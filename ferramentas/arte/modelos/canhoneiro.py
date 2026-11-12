"""Canhoneiro (Piratas, à distância): marujo barbudo carregando um canhão pequeno debaixo do braço.

Uso: blender -b -P ferramentas/arte/modelos/canhoneiro.py -- --saida arte/fontes/canhoneiro.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.95, corpulencia=1.35)
# O osso "arma_costas" aqui é o canhão, sempre visível.
h.arma_padrao = "costas"

PELE = h.mat("pele", (0.88, 0.62, 0.46))
CAMISA = h.mat("camisa", (0.92, 0.9, 0.84))
LISTRA = h.mat("listra", (0.75, 0.15, 0.15))
CALCA = h.mat("calca", (0.2, 0.24, 0.34))
BOTA = h.mat("bota", (0.2, 0.13, 0.08))
BARBA = h.mat("barba", (0.3, 0.17, 0.08))
LENCO = h.mat("lenco", (0.75, 0.15, 0.15))
FERRO = h.mat("ferro", (0.2, 0.21, 0.25), aspereza=0.4)
BRONZE = h.mat("bronze", (0.75, 0.52, 0.2), aspereza=0.4)
BOCA_DO_CANHAO = h.mat("boca", (0.03, 0.03, 0.04))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, CAMISA, CALCA, BOTA, manga=PELE)
h.rosto(OLHO, sobrancelha=BARBA)

# Camisa listrada sem mangas, barriga e cinto largo.
g = h.g
for i, z in enumerate((0.99, 1.09, 1.19, 1.29)):
    h.caixa(f"listra_{i}", "tronco", (0, 0, z), (0.31 * g, 0.37 * g, 0.045), LISTRA, chanfro=0.015)
h.esfera("barriga", "tronco", (0.08, 0, 1.02), 0.2 * g, CAMISA, escala=(1, 1, 0.9))
h.caixa("cinto", "tronco", (0, 0, 0.9), (0.33 * g, 0.38 * g, 0.08), BOTA, chanfro=0.03)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"munhequeira_{lado}", f"ante_{lado}", (0, y, 0.86), (0, y, 0.78), 0.07 * g, 0.066 * g, BOTA)

# Lenço na cabeça com nó atrás, e barba cheia.
h.esfera("lenco", "cabeca", (0.0, 0, 1.6), 0.24, LENCO, escala=(1, 1, 0.72))
h.caixa("no_do_lenco", "cabeca", (-0.26, 0, 1.56), (0.12, 0.1, 0.08), LENCO, chanfro=0.03, giro=30)
h.caixa("ponta_do_lenco", "cabeca", (-0.32, 0, 1.47), (0.06, 0.08, 0.16), LENCO, chanfro=0.02, giro=-20)
h.esfera("barba", "cabeca", (0.1, 0, 1.44), 0.19, BARBA, escala=(1, 1.05, 0.95))
h.caixa("bigode", "cabeca", (0.24, 0, 1.5), (0.06, 0.22, 0.05), BARBA, chanfro=0.02)

# Canhão curto carregado debaixo do braço da frente, com a boca para a frente.
o = h.ombro + 0.1
z = 1.04
h.tubo("canhao_corpo", "arma_costas", (-0.2, -o, z), (0.48, -o, z), 0.13, 0.105, FERRO, lados=12)
h.tubo("canhao_culatra", "arma_costas", (-0.28, -o, z), (-0.2, -o, z), 0.07, 0.13, FERRO, lados=12)
h.esfera("canhao_pomo", "arma_costas", (-0.31, -o, z), 0.05, BRONZE)
h.tubo("canhao_anel_1", "arma_costas", (0.02, -o, z), (0.08, -o, z), 0.135, 0.135, BRONZE, lados=12)
h.tubo("canhao_anel_2", "arma_costas", (0.44, -o, z), (0.54, -o, z), 0.125, 0.13, BRONZE, lados=12)
h.tubo("canhao_boca", "arma_costas", (0.53, -o, z), (0.545, -o, z), 0.085, 0.085, BOCA_DO_CANHAO, lados=12)

# O braço da frente abraça o canhão; a mão de trás apoia por baixo.
GUARDA = {"braco_f": 20, "ante_f": 50, "braco_t": 35, "ante_t": 60}
h.acoes_basicas(arma="costas", guarda=GUARDA)
G = GUARDA

# Tiro comum: firma o pé, dispara e o canhão dá um coice curto.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": 8, "braco_t": 70, "ante_t": 90, "braco_f": 20, "ante_f": 50, "coxa_f": 20, "canela_f": -24, "coxa_t": -16, "canela_t": -10, "raiz": (0, -0.04), "arma_costas": -4},
        7: {"tronco": -10, "braco_t": 50, "ante_t": 105, "braco_f": 20, "ante_f": 50, "coxa_f": 12, "canela_f": -20, "coxa_t": -20, "canela_t": -16, "raiz": (-4, -0.05), "arma_costas": 14},
        10: {"tronco": -4, "braco_t": 56, "ante_t": 100, "braco_f": 20, "ante_f": 50, "coxa_f": 14, "canela_f": -20, "coxa_t": -16, "canela_t": -12, "raiz": (-2, -0.04), "arma_costas": 6},
        13: {"tronco": 2, "braco_t": 60, "ante_t": 95, "braco_f": 20, "ante_f": 50, "coxa_f": 10, "canela_f": -14, "coxa_t": -8, "canela_t": -10, "raiz": (0, -0.02)},
        17: dict(G),
    },
)

# Tiro de canhão: agacha, mira com as duas mãos e o coice joga o corpo para trás.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 14, "braco_t": 75, "ante_t": 85, "braco_f": 20, "ante_f": 50, "coxa_f": 40, "canela_f": -60, "coxa_t": -20, "canela_t": -40, "raiz": (0, -0.14), "arma_costas": -8},
        7: {"tronco": 18, "braco_t": 80, "ante_t": 80, "braco_f": 20, "ante_f": 50, "coxa_f": 46, "canela_f": -70, "coxa_t": -24, "canela_t": -46, "raiz": (0, -0.18), "arma_costas": -10},
        10: {"tronco": 18, "braco_t": 80, "ante_t": 80, "braco_f": 20, "ante_f": 50, "coxa_f": 46, "canela_f": -70, "coxa_t": -24, "canela_t": -46, "raiz": (0, -0.18), "arma_costas": -10},
        13: {"tronco": -22, "braco_t": 40, "ante_t": 110, "braco_f": 20, "ante_f": 50, "coxa_f": 30, "canela_f": -30, "coxa_t": -30, "canela_t": -30, "raiz": (-10, -0.1), "arma_costas": 30},
        16: {"tronco": -14, "braco_t": 46, "ante_t": 106, "braco_f": 20, "ante_f": 50, "coxa_f": 24, "canela_f": -28, "coxa_t": -24, "canela_t": -24, "raiz": (-6, -0.08), "arma_costas": 18},
        19: {"tronco": -4, "braco_t": 56, "ante_t": 98, "braco_f": 20, "ante_f": 50, "coxa_f": 14, "canela_f": -18, "coxa_t": -10, "canela_t": -12, "raiz": (-2, -0.03), "arma_costas": 6},
        22: dict(G),
    },
)

h.salvar("arte/fontes/canhoneiro.blend")
