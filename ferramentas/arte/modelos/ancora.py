"""Âncora (Piratas, tanque): gigante tatuado que usa uma âncora como arma.

Uso: blender -b -P ferramentas/arte/modelos/ancora.py -- --saida arte/fontes/ancora.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=1.12, corpulencia=1.55)
h.arma_padrao = "mao"

PELE = h.mat("pele", (0.72, 0.5, 0.36))
TATUAGEM = h.mat("tatuagem", (0.1, 0.3, 0.38))
CALCA = h.mat("calca", (0.25, 0.2, 0.16))
FAIXA = h.mat("faixa", (0.7, 0.14, 0.14))
BOTA = h.mat("bota", (0.14, 0.1, 0.08))
BARBA = h.mat("barba", (0.12, 0.1, 0.1))
FERRO = h.mat("ferro", (0.3, 0.32, 0.38), aspereza=0.45)
CORDA = h.mat("corda", (0.72, 0.6, 0.38))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

# Sem camisa: tronco e braços da cor da pele.
h.corpo(PELE, PELE, CALCA, BOTA, cabeca=0.21)
h.rosto(OLHO, cabeca=0.21, sobrancelha=BARBA)
g = h.g

# Peitoral largo, faixa vermelha na cintura e uma alça atravessada no peito.
h.caixa("peitoral", "tronco", (0.03, 0, 1.2), (0.3 * g, 0.4 * g, 0.2), PELE, chanfro=0.07)
h.caixa("faixa", "tronco", (0, 0, 0.92), (0.32 * g, 0.38 * g, 0.12), FAIXA, chanfro=0.04)
h.caixa("ponta_da_faixa", "raiz", (-0.05, -0.2 * g, 0.78), (0.1, 0.04, 0.22), FAIXA, chanfro=0.02)
h.caixa("alca", "tronco", (0.02, 0, 1.12), (0.32 * g, 0.39 * g, 0.06), CORDA, chanfro=0.02, giro=28)

# Tatuagens: faixas no braço da frente, uma onda no ombro e um símbolo no peito.
o = h.ombro
for i, z in enumerate((1.16, 1.1, 1.04)):
    h.tubo(f"tatuagem_braco_{i}", "braco_f", (0, -o, z + 0.02), (0, -o, z), 0.078 * g, 0.076 * g, TATUAGEM)
h.esfera("tatuagem_ombro", "braco_f", (0.0, -o - 0.02, 1.27), 0.08 * g, TATUAGEM, escala=(1, 0.8, 0.8))
h.tubo("tatuagem_ante", "ante_f", (0, -o, 0.92), (0, -o, 0.86), 0.062 * g, 0.06 * g, TATUAGEM)
h.caixa("tatuagem_peito", "tronco", (0.15 * g + 0.02, -0.08, 1.2), (0.03, 0.14, 0.12), TATUAGEM, chanfro=0.02)
for lado, y in (("f", -o), ("t", o)):
    h.tubo(f"munhequeira_{lado}", f"ante_{lado}", (0, y, 0.84), (0, y, 0.77), 0.062 * g, 0.058 * g, BOTA)

# Careca, com barba curta e escura.
h.esfera("barba", "cabeca", (0.07, 0, 1.43), 0.17, BARBA, escala=(1, 1.05, 0.8))


def ancora(osso, origem):
    """Âncora no plano lateral, apontando para +X a partir do punho: argola, haste, travessa e os dois braços."""
    ox, oy, oz = origem

    def p(d, lado=0.0):
        return (ox + d, oy, oz + lado)

    h.tubo("ancora_argola", osso, p(-0.2), p(-0.14), 0.07, 0.07, FERRO, lados=8)
    h.tubo("ancora_haste", osso, p(-0.16), p(0.92), 0.04, 0.045, FERRO, lados=6)
    h.tubo("ancora_travessa", osso, p(0.12, -0.2), p(0.12, 0.2), 0.03, 0.03, FERRO, lados=6)
    h.esfera("ancora_coroa", osso, p(0.92), 0.07, FERRO)
    for nome, s in (("cima", 1), ("baixo", -1)):
        h.tubo(f"ancora_braco_{nome}_1", osso, p(0.92), p(0.84, 0.26 * s), 0.05, 0.045, FERRO, lados=6)
        h.tubo(f"ancora_braco_{nome}_2", osso, p(0.84, 0.26 * s), p(0.66, 0.4 * s), 0.045, 0.04, FERRO, lados=6)
        h.tubo(f"ancora_unha_{nome}", osso, p(0.74, 0.3 * s), p(0.58, 0.5 * s), 0.075, 0.01, FERRO, lados=4)
    h.tubo("ancora_corda", osso, p(-0.02), p(0.08), 0.052, 0.052, CORDA, lados=8)


ancora("arma_mao", (0.02, -o, 0.72))

# Âncora apoiada no ombro, apontando para cima e para trás.
GUARDA = {"braco_f": 60, "ante_f": 70, "arma_mao": 55, "braco_t": -12, "ante_t": 30}
h.acoes_basicas(arma="mao", guarda=GUARDA)
G = GUARDA

# Golpe: ergue a âncora e desce com todo o peso.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -14, "braco_f": 175, "ante_f": 40, "arma_mao": 50, "braco_t": 30, "ante_t": 50, "coxa_f": -6, "canela_f": -10, "coxa_t": 8, "canela_t": -14},
        7: {"tronco": 6, "braco_f": 125, "ante_f": 15, "arma_mao": 10, "braco_t": 0, "ante_t": 40, "coxa_f": 16, "canela_f": -22, "coxa_t": -12, "canela_t": -14},
        10: {"tronco": 26, "braco_f": 50, "ante_f": 5, "arma_mao": -40, "braco_t": -30, "ante_t": 35, "coxa_f": 32, "canela_f": -36, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.08)},
        13: {"tronco": 28, "braco_f": 40, "ante_f": 5, "arma_mao": -46, "braco_t": -34, "ante_t": 35, "coxa_f": 34, "canela_f": -38, "coxa_t": -24, "canela_t": -12, "raiz": (0, -0.09)},
        17: dict(G),
    },
)

# Redemoinho: gira a âncora numa volta inteira em torno do corpo.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": -10, "braco_f": 150, "ante_f": 30, "arma_mao": 30, "braco_t": 40, "ante_t": 50, "coxa_f": 14, "canela_f": -30, "coxa_t": -10, "canela_t": -30, "raiz": (0, -0.08)},
        7: {"tronco": 10, "braco_f": 40, "ante_f": 80, "arma_mao": -80, "braco_t": -20, "ante_t": 40, "coxa_f": 24, "canela_f": -36, "coxa_t": -18, "canela_t": -30, "raiz": (0, -0.1)},
        10: {"tronco": 16, "braco_f": 10, "ante_f": 10, "arma_mao": -150, "braco_t": -40, "ante_t": 40, "coxa_f": 24, "canela_f": -36, "coxa_t": -18, "canela_t": -30, "raiz": (0, -0.1)},
        13: {"tronco": 0, "braco_f": -50, "ante_f": 20, "arma_mao": -200, "braco_t": 30, "ante_t": 40, "coxa_f": 20, "canela_f": -34, "coxa_t": -16, "canela_t": -30, "raiz": (0, -0.1)},
        16: {"tronco": -12, "braco_f": 170, "ante_f": 30, "arma_mao": -300, "braco_t": 50, "ante_t": 50, "coxa_f": 16, "canela_f": -30, "coxa_t": -12, "canela_t": -30, "raiz": (0, -0.08)},
        19: {"tronco": 14, "braco_f": 90, "ante_f": 10, "arma_mao": -340, "braco_t": -20, "ante_t": 40, "coxa_f": 22, "canela_f": -28, "coxa_t": -14, "canela_t": -16, "raiz": (0, -0.05)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/ancora.blend")
