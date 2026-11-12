"""Cozinheiro (Piratas, assassino): cozinheiro de bordo, de avental e lenço, com um cutelo.

Uso: blender -b -P ferramentas/arte/modelos/cozinheiro.py -- --saida arte/fontes/cozinheiro.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.9, corpulencia=1.3)
# "mao" = cutelo na mão; "costas" = cutelo lançado (nada aparece) até ele voltar.
h.arma_padrao = "mao"

PELE = h.mat("pele", (0.9, 0.66, 0.5))
CAMISA = h.mat("camisa", (0.2, 0.36, 0.42))
AVENTAL = h.mat("avental", (0.9, 0.87, 0.78))
MANCHA = h.mat("mancha", (0.62, 0.3, 0.22))
CALCA = h.mat("calca", (0.24, 0.2, 0.2))
BOTA = h.mat("bota", (0.16, 0.11, 0.08))
LENCO = h.mat("lenco", (0.82, 0.62, 0.2))
BIGODE = h.mat("bigode", (0.16, 0.1, 0.07))
ACO = h.mat("aco", (0.82, 0.86, 0.9), aspereza=0.3)
CABO = h.mat("cabo", (0.36, 0.2, 0.1))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, CAMISA, CALCA, BOTA, manga=PELE)
h.rosto(OLHO, sobrancelha=BIGODE)
g = h.g
o = h.ombro

# Mangas arregaçadas, barriga e um avental comprido com manchas.
for lado, y in (("f", -o), ("t", o)):
    h.tubo(f"manga_{lado}", f"braco_{lado}", (0, y, 1.28), (0, y, 1.06), 0.088 * g, 0.092 * g, CAMISA)
h.esfera("barriga", "tronco", (0.08, 0, 1.02), 0.2 * g, CAMISA, escala=(1, 1, 0.95))
h.caixa("avental_peito", "tronco", (0.17 * g, 0, 1.14), (0.04, 0.26 * g, 0.3), AVENTAL, chanfro=0.015)
h.tubo("avental_saia", "raiz", (0.04, 0, 0.96), (0.06, 0, 0.5), 0.2 * g, 0.23 * g, AVENTAL, lados=10)
h.caixa("avental_laco", "tronco", (-0.16 * g, 0, 0.96), (0.06, 0.16, 0.08), AVENTAL, chanfro=0.02)
for i, (x, y, z, r) in enumerate(((0.26, -0.1, 0.78, 0.045), (0.27, 0.04, 0.66, 0.035), (0.2, -0.16, 1.1, 0.03))):
    h.esfera(f"mancha_{i}", "raiz" if z < 0.95 else "tronco", (x, y, z), r, MANCHA, escala=(0.4, 1, 1))
h.tubo("alca_do_avental", "tronco", (0.12, 0, 1.3), (0.16 * g, 0, 1.24), 0.05, 0.05, AVENTAL, lados=6)

# Lenço amarrado na cabeça, costeletas e um bigode grande.
h.esfera("lenco", "cabeca", (0.0, 0, 1.6), 0.24, LENCO, escala=(1, 1, 0.7))
h.caixa("no_do_lenco", "cabeca", (-0.24, 0, 1.6), (0.1, 0.12, 0.08), LENCO, chanfro=0.03, giro=20)
h.caixa("bigode", "cabeca", (0.23, 0, 1.48), (0.07, 0.3, 0.06), BIGODE, chanfro=0.02)
for y in (-0.2, 0.2):
    h.caixa(f"costeleta_{y}", "cabeca", (0.02, y, 1.5), (0.1, 0.04, 0.14), BIGODE, chanfro=0.015)

# Cutelo: cabo curto e lâmina larga, retangular.
h.tubo("cutelo_cabo", "arma_mao", (-0.08, -o, 0.72), (0.1, -o, 0.72), 0.026, 0.026, CABO, lados=6)
h.caixa("cutelo_lamina", "arma_mao", (0.28, -o, 0.76), (0.34, 0.02, 0.2), ACO, chanfro=0.0)
h.caixa("cutelo_fio", "arma_mao", (0.28, -o, 0.665), (0.34, 0.012, 0.02), h.mat("fio", (0.96, 0.97, 1.0), aspereza=0.2), chanfro=0.0)

GUARDA = {"braco_f": 30, "ante_f": 60, "arma_mao": 50, "braco_t": -24, "ante_t": 50}
h.acoes_basicas(arma="mao", guarda=GUARDA)
G = GUARDA

# Golpe: cutelada curta e seca, de cima para baixo.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -8, "braco_f": 150, "ante_f": 70, "arma_mao": 60, "braco_t": 10, "ante_t": 50, "coxa_f": -6, "canela_f": -10, "coxa_t": 6, "canela_t": -12},
        7: {"tronco": 12, "braco_f": 100, "ante_f": 20, "arma_mao": 10, "braco_t": -30, "ante_t": 40, "coxa_f": 26, "canela_f": -28, "coxa_t": -18, "canela_t": -10, "raiz": (0, -0.05)},
        10: {"tronco": 22, "braco_f": 50, "ante_f": 5, "arma_mao": -30, "braco_t": -44, "ante_t": 36, "coxa_f": 34, "canela_f": -34, "coxa_t": -24, "canela_t": -10, "raiz": (0, -0.08)},
        13: {"tronco": 12, "braco_f": 36, "ante_f": 40, "arma_mao": 20, "braco_t": -30, "ante_t": 44, "coxa_f": 18, "canela_f": -20, "coxa_t": -12, "canela_t": -10, "raiz": (0, -0.03)},
        17: dict(G),
    },
)

# Cutelo que volta: leva o braço bem atrás, lança (a mão fica vazia) e apanha de volta no fim.
VAZIA = {"arma": "costas"}
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": -16, "braco_f": -70, "ante_f": 90, "arma_mao": 80, "braco_t": 60, "ante_t": 40, "coxa_f": -10, "canela_f": -14, "coxa_t": 10, "canela_t": -18},
        7: {"tronco": -20, "braco_f": -90, "ante_f": 100, "arma_mao": 90, "braco_t": 70, "ante_t": 36, "coxa_f": -12, "canela_f": -16, "coxa_t": 12, "canela_t": -20, "raiz": (0, -0.03)},
        10: {**VAZIA, "tronco": 26, "braco_f": 96, "ante_f": 4, "braco_t": -50, "ante_t": 40, "coxa_f": 40, "canela_f": -40, "coxa_t": -30, "canela_t": -10, "raiz": (0, -0.1)},
        13: {**VAZIA, "tronco": 30, "braco_f": 80, "ante_f": 10, "braco_t": -56, "ante_t": 40, "coxa_f": 42, "canela_f": -42, "coxa_t": -32, "canela_t": -10, "raiz": (0, -0.11)},
        16: {**VAZIA, "tronco": 14, "braco_f": 70, "ante_f": 50, "braco_t": -30, "ante_t": 44, "coxa_f": 22, "canela_f": -24, "coxa_t": -16, "canela_t": -10, "raiz": (0, -0.05)},
        19: {"tronco": 0, "braco_f": 60, "ante_f": 70, "arma_mao": 70, "braco_t": -24, "ante_t": 50, "coxa_f": 8, "canela_f": -10},
        22: dict(G),
    },
)

h.salvar("arte/fontes/cozinheiro.blend")
