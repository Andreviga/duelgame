"""Sombra (Dojo, assassino): ninja de roupa cinza-escura e cachecol comprido.

Uso: blender -b -P ferramentas/arte/modelos/sombra.py -- --saida arte/fontes/sombra.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide(tamanho=0.9, corpulencia=1.05)
# O osso "arma_costas" aqui é o cachecol, sempre visível; a adaga fica presa direto na mão.
h.arma_padrao = "costas"

PELE = h.mat("pele", (0.8, 0.6, 0.46))
ROUPA = h.mat("roupa", (0.17, 0.18, 0.23))
ROUPA_CLARA = h.mat("roupa_clara", (0.3, 0.32, 0.4))
CACHECOL = h.mat("cachecol", (0.35, 0.1, 0.5))
ACO = h.mat("aco", (0.82, 0.86, 0.92), aspereza=0.3)
OLHO = h.mat("olho", (0.95, 0.95, 1.0), brilho=0.6)

h.corpo(ROUPA, ROUPA, ROUPA, ROUPA_CLARA)
# Capuz fechado: só uma faixa de pele na altura dos olhos.
h.caixa("faixa_dos_olhos", "cabeca", (0.12, 0, 1.58), (0.2, 0.34, 0.09), PELE, chanfro=0.03)
for y in (-0.085, 0.085):
    h.esfera(f"olho_{y}", "cabeca", (0.215, y, 1.58), 0.034, OLHO, escala=(0.6, 1, 0.8))
h.caixa("testeira", "cabeca", (0.1, 0, 1.68), (0.26, 0.4, 0.07), ROUPA_CLARA, chanfro=0.02)

# Faixa na cintura, protetores de antebraço e de canela.
h.caixa("cinto", "tronco", (0, 0, 0.93), (0.3, 0.36, 0.08), ROUPA_CLARA, chanfro=0.03)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.tubo(f"protetor_braco_{lado}", f"ante_{lado}", (0, y, 0.95), (0, y, 0.79), 0.068, 0.062, ROUPA_CLARA)
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"protetor_perna_{lado}", f"canela_{lado}", (0, y, 0.4), (0, y, 0.14), 0.083, 0.07, ROUPA_CLARA)

# Cachecol: volta no pescoço e duas pontas compridas para trás.
h.tubo("cachecol_volta", "tronco", (0, 0, 1.27), (0, 0, 1.37), 0.17, 0.15, CACHECOL, lados=10)
h.caixa("cachecol_ponta_1", "arma_costas", (-0.36, 0.03, 1.3), (0.5, 0.05, 0.13), CACHECOL, chanfro=0.02, giro=-14)
h.caixa("cachecol_ponta_2", "arma_costas", (-0.3, -0.05, 1.2), (0.4, 0.05, 0.11), CACHECOL, chanfro=0.02, giro=-30)

# Adaga curta, segurada para a frente.
o = h.ombro
h.tubo("adaga_cabo", "ante_f", (-0.06, -o, 0.72), (0.06, -o, 0.72), 0.022, 0.022, ROUPA_CLARA, lados=6)
h.tubo("adaga_lamina", "ante_f", (0.06, -o, 0.72), (0.4, -o, 0.72), 0.034, 0.008, ACO, lados=4)

# Guarda baixa, de quem está pronto para correr.
GUARDA = {"braco_f": 25, "ante_f": 70, "braco_t": -30, "ante_t": 60}
h.acoes_basicas(arma="costas", guarda=GUARDA)

# Golpe: puxa a adaga para trás e risca para a frente, com o cachecol acompanhando.
h.acao(
    "atacar",
    {
        1: {"braco_f": 25, "ante_f": 70, "braco_t": -30, "ante_t": 60},
        4: {"tronco": -8, "braco_f": -50, "ante_f": 95, "braco_t": 40, "ante_t": 50, "coxa_f": -8, "canela_f": -12, "coxa_t": 10, "canela_t": -16, "arma_costas": 10},
        7: {"tronco": 18, "braco_f": 95, "ante_f": 10, "braco_t": -45, "ante_t": 40, "coxa_f": 36, "canela_f": -34, "coxa_t": -26, "canela_t": -10, "raiz": (0, -0.08), "arma_costas": -14},
        10: {"tronco": 24, "braco_f": 60, "ante_f": 5, "braco_t": -55, "ante_t": 35, "coxa_f": 40, "canela_f": -38, "coxa_t": -30, "canela_t": -10, "raiz": (0, -0.1), "arma_costas": -20},
        13: {"tronco": 14, "braco_f": 35, "ante_f": 40, "braco_t": -40, "ante_t": 45, "coxa_f": 24, "canela_f": -26, "coxa_t": -16, "canela_t": -10, "raiz": (0, -0.05), "arma_costas": -8},
        17: {"tronco": 4, "braco_f": 25, "ante_f": 70, "braco_t": -30, "ante_t": 60, "coxa_f": 8, "canela_f": -12, "coxa_t": -6, "canela_t": -10},
    },
)

# Passo oculto: agacha fazendo um sinal com as mãos, some, e reaparece golpeando de cima.
h.acao(
    "habilidade",
    {
        1: {"braco_f": 25, "ante_f": 70, "braco_t": -30, "ante_t": 60},
        4: {"tronco": 14, "braco_f": 50, "ante_f": 100, "braco_t": 50, "ante_t": 100, "coxa_f": 40, "canela_f": -80, "coxa_t": 30, "canela_t": -80, "raiz": (0, -0.24), "arma_costas": 12},
        7: {"tronco": 20, "braco_f": 55, "ante_f": 105, "braco_t": 55, "ante_t": 105, "coxa_f": 50, "canela_f": -96, "coxa_t": 40, "canela_t": -96, "raiz": (0, -0.32), "arma_costas": 20},
        10: {"tronco": -10, "braco_f": 170, "ante_f": 30, "braco_t": 40, "ante_t": 60, "coxa_f": 50, "canela_f": -70, "coxa_t": 10, "canela_t": -50, "raiz": (0, 0.1), "arma_costas": -25},
        13: {"tronco": 22, "braco_f": 70, "ante_f": 5, "braco_t": -50, "ante_t": 30, "coxa_f": 44, "canela_f": -40, "coxa_t": -30, "canela_t": -10, "raiz": (0, -0.1), "arma_costas": -18},
        16: {"tronco": 28, "braco_f": 40, "ante_f": 5, "braco_t": -58, "ante_t": 30, "coxa_f": 48, "canela_f": -44, "coxa_t": -34, "canela_t": -10, "raiz": (0, -0.13), "arma_costas": -10},
        19: {"tronco": 16, "braco_f": 30, "ante_f": 40, "braco_t": -40, "ante_t": 45, "coxa_f": 26, "canela_f": -28, "coxa_t": -18, "canela_t": -10, "raiz": (0, -0.06)},
        22: {"tronco": 4, "braco_f": 25, "ante_f": 70, "braco_t": -30, "ante_t": 60, "coxa_f": 8, "canela_f": -12, "coxa_t": -6, "canela_t": -10},
    },
)

h.salvar("arte/fontes/sombra.blend")
