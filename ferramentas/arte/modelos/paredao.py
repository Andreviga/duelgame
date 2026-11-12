"""Paredão (Futebol, tanque): goleiro enorme de luvas gigantes e uniforme verde-limão.

Uso: blender -b -P ferramentas/arte/modelos/paredao.py -- --saida arte/fontes/paredao.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=1.1, corpulencia=1.85)

PELE = h.mat("pele", (0.9, 0.68, 0.52))
LIMAO = h.mat("limao", (0.6, 0.92, 0.12))
LIMAO_ESCURO = h.mat("limao_escuro", (0.25, 0.5, 0.08))
PRETO = h.mat("preto", (0.07, 0.08, 0.09))
LUVA = h.mat("luva", (0.96, 0.96, 0.98))
LUVA_DETALHE = h.mat("luva_detalhe", (1.0, 0.5, 0.1))
CHUTEIRA = h.mat("chuteira", (0.1, 0.1, 0.12))
CABELO = h.mat("cabelo", (0.75, 0.55, 0.2))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

# Camisa de manga comprida verde-limão, calção preto, meião verde.
h.corpo(PELE, LIMAO, PELE, CHUTEIRA, cabeca=0.22)
h.rosto(OLHO, cabeca=0.22, sobrancelha=CABELO)
g = h.g
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"calcao_{lado}", f"coxa_{lado}", (0, y, 0.9), (0, y, 0.6), 0.112 * g, 0.12 * g, PRETO)
    h.tubo(f"meiao_{lado}", f"canela_{lado}", (0, y, 0.44), (0, y, 0.1), 0.08 * g, 0.066 * g, LIMAO)
    h.esfera(f"joelheira_{lado}", f"canela_{lado}", (0.04, y, 0.48), 0.075 * g, PRETO)
h.caixa("peito", "tronco", (0.02, 0, 1.2), (0.3 * g, 0.4 * g, 0.2), LIMAO, chanfro=0.07)
h.caixa("barriga", "tronco", (0.05, 0, 1.02), (0.3 * g, 0.36 * g, 0.2), LIMAO, chanfro=0.08)
h.caixa("faixa_do_peito", "tronco", (0.02, 0, 1.2), (0.31 * g, 0.41 * g, 0.06), LIMAO_ESCURO, chanfro=0.02)
h.caixa("gola", "tronco", (0.02, 0, 1.31), (0.2, 0.26, 0.04), LIMAO_ESCURO, chanfro=0.015)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"cotoveleira_{lado}", f"ante_{lado}", (0, y, 1.04), (0, y, 0.96), 0.07 * g, 0.068 * g, LIMAO_ESCURO)
    # Luvas gigantes: palma larga, punho e uma faixa laranja.
    h.tubo(f"punho_da_luva_{lado}", f"ante_{lado}", (0, y, 0.84), (0, y, 0.76), 0.075 * g, 0.09 * g, LUVA)
    h.caixa(f"luva_{lado}", f"ante_{lado}", (0.02, y, 0.62), (0.2, 0.3, 0.34), LUVA, chanfro=0.07)
    h.caixa(f"faixa_da_luva_{lado}", f"ante_{lado}", (0.02, y, 0.74), (0.21, 0.31, 0.05), LUVA_DETALHE, chanfro=0.02)
    h.caixa(f"dedao_{lado}", f"ante_{lado}", (0.14, y, 0.66), (0.1, 0.12, 0.16), LUVA, chanfro=0.04)

# Cabelo loiro curto. (A faixa na testa saiu: de longe parecia óculos escuros.)
h.esfera("cabelo", "cabeca", (-0.03, 0, 1.61), 0.226, CABELO, escala=(1, 1, 0.74))

# Postura de goleiro: joelhos dobrados, luvas abertas à frente.
GUARDA = {"braco_f": 40, "ante_f": 50, "braco_t": 30, "ante_t": 50}
h.acoes_basicas(guarda=GUARDA)
G = GUARDA

# Golpe: soco de duas mãos, como quem espalma a bola para longe.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -10, "braco_f": -20, "ante_f": 100, "braco_t": -30, "ante_t": 100, "coxa_f": -6, "canela_f": -14, "coxa_t": 8, "canela_t": -18, "raiz": (0, -0.03)},
        7: {"tronco": 18, "braco_f": 95, "ante_f": 5, "braco_t": 85, "ante_t": 5, "coxa_f": 30, "canela_f": -34, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.07)},
        10: {"tronco": 24, "braco_f": 100, "ante_f": 0, "braco_t": 90, "ante_t": 0, "coxa_f": 34, "canela_f": -38, "coxa_t": -24, "canela_t": -12, "raiz": (0, -0.08)},
        13: {"tronco": 12, "braco_f": 60, "ante_f": 30, "braco_t": 50, "ante_t": 30, "coxa_f": 18, "canela_f": -22, "coxa_t": -12, "canela_t": -12, "raiz": (0, -0.04)},
        17: dict(G),
    },
)

# Defesa impossível: abre os braços, agacha e fecha as luvas à frente do peito para agarrar e devolver.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 4, "braco_f": 150, "ante_f": 20, "braco_t": -40, "ante_t": 30, "coxa_f": 30, "canela_f": -60, "coxa_t": -20, "canela_t": -50, "raiz": (0, -0.16)},
        7: {"tronco": 8, "braco_f": 160, "ante_f": 15, "braco_t": -50, "ante_t": 25, "coxa_f": 34, "canela_f": -68, "coxa_t": -22, "canela_t": -56, "raiz": (0, -0.2)},
        10: {"tronco": 14, "braco_f": 80, "ante_f": 60, "braco_t": 70, "ante_t": 60, "coxa_f": 34, "canela_f": -68, "coxa_t": -22, "canela_t": -56, "raiz": (0, -0.2)},
        13: {"tronco": 16, "braco_f": 75, "ante_f": 70, "braco_t": 65, "ante_t": 70, "coxa_f": 34, "canela_f": -66, "coxa_t": -22, "canela_t": -54, "raiz": (0, -0.19)},
        16: {"tronco": 26, "braco_f": 100, "ante_f": 0, "braco_t": 90, "ante_t": 0, "coxa_f": 40, "canela_f": -44, "coxa_t": -28, "canela_t": -14, "raiz": (0, -0.1)},
        19: {"tronco": 14, "braco_f": 60, "ante_f": 30, "braco_t": 50, "ante_t": 30, "coxa_f": 20, "canela_f": -24, "coxa_t": -14, "canela_t": -12, "raiz": (0, -0.05)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/paredao.blend")
