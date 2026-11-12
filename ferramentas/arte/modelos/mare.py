"""Capitã Maré (Piratas, corpo a corpo): capitã de casaco azul-marinho, sabre curvo e gancho com corrente.

Uso: blender -b -P ferramentas/arte/modelos/mare.py -- --saida arte/fontes/mare.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

h = Humanoide()
h.arma_padrao = "mao"

PELE = h.mat("pele", (0.6, 0.4, 0.28))
CASACO = h.mat("casaco", (0.07, 0.13, 0.36))
CASACO_ESCURO = h.mat("casaco_escuro", (0.04, 0.07, 0.2))
CAMISA = h.mat("camisa", (0.93, 0.9, 0.82))
CALCA = h.mat("calca", (0.5, 0.42, 0.3))
BOTA = h.mat("bota", (0.16, 0.1, 0.07))
OURO = h.mat("ouro", (0.95, 0.75, 0.2), aspereza=0.4)
CABELO = h.mat("cabelo", (0.45, 0.12, 0.08))
ACO = h.mat("aco", (0.84, 0.88, 0.93), aspereza=0.3)
FERRO = h.mat("ferro", (0.42, 0.44, 0.5), aspereza=0.45)
PENA = h.mat("pena", (0.85, 0.2, 0.2))
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

h.corpo(PELE, CASACO, CALCA, BOTA)
h.rosto(OLHO, sobrancelha=CABELO)

# Casaco comprido aberto na frente, com camisa clara, botões e punhos dourados.
h.tubo("aba_do_casaco", "raiz", (-0.03, 0, 0.92), (-0.08, 0, 0.5), 0.2, 0.3, CASACO, lados=10)
h.caixa("camisa", "tronco", (0.13, 0, 1.12), (0.06, 0.18, 0.36), CAMISA, chanfro=0.02)
h.caixa("cinto", "tronco", (0, 0, 0.93), (0.33, 0.39, 0.08), BOTA, chanfro=0.03)
h.caixa("fivela", "tronco", (0.17, 0, 0.93), (0.04, 0.1, 0.1), OURO, chanfro=0.015)
for z in (1.04, 1.14, 1.24):
    h.esfera(f"botao_{z}", "tronco", (0.155, -0.11, z), 0.022, OURO)
for lado, y in (("f", -h.ombro), ("t", h.ombro)):
    h.caixa(f"dragona_{lado}", f"braco_{lado}", (0, y, 1.33), (0.2, 0.16, 0.05), OURO, chanfro=0.02)
    h.tubo(f"punho_{lado}", f"ante_{lado}", (0, y, 0.86), (0, y, 0.78), 0.075, 0.085, OURO)
# Botas de cano alto.
for lado, y in (("f", -h.quadril), ("t", h.quadril)):
    h.tubo(f"cano_{lado}", f"canela_{lado}", (0, y, 0.44), (0, y, 0.1), 0.1, 0.08, BOTA)
    h.tubo(f"dobra_{lado}", f"canela_{lado}", (0, y, 0.46), (0, y, 0.4), 0.115, 0.105, BOTA)

# Cabelo ruivo comprido e chapéu de capitã com pena.
h.esfera("cabelo", "cabeca", (-0.05, 0, 1.61), 0.235, CABELO, escala=(1, 1, 0.78))
h.tubo("rabo", "cabeca", (-0.2, 0, 1.5), (-0.3, 0, 1.08), 0.1, 0.03, CABELO, lados=8)
h.caixa("aba_do_chapeu", "cabeca", (0.0, 0, 1.73), (0.66, 0.5, 0.05), CASACO_ESCURO, chanfro=0.02, giro=-6)
h.caixa("copa_do_chapeu", "cabeca", (-0.02, 0, 1.82), (0.36, 0.34, 0.16), CASACO_ESCURO, chanfro=0.05, giro=-6)
h.caixa("fita_do_chapeu", "cabeca", (-0.01, 0, 1.765), (0.38, 0.36, 0.04), OURO, chanfro=0.01, giro=-6)
h.tubo("pena", "cabeca", (-0.1, -0.12, 1.84), (-0.42, -0.12, 2.02), 0.05, 0.015, PENA, lados=5)

# Sabre curvo na mão da frente: três trechos, cada um um pouco mais inclinado.
o = h.ombro
h.tubo("sabre_cabo", "arma_mao", (-0.1, -o, 0.72), (0.06, -o, 0.72), 0.026, 0.026, BOTA, lados=6)
h.tubo("sabre_guarda", "arma_mao", (0.05, -o, 0.66), (0.09, -o, 0.8), 0.03, 0.03, OURO, lados=6)
h.tubo("sabre_1", "arma_mao", (0.07, -o, 0.72), (0.38, -o, 0.74), 0.034, 0.036, ACO, lados=4)
h.tubo("sabre_2", "arma_mao", (0.36, -o, 0.74), (0.64, -o, 0.81), 0.036, 0.032, ACO, lados=4)
h.tubo("sabre_3", "arma_mao", (0.62, -o, 0.805), (0.84, -o, 0.92), 0.032, 0.006, ACO, lados=4)

# Gancho no lugar da mão de trás, com alguns elos de corrente pendurados.
h.tubo("gancho_base", "ante_t", (0, o, 0.78), (0, o, 0.68), 0.07, 0.05, FERRO, lados=8)
h.tubo("gancho_1", "ante_t", (0, o, 0.69), (0.02, o, 0.56), 0.022, 0.022, FERRO, lados=6)
h.tubo("gancho_2", "ante_t", (0.02, o, 0.57), (0.11, o, 0.52), 0.022, 0.022, FERRO, lados=6)
h.tubo("gancho_3", "ante_t", (0.11, o, 0.52), (0.15, o, 0.62), 0.022, 0.006, FERRO, lados=6)
for i in range(3):
    h.esfera(f"elo_{i}", "ante_t", (-0.07, o, 0.74 - i * 0.07), 0.03, FERRO)

GUARDA = {"braco_f": 30, "ante_f": 25, "arma_mao": -25, "braco_t": -15, "ante_t": 40}
h.acoes_basicas(arma="mao", guarda=GUARDA)
G = GUARDA

# Golpe: corte largo com o sabre, de trás e de cima para a frente.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -12, "braco_f": 170, "ante_f": 50, "arma_mao": 40, "braco_t": 20, "ante_t": 40, "coxa_f": -6, "canela_f": -10, "coxa_t": 6, "canela_t": -12},
        7: {"tronco": 6, "braco_f": 115, "ante_f": 15, "arma_mao": 0, "braco_t": -10, "ante_t": 40, "coxa_f": 16, "canela_f": -22, "coxa_t": -12, "canela_t": -14},
        10: {"tronco": 20, "braco_f": 50, "ante_f": 5, "arma_mao": -30, "braco_t": -30, "ante_t": 35, "coxa_f": 30, "canela_f": -32, "coxa_t": -22, "canela_t": -12, "raiz": (0, -0.06)},
        13: {"tronco": 16, "braco_f": 30, "ante_f": 20, "arma_mao": -10, "braco_t": -24, "ante_t": 36, "coxa_f": 22, "canela_f": -24, "coxa_t": -16, "canela_t": -12, "raiz": (0, -0.04)},
        17: dict(G),
    },
)

# Gancho: recolhe o braço de trás, lança o gancho para a frente e puxa de volta já cortando.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": -14, "braco_f": 10, "ante_f": 60, "arma_mao": 40, "braco_t": -70, "ante_t": 80, "coxa_f": -8, "canela_f": -12, "coxa_t": 8, "canela_t": -16},
        7: {"tronco": 26, "braco_f": -30, "ante_f": 50, "arma_mao": 30, "braco_t": 95, "ante_t": 5, "coxa_f": 40, "canela_f": -40, "coxa_t": -30, "canela_t": -10, "raiz": (0, -0.1)},
        10: {"tronco": 30, "braco_f": -36, "ante_f": 50, "arma_mao": 30, "braco_t": 100, "ante_t": 0, "coxa_f": 44, "canela_f": -44, "coxa_t": -32, "canela_t": -10, "raiz": (0, -0.12)},
        13: {"tronco": 4, "braco_f": 150, "ante_f": 50, "arma_mao": 40, "braco_t": 40, "ante_t": 90, "coxa_f": 14, "canela_f": -20, "coxa_t": -8, "canela_t": -12, "raiz": (0, -0.03)},
        16: {"tronco": 22, "braco_f": 55, "ante_f": 5, "arma_mao": -30, "braco_t": -30, "ante_t": 60, "coxa_f": 32, "canela_f": -34, "coxa_t": -24, "canela_t": -12, "raiz": (0, -0.07)},
        19: {"tronco": 14, "braco_f": 35, "ante_f": 25, "arma_mao": 0, "braco_t": -20, "ante_t": 45, "coxa_f": 20, "canela_f": -22, "coxa_t": -14, "canela_t": -12, "raiz": (0, -0.03)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/mare.blend")
