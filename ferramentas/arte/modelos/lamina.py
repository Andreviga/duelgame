"""Lâmina (Dojo, corpo a corpo): espadachim de quimono vermelho com espada longa nas costas.

Uso: blender -b -P ferramentas/arte/modelos/lamina.py -- --saida arte/fontes/lamina.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide()
h.arma_padrao = "costas"

PELE = h.mat("pele", (0.92, 0.7, 0.52))
QUIMONO = h.mat("quimono", (0.74, 0.07, 0.07))
QUIMONO_ESCURO = h.mat("quimono_escuro", (0.42, 0.03, 0.05))
HAKAMA = h.mat("hakama", (0.13, 0.1, 0.14))
FAIXA = h.mat("faixa", (0.95, 0.78, 0.22))
CABELO = h.mat("cabelo", (0.07, 0.06, 0.08))
ACO = h.mat("aco", (0.86, 0.9, 0.95), aspereza=0.3)
CABO = h.mat("cabo", (0.1, 0.08, 0.1))
SANDALIA = h.mat("sandalia", (0.55, 0.4, 0.22))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, QUIMONO, HAKAMA, SANDALIA)
h.rosto(OLHO, sobrancelha=CABELO)

# Quimono: gola cruzada, faixa na cintura e a barra que cobre o quadril.
h.caixa("gola", "tronco", (0.13, 0, 1.2), (0.06, 0.2, 0.26), QUIMONO_ESCURO, chanfro=0.02, giro=8)
h.caixa("faixa", "tronco", (0, 0, 0.93), (0.33, 0.39, 0.09), FAIXA, chanfro=0.03)
h.caixa("no_da_faixa", "tronco", (0.17, -0.06, 0.92), (0.06, 0.1, 0.12), FAIXA, chanfro=0.02)
h.tubo("barra", "raiz", (0, 0, 0.9), (0, 0, 0.66), 0.2, 0.25, QUIMONO, lados=10)
# Calça larga (hakama): alarga as pernas até o tornozelo.
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"hakama_coxa_{lado}", f"coxa_{lado}", (0, y, 0.88), (0, y, 0.48), 0.12, 0.125, HAKAMA)
    h.tubo(f"hakama_canela_{lado}", f"canela_{lado}", (0, y, 0.5), (0, y, 0.16), 0.125, 0.15, HAKAMA)
# Mangas largas no antebraço.
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"manga_{lado}", f"ante_{lado}", (0, y, 1.0), (0, y, 0.82), 0.075, 0.105, QUIMONO)

# Cabelo preso em coque alto.
h.esfera("cabelo", "cabeca", (-0.03, 0, 1.6), 0.235, CABELO, escala=(1, 1, 0.82))
h.esfera("coque", "cabeca", (-0.1, 0, 1.83), 0.09, CABELO)
h.caixa("fita_do_coque", "cabeca", (-0.08, 0, 1.76), (0.07, 0.07, 0.04), FAIXA, chanfro=0.01)


def espada(prefixo, osso, origem, direcao):
    """Espada longa: lâmina, guarda e cabo, a partir de `origem`, na direção dada."""
    ox, oy, oz = origem
    dx, dz = direcao

    def ponto(d):
        return (ox + dx * d, oy, oz + dz * d)

    h.tubo(f"{prefixo}_cabo", osso, ponto(-0.2), ponto(0.02), 0.026, 0.026, CABO, lados=6)
    h.tubo(f"{prefixo}_guarda", osso, ponto(0.02), ponto(0.05), 0.07, 0.07, FAIXA, lados=6)
    h.tubo(f"{prefixo}_lamina", osso, ponto(0.05), ponto(0.98), 0.03, 0.012, ACO, lados=4)


# Na mão: sai da mão para a frente. Nas costas: atravessada, com o cabo acima do ombro.
espada("espada_mao", "arma_mao", (0.02, -h.ombro, 0.72), (1.0, 0.0))
espada("espada_costas", "arma_costas", (-0.02, 0.06, 1.62), (-0.42, -0.9))

h.acoes_basicas(arma="costas")

# Golpe: saca, corta de cima para baixo e guarda.
h.acao(
    "atacar",
    {
        1: {"arma": "mao", "braco_f": 30, "ante_f": 60, "arma_mao": 30, "braco_t": -8, "ante_t": 25},
        4: {"arma": "mao", "tronco": -12, "braco_f": 165, "ante_f": 40, "arma_mao": 20, "braco_t": 20, "ante_t": 40, "coxa_f": -6, "canela_f": -10, "coxa_t": 6, "canela_t": -12},
        7: {"arma": "mao", "tronco": 4, "braco_f": 120, "ante_f": 15, "arma_mao": 0, "braco_t": 0, "ante_t": 40, "coxa_f": 14, "canela_f": -20, "coxa_t": -10, "canela_t": -14},
        10: {"arma": "mao", "tronco": 20, "braco_f": 55, "ante_f": 5, "arma_mao": -20, "braco_t": -25, "ante_t": 35, "coxa_f": 30, "canela_f": -32, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.06)},
        13: {"arma": "mao", "tronco": 24, "braco_f": 30, "ante_f": 5, "arma_mao": -30, "braco_t": -30, "ante_t": 30, "coxa_f": 32, "canela_f": -34, "coxa_t": -24, "canela_t": -12, "raiz": (0, -0.07)},
        17: {"arma": "mao", "tronco": 6, "braco_f": 20, "ante_f": 40, "arma_mao": 10, "braco_t": -10, "ante_t": 25, "coxa_f": 10, "canela_f": -14, "coxa_t": -8, "canela_t": -10},
    },
)

# Corte relâmpago: agacha com a espada para trás e avança numa estocada longa.
h.acao(
    "habilidade",
    {
        1: {"arma": "mao", "braco_f": 20, "ante_f": 50, "arma_mao": 20},
        4: {"arma": "mao", "tronco": 22, "braco_f": -40, "ante_f": 30, "arma_mao": -60, "braco_t": 40, "ante_t": 60, "coxa_f": 40, "canela_f": -70, "coxa_t": 20, "canela_t": -70, "raiz": (0, -0.2)},
        7: {"arma": "mao", "tronco": 26, "braco_f": -55, "ante_f": 30, "arma_mao": -70, "braco_t": 50, "ante_t": 60, "coxa_f": 44, "canela_f": -76, "coxa_t": 22, "canela_t": -74, "raiz": (0, -0.23)},
        10: {"arma": "mao", "tronco": 34, "braco_f": 80, "ante_f": 8, "arma_mao": -58, "braco_t": -50, "ante_t": 20, "coxa_f": 58, "canela_f": -52, "coxa_t": -46, "canela_t": -8, "raiz": (0, -0.2)},
        13: {"arma": "mao", "tronco": 38, "braco_f": 86, "ante_f": 4, "arma_mao": -60, "braco_t": -58, "ante_t": 15, "coxa_f": 62, "canela_f": -56, "coxa_t": -50, "canela_t": -6, "raiz": (0, -0.22)},
        16: {"arma": "mao", "tronco": 36, "braco_f": 84, "ante_f": 4, "arma_mao": -60, "braco_t": -56, "ante_t": 15, "coxa_f": 60, "canela_f": -54, "coxa_t": -48, "canela_t": -6, "raiz": (0, -0.22)},
        19: {"arma": "mao", "tronco": 20, "braco_f": 50, "ante_f": 30, "arma_mao": -30, "braco_t": -24, "ante_t": 25, "coxa_f": 32, "canela_f": -36, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.1)},
        22: {"arma": "mao", "tronco": 6, "braco_f": 20, "ante_f": 45, "arma_mao": 15, "coxa_f": 8, "canela_f": -12, "coxa_t": -6, "canela_t": -10},
    },
)

h.salvar("arte/fontes/lamina.blend")
