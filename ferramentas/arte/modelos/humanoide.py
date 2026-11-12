"""Biblioteca para construir personagens humanoides low-poly por script, no Blender.

Cada personagem é um arquivo em `ferramentas/arte/modelos/` que usa esta biblioteca para montar
o corpo com formas simples, prender cada peça a um osso e gravar as 9 ações que o pipeline exige.
Tudo é original: não usa modelos, texturas nem animações de terceiros.

Convenções (as mesmas de `arte/LEIA-ME.md`):
  - o personagem olha para +X, fica em pé no chão (Z = 0) e tem até ~2 unidades de altura;
  - Y é a profundidade: o lado "da frente" (mais perto da câmera) é Y negativo;
  - nas poses, os ângulos são em graus, no plano lateral:
      braço e coxa: 0 = para baixo, positivo = para a frente, 180 = para cima;
      antebraço: positivo dobra o cotovelo para a frente; canela: negativo dobra o joelho;
      tronco e cabeça: positivo inclina para a frente;
      "raiz": (giro do corpo inteiro, subida) — giro negativo cai para trás;
      "arma": "mao" ou "costas" (onde a arma aparece); "arma_mao": giro da arma na mão.

Escrito para a API do Blender 5.3.
"""

import math
import pathlib
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

OCULTO = 0.001


def argumento(nome, padrao):
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return resto[resto.index(nome) + 1] if nome in resto else padrao


