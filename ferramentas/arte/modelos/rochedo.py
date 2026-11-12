"""Rochedo (Monstros, tanque): tartaruga de pedra com cristais nas costas.

Uso: blender -b -P ferramentas/arte/modelos/rochedo.py -- --saida arte/fontes/rochedo.blend
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from humanoide import Humanoide  # noqa: E402

LADO = 0.34


class Tartaruga(Humanoide):
    """Quadrúpede. Os nomes de osso do humanoide viram: braço/ante = pata da frente,
    coxa/canela = pata de trás, tronco = casco, arma_costas = rabo. Todas as ações são próprias."""

    def ossos(self):
        self.ombro = LADO
        self.quadril = LADO
        y = LADO
        return {
            "raiz": ((0, 0, 0.46), (0, 0, 0.56), None),
            "tronco": ((0, 0, 0.46), (0, 0, 0.9), "raiz"),
            # Pescoço e cabeça: horizontais, saindo da frente do casco.
            "cabeca": ((0.42, 0, 0.5), (0.86, 0, 0.6), "tronco"),
            "braco_f": ((0.36, -y, 0.4), (0.4, -y, 0.2), "raiz"),
            "ante_f": ((0.4, -y, 0.2), (0.4, -y, 0.03), "braco_f"),
            "braco_t": ((0.36, y, 0.4), (0.4, y, 0.2), "raiz"),
            "ante_t": ((0.4, y, 0.2), (0.4, y, 0.03), "braco_t"),
            "coxa_f": ((-0.36, -y, 0.4), (-0.4, -y, 0.2), "raiz"),
            "canela_f": ((-0.4, -y, 0.2), (-0.4, -y, 0.03), "coxa_f"),
            "coxa_t": ((-0.36, y, 0.4), (-0.4, y, 0.2), "raiz"),
            "canela_t": ((-0.4, y, 0.2), (-0.4, y, 0.03), "coxa_t"),
            "arma_mao": ((0.4, -y, 0.03), (0.6, -y, 0.03), "ante_f"),
            "arma_costas": ((-0.52, 0, 0.42), (-0.8, 0, 0.34), "tronco"),
        }


h = Tartaruga(tamanho=1.0)
h.arma_padrao = "costas"

PEDRA = h.mat("pedra", (0.27, 0.27, 0.26), aspereza=0.95)
PEDRA_CLARA = h.mat("pedra_clara", (0.4, 0.39, 0.36), aspereza=0.95)
PEDRA_ESCURA = h.mat("pedra_escura", (0.14, 0.14, 0.15), aspereza=0.95)
MUSGO = h.mat("musgo", (0.3, 0.45, 0.2), aspereza=0.9)
PELE = h.mat("pele", (0.45, 0.55, 0.36), aspereza=0.8)
BARRIGA = h.mat("barriga", (0.72, 0.68, 0.5))
CRISTAL = h.mat("cristal", (0.08, 0.62, 0.56), brilho=0.55, aspereza=0.3)
CRISTAL_ROXO = h.mat("cristal_roxo", (0.42, 0.18, 0.72), brilho=0.55, aspereza=0.3)
OLHO = h.mat("olho", (0.05, 0.04, 0.06))

y = LADO

# Casco: uma cúpula de pedra com placas, borda escura e barriga clara por baixo.
h.esfera("casco", "tronco", (0, 0, 0.5), 0.6, PEDRA, escala=(1.0, 0.85, 0.72))
h.esfera("borda_do_casco", "tronco", (0, 0, 0.44), 0.62, PEDRA_ESCURA, escala=(1.02, 0.88, 0.22))
h.esfera("barriga", "tronco", (0, 0, 0.36), 0.52, BARRIGA, escala=(1.0, 0.8, 0.3))
for i, (x, z, g) in enumerate(((0.0, 0.92, 0), (0.3, 0.8, 34), (-0.3, 0.8, -34))):
    h.caixa(f"placa_{i}", "tronco", (x, -0.02, z), (0.26, 0.6, 0.05), PEDRA_ESCURA, chanfro=0.02, giro=g)
# Blocos de pedra salientes, para o casco parecer rocha e não um casco liso.
for i, (x, z, lx, lz, g, m) in enumerate(((0.36, 0.62, 0.22, 0.14, 40, PEDRA_CLARA), (-0.4, 0.6, 0.2, 0.13, -44, PEDRA_CLARA), (0.14, 0.82, 0.2, 0.1, 14, PEDRA_CLARA), (-0.16, 0.8, 0.18, 0.1, -16, PEDRA_ESCURA), (0.5, 0.46, 0.14, 0.12, 62, PEDRA_ESCURA), (-0.52, 0.44, 0.14, 0.12, -64, PEDRA_ESCURA))):
    h.caixa(f"bloco_{i}", "tronco", (x, -0.36, z), (lx, 0.26, lz), m, chanfro=0.03, giro=g)
h.esfera("musgo", "tronco", (-0.14, -0.3, 0.72), 0.14, MUSGO, escala=(1.4, 0.5, 0.6))
# Cristais brotando das costas.
cristais = [(0.02, 0.88, 0.36, 0.1, -4, CRISTAL), (-0.2, 0.82, 0.26, 0.08, -26, CRISTAL_ROXO), (0.2, 0.84, 0.22, 0.07, 22, CRISTAL), (-0.36, 0.7, 0.16, 0.06, -44, CRISTAL), (0.1, 0.9, 0.14, 0.05, 40, CRISTAL_ROXO)]
import math  # noqa: E402

for i, (x, z, comprimento, raio, giro, cor) in enumerate(cristais):
    dx, dz = math.sin(math.radians(giro)), math.cos(math.radians(giro))
    h.tubo(f"cristal_{i}", "tronco", (x, -0.05 + 0.05 * (i % 3), z), (x + dx * comprimento, -0.05 + 0.05 * (i % 3), z + dz * comprimento), raio, 0.006, cor, lados=5)

# Pescoço, cabeça com bico, olho e sobrancelha de pedra.
h.tubo("pescoco", "cabeca", (0.4, 0, 0.5), (0.72, 0, 0.58), 0.12, 0.11, PELE)
h.esfera("cabeca", "cabeca", (0.82, 0, 0.62), 0.17, PELE, escala=(1.15, 0.95, 0.95))
h.caixa("bico", "cabeca", (0.99, 0, 0.58), (0.12, 0.18, 0.1), PEDRA_ESCURA, chanfro=0.03, giro=-14)
h.caixa("testa", "cabeca", (0.84, 0, 0.76), (0.24, 0.26, 0.06), PEDRA, chanfro=0.02, giro=-8)
for lado in (-0.13, 0.13):
    h.esfera(f"olho_{lado}", "cabeca", (0.9, lado, 0.67), 0.035, OLHO)
# Rabo curto.
h.tubo("rabo", "arma_costas", (-0.5, 0, 0.42), (-0.8, 0, 0.34), 0.08, 0.015, PELE, lados=6)

# Patas grossas com unhas de pedra.
for nome, sup, inf, x in (("f", "braco_f", "ante_f", 0.4), ("t", "braco_t", "ante_t", 0.4), ("f2", "coxa_f", "canela_f", -0.4), ("t2", "coxa_t", "canela_t", -0.4)):
    lado_y = -y if sup.endswith("_f") else y
    x0 = 0.36 if x > 0 else -0.36
    h.tubo(f"pata_cima_{nome}", sup, (x0, lado_y, 0.42), (x, lado_y, 0.2), 0.13, 0.11, PELE)
    h.tubo(f"pata_baixo_{nome}", inf, (x, lado_y, 0.22), (x, lado_y, 0.05), 0.11, 0.12, PELE)
    h.caixa(f"unhas_{nome}", inf, (x + 0.08, lado_y, 0.04), (0.14, 0.2, 0.07), PEDRA_ESCURA, chanfro=0.02)


def p(**k):
    return dict(k)


# Patas recolhidas para dentro do casco.
RECOLHIDO = {"braco_f": -70, "ante_f": 120, "braco_t": -70, "ante_t": 120, "coxa_f": 70, "canela_f": -120, "coxa_t": 70, "canela_t": -120}

h.acao(
    "parado",
    h.ciclo(
        [
            p(cabeca=0, arma_costas=0),
            p(cabeca=3, arma_costas=6, raiz=(0, -0.01), braco_f=-4, ante_f=8, braco_t=-4, ante_t=8, coxa_f=4, canela_f=-8, coxa_t=4, canela_t=-8),
            p(cabeca=6, arma_costas=12, raiz=(0, -0.02), braco_f=-8, ante_f=16, braco_t=-8, ante_t=16, coxa_f=8, canela_f=-16, coxa_t=8, canela_t=-16),
            p(cabeca=3, arma_costas=6, raiz=(0, -0.01), braco_f=-4, ante_f=8, braco_t=-4, ante_t=8, coxa_f=4, canela_f=-8, coxa_t=4, canela_t=-8),
        ]
    ),
)

# Andar: patas em diagonal (frente de um lado com trás do outro), passo pesado.
passos = [(30, -10), (10, 30), (-25, 10), (-10, -30)]
andar = []
for i in range(8):
    a, da = passos[i % 4] if i < 4 else passos[(i + 2) % 4]
    b, db = passos[(i + 2) % 4] if i < 4 else passos[i % 4]
    andar.append(
        p(
            braco_f=a, ante_f=da if da > 0 else 0, coxa_t=a, canela_t=-da if da > 0 else 0,
            braco_t=b, ante_t=db if db > 0 else 0, coxa_f=b, canela_f=-db if db > 0 else 0,
            raiz=(2 if i % 2 else -2, -0.01 * (i % 2)), cabeca=4 if i % 2 else -2, arma_costas=10 if i % 4 < 2 else -10,
        )
    )
h.acao("andar", h.ciclo(andar))

h.acao(
    "pular",
    {
        1: p(raiz=(0, -0.12), braco_f=-30, ante_f=60, braco_t=-30, ante_t=60, coxa_f=30, canela_f=-60, coxa_t=30, canela_t=-60, cabeca=-10),
        5: p(raiz=(8, 0.04), braco_f=30, ante_f=0, braco_t=24, ante_t=0, coxa_f=-30, canela_f=0, coxa_t=-24, canela_t=0, cabeca=14),
        9: p(raiz=(12, 0.06), braco_f=44, ante_f=10, braco_t=36, ante_t=10, coxa_f=-44, canela_f=-10, coxa_t=-36, canela_t=-10, cabeca=18, arma_costas=20),
        13: p(raiz=(8, 0.06), braco_f=50, ante_f=20, braco_t=42, ante_t=20, coxa_f=-50, canela_f=-20, coxa_t=-42, canela_t=-20, cabeca=14, arma_costas=24),
    },
)
h.acao(
    "cair",
    h.ciclo(
        [
            p(raiz=(-8, 0), braco_f=50, ante_f=10, braco_t=30, ante_t=20, coxa_f=-40, canela_f=-10, coxa_t=-20, canela_t=-20, cabeca=-10, arma_costas=30),
            p(raiz=(-10, 0), braco_f=30, ante_f=20, braco_t=50, ante_t=10, coxa_f=-20, canela_f=-20, coxa_t=-40, canela_t=-10, cabeca=-14, arma_costas=20),
        ]
    ),
)

# Golpe: recua o pescoço e dá uma cabeçada, jogando o corpo para a frente.
h.acao(
    "atacar",
    {
        1: p(),
        4: p(raiz=(-8, -0.03), cabeca=24, braco_f=-20, ante_f=30, braco_t=-20, ante_t=30, coxa_f=10, canela_f=-20, coxa_t=10, canela_t=-20, arma_costas=-10),
        7: p(raiz=(-10, -0.04), cabeca=30, braco_f=-24, ante_f=36, braco_t=-24, ante_t=36, coxa_f=12, canela_f=-24, coxa_t=12, canela_t=-24, arma_costas=-14),
        10: p(raiz=(14, 0.03), cabeca=-22, braco_f=30, ante_f=0, braco_t=24, ante_t=0, coxa_f=-30, canela_f=0, coxa_t=-24, canela_t=0, arma_costas=24),
        13: p(raiz=(16, 0.04), cabeca=-26, braco_f=34, ante_f=0, braco_t=28, ante_t=0, coxa_f=-34, canela_f=0, coxa_t=-28, canela_t=0, arma_costas=28),
        17: p(),
    },
)

# Casco: recolhe as patas e a cabeça, assenta no chão e os cristais seguram o tranco.
h.acao(
    "habilidade",
    {
        1: p(),
        4: p(raiz=(0, -0.1), cabeca=-30, arma_costas=-20, braco_f=-36, ante_f=60, braco_t=-36, ante_t=60, coxa_f=36, canela_f=-60, coxa_t=36, canela_t=-60),
        7: p(raiz=(0, -0.2), cabeca=-64, arma_costas=-50, **RECOLHIDO),
        10: p(raiz=(3, -0.22), cabeca=-70, arma_costas=-56, **RECOLHIDO),
        13: p(raiz=(-3, -0.2), cabeca=-68, arma_costas=-52, **RECOLHIDO),
        16: p(raiz=(2, -0.22), cabeca=-72, arma_costas=-58, **RECOLHIDO),
        19: p(raiz=(0, -0.1), cabeca=-30, arma_costas=-20, braco_f=-36, ante_f=60, braco_t=-36, ante_t=60, coxa_f=36, canela_f=-60, coxa_t=36, canela_t=-60),
        22: p(),
    },
)

h.acao(
    "atingido",
    {
        1: p(raiz=(-8, 0), cabeca=20, braco_f=30, ante_f=0, braco_t=20, ante_t=0, arma_costas=20),
        4: p(raiz=(-20, -0.02), cabeca=34, braco_f=56, ante_f=10, braco_t=44, ante_t=10, coxa_f=20, canela_f=-20, coxa_t=10, canela_t=-10, arma_costas=40),
        7: p(raiz=(-10, -0.01), cabeca=16, braco_f=30, ante_f=6, braco_t=22, ante_t=6, coxa_f=10, canela_f=-10, arma_costas=20),
    },
)
voando = []
for i, giro in enumerate((-20, -110, -200, -290)):
    par = i % 2 == 0
    voando.append(
        p(raiz=(giro, 0.3), cabeca=24 if par else 10, arma_costas=30 if par else 10,
          braco_f=50 if par else 20, ante_f=10, braco_t=20 if par else 50, ante_t=10,
          coxa_f=-50 if par else -20, canela_f=-10, coxa_t=-20 if par else -50, canela_t=-10)
    )
h.acao("arremessado", h.ciclo(voando))

# Nocaute: tomba de costas e fica de patas para o ar, balançando.
h.acao(
    "nocaute",
    {
        1: p(raiz=(-10, 0), cabeca=20, braco_f=30, braco_t=20),
        4: p(raiz=(-50, 0.12), cabeca=30, braco_f=50, braco_t=40, coxa_f=-30, coxa_t=-20, arma_costas=20),
        7: p(raiz=(-110, 0.2), cabeca=30, braco_f=60, ante_f=20, braco_t=50, ante_t=20, coxa_f=-50, canela_f=-20, coxa_t=-40, canela_t=-20, arma_costas=30),
        10: p(raiz=(-170, 0.2), cabeca=20, braco_f=40, ante_f=30, braco_t=30, ante_t=30, coxa_f=-40, canela_f=-30, coxa_t=-30, canela_t=-30, arma_costas=20),
        13: p(raiz=(-186, 0.18), cabeca=-10, braco_f=20, ante_f=40, braco_t=30, ante_t=30, coxa_f=-20, canela_f=-40, coxa_t=-30, canela_t=-30),
        16: p(raiz=(-180, 0.18), cabeca=-16, braco_f=30, ante_f=30, braco_t=20, ante_t=40, coxa_f=-30, canela_f=-30, coxa_t=-20, canela_t=-40),
    },
)

h.salvar("arte/fontes/rochedo.blend")
