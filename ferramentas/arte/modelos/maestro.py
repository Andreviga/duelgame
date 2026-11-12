"""Maestro (Futebol, à distância): meia armador de uniforme roxo e dourado, faixa de capitão e bola luminosa.

Uso: blender -b -P ferramentas/arte/modelos/maestro.py -- --saida arte/fontes/maestro.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.97)
# O osso "arma_costas" aqui é a bola: "costas" = bola no pé, "mao" = bola já chutada (some).
h.arma_padrao = "costas"

PELE = h.mat("pele", (0.55, 0.36, 0.24))
ROXO = h.mat("roxo", (0.36, 0.12, 0.6))
ROXO_ESCURO = h.mat("roxo_escuro", (0.2, 0.06, 0.36))
DOURADO = h.mat("dourado", (0.96, 0.76, 0.2))
CHUTEIRA = h.mat("chuteira", (0.95, 0.95, 0.97))
CABELO = h.mat("cabelo", (0.06, 0.05, 0.05))
BOLA = h.mat("bola", (0.6, 0.95, 1.0), brilho=2.5)
BOLA_GOMO = h.mat("bola_gomo", (0.95, 0.76, 0.2), brilho=1.0)
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, ROXO, PELE, CHUTEIRA, manga=PELE)
h.rosto(OLHO, sobrancelha=CABELO)
h.uniforme_curto(ROXO, ROXO_ESCURO, DOURADO)

# Camisa com faixa dourada no peito e gola; nenhuma marca ou escudo.
h.caixa("faixa_do_peito", "tronco", (0, 0, 1.16), (0.31, 0.37, 0.07), DOURADO, chanfro=0.02)
h.caixa("gola", "tronco", (0.02, 0, 1.31), (0.2, 0.24, 0.04), DOURADO, chanfro=0.015)
h.caixa("barra_da_camisa", "tronco", (0, 0, 0.9), (0.31, 0.37, 0.05), ROXO, chanfro=0.02)
# Faixa de capitão no braço da frente.
h.tubo("faixa_de_capitao", "braco_f", (0, -h.ombro, 1.1), (0, -h.ombro, 1.04), 0.086, 0.082, DOURADO)
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"lista_do_meiao_{lado}", f"canela_{lado}", (0, y, 0.44), (0, y, 0.39), 0.084, 0.082, ROXO)

# Cabelo curto com topete.
h.esfera("cabelo", "cabeca", (-0.03, 0, 1.61), 0.232, CABELO, escala=(1, 1, 0.74))
h.esfera("topete", "cabeca", (0.1, 0, 1.76), 0.1, CABELO, escala=(1.3, 1, 0.8))

# Bola luminosa junto ao pé da frente.
BX, BZ = 0.36, 0.14
h.esfera("bola", "arma_costas", (BX, -0.06, BZ), 0.14, BOLA)
for i, (dx, dz) in enumerate(((0.0, 0.1), (0.09, -0.04), (-0.09, -0.04))):
    h.esfera(f"gomo_{i}", "arma_costas", (BX + dx, -0.17, BZ + dz), 0.04, BOLA_GOMO, escala=(1, 0.5, 1))

GUARDA = {"braco_f": 10, "ante_f": 25, "braco_t": -10, "ante_t": 25}
h.acoes_basicas(arma="costas", guarda=GUARDA)
G = GUARDA

# Passe: toque seco de chapa; a bola sai no quadro do contato.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": 6, "braco_f": 40, "ante_f": 30, "braco_t": -40, "ante_t": 30, "coxa_f": -34, "canela_f": -50, "coxa_t": 6, "canela_t": -14},
        7: {"arma": "mao", "tronco": -6, "braco_f": -40, "ante_f": 30, "braco_t": 50, "ante_t": 30, "coxa_f": 56, "canela_f": -8, "coxa_t": -8, "canela_t": -10},
        10: {"arma": "mao", "tronco": -10, "braco_f": -50, "ante_f": 30, "braco_t": 60, "ante_t": 30, "coxa_f": 72, "canela_f": -4, "coxa_t": -10, "canela_t": -10, "raiz": (0, 0.02)},
        13: {"arma": "mao", "tronco": 0, "braco_f": -10, "ante_f": 30, "braco_t": 20, "ante_t": 30, "coxa_f": 30, "canela_f": -30, "coxa_t": -6, "canela_t": -10},
        17: dict(G),
    },
)

# Folha seca: toma distância, arma a perna bem atrás e bate por baixo da bola, com o corpo inclinado.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 10, "braco_f": 30, "ante_f": 30, "braco_t": -30, "ante_t": 30, "coxa_f": 20, "canela_f": -30, "coxa_t": -20, "canela_t": -20, "raiz": (0, -0.04)},
        7: {"tronco": 14, "braco_f": 70, "ante_f": 30, "braco_t": -70, "ante_t": 30, "coxa_f": -50, "canela_f": -80, "coxa_t": 14, "canela_t": -24, "raiz": (0, -0.05)},
        10: {"tronco": 16, "braco_f": 80, "ante_f": 30, "braco_t": -80, "ante_t": 30, "coxa_f": -60, "canela_f": -90, "coxa_t": 16, "canela_t": -26, "raiz": (0, -0.06)},
        13: {"arma": "mao", "tronco": -16, "braco_f": -60, "ante_f": 30, "braco_t": 80, "ante_t": 30, "coxa_f": 70, "canela_f": -6, "coxa_t": -10, "canela_t": -12, "raiz": (-6, 0.0)},
        16: {"arma": "mao", "tronco": -24, "braco_f": -70, "ante_f": 30, "braco_t": 100, "ante_t": 30, "coxa_f": 100, "canela_f": -4, "coxa_t": -14, "canela_t": -8, "raiz": (-10, 0.06)},
        19: {"arma": "mao", "tronco": -8, "braco_f": -20, "ante_f": 30, "braco_t": 40, "ante_t": 30, "coxa_f": 50, "canela_f": -40, "coxa_t": -8, "canela_t": -10, "raiz": (-3, 0.02)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/maestro.blend")