class Humanoide:
    def __init__(self, tamanho=1.0, corpulencia=1.0):
        """`tamanho` escala o personagem inteiro; `corpulencia` engrossa tronco e membros."""
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.cena = bpy.context.scene
        self.t = tamanho
        self.g = corpulencia
        self.materiais = {}
        self.arma_padrao = "mao"
        self._esqueleto()

    # ---------- esqueleto ----------
    def _esqueleto(self):
        t = self.t
        dados = bpy.data.armatures.new("esqueleto")
        self.esqueleto = bpy.data.objects.new("esqueleto", dados)
        self.cena.collection.objects.link(self.esqueleto)
        bpy.context.view_layer.objects.active = self.esqueleto
        bpy.ops.object.mode_set(mode="EDIT")
        ombro = 0.21 * self.g
        quadril = 0.1 * self.g
        ossos = {
            "raiz": ((0, 0, 0.9), (0, 0, 1.0), None),
            "tronco": ((0, 0, 0.9), (0, 0, 1.32), "raiz"),
            "cabeca": ((0, 0, 1.32), (0, 0, 1.78), "tronco"),
            "braco_f": ((0, -ombro, 1.27), (0, -ombro, 1.0), "tronco"),
            "ante_f": ((0, -ombro, 1.0), (0, -ombro, 0.74), "braco_f"),
            "braco_t": ((0, ombro, 1.27), (0, ombro, 1.0), "tronco"),
            "ante_t": ((0, ombro, 1.0), (0, ombro, 0.74), "braco_t"),
            "coxa_f": ((0, -quadril, 0.9), (0, -quadril, 0.48), "raiz"),
            "canela_f": ((0, -quadril, 0.48), (0, -quadril, 0.06), "coxa_f"),
            "coxa_t": ((0, quadril, 0.9), (0, quadril, 0.48), "raiz"),
            "canela_t": ((0, quadril, 0.48), (0, quadril, 0.06), "coxa_t"),
            # A arma na mão aponta para a frente quando o braço está para baixo.
            "arma_mao": ((0.02, -ombro, 0.72), (0.3, -ombro, 0.72), "ante_f"),
            "arma_costas": ((-0.16, 0, 1.2), (-0.16, 0, 1.5), "tronco"),
        }
        for nome, (cabeca, cauda, pai) in ossos.items():
            osso = dados.edit_bones.new(nome)
            osso.head = Vector(cabeca) * t
            osso.tail = Vector(cauda) * t
            osso.roll = 0.0
            if pai:
                osso.parent = dados.edit_bones[pai]
        bpy.ops.object.mode_set(mode="OBJECT")
        self.ombro = ombro
        self.quadril = quadril
        self.esqueleto.animation_data_create()
        for osso in self.esqueleto.pose.bones:
            osso.rotation_mode = "XYZ"
        self._descobrir_sinais()

    def _descobrir_sinais(self):
        """Descobre, para cada osso, em que eixo local e com que sinal um ângulo positivo
        gira o osso no plano lateral "para a frente" (ou "para cima", nos ossos horizontais)."""
        self.eixo = {}
        self.sinal = {}
        mundo = self.esqueleto.matrix_world
        for osso in self.esqueleto.pose.bones:
            bpy.context.view_layer.update()
            antes = mundo @ osso.tail.copy()
            base = mundo @ osso.head.copy()
            horizontal = abs((antes - base).x) > abs((antes - base).z)
            for eixo in (2, 0):
                giro = [0.0, 0.0, 0.0]
                giro[eixo] = 0.2
                osso.rotation_euler = giro
                bpy.context.view_layer.update()
                depois = mundo @ osso.tail.copy()
                osso.rotation_euler = (0.0, 0.0, 0.0)
                # O eixo certo é o que não tira a ponta do osso do plano lateral (Y não muda).
                if abs(depois.y - antes.y) < 1e-4:
                    delta = (depois.z - antes.z) if horizontal else (depois.x - antes.x)
                    self.eixo[osso.name] = eixo
                    self.sinal[osso.name] = 1.0 if delta > 0 else -1.0
                    break
            else:
                raise RuntimeError(f"osso {osso.name}: nenhum eixo gira no plano lateral")
        bpy.context.view_layer.update()

    # ---------- materiais e peças ----------
    def mat(self, nome, cor, brilho=0.0, aspereza=0.8):
        if nome in self.materiais:
            return self.materiais[nome]
        m = bpy.data.materials.new(nome)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*cor, 1.0)
        bsdf.inputs["Roughness"].default_value = aspereza
        if brilho > 0:
            bsdf.inputs["Emission Color"].default_value = (*cor, 1.0)
            bsdf.inputs["Emission Strength"].default_value = brilho
        self.materiais[nome] = m
        return m

    def _prender(self, nome, bm, mat, osso):
        malha = bpy.data.meshes.new(nome)
        bm.to_mesh(malha)
        bm.free()
        malha.materials.append(mat)
        obj = bpy.data.objects.new(nome, malha)
        self.cena.collection.objects.link(obj)
        obj.parent = self.esqueleto
        obj.parent_type = "BONE"
        obj.parent_bone = osso
        bpy.context.view_layer.update()
        # Os vértices já estão em coordenadas do mundo: o objeto fica na origem.
        obj.matrix_world = Matrix.Identity(4)
        return obj

    def caixa(self, nome, osso, centro, tamanho, mat, chanfro=0.035, giro=0.0):
        """Caixa de cantos chanfrados. `giro` (graus) inclina no plano lateral."""
        t = self.t
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(tamanho) * t, verts=bm.verts)
        if chanfro > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=chanfro * t, segments=2, affect="EDGES")
        if giro:
            bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-giro), 3, "Y"), verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(centro) * t, verts=bm.verts)
        return self._prender(nome, bm, mat, osso)

    def esfera(self, nome, osso, centro, raio, mat, escala=(1, 1, 1)):
        t = self.t
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=raio * t)
        bmesh.ops.scale(bm, vec=Vector(escala), verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(centro) * t, verts=bm.verts)
        return self._prender(nome, bm, mat, osso)

    def tubo(self, nome, osso, de, ate, raio_de, raio_ate, mat, lados=8):
        """Tronco de cone entre dois pontos (membros, cabos, lâminas redondas)."""
        t = self.t
        a = Vector(de) * t
        b = Vector(ate) * t
        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=lados, radius1=raio_de * t, radius2=raio_ate * t, depth=(b - a).length
        )
        orientar = (b - a).to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ orientar, verts=bm.verts)
        return self._prender(nome, bm, mat, osso)

    # ---------- corpo padrão ----------
    def corpo(self, pele, camisa, calca, sapato, manga=None, cabeca=0.23):
        """Tronco, cabeça, braços e pernas. Devolve nada; os acessórios vêm depois."""
        g = self.g
        o = self.ombro
        q = self.quadril
        manga = manga or camisa
        self.caixa("tronco", "tronco", (0, 0, 1.1), (0.3 * g, 0.36 * g, 0.44), camisa, chanfro=0.07)
        self.caixa("bacia", "raiz", (0, 0, 0.9), (0.27 * g, 0.32 * g, 0.16), calca, chanfro=0.05)
        self.esfera("cabeca", "cabeca", (0.02, 0, 1.32 + cabeca), cabeca, pele, escala=(1, 0.95, 1))
        self.caixa("pescoco", "cabeca", (0, 0, 1.33), (0.1, 0.1, 0.08), pele, chanfro=0.02)
        for lado, y in (("f", -o), ("t", o)):
            self.esfera(f"ombro_{lado}", f"braco_{lado}", (0, y, 1.26), 0.085 * g, manga)
            self.tubo(f"braco_{lado}", f"braco_{lado}", (0, y, 1.26), (0, y, 1.0), 0.075 * g, 0.062 * g, manga)
            self.esfera(f"cotovelo_{lado}", f"ante_{lado}", (0, y, 1.0), 0.064 * g, manga)
            self.tubo(f"ante_{lado}", f"ante_{lado}", (0, y, 1.0), (0, y, 0.76), 0.06 * g, 0.05 * g, manga)
            self.esfera(f"mao_{lado}", f"ante_{lado}", (0.01, y, 0.72), 0.068, pele)
        for lado, y in (("f", -q), ("t", q)):
            self.tubo(f"coxa_{lado}", f"coxa_{lado}", (0, y, 0.9), (0, y, 0.48), 0.1 * g, 0.08 * g, calca)
            self.esfera(f"joelho_{lado}", f"canela_{lado}", (0, y, 0.48), 0.08 * g, calca)
            self.tubo(f"canela_{lado}", f"canela_{lado}", (0, y, 0.48), (0, y, 0.1), 0.075 * g, 0.06 * g, calca)
            self.caixa(f"pe_{lado}", f"canela_{lado}", (0.05, y, 0.05), (0.24, 0.12, 0.1), sapato, chanfro=0.03)

    def rosto(self, olho, cabeca=0.23, sobrancelha=None):
        """Olhos na frente da cabeça (de lado só um aparece inteiro)."""
        z = 1.32 + cabeca + 0.02
        for y in (-0.085, 0.085):
            self.esfera(f"olho_{y}", "cabeca", (0.02 + cabeca * 0.86, y, z), 0.036, olho, escala=(0.6, 1, 1.25))
        if sobrancelha:
            self.caixa("sobrancelha", "cabeca", (0.02 + cabeca * 0.84, -0.085, z + 0.075), (0.03, 0.09, 0.022), sobrancelha, chanfro=0.0, giro=-12)

    # ---------- ações ----------
    def acao(self, nome, quadros):
        """quadros: {numero: {osso ou "raiz"/"arma": valor}}. O que não aparece fica em 0."""
        a = bpy.data.actions.new(nome)
        a.use_fake_user = True
        self.esqueleto.animation_data.action = a
        arma_antes = None
        for numero, pose in sorted(quadros.items()):
            arma = pose.get("arma", self.arma_padrao)
            for osso in self.esqueleto.pose.bones:
                valor = pose.get(osso.name, 0)
                giro, subida = valor if isinstance(valor, tuple) else (valor, 0.0)
                euler = [0.0, 0.0, 0.0]
                euler[self.eixo[osso.name]] = math.radians(giro) * self.sinal[osso.name]
                osso.rotation_euler = euler
                osso.keyframe_insert("rotation_euler", frame=numero)
                if osso.name == "raiz":
                    osso.location = (0.0, subida * self.t, 0.0)
                    osso.keyframe_insert("location", frame=numero)
                if osso.name in ("arma_mao", "arma_costas"):
                    visivel = arma == ("mao" if osso.name == "arma_mao" else "costas")
                    antes = arma_antes == ("mao" if osso.name == "arma_mao" else "costas")
                    if arma_antes is not None and visivel != antes:
                        # Troca seca: mantém o estado antigo até um instante antes deste quadro.
                        osso.scale = (1, 1, 1) if antes else (OCULTO,) * 3
                        osso.keyframe_insert("scale", frame=numero - 0.05)
                    osso.scale = (1, 1, 1) if visivel else (OCULTO,) * 3
                    osso.keyframe_insert("scale", frame=numero)
            arma_antes = arma
        return a

    @staticmethod
    def ciclo(passos, intervalo=4):
        """Laço: repete o primeiro passo no fim, em quadros igualmente espaçados."""
        quadros = {1 + i * intervalo: p for i, p in enumerate(passos)}
        quadros[1 + len(passos) * intervalo] = passos[0]
        return quadros

    def acoes_basicas(self, arma="mao", guarda=None):
        """As sete ações comuns a todo humanoide. `atacar` e `habilidade` são de cada personagem."""
        g = guarda or {"braco_f": 12, "ante_f": 35, "braco_t": -8, "ante_t": 25}
        A = {"arma": arma}

        def p(**k):
            return {**A, **k}

        self.acao(
            "parado",
            self.ciclo(
                [
                    p(tronco=2, coxa_f=6, canela_f=-10, coxa_t=-6, canela_t=-8, **g),
                    p(tronco=3, coxa_f=7, canela_f=-13, coxa_t=-6, canela_t=-11, raiz=(0, -0.012), **g),
                    p(tronco=4, coxa_f=8, canela_f=-16, coxa_t=-6, canela_t=-14, raiz=(0, -0.024), **g),
                    p(tronco=3, coxa_f=7, canela_f=-13, coxa_t=-6, canela_t=-11, raiz=(0, -0.012), **g),
                ]
            ),
        )
        passo = [
            # (coxa, canela) da perna que vai à frente, e da outra; subida do corpo
            ((30, -8), (-26, -16), -0.03),
            ((20, -26), (-16, -44), -0.05),
            ((2, -8), (16, -66), 0.0),
            ((-14, -4), (32, -40), 0.02),
        ]
        andar = []
        for (frente, tras, sobe), espelho in [(x, False) for x in passo] + [(x, True) for x in passo]:
            a, b = (tras, frente) if espelho else (frente, tras)
            balanco = (b[0] - a[0]) * 0.45  # o braço acompanha a perna oposta
            andar.append(
                p(
                    coxa_f=a[0], canela_f=a[1], coxa_t=b[0], canela_t=b[1], tronco=7, raiz=(0, sobe),
                    braco_f=balanco, ante_f=30, braco_t=-balanco, ante_t=30,
                )
            )
        self.acao("andar", self.ciclo(andar))
        self.acao(
            "pular",
            {
                1: p(tronco=16, coxa_f=42, canela_f=-78, coxa_t=38, canela_t=-74, braco_f=-35, ante_f=20, braco_t=-30, ante_t=20, raiz=(0, -0.2)),
                5: p(tronco=4, coxa_f=4, canela_f=-6, coxa_t=-8, canela_t=-8, braco_f=120, ante_f=20, braco_t=105, ante_t=20, raiz=(0, 0.03)),
                9: p(tronco=-2, coxa_f=38, canela_f=-58, coxa_t=6, canela_t=-30, braco_f=150, ante_f=25, braco_t=135, ante_t=25, raiz=(0, 0.05)),
                13: p(tronco=-4, coxa_f=52, canela_f=-74, coxa_t=14, canela_t=-40, braco_f=160, ante_f=30, braco_t=145, ante_t=30, raiz=(0, 0.05)),
            },
        )
        self.acao(
            "cair",
            self.ciclo(
                [
                    p(tronco=8, coxa_f=26, canela_f=-36, coxa_t=-10, canela_t=-48, braco_f=150, ante_f=25, braco_t=125, ante_t=30),
                    p(tronco=10, coxa_f=16, canela_f=-48, coxa_t=-2, canela_t=-36, braco_f=165, ante_f=15, braco_t=112, ante_t=40),
                ]
            ),
        )
        self.acao(
            "atingido",
            {
                1: p(raiz=(-6, 0), tronco=-10, cabeca=-14, braco_f=40, ante_f=50, braco_t=55, ante_t=45, coxa_f=10, canela_f=-14),
                4: p(raiz=(-14, -0.03), tronco=-22, cabeca=-26, braco_f=85, ante_f=60, braco_t=100, ante_t=50, coxa_f=24, canela_f=-30, coxa_t=-8, canela_t=-20),
                7: p(raiz=(-8, -0.02), tronco=-12, cabeca=-10, braco_f=50, ante_f=45, braco_t=60, ante_t=40, coxa_f=14, canela_f=-18),
            },
        )
        voando = []
        for i, giro in enumerate((-20, -110, -200, -290)):
            par = i % 2 == 0
            voando.append(
                p(
                    raiz=(giro, 0.12), cabeca=-18, tronco=-8,
                    braco_f=130 if par else 155, ante_f=30, braco_t=150 if par else 110, ante_t=35,
                    coxa_f=38 if par else 12, canela_f=-50, coxa_t=-16 if par else 30, canela_t=-40,
                )
            )
        self.acao("arremessado", self.ciclo(voando))
        self.acao(
            "nocaute",
            {
                1: p(raiz=(-8, 0), tronco=-14, cabeca=-18, braco_f=70, ante_f=40, braco_t=85, ante_t=40),
                4: p(raiz=(-28, -0.06), tronco=-18, cabeca=-22, braco_f=105, ante_f=35, braco_t=118, ante_t=35, coxa_f=26, canela_f=-30),
                7: p(raiz=(-55, -0.24), tronco=-14, cabeca=-18, braco_f=125, ante_f=25, braco_t=135, ante_t=25, coxa_f=30, canela_f=-26, coxa_t=8),
                10: p(raiz=(-80, -0.52), tronco=-8, cabeca=-8, braco_f=140, ante_f=15, braco_t=150, ante_t=15, coxa_f=18, canela_f=-14),
                13: p(raiz=(-90, -0.7), tronco=-2, braco_f=150, ante_f=10, braco_t=160, ante_t=10, coxa_f=8, canela_f=-6),
                16: p(raiz=(-90, -0.73), braco_f=155, ante_f=8, braco_t=165, ante_t=8, coxa_f=4),
            },
        )

    def salvar(self, padrao):
        saida = pathlib.Path(argumento("--saida", padrao)).resolve()
        saida.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(saida))
        print("salvo:", saida)
