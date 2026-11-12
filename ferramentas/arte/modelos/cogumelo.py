"""Cogumelo (Monstros, à distância): cogumelo saltador de chapéu roxo, que cospe esporos.

Uso: blender -b -P ferramentas/arte/modelos/cogumelo.py -- --saida arte/fontes/cogumelo.blend
"""

import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

OMBRO = 0.24
QUADRIL = 0.13


class Cogumelo(Humanoide):
    """Corpo curto (o pé do cogumelo), chapéu grande no osso da cabeça, bracinhos e pernas curtas.
    Mesmos nomes de osso do humanoide, para as ações básicas valerem."""

    def ossos(self):
        self.ombro = OMBRO
        self.quadril = QUADRIL
        o, q = OMBRO, QUADRIL
        return {
            "raiz": ((0, 0, 0.3), (0, 0, 0.4), None),
            "tronco": ((0, 0, 0.3), (0, 0, 0.74), "raiz"),
            "cabeca": ((0, 0, 0.74), (0, 0, 1.2), "tronco"),
            "braco_f": ((0.04, -o, 0.62), (0.08, -o, 0.44), "tronco"),
            "ante_f": ((0.08, -o, 0.44), (0.12, -o, 0.3), "braco_f"),
            "braco_t": ((0.04, o, 0.62), (0.08, o, 0.44), "tronco"),
            "ante_t": ((0.08, o, 0.44), (0.12, o, 0.3), "braco_t"),
            "coxa_f": ((0, -q, 0.3), (0.02, -q, 0.17), "raiz"),
            "canela_f": ((0.02, -q, 0.17), (0, -q, 0.04), "coxa_f"),
            "coxa_t": ((0, q, 0.3), (0.02, q, 0.17), "raiz"),
            "canela_t": ((0.02, q, 0.17), (0, q, 0.04), "coxa_t"),
            "arma_mao": ((0.12, -o, 0.3), (0.3, -o, 0.3), "ante_f"),
            "arma_costas": ((-0.1, 0, 0.6), (-0.1, 0, 0.8), "tronco"),
        }


h = Cogumelo(tamanho=1.0)

PE = h.mat("pe_do_cogumelo", (0.9, 0.85, 0.72))
PE_ESCURO = h.mat("pe_escuro", (0.7, 0.62, 0.5))
CHAPEU = h.mat("chapeu", (0.42, 0.16, 0.5), aspereza=0.6)
CHAPEU_ESCURO = h.mat("chapeu_escuro", (0.24, 0.08, 0.32), aspereza=0.6)
LAMELA = h.mat("lamela", (0.82, 0.74, 0.62))
PINTA = h.mat("pinta", (0.6, 0.95, 0.75), brilho=1.0)
OLHO = h.mat("olho", (0.05, 0.04, 0.06))
BOCA = h.mat("boca", (0.2, 0.08, 0.16))

o, q = OMBRO, QUADRIL

# O pé: um barril claro, mais largo embaixo, com a barriga marcada.
h.tubo("pe_cima", "tronco", (0, 0, 0.74), (0, 0, 0.5), 0.2, 0.25, PE, lados=10)
h.tubo("pe_baixo", "tronco", (0, 0, 0.5), (0, 0, 0.3), 0.25, 0.22, PE, lados=10)
h.esfera("base", "raiz", (0, 0, 0.3), 0.22, PE_ESCURO, escala=(1, 1, 0.5))
# Rosto no pé: olhos bravos, sobrancelha e a boca por onde saem os esporos.
for y in (-0.09, 0.09):
    h.esfera(f"olho_{y}", "tronco", (0.21, y, 0.6), 0.045, OLHO, escala=(0.6, 1, 1.2))
    h.caixa(f"sobrancelha_{y}", "tronco", (0.22, y, 0.67), (0.03, 0.1, 0.025), CHAPEU_ESCURO, chanfro=0.0, giro=-18 if y < 0 else -18)
h.esfera("boca", "tronco", (0.235, 0, 0.46), 0.05, BOCA, escala=(0.5, 1.2, 0.8))

# O chapéu: cúpula larga e roxa, borda escura, lamelas por baixo e pintas claras irregulares.
h.esfera("chapeu", "cabeca", (0, 0, 0.84), 0.46, CHAPEU, escala=(1.0, 1.0, 0.66))
h.esfera("chapeu_borda", "cabeca", (0, 0, 0.8), 0.47, CHAPEU_ESCURO, escala=(1.02, 1.02, 0.2))
h.tubo("lamelas", "cabeca", (0, 0, 0.8), (0, 0, 0.72), 0.44, 0.2, LAMELA, lados=12)
for i, (ang, alt, r) in enumerate(((0.3, 0.6, 0.075), (1.5, 0.82, 0.06), (-0.9, 0.74, 0.085), (2.6, 0.5, 0.07), (-2.2, 0.56, 0.05), (0.0, 0.95, 0.055))):
    rx = 0.44 * math.cos(math.asin(min(0.99, alt)))
    h.esfera(f"pinta_{i}", "cabeca", (rx * math.cos(ang) * 0.96, rx * math.sin(ang) * 0.96, 0.84 + 0.46 * 0.66 * alt * 0.96), r, PINTA, escala=(1, 1, 0.5))

