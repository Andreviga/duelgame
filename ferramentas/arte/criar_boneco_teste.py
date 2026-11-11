"""Cria um boneco de teste (formas simples + esqueleto + as 9 ações) e salva como .blend.

Serve para provar o pipeline de sprites sem depender de um modelo pronto. NÃO é arte final.

Uso:
    blender -b -P ferramentas/arte/criar_boneco_teste.py -- --saida arte/fontes/boneco-teste.blend
"""

import math
import pathlib
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


def argumento(nome, padrao):
    resto = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return resto[resto.index(nome) + 1] if nome in resto else padrao


bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene


def material(nome, cor):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*cor, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.75
    return m


QUIMONO = material("quimono", (0.72, 0.08, 0.08))
ESCURO = material("escuro", (0.16, 0.04, 0.05))
PELE = material("pele", (0.93, 0.72, 0.55))
ACO = material("aco", (0.82, 0.85, 0.9))
FAIXA = material("faixa", (0.95, 0.85, 0.3))

# ---------- esqueleto ----------
dados = bpy.data.armatures.new("esqueleto")
esqueleto = bpy.data.objects.new("esqueleto", dados)
cena.collection.objects.link(esqueleto)
bpy.context.view_layer.objects.active = esqueleto
bpy.ops.object.mode_set(mode="EDIT")

OSSOS = {
    # nome: (cabeça, cauda, pai)
    "raiz": ((0, 0, 0.85), (0, 0, 1.0), None),
    "tronco": ((0, 0, 0.85), (0, 0, 1.4), "raiz"),
    "cabeca": ((0, 0, 1.4), (0, 0, 1.78), "tronco"),
    "braco_frente": ((0.02, -0.2, 1.36), (0.02, -0.2, 0.8), "tronco"),
    "braco_tras": ((0.02, 0.2, 1.36), (0.02, 0.2, 0.8), "tronco"),
    "perna_frente": ((0, -0.1, 0.85), (0, -0.1, 0.0), "raiz"),
    "perna_tras": ((0, 0.1, 0.85), (0, 0.1, 0.0), "raiz"),
}
for nome, (cabeca, cauda, pai) in OSSOS.items():
    osso = dados.edit_bones.new(nome)
    osso.head = cabeca
    osso.tail = cauda
    osso.roll = 0.0
    if pai:
        osso.parent = dados.edit_bones[pai]
bpy.ops.object.mode_set(mode="OBJECT")


def caixa(nome, centro, tamanho, mat, osso):
    """Uma caixa presa a um osso (acompanha o osso sem deformar)."""
    malha = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(tamanho), verts=bm.verts)
    bm.to_mesh(malha)
    bm.free()
    malha.materials.append(mat)
    obj = bpy.data.objects.new(nome, malha)
    cena.collection.objects.link(obj)
    obj.parent = esqueleto
    obj.parent_type = "BONE"
    obj.parent_bone = osso
    bpy.context.view_layer.update()
    obj.matrix_world = Matrix.Translation(Vector(centro))
    return obj


caixa("tronco", (0, 0, 1.12), (0.34, 0.42, 0.58), QUIMONO, "tronco")
caixa("faixa", (0, 0, 0.9), (0.36, 0.44, 0.1), FAIXA, "tronco")
caixa("cabeca", (0.02, 0, 1.6), (0.32, 0.32, 0.34), PELE, "cabeca")
caixa("cabelo", (-0.03, 0, 1.76), (0.36, 0.34, 0.1), ESCURO, "cabeca")
caixa("olho", (0.17, -0.08, 1.63), (0.04, 0.08, 0.07), ESCURO, "cabeca")
caixa("braco_frente", (0.02, -0.25, 1.08), (0.15, 0.14, 0.56), QUIMONO, "braco_frente")
caixa("mao_frente", (0.02, -0.25, 0.78), (0.13, 0.12, 0.12), PELE, "braco_frente")
# a espada sai da mão da frente, apontando para a frente e para cima
caixa("espada", (0.42, -0.25, 0.86), (0.9, 0.03, 0.09), ACO, "braco_frente")
caixa("cabo", (-0.02, -0.25, 0.8), (0.16, 0.05, 0.06), ESCURO, "braco_frente")
caixa("braco_tras", (0.02, 0.25, 1.08), (0.15, 0.14, 0.56), ESCURO, "braco_tras")
caixa("perna_frente", (0, -0.1, 0.42), (0.19, 0.18, 0.84), QUIMONO, "perna_frente")
caixa("perna_tras", (0, 0.1, 0.42), (0.19, 0.18, 0.84), ESCURO, "perna_tras")

