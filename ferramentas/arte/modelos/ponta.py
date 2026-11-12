"""Ponta (Futebol, assassino): atacante baixinho e veloz, chuteiras com rastro de faísca.

Uso: blender -b -P ferramentas/arte/modelos/ponta.py -- --saida arte/fontes/ponta.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.78, corpulencia=1.05)

PELE = h.mat("pele", (0.8, 0.56, 0.4))
ROXO = h.mat("roxo", (0.36, 0.12, 0.6))
ROXO_ESCURO = h.mat("roxo_escuro", (0.2, 0.06, 0.36))
DOURADO = h.mat("dourado", (0.96, 0.76, 0.2))
CHUTEIRA = h.mat("chuteira", (1.0, 0.55, 0.1), brilho=1.2)
FAISCA = h.mat("faisca", (1.0, 0.9, 0.3), brilho=4.0)
CABELO = h.mat("cabelo", (0.9, 0.3, 0.12))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

# Cabeça grande para o corpo: é o baixinho do time.
h.corpo(PELE, ROXO, PELE, CHUTEIRA, manga=PELE, cabeca=0.27)
h.rosto(OLHO, cabeca=0.27, sobrancelha=CABELO)
h.uniforme_curto(ROXO, ROXO_ESCURO, DOURADO)
h.caixa("faixa_do_peito", "tronco", (0, 0, 1.16), (0.32, 0.38, 0.07), DOURADO, chanfro=0.02)
h.caixa("gola", "tronco", (0.02, 0, 1.31), (0.2, 0.24, 0.04), DOURADO, chanfro=0.015)

# Cabelo espetado para trás, de quem corre muito.
h.esfera("cabelo", "cabeca", (-0.04, 0, 1.68), 0.27, CABELO, escala=(1, 1, 0.72))
for i, (x, z, c) in enumerate(((-0.3, 1.84, 0.26), (-0.36, 1.7, 0.3), (-0.3, 1.56, 0.24))):
    h.tubo(f"espeto_{i}", "cabeca", (-0.12, 0, z - 0.04), (x - 0.1, 0, z + 0.04), 0.09, 0.01, CABELO, lados=5)

# Faíscas saindo do calcanhar das chuteiras.
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    for i, (dx, dz, c) in enumerate(((-0.2, 0.06, 0.16), (-0.26, 0.16, 0.12), (-0.16, 0.2, 0.09))):
        h.tubo(f"faisca_{lado}_{i}", f"canela_{lado}", (-0.07, y, 0.06), (dx - c * 0.4, y, dz), 0.03, 0.004, FAISCA, lados=4)

# Sempre pronto para disparar: inclinado, braços dobrados.
GUARDA = {"braco_f": 30, "ante_f": 80, "braco_t": -40, "ante_t": 80}
h.acoes_basicas(guarda=GUARDA)
G = GUARDA

# Golpe: chute rápido de bico.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": 8, "braco_f": 50, "ante_f": 60, "braco_t": -50, "ante_t": 60, "coxa_f": -30, "canela_f": -70, "coxa_t": 8, "canela_t": -16},
        7: {"tronco": -8, "braco_f": -40, "ante_f": 50, "braco_t": 60, "ante_t": 50, "coxa_f": 70, "canela_f": -6, "coxa_t": -8, "canela_t": -10},
        10: {"tronco": -14, "braco_f": -50, "ante_f": 50, "braco_t": 70, "ante_t": 50, "coxa_f": 92, "canela_f": -2, "coxa_t": -10, "canela_t": -8, "raiz": (-4, 0.03)},
        13: {"tronco": -2, "braco_f": 0, "ante_f": 60, "braco_t": 10, "ante_t": 60, "coxa_f": 40, "canela_f": -40, "coxa_t": -6, "canela_t": -10},
        17: dict(G),
    },
)

# Carrinho: joga o corpo para trás e desliza no chão com a perna da frente esticada.
DESLIZE = {"tronco": 14, "cabeca": 34, "braco_f": -50, "ante_f": 30, "braco_t": 130, "ante_t": 30, "coxa_f": 28, "canela_f": -2, "coxa_t": 62, "canela_t": -100}
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 24, "braco_f": 60, "ante_f": 70, "braco_t": -60, "ante_t": 70, "coxa_f": 50, "canela_f": -60, "coxa_t": -30, "canela_t": -30, "raiz": (0, -0.12)},
        7: {**DESLIZE, "coxa_f": 44, "raiz": (-40, -0.5)},
        10: {**DESLIZE, "raiz": (-60, -0.7)},
        13: {**DESLIZE, "raiz": (-62, -0.71)},
        16: {**DESLIZE, "coxa_f": 50, "raiz": (-58, -0.68)},
        19: {"tronco": 20, "braco_f": 20, "ante_f": 60, "braco_t": 40, "ante_t": 60, "coxa_f": 60, "canela_f": -90, "coxa_t": 30, "canela_t": -90, "raiz": (-10, -0.3)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/ponta.blend")
