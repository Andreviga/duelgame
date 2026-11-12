"""Renderiza os quadros de um personagem como sprites 2D.

Uso (com o Blender em segundo plano):
    blender -b arte/fontes/lamina.blend -P ferramentas/arte/render_sprites.py -- --id lamina --saida arte/quadros/lamina

O que o .blend precisa ter:
  - o personagem virado para +X (a direita da tela), em pé no chão (Z = 0), com a origem entre os pés;
  - um esqueleto (armature) e uma ação por animação, com o nome exato da animação
    (parado, andar, pular, cair, atacar, habilidade, atingido, arremessado, nocaute);
  - até 2 unidades de altura (o quadro mostra de -0,42 a 2,58 na vertical e 1,5 para cada lado,
    com folga para armas e saltos).

O que este script impõe, igual para todos os personagens: câmera lateral ortográfica, mesma luz,
mesmo enquadramento, pés na mesma linha de base, fundo transparente e tamanho do quadro.
Câmeras e luzes que vierem no arquivo são ignoradas.

Escrito para a API do Blender 5.3 (conferida em 2026-11-11 com o módulo bpy 5.3.0).
"""

import json
import math
import pathlib
import sys

import bpy

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
ESPEC = json.loads((RAIZ / "src" / "dados" / "animacoes.json").read_text(encoding="utf-8"))

# Enquadramento fixo: o quadro cobre ALTURA_DO_QUADRO unidades do mundo, e a linha dos pés
# fica na fração `linhaDeBase` da altura do quadro, contada de cima.
ALTURA_DO_QUADRO = 3.0


def argumentos():
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    opcoes = {"id": None, "saida": None, "motor": "CYCLES", "amostras": "24"}
    for i in range(0, len(resto) - 1, 2):
        opcoes[resto[i].lstrip("-")] = resto[i + 1]
    if not opcoes["id"] or not opcoes["saida"]:
        raise SystemExit("uso: ... -- --id <personagem> --saida <pasta>")
    return opcoes


def preparar_cena(cena, opcoes):
    quadro = ESPEC["quadro"]
    r = cena.render
    r.engine = opcoes["motor"]
    r.resolution_x = quadro
    r.resolution_y = quadro
    r.resolution_percentage = 100
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    cena.view_settings.view_transform = "Standard"
    if opcoes["motor"] == "CYCLES":
        cena.cycles.samples = int(opcoes["amostras"])
        cena.cycles.device = "CPU"
        cena.cycles.use_denoising = False
        # Mesma semente em todo quadro: o mesmo .blend gera sempre os mesmos arquivos.
        cena.cycles.seed = 0
        cena.cycles.use_animated_seed = False

    # Câmeras e luzes do arquivo saem; entram as do padrão.
    for obj in list(cena.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    dados_camera = bpy.data.cameras.new("camera_padrao")
    dados_camera.type = "ORTHO"
    dados_camera.ortho_scale = ALTURA_DO_QUADRO
    camera = bpy.data.objects.new("camera_padrao", dados_camera)
    # Olhando de -Y para +Y: +X fica à direita da tela e +Z para cima.
    centro_z = ALTURA_DO_QUADRO * (ESPEC["linhaDeBase"] - 0.5)
    camera.location = (0.0, -10.0, centro_z)
    camera.rotation_euler = (math.radians(90), 0.0, 0.0)
    cena.collection.objects.link(camera)
    cena.camera = camera

    def sol(nome, energia, rotacao):
        dados = bpy.data.lights.new(nome, "SUN")
        dados.energy = energia
        dados.angle = math.radians(8)
        luz = bpy.data.objects.new(nome, dados)
        luz.rotation_euler = tuple(math.radians(g) for g in rotacao)
        cena.collection.objects.link(luz)

    sol("luz_principal", 3.2, (55, 0, -25))
    sol("luz_de_recorte", 1.4, (120, 0, 150))

    mundo = cena.world or bpy.data.worlds.new("mundo_padrao")
    cena.world = mundo
    mundo.use_nodes = True
    fundo = mundo.node_tree.nodes.get("Background")
    if fundo:
        fundo.inputs[0].default_value = (0.75, 0.8, 0.9, 1.0)
        fundo.inputs[1].default_value = 0.55


def usar_acao(objetos, acao):
    for obj in objetos:
        if obj.animation_data is None:
            obj.animation_data_create()
        obj.animation_data.action = acao
        # Do Blender 4.4 em diante a ação tem "slots"; é preciso apontar um.
        if hasattr(obj.animation_data, "action_slot") and len(acao.slots) > 0:
            obj.animation_data.action_slot = acao.slots[0]


def main():
    opcoes = argumentos()
    cena = bpy.context.scene
    preparar_cena(cena, opcoes)
    saida = pathlib.Path(opcoes["saida"])
    saida.mkdir(parents=True, exist_ok=True)
    for antigo in saida.glob("*.png"):
        antigo.unlink()

    esqueletos = [o for o in cena.objects if o.type == "ARMATURE"]
    if not esqueletos:
        raise SystemExit("o arquivo não tem esqueleto (armature)")

    faltando = [a["nome"] for a in ESPEC["animacoes"] if a["nome"] not in bpy.data.actions]
    if faltando:
        raise SystemExit("faltam ações com estes nomes: " + ", ".join(faltando))

    total = 0
    for anim in ESPEC["animacoes"]:
        acao = bpy.data.actions[anim["nome"]]
        usar_acao(esqueletos, acao)
        inicio, fim = acao.frame_range
        n = anim["quadros"]
        for i in range(n):
            # Em laço, o último quadro da ação repete o primeiro: não é amostrado.
            fracao = i / n if anim["laco"] else (i / (n - 1) if n > 1 else 0.0)
            instante = inicio + (fim - inicio) * fracao
            cena.frame_set(int(math.floor(instante)), subframe=instante - math.floor(instante))
            cena.render.filepath = str(saida / f"{anim['nome']}_{i}.png")
            bpy.ops.render.render(write_still=True)
            total += 1

    (saida / "origem.json").write_text(
        json.dumps({"id": opcoes["id"], "blender": bpy.app.version_string, "quadros": total}, indent=2),
        encoding="utf-8",
    )
    print(f"{total} quadros de '{opcoes['id']}' em {saida}")


main()
