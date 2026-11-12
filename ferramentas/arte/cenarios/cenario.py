"""Biblioteca dos cenários: formas low-poly, materiais e o render das camadas.

Cada arena tem um script (`<id>.py`) que usa esta biblioteca para montar a cena do zero e
renderizar as camadas em `public/cenarios/<id>/`. Nada aqui muda a simulação: é só imagem.

Convenções
- A cena é montada em **pixels da camada**: X para a direita, Y para baixo, como na imagem.
  No Blender isso vira X = x e Z = -y; a profundidade (eixo Y do Blender) só serve para dar
  volume às formas e definir quem fica na frente dentro da mesma camada.
- Cada camada é uma coleção. Ao renderizar uma camada, as outras ficam escondidas.
- Câmera ortográfica de frente, do tamanho exato da camada.
- Luz: as mesmas duas direções dos personagens (`render_sprites.py`), para a sombra bater.
- Render reproduzível: Cycles na CPU, semente fixa, sem denoise. Os materiais não usam luz
  indireta (só sol direto + uma luz ambiente fixa do próprio material), então não há ruído.

Escrito para a API do Blender 5.3 (conferida em 2026-11-12 com o módulo bpy 5.3.0).
"""

import json
import math
import pathlib
import random
import sys

import bpy
from mathutils import Vector

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent.parent

# As mesmas direções de luz dos personagens (ferramentas/arte/render_sprites.py).
ROTACAO_DO_SOL = (55, 0, -25)
ROTACAO_DO_RECORTE = (120, 0, 150)


def argumentos():
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    opcoes = {"saida": None, "escala": "1", "amostras": "16", "so": ""}
    for i in range(0, len(resto) - 1, 2):
        opcoes[resto[i].lstrip("-")] = resto[i + 1]
    return opcoes


def cor(hexa):
    """'#rrggbb' -> cor linear (o Blender trabalha em linear; a imagem sai em sRGB)."""
    hexa = hexa.lstrip("#")

    def canal(v):
        v = v / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    return tuple(canal(int(hexa[i : i + 2], 16)) for i in (0, 2, 4))


def misturar(a, b, t):
    """Mistura duas cores '#rrggbb' (t = 0 dá a, t = 1 dá b)."""
    a, b = a.lstrip("#"), b.lstrip("#")
    partes = [round(int(a[i : i + 2], 16) * (1 - t) + int(b[i : i + 2], 16) * t) for i in (0, 2, 4)]
    return "#" + "".join(f"{p:02x}" for p in partes)