# ---------- ações ----------
esqueleto.animation_data_create()
for osso in esqueleto.pose.bones:
    osso.rotation_mode = "XYZ"

G = math.radians


def acao(nome, quadros):
    """quadros: {numero: {osso: (giro em graus no plano lateral, [subida da raiz])}}"""
    a = bpy.data.actions.new(nome)
    a.use_fake_user = True
    esqueleto.animation_data.action = a
    for numero, poses in sorted(quadros.items()):
        for osso in esqueleto.pose.bones:
            valor = poses.get(osso.name, 0)
            giro, subida = valor if isinstance(valor, tuple) else (valor, 0.0)
            # Com os ossos na vertical, girar no plano lateral (XZ do mundo) é girar em Z local.
            # Convenção dos ângulos: positivo leva o membro para a frente (+X); para o tronco e a
            # cabeça, positivo inclina para a frente. Braço: 0 = para baixo, 90 = à frente, 180 = para cima.
            sinal = 1.0 if osso.name.startswith("perna") else -1.0
            osso.rotation_euler = (0.0, 0.0, G(giro) * sinal)
            osso.location = (0.0, subida, 0.0) if osso.name == "raiz" else (0.0, 0.0, 0.0)
            osso.keyframe_insert("rotation_euler", frame=numero)
            if osso.name == "raiz":
                osso.keyframe_insert("location", frame=numero)
    return a


def ciclo(passos):
    """Laço: repete o primeiro passo no fim, em quadros igualmente espaçados de 4 em 4."""
    quadros = {1 + i * 4: p for i, p in enumerate(passos)}
    quadros[1 + len(passos) * 4] = passos[0]
    return quadros


