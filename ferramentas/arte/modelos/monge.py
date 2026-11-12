"""Monge do Sino (Dojo, tanque): monge enorme e calmo, com um sino de bronze na ponta de um cajado.

Uso: blender -b -P ferramentas/arte/modelos/monge.py -- --saida arte/fontes/monge.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=1.06, corpulencia=1.65)
h.arma_padrao = "mao"

PELE = h.mat("pele", (0.78, 0.56, 0.4))
MANTO = h.mat("manto", (0.5, 0.36, 0.14))
MANTO_ESCURO = h.mat("manto_escuro", (0.3, 0.2, 0.08))
FAIXA = h.mat("faixa", (0.36, 0.12, 0.12))
CONTA = h.mat("conta", (0.16, 0.1, 0.07))
SANDALIA = h.mat("sandalia", (0.4, 0.28, 0.16))
MADEIRA = h.mat("madeira", (0.34, 0.2, 0.1))
BRONZE = h.mat("bronze", (0.72, 0.52, 0.2), aspereza=0.35)
BRONZE_ESCURO = h.mat("bronze_escuro", (0.42, 0.3, 0.12), aspereza=0.4)
OLHO = h.mat("olho", (0.05, 0.04, 0.06))
SOBRANCELHA = h.mat("sobrancelha", (0.2, 0.15, 0.12))

h.corpo(PELE, MANTO, MANTO_ESCURO, SANDALIA, manga=PELE, cabeca=0.21)
h.rosto(OLHO, cabeca=0.21, sobrancelha=SOBRANCELHA)
g = h.g
o = h.ombro

# Manto que deixa um ombro de fora, barriga grande, faixa na cintura e saia até o tornozelo.
h.esfera("barriga", "tronco", (0.08, 0, 1.02), 0.21 * g, MANTO, escala=(1, 1, 1.0))
h.caixa("manto_cruzado", "tronco", (0.03, 0, 1.18), (0.31 * g, 0.4 * g, 0.12), MANTO_ESCURO, chanfro=0.04, giro=24)
h.tubo("saia", "raiz", (0, 0, 0.94), (0, 0, 0.2), 0.2 * g, 0.26 * g, MANTO, lados=10)
h.caixa("faixa", "tronco", (0, 0, 0.92), (0.32 * g, 0.38 * g, 0.1), FAIXA, chanfro=0.03)
h.caixa("ponta_da_faixa", "raiz", (0.16 * g, -0.1, 0.76), (0.04, 0.1, 0.24), FAIXA, chanfro=0.02)
h.tubo("manga_t", "braco_t", (0, o, 1.28), (0, o, 1.02), 0.09 * g, 0.1 * g, MANTO)
# Colar de contas grandes.
for i in range(9):
    a = -1.4 + i * 0.35
    import math  # noqa: E402

    h.esfera(f"conta_{i}", "tronco", (0.13 * g + 0.05 * math.cos(a), 0.2 * math.sin(a) * g * 0.6, 1.2 - 0.09 * math.cos(a)), 0.034, CONTA)

# Careca, com orelhas grandes e sobrancelhas grossas: um rosto tranquilo.
for y in (-0.2, 0.2):
    h.esfera(f"orelha_{y}", "cabeca", (0.0, y, 1.5), 0.06, PELE, escala=(0.6, 0.5, 1.3))

# Cajado com o sino pendurado na ponta. Na mão, aponta para a frente; a guarda o deixa em pé.
h.tubo("cajado", "arma_mao", (-0.46, -o, 0.72), (0.78, -o, 0.72), 0.03, 0.026, MADEIRA, lados=6)
h.tubo("sino_alca", "arma_mao", (0.74, -o, 0.72), (0.74, -o, 0.64), 0.02, 0.02, BRONZE_ESCURO, lados=5)
h.tubo("sino_ombro", "arma_mao", (0.74, -o, 0.66), (0.74, -o, 0.58), 0.05, 0.12, BRONZE, lados=10)
h.tubo("sino_corpo", "arma_mao", (0.74, -o, 0.58), (0.74, -o, 0.4), 0.12, 0.15, BRONZE, lados=10)
h.tubo("sino_boca", "arma_mao", (0.74, -o, 0.4), (0.74, -o, 0.37), 0.17, 0.165, BRONZE_ESCURO, lados=10)
h.esfera("sino_badalo", "arma_mao", (0.74, -o, 0.36), 0.04, BRONZE_ESCURO)

# O cajado fica em pé ao lado do corpo, com o sino no alto.
GUARDA = {"braco_f": 20, "ante_f": 40, "arma_mao": 28, "braco_t": -10, "ante_t": 30}
h.acoes_basicas(arma="mao", guarda=GUARDA)
G = GUARDA

# Golpe: desce o cajado com o sino, como um martelo.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -12, "braco_f": 150, "ante_f": 40, "arma_mao": 30, "braco_t": 30, "ante_t": 50, "coxa_f": -6, "canela_f": -10, "coxa_t": 8, "canela_t": -14},
        7: {"tronco": 6, "braco_f": 110, "ante_f": 20, "arma_mao": -10, "braco_t": 0, "ante_t": 40, "coxa_f": 16, "canela_f": -22, "coxa_t": -12, "canela_t": -14},
        10: {"tronco": 24, "braco_f": 50, "ante_f": 6, "arma_mao": -50, "braco_t": -30, "ante_t": 35, "coxa_f": 30, "canela_f": -34, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.08)},
        13: {"tronco": 26, "braco_f": 40, "ante_f": 6, "arma_mao": -56, "braco_t": -34, "ante_t": 35, "coxa_f": 32, "canela_f": -36, "coxa_t": -24, "canela_t": -12, "raiz": (0, -0.09)},
        17: dict(G),
    },
)

# Badalada: ergue o sino acima da cabeça com as duas mãos e o faz soar, firmando os pés.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 8, "braco_f": 60, "ante_f": 60, "arma_mao": 40, "braco_t": 50, "ante_t": 70, "coxa_f": 20, "canela_f": -40, "coxa_t": -14, "canela_t": -34, "raiz": (0, -0.1)},
        7: {"tronco": -8, "braco_f": 150, "ante_f": 30, "arma_mao": 20, "braco_t": 140, "ante_t": 40, "coxa_f": 14, "canela_f": -30, "coxa_t": -10, "canela_t": -26, "raiz": (0, -0.06)},
        10: {"tronco": -12, "braco_f": 172, "ante_f": 16, "arma_mao": 6, "braco_t": 164, "ante_t": 24, "coxa_f": 10, "canela_f": -22, "coxa_t": -8, "canela_t": -20, "raiz": (0, -0.03)},
        13: {"tronco": -6, "braco_f": 160, "ante_f": 30, "arma_mao": 40, "braco_t": 150, "ante_t": 36, "coxa_f": 18, "canela_f": -38, "coxa_t": -12, "canela_t": -32, "raiz": (0, -0.09)},
        16: {"tronco": -12, "braco_f": 174, "ante_f": 14, "arma_mao": -14, "braco_t": 166, "ante_t": 22, "coxa_f": 20, "canela_f": -42, "coxa_t": -14, "canela_t": -36, "raiz": (0, -0.11)},
        19: {"tronco": 4, "braco_f": 80, "ante_f": 40, "arma_mao": 30, "braco_t": 40, "ante_t": 50, "coxa_f": 12, "canela_f": -24, "coxa_t": -8, "canela_t": -20, "raiz": (0, -0.05)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/monge.blend")
