"""Faísca (Monstros, assassino): besouro de tempestade azul-escuro com chifre em forma de raio.

Uso: blender -b -P ferramentas/arte/modelos/faisca.py -- --saida arte/fontes/faisca.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

OMBRO = 0.3
QUADRIL = 0.2


class Besouro(Humanoide):
    """Besouro em pé: corpo redondo, cabeça baixa à frente, quatro patas finas com os nomes
    de braço e perna do humanoide, e o chifre no osso da cabeça."""

    def ossos(self):
        self.ombro = OMBRO
        self.quadril = QUADRIL
        o, q = OMBRO, QUADRIL
        return {
            "raiz": ((0, 0, 0.6), (0, 0, 0.7), None),
            "tronco": ((0, 0, 0.6), (0.06, 0, 1.05), "raiz"),
            "cabeca": ((0.22, 0, 1.0), (0.5, 0, 1.2), "tronco"),
            "braco_f": ((0.2, -o, 0.82), (0.36, -o, 0.6), "tronco"),
            "ante_f": ((0.36, -o, 0.6), (0.5, -o, 0.4), "braco_f"),
            "braco_t": ((0.2, o, 0.82), (0.36, o, 0.6), "tronco"),
            "ante_t": ((0.36, o, 0.6), (0.5, o, 0.4), "braco_t"),
            "coxa_f": ((0, -q, 0.5), (0.1, -q, 0.28), "raiz"),
            "canela_f": ((0.1, -q, 0.28), (0.0, -q, 0.04), "coxa_f"),
            "coxa_t": ((0, q, 0.5), (0.1, q, 0.28), "raiz"),
            "canela_t": ((0.1, q, 0.28), (0.0, q, 0.04), "coxa_t"),
            "arma_mao": ((0.5, -o, 0.4), (0.7, -o, 0.4), "ante_f"),
            # As asas de casca, que se abrem nas costas.
            "arma_costas": ((-0.1, 0, 1.05), (-0.45, 0, 0.7), "tronco"),
        }


h = Besouro(tamanho=1.0)
h.arma_padrao = "costas"

CASCA = h.mat("casca", (0.02, 0.05, 0.2), aspereza=0.7)
CASCA_CLARA = h.mat("casca_clara", (0.05, 0.12, 0.38), aspereza=0.7)
BARRIGA = h.mat("barriga", (0.5, 0.6, 0.8))
PATA = h.mat("pata", (0.03, 0.05, 0.15))
RAIO = h.mat("raio", (1.0, 0.8, 0.1), brilho=1.6)
OLHO = h.mat("olho", (0.7, 0.95, 1.0), brilho=3.0)
ASA = h.mat("asa", (0.6, 0.85, 1.0), brilho=0.8)

o, q = OMBRO, QUADRIL

# Corpo redondo: casca nas costas, barriga clara na frente.
h.esfera("corpo", "tronco", (0.0, 0, 0.78), 0.42, CASCA, escala=(0.95, 1.0, 1.05))
h.esfera("barriga", "tronco", (0.12, 0, 0.74), 0.36, BARRIGA, escala=(0.9, 0.9, 1.0))
h.caixa("divisa_da_casca", "tronco", (-0.3, 0, 0.82), (0.2, 0.03, 0.6), CASCA_CLARA, chanfro=0.0, giro=-14)
for i, z in enumerate((0.62, 0.78, 0.94)):
    h.caixa(f"anel_da_barriga_{i}", "tronco", (0.4, 0, z), (0.1, 0.4, 0.02), CASCA, chanfro=0.0, giro=6)
# Élitros (as asas duras) sobre as costas e a asa fina por baixo.
h.esfera("elitro", "arma_costas", (-0.22, 0, 0.84), 0.36, CASCA_CLARA, escala=(0.6, 1.02, 1.0))
h.caixa("asa_fina", "arma_costas", (-0.34, 0, 0.72), (0.06, 0.5, 0.5), ASA, chanfro=0.02, giro=-30)

# Cabeça: redonda, olhos grandes e brilhantes, mandíbulas pequenas.
h.esfera("cabeca", "cabeca", (0.34, 0, 1.08), 0.24, CASCA, escala=(1, 1.05, 0.9))
for y in (-0.14, 0.14):
    h.esfera(f"olho_{y}", "cabeca", (0.5, y, 1.1), 0.075, OLHO, escala=(0.7, 1, 1.1))
    h.tubo(f"mandibula_{y}", "cabeca", (0.52, y * 0.6, 0.98), (0.64, y * 0.3, 0.92), 0.03, 0.008, PATA, lados=5)

# Chifre em forma de raio: quatro trechos em zigue-zague, subindo para a frente.
pontos = [(0.44, 1.24), (0.58, 1.42), (0.47, 1.48), (0.66, 1.68), (0.58, 1.73), (0.76, 1.9)]
raios = [0.085, 0.07, 0.075, 0.055, 0.06, 0.008]
for i in range(len(pontos) - 1):
    (x1, z1), (x2, z2) = pontos[i], pontos[i + 1]
    h.tubo(f"chifre_{i}", "cabeca", (x1, 0, z1), (x2, 0, z2), raios[i], raios[i + 1], RAIO, lados=4)

# Patas finas com garra na ponta.
for lado, y in (("f", -o), ("t", o)):
    h.tubo(f"braco_{lado}", f"braco_{lado}", (0.2, y, 0.82), (0.36, y, 0.6), 0.05, 0.04, PATA, lados=6)
    h.tubo(f"ante_{lado}", f"ante_{lado}", (0.36, y, 0.6), (0.5, y, 0.4), 0.04, 0.03, PATA, lados=6)
    h.tubo(f"garra_{lado}", f"ante_{lado}", (0.5, y, 0.4), (0.6, y, 0.34), 0.035, 0.005, RAIO, lados=4)
for lado, y in (("f", -q), ("t", q)):
    h.tubo(f"coxa_{lado}", f"coxa_{lado}", (0, y, 0.5), (0.1, y, 0.28), 0.06, 0.045, PATA, lados=6)
    h.tubo(f"canela_{lado}", f"canela_{lado}", (0.1, y, 0.28), (0.0, y, 0.06), 0.045, 0.035, PATA, lados=6)
    h.caixa(f"pe_{lado}", f"canela_{lado}", (0.06, y, 0.035), (0.22, 0.1, 0.07), PATA, chanfro=0.02)

GUARDA = {"braco_f": 6, "ante_f": 10, "braco_t": -6, "ante_t": 10}
h.acoes_basicas(arma="costas", guarda=GUARDA)
G = GUARDA

# Golpe: baixa a cabeça e dá uma chifrada para cima.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": 26, "cabeca": -50, "braco_f": -30, "ante_f": 20, "braco_t": -30, "ante_t": 20, "coxa_f": 20, "canela_f": -40, "coxa_t": -10, "canela_t": -30, "raiz": (0, -0.08), "arma_costas": 10},
        7: {"tronco": 30, "cabeca": -60, "braco_f": -40, "ante_f": 20, "braco_t": -40, "ante_t": 20, "coxa_f": 24, "canela_f": -46, "coxa_t": -12, "canela_t": -34, "raiz": (0, -0.1), "arma_costas": 16},
        10: {"tronco": -14, "cabeca": 34, "braco_f": 50, "ante_f": 10, "braco_t": 40, "ante_t": 10, "coxa_f": 30, "canela_f": -20, "coxa_t": -24, "canela_t": -8, "raiz": (0, 0.06), "arma_costas": 40},
        13: {"tronco": -18, "cabeca": 40, "braco_f": 60, "ante_f": 10, "braco_t": 50, "ante_t": 10, "coxa_f": 30, "canela_f": -18, "coxa_t": -26, "canela_t": -8, "raiz": (0, 0.08), "arma_costas": 30},
        17: dict(G),
    },
)

# Descarga: abre as asas, encolhe carregando e dispara para a frente com o chifre apontado.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 10, "cabeca": -20, "braco_f": 40, "ante_f": 60, "braco_t": 30, "ante_t": 60, "coxa_f": 30, "canela_f": -60, "coxa_t": 10, "canela_t": -50, "raiz": (0, -0.14), "arma_costas": 40},
        7: {"tronco": 14, "cabeca": -30, "braco_f": 50, "ante_f": 70, "braco_t": 40, "ante_t": 70, "coxa_f": 36, "canela_f": -70, "coxa_t": 14, "canela_t": -60, "raiz": (0, -0.18), "arma_costas": 70},
        10: {"tronco": 50, "cabeca": 0, "braco_f": -70, "ante_f": 10, "braco_t": -80, "ante_t": 10, "coxa_f": -40, "canela_f": -20, "coxa_t": -60, "canela_t": -10, "raiz": (0, 0.16), "arma_costas": 80},
        13: {"tronco": 56, "cabeca": -4, "braco_f": -80, "ante_f": 10, "braco_t": -90, "ante_t": 10, "coxa_f": -50, "canela_f": -16, "coxa_t": -66, "canela_t": -10, "raiz": (0, 0.2), "arma_costas": 60},
        16: {"tronco": 52, "cabeca": 2, "braco_f": -74, "ante_f": 10, "braco_t": -86, "ante_t": 10, "coxa_f": -44, "canela_f": -18, "coxa_t": -62, "canela_t": -10, "raiz": (0, 0.18), "arma_costas": 84},
        19: {"tronco": 16, "cabeca": -10, "braco_f": 20, "ante_f": 30, "braco_t": 10, "ante_t": 30, "coxa_f": 20, "canela_f": -40, "coxa_t": -6, "canela_t": -30, "raiz": (0, -0.06), "arma_costas": 30},
        22: dict(G),
    },
)

h.salvar("arte/fontes/faisca.blend")
