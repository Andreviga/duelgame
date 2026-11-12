"""Mestre Vento (Dojo, à distância): mestre idoso de barba longa com um leque gigante.

Uso: blender -b -P ferramentas/arte/modelos/vento.py -- --saida arte/fontes/vento.blend
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.95, corpulencia=0.95)
h.arma_padrao = "mao"

PELE = h.mat("pele", (0.86, 0.66, 0.5))
TUNICA = h.mat("tunica", (0.16, 0.5, 0.52))
TUNICA_ESCURA = h.mat("tunica_escura", (0.08, 0.3, 0.34))
FAIXA = h.mat("faixa", (0.93, 0.88, 0.72))
BARBA = h.mat("barba", (0.94, 0.94, 0.96))
MADEIRA = h.mat("madeira", (0.4, 0.24, 0.12))
PAPEL = h.mat("papel", (0.96, 0.93, 0.82))
DETALHE = h.mat("detalhe", (0.85, 0.3, 0.2))
SANDALIA = h.mat("sandalia", (0.5, 0.36, 0.2))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, TUNICA, TUNICA_ESCURA, SANDALIA)
h.rosto(OLHO, sobrancelha=BARBA)

# Túnica comprida até o tornozelo, com faixa clara e mangas largas.
h.tubo("saia", "raiz", (0, 0, 0.92), (0, 0, 0.22), 0.2, 0.33, TUNICA, lados=10)
h.caixa("gola", "tronco", (0.13, 0, 1.2), (0.06, 0.2, 0.26), TUNICA_ESCURA, chanfro=0.02, giro=8)
h.caixa("faixa", "tronco", (0, 0, 0.94), (0.33, 0.39, 0.1), FAIXA, chanfro=0.03)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"manga_{lado}", f"ante_{lado}", (0, y, 1.0), (0, y, 0.8), 0.08, 0.13, TUNICA)

# Careca, com um tufo atrás, sobrancelhas grossas, bigode e barba até a cintura.
h.esfera("tufo", "cabeca", (-0.16, 0, 1.5), 0.12, BARBA, escala=(1, 1.3, 1))
h.caixa("bigode", "cabeca", (0.22, 0, 1.47), (0.07, 0.24, 0.05), BARBA, chanfro=0.02)
h.tubo("barba_1", "cabeca", (0.17, 0, 1.46), (0.2, 0, 1.2), 0.11, 0.08, BARBA, lados=8)
h.tubo("barba_2", "cabeca", (0.2, 0, 1.22), (0.24, 0, 0.98), 0.08, 0.02, BARBA, lados=8)


def leque(prefixo, osso, origem, direcao, comprimento=0.66, abertura=100, varetas=9):
    """Leque aberto no plano lateral: cabo, varetas de madeira e folhas de papel entre elas."""
    ox, oy, oz = origem
    centro = math.atan2(direcao[1], direcao[0])

    def ponto(angulo, d):
        return (ox + math.cos(angulo) * d, oy, oz + math.sin(angulo) * d)

    h.tubo(f"{prefixo}_cabo", osso, ponto(centro, -0.16), ponto(centro, 0.04), 0.03, 0.03, MADEIRA, lados=6)
    for i in range(varetas):
        a = centro + math.radians(-abertura / 2 + abertura * i / (varetas - 1))
        h.tubo(f"{prefixo}_vareta_{i}", osso, ponto(a, 0.0), ponto(a, comprimento), 0.016, 0.012, MADEIRA, lados=4)
        if i < varetas - 1:
            b = centro + math.radians(-abertura / 2 + abertura * (i + 0.5) / (varetas - 1))
            largura = comprimento * math.radians(abertura / (varetas - 1)) * 0.52
            cor = DETALHE if i in (0, varetas - 2) else PAPEL
            h.tubo(f"{prefixo}_folha_{i}", osso, ponto(b, 0.24), ponto(b, comprimento * 0.97), largura * 0.3, largura, cor, lados=4)


o = h.ombro
leque("leque_mao", "arma_mao", (0.02, -o, 0.72), (1.0, 0.0))
leque("leque_costas", "arma_costas", (-0.2, 0.08, 1.0), (-0.25, 1.0))

# Postura de mestre: leque aberto à frente do corpo, sem cobrir o rosto.
GUARDA = {"braco_f": 30, "ante_f": 15, "arma_mao": -15, "braco_t": -20, "ante_t": 50}
h.acoes_basicas(arma="mao", guarda=GUARDA)

# Golpe: abana o leque de trás para a frente, soltando uma rajada.
h.acao(
    "atacar",
    {
        1: {"tronco": 6, "braco_f": 30, "ante_f": 15, "arma_mao": -15, "braco_t": -20, "ante_t": 50},
        4: {"tronco": -8, "braco_f": 150, "ante_f": 50, "arma_mao": 70, "braco_t": 10, "ante_t": 50, "coxa_f": -6, "canela_f": -10, "coxa_t": 6, "canela_t": -12},
        7: {"tronco": 14, "braco_f": 95, "ante_f": 10, "arma_mao": 10, "braco_t": -30, "ante_t": 40, "coxa_f": 18, "canela_f": -22, "coxa_t": -12, "canela_t": -10, "raiz": (0, -0.04)},
        10: {"tronco": 20, "braco_f": 55, "ante_f": 5, "arma_mao": -30, "braco_t": -36, "ante_t": 36, "coxa_f": 22, "canela_f": -26, "coxa_t": -14, "canela_t": -10, "raiz": (0, -0.05)},
        13: {"tronco": 12, "braco_f": 40, "ante_f": 30, "arma_mao": 20, "braco_t": -26, "ante_t": 44, "coxa_f": 12, "canela_f": -16, "coxa_t": -8, "canela_t": -10},
        17: {"tronco": 6, "braco_f": 30, "ante_f": 15, "arma_mao": -15, "braco_t": -20, "ante_t": 50},
    },
)

# Tufão: ergue o leque bem alto, gira o corpo e varre tudo com um abano enorme.
h.acao(
    "habilidade",
    {
        1: {"tronco": 6, "braco_f": 30, "ante_f": 15, "arma_mao": -15, "braco_t": -20, "ante_t": 50},
        4: {"tronco": -6, "braco_f": 120, "ante_f": 40, "arma_mao": 80, "braco_t": 60, "ante_t": 60, "coxa_f": 10, "canela_f": -30, "coxa_t": -4, "canela_t": -26, "raiz": (0, -0.08)},
        7: {"tronco": -16, "braco_f": 185, "ante_f": 20, "arma_mao": 60, "braco_t": 150, "ante_t": 30, "coxa_f": 4, "canela_f": -10, "coxa_t": -4, "canela_t": -8, "raiz": (0, 0.05)},
        10: {"tronco": -20, "braco_f": 200, "ante_f": 25, "arma_mao": 50, "braco_t": 165, "ante_t": 30, "coxa_f": 0, "canela_f": -6, "coxa_t": -2, "canela_t": -6, "raiz": (0, 0.08)},
        13: {"tronco": 22, "braco_f": 100, "ante_f": 5, "arma_mao": 0, "braco_t": 60, "ante_t": 20, "coxa_f": 36, "canela_f": -40, "coxa_t": -26, "canela_t": -10, "raiz": (0, -0.1)},
        16: {"tronco": 32, "braco_f": 45, "ante_f": 0, "arma_mao": -40, "braco_t": 10, "ante_t": 20, "coxa_f": 42, "canela_f": -46, "coxa_t": -30, "canela_t": -10, "raiz": (0, -0.13)},
        19: {"tronco": 20, "braco_f": 35, "ante_f": 20, "arma_mao": -10, "braco_t": -10, "ante_t": 36, "coxa_f": 24, "canela_f": -28, "coxa_t": -16, "canela_t": -10, "raiz": (0, -0.06)},
        22: {"tronco": 6, "braco_f": 30, "ante_f": 15, "arma_mao": -15, "braco_t": -20, "ante_t": 50},
    },
)

h.salvar("arte/fontes/vento.blend")