acao(
    "parado",
    ciclo(
        [
            {"tronco": 0, "braco_frente": -12, "braco_tras": 4},
            {"tronco": 2, "braco_frente": -15, "braco_tras": 6, "raiz": (0, -0.015)},
            {"tronco": 3, "braco_frente": -17, "braco_tras": 8, "raiz": (0, -0.03)},
            {"tronco": 2, "braco_frente": -15, "braco_tras": 6, "raiz": (0, -0.015)},
        ]
    ),
)
acao(
    "andar",
    ciclo(
        [
            {"perna_frente": 32, "perna_tras": -30, "braco_frente": 22, "braco_tras": -26, "tronco": 5},
            {"perna_frente": 16, "perna_tras": -12, "braco_frente": 8, "braco_tras": -12, "tronco": 6, "raiz": (0, 0.04)},
            {"perna_frente": -6, "perna_tras": 8, "braco_frente": -8, "braco_tras": 6, "tronco": 5, "raiz": (0, 0.06)},
            {"perna_frente": -22, "perna_tras": 24, "braco_frente": -20, "braco_tras": 18, "tronco": 6, "raiz": (0, 0.03)},
            {"perna_frente": -32, "perna_tras": 32, "braco_frente": -28, "braco_tras": 24, "tronco": 5},
            {"perna_frente": -14, "perna_tras": 18, "braco_frente": -14, "braco_tras": 10, "tronco": 6, "raiz": (0, 0.04)},
            {"perna_frente": 8, "perna_tras": -6, "braco_frente": 4, "braco_tras": -6, "tronco": 5, "raiz": (0, 0.06)},
            {"perna_frente": 24, "perna_tras": -22, "braco_frente": 16, "braco_tras": -20, "tronco": 6, "raiz": (0, 0.03)},
        ]
    ),
)
acao(
    "pular",
    {
        1: {"perna_frente": 18, "perna_tras": -18, "braco_frente": 30, "braco_tras": 30, "tronco": 12, "raiz": (0, -0.12)},
        5: {"perna_frente": 6, "perna_tras": -6, "braco_frente": -60, "braco_tras": -50, "tronco": 4},
        9: {"perna_frente": -14, "perna_tras": 10, "braco_frente": -120, "braco_tras": -110, "tronco": -4, "raiz": (0, 0.06)},
        13: {"perna_frente": -24, "perna_tras": 20, "braco_frente": -140, "braco_tras": -130, "tronco": -8, "raiz": (0, 0.08)},
    },
)
acao(
    "cair",
    ciclo(
        [
            {"perna_frente": 22, "perna_tras": -14, "braco_frente": -150, "braco_tras": -135, "tronco": 6},
            {"perna_frente": 12, "perna_tras": -24, "braco_frente": -165, "braco_tras": -120, "tronco": 9},
        ]
    ),
)
acao(
    "atacar",
    {
        1: {"braco_frente": 15, "tronco": 0},
        4: {"braco_frente": 205, "tronco": -12, "perna_frente": -8, "perna_tras": 8},
        7: {"braco_frente": 150, "tronco": 2, "perna_frente": 8, "perna_tras": -6},
        10: {"braco_frente": 70, "tronco": 18, "perna_frente": 24, "perna_tras": -18},
        13: {"braco_frente": 25, "tronco": 22, "perna_frente": 26, "perna_tras": -20},
        17: {"braco_frente": 15, "tronco": 4, "perna_frente": 6, "perna_tras": -4},
    },
)
acao(
    "habilidade",
    {
        1: {"braco_frente": 15},
        4: {"braco_frente": -35, "braco_tras": 40, "tronco": -14, "perna_frente": -16, "perna_tras": 14, "raiz": (0, -0.08)},
        7: {"braco_frente": -50, "braco_tras": 50, "tronco": -18, "perna_frente": -20, "perna_tras": 18, "raiz": (0, -0.12)},
        10: {"braco_frente": 80, "braco_tras": -40, "tronco": 24, "perna_frente": 40, "perna_tras": -34, "raiz": (0, -0.1)},
        13: {"braco_frente": 92, "braco_tras": -60, "tronco": 30, "perna_frente": 46, "perna_tras": -40, "raiz": (0, -0.12)},
        16: {"braco_frente": 90, "braco_tras": -62, "tronco": 28, "perna_frente": 44, "perna_tras": -38, "raiz": (0, -0.12)},
        19: {"braco_frente": 70, "braco_tras": -30, "tronco": 18, "perna_frente": 26, "perna_tras": -20, "raiz": (0, -0.06)},
        22: {"braco_frente": 25, "tronco": 4, "perna_frente": 6, "perna_tras": -4},
    },
)
acao(
    "atingido",
    {
        1: {"tronco": -10, "cabeca": -14, "braco_frente": -50, "braco_tras": -60},
        4: {"tronco": -26, "cabeca": -24, "braco_frente": -95, "braco_tras": -110, "perna_frente": 16, "perna_tras": -6},
        7: {"tronco": -16, "cabeca": -10, "braco_frente": -60, "braco_tras": -70, "perna_frente": 8},
    },
)
acao(
    "arremessado",
    ciclo(
        [
            {"raiz": (-20, 0.1), "braco_frente": -120, "braco_tras": -140, "perna_frente": 30, "perna_tras": -20, "cabeca": -15},
            {"raiz": (-110, 0.1), "braco_frente": -150, "braco_tras": -100, "perna_frente": 10, "perna_tras": -35, "cabeca": -15},
            {"raiz": (-200, 0.1), "braco_frente": -110, "braco_tras": -150, "perna_frente": 35, "perna_tras": -10, "cabeca": -15},
            {"raiz": (-290, 0.1), "braco_frente": -140, "braco_tras": -120, "perna_frente": 15, "perna_tras": -30, "cabeca": -15},
        ]
    ),
)
acao(
    "nocaute",
    {
        1: {"tronco": -14, "cabeca": -16, "braco_frente": -70, "braco_tras": -80},
        4: {"raiz": (-25, -0.05), "tronco": -18, "cabeca": -20, "braco_frente": -100, "braco_tras": -110, "perna_frente": 20},
        7: {"raiz": (-50, -0.2), "tronco": -14, "cabeca": -18, "braco_frente": -120, "braco_tras": -125, "perna_frente": 26},
        10: {"raiz": (-75, -0.45), "tronco": -8, "cabeca": -10, "braco_frente": -130, "braco_tras": -135, "perna_frente": 16},
        13: {"raiz": (-90, -0.62), "tronco": -2, "braco_frente": -140, "braco_tras": -150, "perna_frente": 6},
        16: {"raiz": (-90, -0.66), "braco_frente": -150, "braco_tras": -155},
    },
)

saida = pathlib.Path(argumento("--saida", "arte/fontes/boneco-teste.blend")).resolve()
saida.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(saida))
print("salvo:", saida)