class Cenario:
    def __init__(self, arena, semente=1):
        self.arena = arena
        self.sorteio = random.Random(semente)
        self.materiais = {}
        self.camadas = {}
        self.atual = None
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.cena = bpy.context.scene

    # ------------------------------------------------------------------ camadas

    def camada(self, nome, largura, altura, transparente=True):
        """Cria a camada e passa a pôr nela tudo o que for criado em seguida."""
        colecao = bpy.data.collections.new(nome)
        self.cena.collection.children.link(colecao)
        self.camadas[nome] = {
            "colecao": colecao,
            "largura": largura,
            "altura": altura,
            "transparente": transparente,
        }
        self.atual = colecao
        return colecao

    # ---------------------------------------------------------------- materiais

    def mat(self, hexa, ambiente=0.45, luz=1.0, base=0.7):
        """Cor low-poly: sol direto (`luz`) mais uma luz ambiente fixa (`ambiente`).

        Cada peça escurece de cima para baixo até `base` vezes a cor (1 = sem degradê).
        """
        chave = ("mat", hexa, ambiente, luz, base)
        if chave in self.materiais:
            return self.materiais[chave]
        m = bpy.data.materials.new(f"cor_{hexa}_{ambiente}_{luz}")
        m.use_nodes = True
        nos, elos = m.node_tree.nodes, m.node_tree.links
        nos.clear()
        saida = nos.new("ShaderNodeOutputMaterial")
        difuso = nos.new("ShaderNodeBsdfDiffuse")
        c = cor(hexa)
        difuso.inputs["Color"].default_value = (c[0] * luz, c[1] * luz, c[2] * luz, 1)
        emissao = nos.new("ShaderNodeEmission")
        emissao.inputs["Color"].default_value = (*c, 1)
        emissao.inputs["Strength"].default_value = ambiente
        if base < 1:
            # Altura dentro da própria peça (0 embaixo, 1 em cima) -> fator de escurecimento.
            coordenadas = nos.new("ShaderNodeTexCoord")
            separar = nos.new("ShaderNodeSeparateXYZ")
            elos.new(coordenadas.outputs["Generated"], separar.inputs[0])
            fator = nos.new("ShaderNodeMapRange")
            fator.inputs["To Min"].default_value = base
            fator.inputs["To Max"].default_value = 1.0
            elos.new(separar.outputs["Z"], fator.inputs["Value"])
            for no, valor in ((difuso, (c[0] * luz, c[1] * luz, c[2] * luz, 1)), (emissao, (*c, 1))):
                vezes = nos.new("ShaderNodeMixRGB")
                vezes.blend_type = "MULTIPLY"
                vezes.inputs[0].default_value = 1.0
                vezes.inputs[1].default_value = valor
                elos.new(fator.outputs[0], vezes.inputs[2])
                elos.new(vezes.outputs[0], no.inputs["Color"])
        soma = nos.new("ShaderNodeAddShader")
        elos.new(difuso.outputs[0], soma.inputs[0])
        elos.new(emissao.outputs[0], soma.inputs[1])
        elos.new(soma.outputs[0], saida.inputs["Surface"])
        self.materiais[chave] = m
        return m

    def brilho(self, hexa, forca=1.0, alfa=1.0):
        """Cor que não depende da luz (céu, lua, lanterna, névoa). `alfa` < 1 deixa ver o que está atrás."""
        chave = ("brilho", hexa, forca, alfa)
        if chave in self.materiais:
            return self.materiais[chave]
        m = bpy.data.materials.new(f"brilho_{hexa}_{forca}_{alfa}")
        m.use_nodes = True
        nos, elos = m.node_tree.nodes, m.node_tree.links
        nos.clear()
        saida = nos.new("ShaderNodeOutputMaterial")
        emissao = nos.new("ShaderNodeEmission")
        emissao.inputs["Color"].default_value = (*cor(hexa), 1)
        emissao.inputs["Strength"].default_value = forca
        if alfa >= 1:
            elos.new(emissao.outputs[0], saida.inputs["Surface"])
        else:
            vazio = nos.new("ShaderNodeBsdfTransparent")
            mistura = nos.new("ShaderNodeMixShader")
            mistura.inputs[0].default_value = alfa
            elos.new(vazio.outputs[0], mistura.inputs[1])
            elos.new(emissao.outputs[0], mistura.inputs[2])
            elos.new(mistura.outputs[0], saida.inputs["Surface"])
        self.materiais[chave] = m
        return m

    def degrade(self, paradas, y0, y1, alfas=None):
        """Degradê vertical que não depende da luz, entre as alturas y0 (em cima) e y1 (embaixo).

        `paradas` é uma lista de (posição de 0 a 1, '#rrggbb'). Com `alfas` (lista de
        (posição, alfa)), a transparência também varia: serve para névoa que some aos poucos.
        """
        m = bpy.data.materials.new(f"degrade_{len(self.materiais)}")
        self.materiais[("degrade", len(self.materiais))] = m
        m.use_nodes = True
        nos, elos = m.node_tree.nodes, m.node_tree.links
        nos.clear()
        saida = nos.new("ShaderNodeOutputMaterial")
        geometria = nos.new("ShaderNodeNewGeometry")
        separar = nos.new("ShaderNodeSeparateXYZ")
        elos.new(geometria.outputs["Position"], separar.inputs[0])
        # Z do Blender = -y da camada; vira 0 em y0 e 1 em y1.
        faixa = nos.new("ShaderNodeMapRange")
        faixa.inputs["From Min"].default_value = -y0
        faixa.inputs["From Max"].default_value = -y1
        elos.new(separar.outputs["Z"], faixa.inputs["Value"])

        def rampa(pontos, para_cor):
            no = nos.new("ShaderNodeValToRGB")
            elementos = no.color_ramp.elements
            while len(elementos) < len(pontos):
                elementos.new(0.5)
            for elemento, (pos, valor) in zip(elementos, pontos):
                elemento.position = pos
                elemento.color = (*cor(valor), 1) if para_cor else (valor, valor, valor, 1)
            elos.new(faixa.outputs[0], no.inputs[0])
            return no

        emissao = nos.new("ShaderNodeEmission")
        elos.new(rampa(paradas, True).outputs["Color"], emissao.inputs["Color"])
        if alfas is None:
            elos.new(emissao.outputs[0], saida.inputs["Surface"])
        else:
            vazio = nos.new("ShaderNodeBsdfTransparent")
            mistura = nos.new("ShaderNodeMixShader")
            elos.new(rampa(alfas, False).outputs["Color"], mistura.inputs[0])
            elos.new(vazio.outputs[0], mistura.inputs[1])
            elos.new(emissao.outputs[0], mistura.inputs[2])
            elos.new(mistura.outputs[0], saida.inputs["Surface"])
        return m

    # ------------------------------------------------------------------- formas

    def malha(self, nome, vertices, faces, material):
        """Malha a partir de pontos (x, y da camada, profundidade) e faces; sempre de faces lisas."""
        dados = bpy.data.meshes.new(nome)
        dados.from_pydata([(x, p, -y) for (x, y, p) in vertices], [], faces)
        dados.update()
        # Normais para fora, para a luz bater do lado certo.
        import bmesh

        bm = bmesh.new()
        bm.from_mesh(dados)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(dados)
        bm.free()
        dados.materials.append(material)
        objeto = bpy.data.objects.new(nome, dados)
        self.atual.objects.link(objeto)
        return objeto

    def placa(self, nome, pontos, material, profundidade=0.0):
        """Polígono plano de frente para a câmera. `pontos` é a lista de (x, y) do contorno."""
        vertices = [(x, y, profundidade) for (x, y) in pontos]
        return self.malha(nome, vertices, [tuple(range(len(pontos)))], material)

    def retangulo(self, nome, x0, y0, x1, y1, material, profundidade=0.0):
        return self.placa(nome, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], material, profundidade)

    def disco(self, nome, cx, cy, raio, material, lados=12, profundidade=0.0, giro=0.0):
        pontos = [
            (
                cx + raio * math.cos(giro + 2 * math.pi * i / lados),
                cy + raio * math.sin(giro + 2 * math.pi * i / lados),
            )
            for i in range(lados)
        ]
        return self.placa(nome, pontos, material, profundidade)

    def caixa(self, nome, x0, y0, x1, y1, material, frente=-20.0, fundo=20.0, chanfro=0.0):
        """Bloco. Com `chanfro`, a face da frente é menor que a de trás e as bordas pegam luz diferente."""
        c = chanfro
        v = [
            (x0 + c, y0 + c, frente),
            (x1 - c, y0 + c, frente),
            (x1 - c, y1 - c, frente),
            (x0 + c, y1 - c, frente),
            (x0, y0, frente + c),
            (x1, y0, frente + c),
            (x1, y1, frente + c),
            (x0, y1, frente + c),
            (x0, y0, fundo),
            (x1, y0, fundo),
            (x1, y1, fundo),
            (x0, y1, fundo),
        ]
        f = [
            (0, 1, 2, 3),
            (0, 4, 5, 1),
            (1, 5, 6, 2),
            (2, 6, 7, 3),
            (3, 7, 4, 0),
            (4, 8, 9, 5),
            (5, 9, 10, 6),
            (6, 10, 11, 7),
            (7, 11, 8, 4),
        ]
        return self.malha(nome, v, f, material)

    def telhado(self, nome, x0, x1, y_beiral, y_cumeeira, material, avanco=40.0, levanta=0.0, recuo=0.25):
        """Telhado de quatro águas visto de frente; `levanta` ergue as pontas do beiral."""
        largura = x1 - x0
        xa, xb = x0 + largura * recuo, x1 - largura * recuo
        v = [
            (x0, y_beiral - levanta, -avanco),
            ((x0 + x1) / 2, y_beiral, -avanco * 1.1),
            (x1, y_beiral - levanta, -avanco),
            (xb, y_cumeeira, 0),
            (xa, y_cumeeira, 0),
            (x0, y_beiral - levanta, avanco),
            (x1, y_beiral - levanta, avanco),
        ]
        f = [(0, 1, 4), (1, 3, 4), (1, 2, 3), (2, 6, 3), (0, 4, 5)]
        return self.malha(nome, v, f, material)

    def cone(self, nome, cx, y_base, y_topo, raio, material, lados=6, torto=0.0, giro=0.3):
        """Cone low-poly (árvore, pico). `torto` desloca o topo para o lado."""
        v = [(cx + torto, y_topo, 0)]
        for i in range(lados):
            a = giro + 2 * math.pi * i / lados
            v.append((cx + raio * math.cos(a), y_base, raio * 0.6 * math.sin(a)))
        f = [(0, 1 + i, 1 + (i + 1) % lados) for i in range(lados)]
        return self.malha(nome, v, f, material)

    def cilindro(self, nome, cx, y_topo, y_base, r_topo, r_base, material, lados=8, inclina=0.0, profundidade=0.0, giro=0.39):
        """Coluna facetada em pé. `inclina` desloca o topo para o lado."""
        v = []
        for y, r, dx in ((y_topo, r_topo, inclina), (y_base, r_base, 0.0)):
            for i in range(lados):
                a = giro + 2 * math.pi * i / lados
                v.append((cx + dx + r * math.cos(a), y, profundidade + r * math.sin(a)))
        f = [(i, (i + 1) % lados, lados + (i + 1) % lados, lados + i) for i in range(lados)]
        f.append(tuple(range(lados)))
        return self.malha(nome, v, f, material)

    def bolha(self, nome, cx, cy, rx, ry, material, profundidade=0.0, torto=0.18, detalhe=1):
        """Volume arredondado e facetado (copa de árvore, arbusto, pedra)."""
        import bmesh

        s = self.sorteio
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=detalhe, radius=1.0)
        for vert in bm.verts:
            k = 1 + s.uniform(-torto, torto)
            vert.co = Vector((cx + vert.co.x * rx * k, profundidade + vert.co.y * min(rx, ry) * 0.7 * k, -cy + vert.co.z * ry * k))
        dados = bpy.data.meshes.new(nome)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(dados)
        bm.free()
        dados.materials.append(material)
        objeto = bpy.data.objects.new(nome, dados)
        self.atual.objects.link(objeto)
        return objeto

    def telhado_curvo(self, nome, x0, x1, y_beiral, y_cumeeira, material, material_telha=None, avanco=60.0, levanta=26.0, trechos=14, recuo=0.08, costelas=0):
        """Telhado comprido visto de frente, com as pontas do beiral erguidas, feito em trechos facetados."""
        v, f = [], []
        for i in range(trechos + 1):
            t = i / trechos
            curva = (2 * t - 1) ** 2  # 0 no meio, 1 nas pontas
            x_beiral = x0 + (x1 - x0) * t
            x_cume = x0 + (x1 - x0) * (recuo + (1 - 2 * recuo) * t)
            v.append((x_beiral, y_beiral - levanta * curva**1.5, -avanco))
            v.append((x_cume, y_cumeeira - levanta * 0.35 * curva, 0))
            v.append((x_beiral, y_beiral - levanta * curva**1.5 + 9, -avanco + 4))  # espessura do beiral
        for i in range(trechos):
            a, b = i * 3, (i + 1) * 3
            f.append((a, b, b + 1, a + 1))
            f.append((a + 2, b + 2, b, a))
        objeto = self.malha(nome, v, f, material)
        if costelas and material_telha is not None:
            for k in range(1, costelas):
                t = k / costelas
                curva = (2 * t - 1) ** 2
                xb = x0 + (x1 - x0) * t
                xc = x0 + (x1 - x0) * (recuo + (1 - 2 * recuo) * t)
                yb = y_beiral - levanta * curva**1.5
                yc = y_cumeeira - levanta * 0.35 * curva
                self.malha(
                    f"{nome}_costela{k}",
                    [(xb - 2.5, yb + 2, -avanco - 3), (xb + 2.5, yb + 2, -avanco - 3), (xc + 2, yc, -3), (xc - 2, yc, -3)],
                    [(0, 1, 2, 3)],
                    material_telha,
                )
        return objeto

    def montanha(self, nome, cx, y_pico, largura, y_base, material, lados=7, neve=None, y_fundo=None):
        """Montanha facetada: pico, dois anéis irregulares de encosta e a base. Só a metade da frente."""
        s = self.sorteio
        altura = y_base - y_pico
        pico = (cx + s.uniform(-0.05, 0.05) * largura, y_pico, 0)
        ombros, meio, base = [], [], []
        for i in range(lados + 1):
            t = i / lados
            a = math.pi * t  # da esquerda para a direita, passando pela frente
            x = -math.cos(a)
            p = -math.sin(a)
            r_ombro = 0.15 + s.uniform(-0.04, 0.06)
            r_meio = 0.33 + s.uniform(-0.05, 0.05)
            ombros.append((cx + x * largura * r_ombro, y_pico + altura * (0.3 + s.uniform(-0.08, 0.1)), p * largura * r_ombro))
            meio.append((cx + x * largura * r_meio, y_pico + altura * (0.66 + s.uniform(-0.07, 0.07)), p * largura * r_meio * 0.9))
            base.append((cx + x * largura * 0.5, y_base, p * largura * 0.3))
        v = [pico] + ombros + meio + base
        n = lados + 1
        f = []
        for i in range(lados):
            f.append((0, 1 + i, 2 + i))
            f.append((1 + i, 1 + n + i, 2 + n + i, 2 + i))
            f.append((1 + n + i, 1 + 2 * n + i, 2 + 2 * n + i, 2 + n + i))
        objeto = self.malha(nome, v, f, material)
        if y_fundo is not None and y_fundo > y_base:
            self.retangulo(nome + "_pe", cx - largura * 0.5, y_base - 1, cx + largura * 0.5, y_fundo, material, 0.0)
        if neve is not None:
            # A neve é o mesmo pico, um pouco para a frente, cortado no primeiro terço.
            corte = 0.62
            vn = [pico]
            for o in ombros:
                vn.append(tuple(pico[k] + (o[k] - pico[k]) * corte + (-0.5 if k == 2 else 0) for k in range(3)))
            fn = [(0, 1 + i, 2 + i) for i in range(lados)]
            self.malha(nome + "_neve", vn, fn, neve)
        return objeto

    def pinheiro(self, nome, cx, y_base, altura, material_copa, material_tronco, largura=None):
        """Pinheiro de três cones empilhados."""
        s = self.sorteio
        largura = largura or altura * 0.36
        self.retangulo(nome + "_tronco", cx - altura * 0.025, y_base - altura * 0.3, cx + altura * 0.025, y_base, material_tronco, 4)
        for i, (base, topo, r) in enumerate(((0.12, 0.58, 1.0), (0.36, 0.8, 0.78), (0.6, 1.0, 0.54))):
            self.cone(
                f"{nome}_copa{i}",
                cx + s.uniform(-0.02, 0.02) * altura,
                y_base - altura * base,
                y_base - altura * topo,
                largura * r,
                material_copa,
                lados=6,
                giro=s.uniform(0, 1),
            )

    # ------------------------------------------------------------------- render

    def _preparar(self, amostras):
        cena = self.cena
        r = cena.render
        r.engine = "CYCLES"
        r.resolution_percentage = 100
        r.image_settings.file_format = "PNG"
        r.image_settings.color_depth = "8"
        r.image_settings.compression = 100
        # Sem pontilhado: ele é ruído, e ruído deixa o PNG várias vezes mais pesado.
        r.dither_intensity = 0.0
        # Sem data, hora e tempo de render gravados no arquivo: o mesmo script dá o mesmo PNG, byte a byte.
        for carimbo in ("date", "time", "render_time", "frame", "frame_range", "camera", "scene", "filename", "hostname", "memory", "lens", "marker", "sequencer_strip", "note"):
            if hasattr(r, f"use_stamp_{carimbo}"):
                setattr(r, f"use_stamp_{carimbo}", False)
        cena.view_settings.view_transform = "Standard"
        cena.cycles.samples = amostras
        cena.cycles.device = "CPU"
        cena.cycles.use_denoising = False
        cena.cycles.use_adaptive_sampling = False
        cena.cycles.seed = 0
        cena.cycles.use_animated_seed = False
        # Só luz direta: sem rebatidas não há ruído, e a imagem sai igual em qualquer máquina.
        cena.cycles.max_bounces = 0
        cena.cycles.diffuse_bounces = 0
        cena.cycles.glossy_bounces = 0
        cena.cycles.transmission_bounces = 0
        cena.cycles.transparent_max_bounces = 16
        cena.cycles.filter_width = 1.2

        mundo = bpy.data.worlds.new("mundo")
        mundo.use_nodes = True
        fundo = mundo.node_tree.nodes.get("Background")
        fundo.inputs[0].default_value = (0, 0, 0, 1)
        fundo.inputs[1].default_value = 0.0
        cena.world = mundo

        def sol(nome, energia, rotacao, tom):
            dados = bpy.data.lights.new(nome, "SUN")
            dados.energy = energia
            dados.color = tom
            dados.angle = 0.0  # sombra dura: sem ruído na borda
            luz = bpy.data.objects.new(nome, dados)
            luz.rotation_euler = tuple(math.radians(g) for g in rotacao)
            cena.collection.objects.link(luz)

        sol("luz_principal", 3.2, ROTACAO_DO_SOL, self.tom_do_sol)
        sol("luz_de_recorte", 1.4, ROTACAO_DO_RECORTE, self.tom_do_recorte)

        dados_camera = bpy.data.cameras.new("camera")
        dados_camera.type = "ORTHO"
        dados_camera.clip_start = 1
        dados_camera.clip_end = 20000
        camera = bpy.data.objects.new("camera", dados_camera)
        camera.rotation_euler = (math.radians(90), 0, 0)
        cena.collection.objects.link(camera)
        cena.camera = camera
        return camera

    tom_do_sol = (1.0, 1.0, 1.0)
    tom_do_recorte = (1.0, 1.0, 1.0)

    def renderizar(self, extras=None):
        """Renderiza todas as camadas em `public/cenarios/<arena>/` e grava `cenario.json`."""
        opcoes = argumentos()
        escala = float(opcoes["escala"])
        so = [n for n in opcoes["so"].split(",") if n]
        saida = pathlib.Path(opcoes["saida"] or RAIZ / "public" / "cenarios" / self.arena)
        saida.mkdir(parents=True, exist_ok=True)
        camera = self._preparar(int(opcoes["amostras"]))
        r = self.cena.render

        for nome, c in self.camadas.items():
            if so and nome not in so:
                continue
            for outro, d in self.camadas.items():
                d["colecao"].hide_render = outro != nome
            largura, altura = c["largura"], c["altura"]
            r.resolution_x = round(largura * escala)
            r.resolution_y = round(altura * escala)
            r.film_transparent = c["transparente"]
            r.image_settings.color_mode = "RGBA" if c["transparente"] else "RGB"
            # ortho_scale vale para o lado maior da imagem.
            camera.data.ortho_scale = max(largura, altura)
            camera.location = Vector((largura / 2, -5000, -altura / 2))
            r.filepath = str(saida / f"{nome}.png")
            bpy.ops.render.render(write_still=True)
            print(f"{self.arena}/{nome}.png  {r.resolution_x}x{r.resolution_y}")

        if not so and escala == 1:
            dados = {
                "arena": self.arena,
                "blender": bpy.app.version_string,
                "camadas": {n: {"largura": c["largura"], "altura": c["altura"]} for n, c in self.camadas.items()},
            }
            dados.update(extras or {})
            (saida / "cenario.json").write_text(json.dumps(dados, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