# Bracinhos e pernas curtas, da cor do pé.
for lado, y in (("f", -o), ("t", o)):
    h.tubo(f"braco_{lado}", f"braco_{lado}", (0.04, y, 0.62), (0.08, y, 0.44), 0.05, 0.045, PE_ESCURO, lados=6)
    h.tubo(f"ante_{lado}", f"ante_{lado}", (0.08, y, 0.44), (0.12, y, 0.32), 0.045, 0.04, PE_ESCURO, lados=6)
    h.esfera(f"mao_{lado}", f"ante_{lado}", (0.12, y, 0.3), 0.055, PE)
for lado, y in (("f", -q), ("t", q)):
    h.tubo(f"coxa_{lado}", f"coxa_{lado}", (0, y, 0.3), (0.02, y, 0.17), 0.075, 0.065, PE_ESCURO, lados=6)
    h.tubo(f"canela_{lado}", f"canela_{lado}", (0.02, y, 0.17), (0, y, 0.07), 0.065, 0.06, PE_ESCURO, lados=6)
    h.caixa(f"pe_{lado}", f"canela_{lado}", (0.05, y, 0.04), (0.22, 0.13, 0.08), CHAPEU_ESCURO, chanfro=0.03)

GUARDA = {"braco_f": 10, "ante_f": 20, "braco_t": -10, "ante_t": 20}
h.acoes_basicas(guarda=GUARDA)
G = GUARDA

# Golpe: joga o chapéu para trás e cospe um esporo para a frente.
h.acao(
    "atacar",
    {
        1: dict(G),
        4: {"tronco": -14, "cabeca": -24, "braco_f": -30, "ante_f": 30, "braco_t": -30, "ante_t": 30, "coxa_f": 10, "canela_f": -20, "coxa_t": 6, "canela_t": -16, "raiz": (0, -0.04)},
        7: {"tronco": 18, "cabeca": 26, "braco_f": 50, "ante_f": 20, "braco_t": 40, "ante_t": 20, "coxa_f": 24, "canela_f": -20, "coxa_t": -18, "canela_t": -8, "raiz": (0, 0.02)},
        10: {"tronco": 22, "cabeca": 30, "braco_f": 60, "ante_f": 20, "braco_t": 50, "ante_t": 20, "coxa_f": 26, "canela_f": -20, "coxa_t": -20, "canela_t": -8, "raiz": (0, 0.02)},
        13: {"tronco": 8, "cabeca": 10, "braco_f": 30, "ante_f": 20, "braco_t": 20, "ante_t": 20, "coxa_f": 12, "canela_f": -12, "coxa_t": -8, "canela_t": -8},
        17: dict(G),
    },
)

# Chuva de esporos: agacha, incha, e solta três esporos num pulinho, com o chapéu sacudindo.
h.acao(
    "habilidade",
    {
        1: dict(G),
        4: {"tronco": 10, "cabeca": 14, "braco_f": 30, "ante_f": 60, "braco_t": 30, "ante_t": 60, "coxa_f": 50, "canela_f": -90, "coxa_t": 40, "canela_t": -90, "raiz": (0, -0.1)},
        7: {"tronco": 14, "cabeca": 20, "braco_f": 40, "ante_f": 70, "braco_t": 40, "ante_t": 70, "coxa_f": 60, "canela_f": -104, "coxa_t": 50, "canela_t": -104, "raiz": (0, -0.13)},
        10: {"tronco": -22, "cabeca": -30, "braco_f": 150, "ante_f": 20, "braco_t": 140, "ante_t": 20, "coxa_f": 10, "canela_f": -10, "coxa_t": -10, "canela_t": -10, "raiz": (-6, 0.14)},
        13: {"tronco": -16, "cabeca": 24, "braco_f": 160, "ante_f": 20, "braco_t": 150, "ante_t": 20, "coxa_f": 20, "canela_f": -30, "coxa_t": 0, "canela_t": -24, "raiz": (-4, 0.2)},
        16: {"tronco": -10, "cabeca": -20, "braco_f": 140, "ante_f": 20, "braco_t": 130, "ante_t": 20, "coxa_f": 24, "canela_f": -36, "coxa_t": 4, "canela_t": -28, "raiz": (-2, 0.12)},
        19: {"tronco": 10, "cabeca": 12, "braco_f": 40, "ante_f": 40, "braco_t": 30, "ante_t": 40, "coxa_f": 40, "canela_f": -70, "coxa_t": 30, "canela_t": -70, "raiz": (0, -0.07)},
        22: dict(G),
    },
)

h.salvar("arte/fontes/cogumelo.blend")
