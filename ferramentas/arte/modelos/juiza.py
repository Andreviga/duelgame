"""Juíza (Futebol, corpo a corpo): árbitra de preto e amarelo, apito no pescoço e cartão no bolso.

Uso: blender -b -P ferramentas/arte/modelos/juiza.py -- --saida arte/fontes/juiza.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide()
# O osso "arma_mao" é o cartão: só aparece quando ela o ergue ("mao"); no resto do tempo fica no bolso.
h.arma_padrao = "costas"

PELE = h.mat("pele", (0.45, 0.29, 0.2))
PRETO = h.mat("preto", (0.07, 0.07, 0.09))
AMARELO = h.mat("amarelo", (0.98, 0.84, 0.16))
CINZA = h.mat("cinza", (0.3, 0.31, 0.35))
CHUTEIRA = h.mat("chuteira", (0.12, 0.12, 0.14))
CABELO = h.mat("cabelo", (0.1, 0.07, 0.06))
CARTAO = h.mat("cartao", (0.9, 0.1, 0.12), brilho=0.9)
APITO = h.mat("apito", (0.8, 0.82, 0.86), aspereza=0.3)
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, PRETO, PELE, CHUTEIRA, manga=PELE)
h.rosto(OLHO, sobrancelha=CABELO)
h.uniforme_curto(PRETO, PRETO, PRETO)

# Uniforme de árbitra: gola e punhos amarelos, bolso no peito, meião com faixa. Nenhum escudo.
h.caixa("gola", "tronco", (0.02, 0, 1.31), (0.2, 0.24, 0.045), AMARELO, chanfro=0.015)
h.caixa("barra_da_camisa", "tronco", (0, 0, 0.9), (0.31, 0.37, 0.05), PRETO, chanfro=0.02)
h.caixa("bolso", "tronco", (0.155, -0.09, 1.18), (0.02, 0.1, 0.1), CINZA, chanfro=0.01)
h.caixa("cartao_no_bolso", "tronco", (0.162, -0.09, 1.23), (0.015, 0.07, 0.05), CARTAO, chanfro=0.0)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"punho_da_manga_{lado}", f"braco_{lado}", (0, y, 1.14), (0, y, 1.11), 0.09, 0.088, AMARELO)
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"faixa_do_meiao_{lado}", f"canela_{lado}", (0, y, 0.44), (0, y, 0.39), 0.084, 0.082, AMARELO)
# Relógio no pulso de trás e apito pendurado no pescoço.
h.tubo("relogio", "ante_t", (0, h.ombro, 0.82), (0, h.ombro, 0.78), 0.062, 0.062, AMARELO)
h.tubo("cordao", "tronco", (0.1, 0, 1.3), (0.15, 0, 1.12), 0.012, 0.012, AMARELO, lados=5)
h.caixa("apito", "tronco", (0.17, 0, 1.09), (0.05, 0.07, 0.05), APITO, chanfro=0.015)

# Cabelo preso em rabo de cavalo.
h.esfera("cabelo", "cabeca", (-0.04, 0, 1.6), 0.236, CABELO, escala=(1, 1, 0.8))
h.tubo("rabo", "cabeca", (-0.2, 0, 1.62), (-0.34, 0, 1.36), 0.085, 0.03, CABELO, lados=7)
h.caixa("elastico", "cabeca", (-0.2, 0, 1.62), (0.05, 0.1, 0.1), AMARELO, chanfro=0.02)

# O cartão na mão: fino e alto, apontando para cima quando o braço está erguido.
o = h.ombro
h.caixa("cartao", "arma_mao", (0.1, -o, 0.72), (0.2, 0.02, 0.13), CARTAO, chanfro=0.0)

GUARDA = {"braco_f": 14, "ante_f": 40, "braco_t": -14, "ante_t": 40}
h.acoes_basicas(arma="costas", guarda=GUARDA)
G = GUARDA

# Golpe: empurrão de ombro com o antebraço, de quem aparta uma briga.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -10, "braco_f": -30, "ante_f": 110, "braco_t": -30, "ante_t": 60, "coxa_f": -8, "canela_f": -12, "coxa_t": 8, "canela_t": -16},
        7: {"tronco": 20, "braco_f": 80, "ante_f": 40, "braco_t": -50, "ante_t": 40, "coxa_f": 34, "canela_f": -34, "coxa_t": -24, "canela_t": -10, "raiz": (0, -0.07)},
        10: {"tronco": 26, "braco_f": 92, "ante_f": 8, "braco_t": -58, "ante_t": 36, "coxa_f": 38, "canela_f": -38, "coxa_t": -28, "canela_t": -10, "raiz": (0, -0.09)},
        13: {"tronco": 12, "braco_f": 50, "ante_f": 36, "braco_t": -30, "ante_t": 40, "coxa_f": 20, "canela_f": -22, "coxa_t": -14, "canela_t": -10, "raiz": (0, -0.04)},
        17: dict(G),
    },
)

# Cartão vermelho: apita, tira o cartão do bolso e ergue bem alto, de braço esticado.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 4, "braco_f": 50, "ante_f": 110, "braco_t": 60, "ante_t": 120, "cabeca": 6},
        7: {"arma": "mao", "tronco": -4, "braco_f": 120, "ante_f": 40, "arma_mao": 70, "braco_t": 62, "ante_t": 124, "coxa_f": 6, "canela_f": -8},
        10: {"arma": "mao", "tronco": -10, "braco_f": 176, "ante_f": 4, "arma_mao": 88, "braco_t": -20, "ante_t": 30, "coxa_f": 10, "canela_f": -10, "coxa_t": -8, "canela_t": -6, "raiz": (0, 0.04)},
        13: {"arma": "mao", "tronco": -12, "braco_f": 180, "ante_f": 0, "arma_mao": 90, "braco_t": -24, "ante_t": 26, "coxa_f": 10, "canela_f": -10, "coxa_t": -8, "canela_t": -6, "raiz": (0, 0.05)},
        16: {"arma": "mao", "tronco": -10, "braco_f": 178, "ante_f": 2, "arma_mao": 86, "braco_t": -22, "ante_t": 28, "coxa_f": 10, "canela_f": -10, "coxa_t": -8, "canela_t": -6, "raiz": (0, 0.04)},
        19: {"arma": "mao", "tronco": 0, "braco_f": 90, "ante_f": 60, "arma_mao": 60, "braco_t": -16, "ante_t": 36},
        22: dict(G),
    },
)

h.salvar("arte/fontes/juiza.blend")
