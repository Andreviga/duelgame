"""Brasa (Monstros, corpo a corpo): gorila de lava com rachaduras brilhantes.

Uso: blender -b -P ferramentas/arte/modelos/brasa.py -- --saida arte/fontes/brasa.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

OMBRO = 0.34
QUADRIL = 0.16


class Gorila(Humanoide):
    """Mesmos nomes de osso do humanoide, com outro desenho: tronco inclinado para a frente,
    braços compridos que chegam ao chão e pernas curtas."""

    def ossos(self):
        self.ombro = OMBRO
        self.quadril = QUADRIL
        o, q = OMBRO, QUADRIL
        return {
            "raiz": ((0, 0, 0.62), (0, 0, 0.72), None),
            "tronco": ((0, 0, 0.62), (0.22, 0, 1.12), "raiz"),
            "cabeca": ((0.26, 0, 1.12), (0.4, 0, 1.42), "tronco"),
            "braco_f": ((0.2, -o, 1.1), (0.26, -o, 0.66), "tronco"),
            "ante_f": ((0.26, -o, 0.66), (0.34, -o, 0.18), "braco_f"),
            "braco_t": ((0.2, o, 1.1), (0.26, o, 0.66), "tronco"),
            "ante_t": ((0.26, o, 0.66), (0.34, o, 0.18), "braco_t"),
            "coxa_f": ((-0.02, -q, 0.62), (0.04, -q, 0.34), "raiz"),
            "canela_f": ((0.04, -q, 0.34), (-0.02, -q, 0.06), "coxa_f"),
            "coxa_t": ((-0.02, q, 0.62), (0.04, q, 0.34), "raiz"),
            "canela_t": ((0.04, q, 0.34), (-0.02, q, 0.06), "coxa_t"),
            "arma_mao": ((0.34, -o, 0.18), (0.6, -o, 0.18), "ante_f"),
            "arma_costas": ((-0.1, 0, 1.0), (-0.1, 0, 1.3), "tronco"),
        }


h = Gorila(tamanho=1.05)

ROCHA = h.mat("rocha", (0.06, 0.04, 0.045), aspereza=0.95)
ROCHA_CLARA = h.mat("rocha_clara", (0.13, 0.08, 0.07), aspereza=0.95)
LAVA = h.mat("lava", (1.0, 0.3, 0.02), brilho=2.2)
LAVA_CLARA = h.mat("lava_clara", (1.0, 0.55, 0.08), brilho=2.6)

o, q = OMBRO, QUADRIL

# Tronco: costas largas e arredondadas, peito de rocha mais clara, barriga.
h.esfera("costas", "tronco", (0.08, 0, 0.98), 0.4, ROCHA, escala=(0.95, 1.1, 0.95))
h.esfera("barriga", "tronco", (0.08, 0, 0.72), 0.32, ROCHA, escala=(1, 1.05, 0.9))
h.caixa("peito", "tronco", (0.34, 0, 0.94), (0.2, 0.52, 0.36), ROCHA_CLARA, chanfro=0.08, giro=22)
h.esfera("bacia", "raiz", (-0.02, 0, 0.6), 0.26, ROCHA, escala=(1, 1.1, 0.8))
# Rachaduras de lava nas costas, no peito e na barriga.
for i, (x, z, c, g) in enumerate(((-0.2, 1.12, 0.3, 40), (-0.26, 0.92, 0.26, -30), (-0.1, 1.3, 0.22, -10), (-0.2, 0.72, 0.2, 60))):
    h.caixa(f"rachadura_costas_{i}", "tronco", (x, -0.12 + 0.08 * i, z), (0.05, 0.5, c), LAVA, chanfro=0.0, giro=g)
h.caixa("rachadura_peito_1", "tronco", (0.44, -0.08, 0.96), (0.03, 0.06, 0.3), LAVA_CLARA, chanfro=0.0, giro=30)
h.caixa("rachadura_peito_2", "tronco", (0.42, 0.1, 0.84), (0.03, 0.06, 0.2), LAVA_CLARA, chanfro=0.0, giro=-10)

# Cabeça pequena e baixa, com crista, sobrancelha pesada, olhos de lava e mandíbula.
h.esfera("cabeca", "cabeca", (0.36, 0, 1.3), 0.21, ROCHA, escala=(1, 0.95, 1))
h.caixa("crista", "cabeca", (0.28, 0, 1.47), (0.26, 0.2, 0.14), ROCHA, chanfro=0.05, giro=-20)
h.caixa("sobrancelha", "cabeca", (0.5, 0, 1.37), (0.12, 0.36, 0.07), ROCHA_CLARA, chanfro=0.02, giro=-10)
h.caixa("focinho", "cabeca", (0.52, 0, 1.22), (0.16, 0.3, 0.16), ROCHA_CLARA, chanfro=0.05)
h.caixa("boca", "cabeca", (0.59, 0, 1.19), (0.03, 0.2, 0.035), LAVA_CLARA, chanfro=0.0)
for y in (-0.09, 0.09):
    h.esfera(f"olho_{y}", "cabeca", (0.54, y, 1.32), 0.035, LAVA_CLARA)

# Braços enormes: ombro redondo, antebraço que engrossa até um punho de pedra.
for lado, y in (("f", -o), ("t", o)):
    h.esfera(f"ombro_{lado}", f"braco_{lado}", (0.2, y, 1.1), 0.19, ROCHA)
    h.tubo(f"braco_{lado}", f"braco_{lado}", (0.2, y, 1.1), (0.26, y, 0.66), 0.15, 0.12, ROCHA)
    h.esfera(f"cotovelo_{lado}", f"ante_{lado}", (0.26, y, 0.66), 0.13, ROCHA)
    h.tubo(f"ante_{lado}", f"ante_{lado}", (0.26, y, 0.66), (0.33, y, 0.26), 0.12, 0.17, ROCHA)
    h.caixa(f"punho_{lado}", f"ante_{lado}", (0.35, y, 0.17), (0.3, 0.26, 0.28), ROCHA_CLARA, chanfro=0.08)
    h.tubo(f"anel_de_lava_{lado}", f"ante_{lado}", (0.31, y, 0.36), (0.32, y, 0.31), 0.165, 0.175, LAVA)
    h.caixa(f"rachadura_braco_{lado}", f"braco_{lado}", (0.24, y * 1.42, 0.9), (0.05, 0.03, 0.3), LAVA, chanfro=0.0, giro=10)
# Pernas curtas e grossas.
for lado, y in (("f", -q), ("t", q)):
    h.tubo(f"coxa_{lado}", f"coxa_{lado}", (-0.02, y, 0.62), (0.04, y, 0.34), 0.15, 0.12, ROCHA)
    h.esfera(f"joelho_{lado}", f"canela_{lado}", (0.04, y, 0.34), 0.12, ROCHA)
    h.tubo(f"canela_{lado}", f"canela_{lado}", (0.04, y, 0.34), (-0.01, y, 0.1), 0.11, 0.1, ROCHA)
    h.caixa(f"pe_{lado}", f"canela_{lado}", (0.06, y, 0.06), (0.32, 0.2, 0.12), ROCHA_CLARA, chanfro=0.04)

# Anda apoiado nos punhos: os braços quase não saem do lugar na postura de descanso.
GUARDA = {"braco_f": 4, "ante_f": 0, "braco_t": -4, "ante_t": 0}
h.acoes_basicas(guarda=GUARDA)
G = GUARDA

# Golpe: ergue os dois punhos e desce como uma marreta.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -30, "cabeca": -10, "braco_f": 170, "ante_f": 40, "braco_t": 160, "ante_t": 40, "coxa_f": -8, "canela_f": -10, "coxa_t": 6, "canela_t": -12, "raiz": (0, 0.04)},
        7: {"tronco": -20, "braco_f": 150, "ante_f": 20, "braco_t": 140, "ante_t": 20, "coxa_f": 10, "canela_f": -14, "coxa_t": -8, "canela_t": -10, "raiz": (0, 0.03)},
        10: {"tronco": 18, "cabeca": 10, "braco_f": 50, "ante_f": 5, "braco_t": 40, "ante_t": 5, "coxa_f": 26, "canela_f": -30, "coxa_t": -18, "canela_t": -10, "raiz": (0, -0.06)},
        13: {"tronco": 22, "cabeca": 12, "braco_f": 30, "ante_f": 0, "braco_t": 22, "ante_t": 0, "coxa_f": 28, "canela_f": -32, "coxa_t": -20, "canela_t": -10, "raiz": (0, -0.08)},
        17: dict(G),
    },
)

# Erupção: bate no peito, salta e esmurra o chão com os dois punhos.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": -34, "cabeca": -24, "braco_f": 60, "ante_f": 120, "braco_t": 100, "ante_t": 100, "coxa_f": 6, "canela_f": -14, "coxa_t": -6, "canela_t": -14},
        7: {"tronco": -32, "cabeca": -26, "braco_f": 100, "ante_f": 100, "braco_t": 60, "ante_t": 120, "coxa_f": 6, "canela_f": -16, "coxa_t": -6, "canela_t": -16, "raiz": (0, -0.02)},
        10: {"tronco": -36, "cabeca": -10, "braco_f": 190, "ante_f": 20, "braco_t": 180, "ante_t": 20, "coxa_f": 30, "canela_f": -50, "coxa_t": 10, "canela_t": -40, "raiz": (0, 0.3)},
        13: {"tronco": -10, "braco_f": 140, "ante_f": 10, "braco_t": 130, "ante_t": 10, "coxa_f": 40, "canela_f": -60, "coxa_t": 20, "canela_t": -50, "raiz": (0, 0.22)},
        16: {"tronco": 30, "cabeca": 16, "braco_f": 20, "ante_f": -6, "braco_t": 12, "ante_t": -6, "coxa_f": 40, "canela_f": -56, "coxa_t": -20, "canela_t": -30, "raiz": (0, -0.14)},
        19: {"tronco": 26, "cabeca": 14, "braco_f": 24, "ante_f": -4, "braco_t": 16, "ante_t": -4, "coxa_f": 36, "canela_f": -50, "coxa_t": -18, "canela_t": -26, "raiz": (0, -0.12)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/brasa.blend")
