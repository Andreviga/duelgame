"""Cenário da arena básica: pátio de dojo à noite.

Uso: blender -b -P ferramentas/arte/cenarios/arena-basica.py
     (ou: python3 ferramentas/arte/rodar_blender.py ferramentas/arte/cenarios/arena-basica.py)
Opções, depois de `--`: --saida <pasta>  --escala 0.5 (prévia rápida)  --so ceu,perto

Gera em public/cenarios/arena-basica/: ceu.png, longe.png, perto.png, chao.png, plataforma.png,
frente.png e cenario.json (tamanhos, encaixe e paralaxe sugerida para o jogo).

Encaixe das camadas largas (longe, perto e frente): o centro da camada fica atrás do centro da
arena (x = 600 do mundo) e a linha y = 600 da camada fica na altura do chão (y = 520 do mundo).
A luta acontece, na camada `perto`, entre x 800 e 1600 e y 250 e 600: ali tudo é escuro e liso.
"""

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cenario import RAIZ, Cenario, misturar  # noqa: E402

ARENA = json.loads((RAIZ / "src" / "dados" / "arena-basica.json").read_text(encoding="utf-8"))
PX_POR_UNIDADE = 2  # chão e plataforma: 2 pixels por unidade do mundo

c = Cenario("arena-basica", semente=7)
# Noite de lua: sol frio e fraco de cima e pela frente, recorte azulado por trás.
c.tom_do_sol = (0.62, 0.7, 1.0)
c.tom_do_recorte = (0.45, 0.5, 0.9)
s = c.sorteio


def halo(nome, x, y, raio, hexa, forca, profundidade, aneis=5):
    """Brilho suave: vários discos transparentes, um dentro do outro."""
    for i in range(aneis):
        t = (i + 1) / aneis
        c.disco(f"{nome}_halo{i}", x, y, raio * t, c.brilho(hexa, alfa=forca / aneis), lados=28, profundidade=profundidade - i * 0.2)


# ---------------------------------------------------------------------------- céu (1600×900)
c.camada("ceu", 1600, 900, transparente=False)
c.retangulo(
    "ceu",
    -10,
    -10,
    1610,
    910,
    c.degrade([(0.0, "#060913"), (0.4, "#121830"), (0.72, "#232748"), (1.0, "#3a3457")], 0, 900),
    profundidade=900,
)
# Faixa de estrelas miúdas atravessando o alto do céu, e algumas maiores, de quatro pontas.
for i in range(150):
    x = s.uniform(0, 1600)
    y = 250 - 0.16 * x + s.gauss(0, 60) if i < 90 else s.uniform(10, 440)
    if not 6 < y < 470:
        continue
    tom = misturar("#121830", "#c9d3f2", s.uniform(0.25, 0.8) * (1 - y / 640))
    c.disco(f"estrela{i}", x, y, s.choice((1.3, 1.3, 1.7, 2.1)), c.brilho(tom), lados=4, profundidade=880)
for i, (x, y, r) in enumerate(((118, 96, 7), (402, 58, 5), (688, 132, 6), (964, 70, 5), (1452, 118, 7), (1318, 44, 4), (236, 232, 4))):
    tom = "#d6defa"
    c.placa(f"estrela_g{i}", [(x - r, y), (x - r * 0.22, y - r * 0.22), (x, y - r), (x + r * 0.22, y - r * 0.22), (x + r, y), (x + r * 0.22, y + r * 0.22), (x, y + r), (x - r * 0.22, y + r * 0.22)], c.brilho(tom), profundidade=879)
# Lua: à direita, emoldurada pelo portal, acima de onde se luta. Clara, mas sem estourar.
LUA = (1105, 296)
halo("lua", *LUA, 230, "#8f9bd0", 0.16, 872, aneis=8)
c.disco("lua", *LUA, 84, c.brilho("#838fb8"), lados=16, profundidade=866, giro=0.2)
c.disco("lua_luz", LUA[0] - 10, LUA[1] - 10, 68, c.brilho("#8c98c0"), lados=14, profundidade=865, giro=0.5)
for i, (dx, dy, r) in enumerate(((-30, -22, 22), (26, 18, 15), (-12, 38, 11), (36, -34, 9), (4, -50, 7), (-52, 14, 8))):
    c.disco(f"cratera{i}", LUA[0] + dx, LUA[1] + dy, r, c.brilho("#7480aa"), lados=7, profundidade=864, giro=i)
    c.disco(f"cratera_fundo{i}", LUA[0] + dx + r * 0.15, LUA[1] + dy + r * 0.15, r * 0.7, c.brilho("#6b7799"), lados=6, profundidade=863, giro=i + 1)
# Nuvens altas: faixas compridas e facetadas em dois tons, mais para as bordas.
for i, (x, y, l, a, tom) in enumerate(
    (
        (210, 330, 520, 26, "#1a203f"),
        (120, 372, 360, 18, "#1f2548"),
        (1440, 420, 470, 24, "#1f2548"),
        (940, 250, 300, 14, "#181e3b"),
        (640, 480, 620, 20, "#252a4e"),
        (1500, 520, 380, 16, "#2a2e54"),
        (330, 548, 420, 15, "#2a2e54"),
        (1010, 566, 520, 13, "#2f3158"),
    )
):
    for parte, (dy, k, clareia) in enumerate(((0, 1.0, 0.0), (-a * 0.3, 0.62, 0.12))):
        ll, aa, yy = l * k, a * k, y + dy
        pontos = [
            (x - ll / 2, yy),
            (x - ll * 0.3, yy - aa * 0.7),
            (x - ll * 0.05, yy - aa),
            (x + ll * 0.22, yy - aa * 0.55),
            (x + ll / 2, yy - aa * 0.1),
            (x + ll * 0.34, yy + aa * 0.5),
            (x - ll * 0.1, yy + aa * 0.75),
            (x - ll * 0.36, yy + aa * 0.45),
        ]
        c.placa(f"nuvem{i}_{parte}", pontos, c.brilho(misturar(tom, "#4a4f80", clareia)), profundidade=860 - i - parte * 0.5)

# -------------------------------------------------------------------------- longe (2000×900)
c.camada("longe", 2000, 900)
HORIZONTE = 650
NEVE = c.mat("#4a5170", ambiente=0.55, luz=0.45, base=0.85)


def nevoa(nome, y0, y1, hexa, forca, profundidade, largura=2000):
    c.retangulo(
        nome,
        -10,
        y0,
        largura + 10,
        y1,
        c.degrade([(0, hexa), (1, hexa)], y0, y1, alfas=[(0.0, 0.0), (0.65, forca * 0.8), (1.0, forca)]),
        profundidade=profundidade,
    )


# Três planos de serra: quanto mais longe, mais alta, mais clara e mais apagada pela névoa.
# Entre x 1180 e 1350 as serras ficam baixas: é onde a lua aparece.
for i, (x, pico, largura) in enumerate(((180, 300, 620), (640, 360, 560), (985, 285, 640), (1610, 390, 560), (1960, 300, 560))):
    c.montanha(f"serra3_{i}", x, pico, largura, HORIZONTE + 20, c.mat("#2b2e4a", ambiente=0.68, luz=0.2, base=0.9), lados=8, neve=NEVE, y_fundo=910).location.y = 300
nevoa("nevoa3", 380, 700, "#2e3152", 0.55, 200)
for i, (x, pico, largura) in enumerate(((-40, 440, 520), (360, 400, 600), (800, 470, 520), (1290, 500, 600), (1700, 450, 560), (2040, 470, 420))):
    c.montanha(f"serra2_{i}", x, pico, largura, HORIZONTE + 20, c.mat("#21253c", ambiente=0.62, luz=0.28, base=0.85), lados=7, y_fundo=910)
nevoa("nevoa2", 480, 700, "#272b47", 0.5, -420)
# Serra da frente: a mais escura. Baixa no meio, para não disputar com a luta.
for i, (x, pico, largura) in enumerate(((120, 510, 520), (520, 566, 460), (930, 596, 520), (1330, 574, 480), (1760, 500, 560))):
    c.montanha(f"serra1_{i}", x, pico, largura, HORIZONTE + 30, c.mat("#141728", ambiente=0.6, luz=0.3, base=0.8), lados=6, y_fundo=910).location.y = -500
# Pagode ao longe, no morro da esquerda, com uma luzinha: silhueta de três andares.
PAGODE = c.brilho("#0f1326")
px, py = 208, 508
for andar in range(3):
    largura = 74 - andar * 16
    y = py - andar * 34
    c.placa(
        f"pagode_telhado{andar}",
        [(px - largura - 6, y - 5), (px - largura + 12, y - 11), (px + largura - 12, y - 11), (px + largura + 6, y - 5), (px + largura - 10, y), (px - largura + 10, y)],
        PAGODE,
        profundidade=-900,
    )
    c.retangulo(f"pagode_corpo{andar}", px - largura * 0.52, y, px + largura * 0.52, y + 24, PAGODE, profundidade=-900)
    c.retangulo(f"pagode_luz{andar}", px - 3, y + 8, px + 3, y + 17, c.brilho("#b98a4a"), profundidade=-901)
c.placa("pagode_ponta", [(px - 3, py - 79), (px, py - 118), (px + 3, py - 79)], PAGODE, profundidade=-900)
# Chão distante: fecha a camada até embaixo, escurecendo.
c.retangulo("base_longe", -10, HORIZONTE, 2010, 910, c.degrade([(0, "#141728"), (1, "#0e1222")], HORIZONTE, 900), profundidade=-950)

# -------------------------------------------------------------------------- perto (2400×900)
c.camada("perto", 2400, 900)
MADEIRA = c.mat("#2a1f2a", ambiente=0.5, luz=0.5)
MADEIRA_ESCURA = c.mat("#1b1522", ambiente=0.5, luz=0.4)
LACA = c.mat("#45202b", ambiente=0.4, luz=0.46, base=0.62)  # vermelho de portal, bem apagado
LACA_ESCURA = c.mat("#2c1620", ambiente=0.4, luz=0.4)
TELHA = c.mat("#1d2238", ambiente=0.5, luz=0.6, base=0.8)
TELHA_ESCURA = c.mat("#141829", ambiente=0.5, luz=0.5, base=1.0)
OURO = c.mat("#6b5a3a", ambiente=0.55, luz=0.5, base=1.0)  # metal velho, sem brilho
PEDRA = c.mat("#272c42", ambiente=0.5, luz=0.55)
PEDRA_ESCURA = c.mat("#181c2c", ambiente=0.5, luz=0.4)
COPA = c.mat("#111a26", ambiente=0.55, luz=0.5)
COPA_FUNDO = c.mat("#0e1522", ambiente=0.6, luz=0.3)
FLOR = c.mat("#4a2a42", ambiente=0.5, luz=0.5, base=0.6)  # cerejeira à noite: rosa bem fechado
FLOR_CLARA = c.mat("#59324e", ambiente=0.5, luz=0.55, base=0.65)
TRONCO = c.brilho("#0b0e18")
GALHO = c.mat("#1a1420", ambiente=0.5, luz=0.4, base=1.0)
LUZ = c.brilho("#ffcf73")
LUZ_FRACA = c.brilho("#d9a04c")
PATIO = 724  # onde as coisas do fundo pisam: bem abaixo da linha do chão da luta (y = 600)


def cerejeira(nome, x, altura, profundidade=0.0, lado=1):
    """Cerejeira: tronco torto, três galhos e copas facetadas em dois tons."""
    y = PATIO + 6
    a = altura
    tronco = [(x - a * 0.045, y), (x + a * 0.045, y), (x + a * 0.03 + lado * a * 0.06, y - a * 0.45), (x - a * 0.02 + lado * a * 0.06, y - a * 0.45)]
    c.placa(f"{nome}_tronco", tronco, GALHO, profundidade)
    topo = (x + lado * a * 0.06, y - a * 0.45)
    copas = []
    for i, (dx, dy) in enumerate(((-0.3, -0.26), (0.02, -0.4), (0.3, -0.22))):
        fim = (topo[0] + dx * a, topo[1] + dy * a)
        c.placa(f"{nome}_galho{i}", [(topo[0] - a * 0.018, topo[1]), (topo[0] + a * 0.018, topo[1]), (fim[0] + a * 0.008, fim[1]), (fim[0] - a * 0.008, fim[1])], GALHO, profundidade)
        copas.append(fim)
    for i, (fx, fy) in enumerate(copas + [(topo[0] - a * 0.12, topo[1] - a * 0.2), (topo[0] + a * 0.16, topo[1] - a * 0.3)]):
        r = a * s.uniform(0.17, 0.23)
        c.bolha(f"{nome}_copa{i}", fx, fy, r * 1.25, r * 0.85, FLOR if i % 2 else FLOR_CLARA, profundidade - 30 - i * 6, detalhe=2)


# Pinheiros nas bordas, atrás de tudo. No meio (atrás da luta) não há árvore.
for i, (x, altura) in enumerate(((40, 430), (175, 330), (505, 310), (610, 250), (1800, 250), (1900, 330), (2385, 440))):
    c.pinheiro(f"pinheiro_fundo{i}", x, PATIO + 6, altura, COPA_FUNDO, TRONCO)

# Muro do pátio com capa de telha e pilares, ao fundo, de ponta a ponta.
MURO_TOPO = 648
c.caixa("muro", -20, MURO_TOPO, 2420, PATIO + 4, PEDRA_ESCURA, frente=30, fundo=60)
c.malha(
    "muro_telha",
    [(-20, MURO_TOPO - 14, 45), (2420, MURO_TOPO - 14, 45), (2420, MURO_TOPO + 6, 14), (-20, MURO_TOPO + 6, 14), (2420, MURO_TOPO + 6, 76), (-20, MURO_TOPO + 6, 76)],
    [(0, 1, 2, 3), (0, 5, 4, 1)],
    TELHA,
)
c.retangulo("muro_cumeeira", -20, MURO_TOPO - 18, 2420, MURO_TOPO - 13, TELHA_ESCURA, profundidade=44)
for x in range(30, 2400, 30):
    c.retangulo(f"muro_telha_risco{x}", x, MURO_TOPO - 12, x + 2, MURO_TOPO + 5, TELHA_ESCURA, profundidade=13)
for x in range(90, 2400, 240):
    c.caixa(f"muro_pilar{x}", x - 14, MURO_TOPO - 6, x + 14, PATIO + 6, PEDRA, frente=14, fundo=40, chanfro=4)
    c.telhado(f"muro_pilar_teto{x}", x - 24, x + 24, MURO_TOPO - 6, MURO_TOPO - 30, TELHA, avanco=22, recuo=0.4)

# Cerejeiras: uma em cada ponta, atrás do muro baixo, e a casa do dojo no canto direito.
cerejeira("cerejeira_e", 270, 420, profundidade=20, lado=1)
cerejeira("cerejeira_d", 2010, 380, profundidade=20, lado=-1)

CASA = 2190
c.caixa("dojo_parede", CASA - 170, 470, CASA + 260, PATIO + 6, MADEIRA_ESCURA, frente=-10, fundo=40)
for i, x in enumerate(range(CASA - 160, CASA + 260, 84)):
    c.cilindro(f"dojo_pilar{i}", x, 468, PATIO + 6, 8, 9, MADEIRA, lados=6, profundidade=-20)
for j, x0 in enumerate((CASA - 136, CASA - 52)):
    c.retangulo(f"dojo_janela{j}", x0, 520, x0 + 60, 660, c.brilho("#b98646"), profundidade=-11)
    for i in range(1, 3):
        c.retangulo(f"dojo_grade_v{j}_{i}", x0 + i * 20 - 1.5, 520, x0 + i * 20 + 1.5, 660, TRONCO, profundidade=-12)
    for i in range(1, 4):
        c.retangulo(f"dojo_grade_h{j}_{i}", x0, 520 + i * 35 - 1.5, x0 + 60, 520 + i * 35 + 1.5, TRONCO, profundidade=-12)
halo("dojo", CASA - 76, 590, 120, "#ffb060", 0.08, -13, aneis=5)
c.telhado_curvo("dojo_telhado", CASA - 270, CASA + 360, 480, 376, TELHA, TELHA_ESCURA, avanco=90, levanta=30, trechos=12, recuo=0.22, costelas=18)
c.caixa("dojo_cumeeira", CASA - 136, 364, CASA + 226, 380, TELHA_ESCURA, frente=-8, fundo=8, chanfro=3)
c.caixa("dojo_varanda", CASA - 200, PATIO - 22, CASA + 260, PATIO + 6, MADEIRA, frente=-60, fundo=-10, chanfro=4)
c.caixa("dojo_degrau", CASA - 150, PATIO - 8, CASA - 20, PATIO + 8, PEDRA, frente=-80, fundo=-60, chanfro=3)

# Portal grande, emoldurando a arena: as colunas ficam por fora das pontas do chão da luta
# (x 800 a 1600 nesta camada) e as vigas ficam acima de onde os personagens chegam.
COL_E, COL_D = 716, 1684
for nome, x, dentro in (("e", COL_E, 14), ("d", COL_D, -14)):
    c.cilindro(f"portal_coluna_{nome}", x, 236, PATIO - 30, 21, 27, LACA, lados=10, inclina=dentro, profundidade=-8)
    c.cilindro(f"portal_anel_{nome}", x + dentro * 0.12, PATIO - 96, PATIO - 30, 29, 30, LACA_ESCURA, lados=10, profundidade=-8)
    c.cilindro(f"portal_aro_{nome}", x + dentro * 0.13, PATIO - 102, PATIO - 94, 30, 30, OURO, lados=10, profundidade=-8)
    c.caixa(f"portal_pe_{nome}", x - 40, PATIO - 32, x + 40, PATIO + 8, PEDRA, frente=-48, fundo=24, chanfro=9)
    c.caixa(f"portal_pe_base_{nome}", x - 50, PATIO - 6, x + 50, PATIO + 10, PEDRA_ESCURA, frente=-56, fundo=30, chanfro=5)
    # cunha entre a coluna e a viga de baixo
    c.caixa(f"portal_cunha_{nome}", x + dentro - 30, 252, x + dentro + 30, 266, MADEIRA, frente=-40, fundo=12, chanfro=3)
# Viga de baixo (atravessa as colunas), viga de cima com as pontas erguidas e o telhado curvo.
c.caixa("portal_viga_baixa", COL_E - 64, 266, COL_D + 64, 296, LACA, frente=-34, fundo=10, chanfro=6)
for nome, x in (("e", COL_E - 64), ("d", COL_D + 64)):
    c.caixa(f"portal_viga_ponta_{nome}", x - 5, 263, x + 5, 299, OURO, frente=-36, fundo=10, chanfro=2)
c.caixa("portal_pendural", 1188, 232, 1212, 266, LACA_ESCURA, frente=-30, fundo=6, chanfro=3)
c.caixa("portal_placa", 1158, 222, 1242, 276, MADEIRA_ESCURA, frente=-44, fundo=-30, chanfro=5)
c.caixa("portal_placa_moldura", 1166, 230, 1234, 268, OURO, frente=-47, fundo=-44, chanfro=2)
c.caixa("portal_placa_miolo", 1171, 235, 1229, 263, MADEIRA_ESCURA, frente=-49, fundo=-46, chanfro=1)
VIGA_ALTA = [(COL_E - 150, 0.0), (COL_E - 60, 0.6), (1200, 1.0), (COL_D + 60, 0.6), (COL_D + 150, 0.0)]
for i in range(len(VIGA_ALTA) - 1):
    (xa, ta), (xb, tb) = VIGA_ALTA[i], VIGA_ALTA[i + 1]
    ya, yb = 196 - (1 - ta) * 22, 196 - (1 - tb) * 22
    c.malha(
        f"portal_viga_alta{i}",
        [(xa, ya, -44), (xb, yb, -44), (xb, yb + 36, -44), (xa, ya + 36, -44), (xa, ya, 14), (xb, yb, 14)],
        [(0, 1, 2, 3), (0, 4, 5, 1)],
        LACA_ESCURA,
    )
c.telhado_curvo("portal_telhado", COL_E - 214, COL_D + 214, 190, 138, TELHA, TELHA_ESCURA, avanco=70, levanta=34, trechos=16, recuo=0.05, costelas=40)
c.caixa("portal_cumeeira", COL_E - 150, 128, COL_D + 150, 142, TELHA_ESCURA, frente=-10, fundo=10, chanfro=3)

# Lanternas de papel penduradas na viga, junto das colunas: o único brilho quente perto da luta,
# e fica nas pontas.
for nome, x in (("e", COL_E + 84), ("d", COL_D - 84)):
    c.retangulo(f"lanterna_fio_{nome}", x - 1.5, 296, x + 1.5, 326, TRONCO, profundidade=-20)
    halo(f"lanterna_{nome}", x, 350, 74, "#ffbe66", 0.16, -52, aneis=6)
    corpo = [(x - 9, 328), (x + 9, 328), (x + 16, 338), (x + 16, 362), (x + 9, 372), (x - 9, 372), (x - 16, 362), (x - 16, 338)]
    c.placa(f"lanterna_{nome}", corpo, LUZ, profundidade=-56)
    c.placa(f"lanterna_miolo_{nome}", [(x - 5, 334), (x + 5, 334), (x + 9, 342), (x + 9, 358), (x + 5, 366), (x - 5, 366), (x - 9, 358), (x - 9, 342)], c.brilho("#ffe6a8"), profundidade=-57)
    for dy in (341, 350, 359):
        c.retangulo(f"lanterna_aro_{nome}{dy}", x - 16, dy - 0.8, x + 16, dy + 0.8, c.brilho("#c98f3e"), profundidade=-58)
    c.retangulo(f"lanterna_tampa_{nome}", x - 11, 323, x + 11, 329, TRONCO, profundidade=-59)
    c.retangulo(f"lanterna_fundo_{nome}", x - 11, 371, x + 11, 377, TRONCO, profundidade=-59)
    c.retangulo(f"lanterna_franja_{nome}", x - 1.5, 377, x + 1.5, 392, c.brilho("#7a2a2e"), profundidade=-59)


def lanterna_de_pedra(nome, x, escala=1.0):
    e = escala
    y = PATIO + 6
    c.caixa(f"{nome}_base", x - 28 * e, y - 14 * e, x + 28 * e, y, PEDRA, frente=-74, fundo=-26, chanfro=5 * e)
    c.cilindro(f"{nome}_haste", x, y - 92 * e, y - 14 * e, 8 * e, 11 * e, PEDRA, lados=6, profundidade=-50)
    c.caixa(f"{nome}_mesa", x - 25 * e, y - 104 * e, x + 25 * e, y - 92 * e, PEDRA, frente=-72, fundo=-28, chanfro=4 * e)
    halo(nome, x, y - 124 * e, 58 * e, "#ffb85c", 0.1, -72, aneis=6)
    c.caixa(f"{nome}_caixa", x - 18 * e, y - 144 * e, x + 18 * e, y - 104 * e, PEDRA_ESCURA, frente=-66, fundo=-34, chanfro=2 * e)
    c.retangulo(f"{nome}_fogo", x - 11 * e, y - 138 * e, x + 11 * e, y - 110 * e, LUZ_FRACA, profundidade=-74)
    c.retangulo(f"{nome}_fogo_miolo", x - 6 * e, y - 130 * e, x + 6 * e, y - 112 * e, c.brilho("#ffd98a"), profundidade=-74.5)
    c.retangulo(f"{nome}_grade_v", x - 1.5 * e, y - 138 * e, x + 1.5 * e, y - 110 * e, c.brilho("#181c2c"), profundidade=-75)
    c.retangulo(f"{nome}_grade_h", x - 11 * e, y - 125.5 * e, x + 11 * e, y - 122.5 * e, c.brilho("#181c2c"), profundidade=-75)
    c.telhado(f"{nome}_teto", x - 36 * e, x + 36 * e, y - 142 * e, y - 176 * e, TELHA, avanco=36 * e, levanta=5 * e, recuo=0.44)
    c.bolha(f"{nome}_bola", x, y - 180 * e, 6 * e, 6 * e, PEDRA, -50, torto=0.05)


# Lanternas de pedra longe da luta, nas bordas da camada.
lanterna_de_pedra("lanterna_pedra_e", 480, 1.15)
lanterna_de_pedra("lanterna_pedra_d", 1870, 1.15)

# Canto esquerdo: escada de pedra subindo para fora da cena, com arbustos.
for i in range(6):
    c.caixa(f"degrau{i}", -20, PATIO - 22 * (i + 1), 250 - i * 42, PATIO - 22 * i + 6, PEDRA, frente=-50 + i * 8, fundo=0, chanfro=3)
for i, (x, r) in enumerate(((560, 34), (640, 24), (1770, 28), (1820, 20), (300, 30))):
    c.bolha(f"arbusto{i}", x, PATIO - r * 0.5, r * 1.5, r, COPA, -60, torto=0.22)
for i, (x, r) in enumerate(((610, 13), (1745, 16), (2010, 12), (410, 10))):
    c.bolha(f"pedra{i}", x, PATIO + 2, r * 1.4, r, PEDRA, -84, torto=0.2)

# Pinheiros da frente, só nas pontas.
for i, (x, altura) in enumerate(((95, 310), (2330, 300))):
    c.pinheiro(f"pinheiro{i}", x, PATIO + 6, altura, COPA, TRONCO)
    for obj in c.atual.objects:
        if obj.name.startswith(f"pinheiro{i}_"):
            obj.location.y = -90

# Chão do pátio: escuro, sem linha clara (para ninguém achar que dá para pisar), fechando a
# camada até embaixo. A névoa por cima separa o fundo da luta.
c.retangulo("patio", -10, PATIO, 2410, 910, c.degrade([(0, "#12162a"), (0.5, "#0c0f1d"), (1, "#080a14")], PATIO, 900), profundidade=-100)
for i in range(26):
    x = s.uniform(0, 2400)
    y = s.uniform(PATIO + 14, 850)
    l = s.uniform(60, 150)
    c.placa(f"laje{i}", [(x, y), (x + l, y), (x + l + 16, y + 9), (x + 12, y + 9)], c.brilho(misturar("#12162a", "#161a30", s.random() * (1 - (y - PATIO) / 200))), profundidade=-101)
c.retangulo(
    "nevoa_patio",
    -10,
    560,
    2410,
    820,
    c.degrade([(0, "#2c3158"), (1, "#2c3158")], 560, 820, alfas=[(0.0, 0.0), (0.55, 0.3), (1.0, 0.0)]),
    profundidade=-120,
)

# --------------------------------------------------------------------------- chão (1600×80)
chao = ARENA["chao"]
LARGURA_DO_CHAO = chao["largura"] * PX_POR_UNIDADE
ALTURA_DO_CHAO = chao["altura"] * PX_POR_UNIDADE
c.camada("chao", LARGURA_DO_CHAO, ALTURA_DO_CHAO)
c.retangulo("chao_corpo", 0, 0, LARGURA_DO_CHAO, ALTURA_DO_CHAO, c.degrade([(0, "#2a344b"), (1, "#151b29")], 0, ALTURA_DO_CHAO), profundidade=10)
# Blocos de pedra em duas fiadas desencontradas, cada um com um tom e um chanfro que pega a luz.
FIADA = (ALTURA_DO_CHAO - 18) / 2
for fiada in range(2):
    y0 = 18 + fiada * FIADA
    x = -70.0 if fiada else 0.0
    i = 0
    while x < LARGURA_DO_CHAO:
        largura = s.choice((110, 130, 150, 170))
        tom = misturar("#36435e", "#28334b", s.random())
        if fiada:
            tom = misturar(tom, "#141a28", 0.4)
        c.caixa(f"bloco{fiada}_{i}", max(x + 2, 0), y0 + 2, min(x + largura - 2, LARGURA_DO_CHAO), y0 + FIADA - 2, c.mat(tom, ambiente=0.62, luz=0.5, base=0.82), frente=-8, fundo=0, chanfro=5)
        x += largura
        i += 1
# Beiral de pedra clara: a linha reta que mostra onde se pisa, com um friso embaixo.
c.retangulo("chao_beiral", 0, 0, LARGURA_DO_CHAO, 12, c.brilho("#a3b8d9"), profundidade=-20)
c.retangulo("chao_beiral_luz", 0, 0, LARGURA_DO_CHAO, 3, c.brilho("#c9d8f0"), profundidade=-21)
c.retangulo("chao_beiral_sombra", 0, 12, LARGURA_DO_CHAO, 18, c.brilho("#56678a"), profundidade=-20)
for x in range(40, LARGURA_DO_CHAO, 80):
    c.retangulo(f"chao_friso{x}", x - 1, 12, x + 1, 18, c.brilho("#3b4868"), profundidade=-21)
# Musgo discreto em alguns cantos, sem cor de time.
for i in range(9):
    x = s.uniform(20, LARGURA_DO_CHAO - 60)
    c.placa(f"musgo{i}", [(x, 18), (x + s.uniform(26, 60), 18), (x + s.uniform(14, 30), 18 + s.uniform(6, 13)), (x + 6, 18 + s.uniform(3, 7))], c.brilho("#2b3d45"), profundidade=-22)

# --------------------------------------------------------------------- plataforma (380×40)
c.camada("plataforma", 380, 40)
# A metade de cima é a tábua (10 unidades do mundo); a de baixo, a sombra dela, quase sumindo.
c.retangulo("tabua", 0, 0, 380, 20, c.degrade([(0, "#5d7198"), (1, "#384667")], 0, 20), profundidade=0)
c.retangulo("tabua_topo", 0, 0, 380, 6, c.brilho("#c3d3ee"), profundidade=-5)
c.retangulo("tabua_topo_luz", 0, 0, 380, 2, c.brilho("#e1eaf8"), profundidade=-6)
c.retangulo("tabua_base", 0, 17, 380, 20, c.brilho("#283350"), profundidade=-5)
for x in (95, 190, 285):
    c.retangulo(f"tabua_junta{x}", x - 1, 6, x + 1, 17, c.brilho("#33405f"), profundidade=-5)
for x0, x1 in ((0, 10), (370, 380)):
    c.retangulo(f"tabua_ponta{x0}", x0, 0, x1, 20, c.brilho("#8b6a3c"), profundidade=-7)
    c.retangulo(f"tabua_ponta_luz{x0}", x0, 0, x1, 3, c.brilho("#c9a469"), profundidade=-8)
c.retangulo("tabua_sombra", 6, 20, 374, 40, c.degrade([(0, "#05070d"), (1, "#05070d")], 20, 40, alfas=[(0.0, 0.42), (1.0, 0.0)]), profundidade=0)

# ------------------------------------------------------------------------- frente (2400×900)
c.camada("frente", 2400, 900)
SOMBRA = c.brilho("#07090f")
FLOR_FRENTE = c.mat("#3d2236", ambiente=0.5, luz=0.5, base=0.6)
FLOR_FRENTE_CLARA = c.mat("#4b2a42", ambiente=0.5, luz=0.5, base=0.65)
# Galhos de cerejeira entrando pelos cantos de cima, bem escuros, longe do centro.
for nome, lado, x0 in (("e", 1, 0), ("d", -1, 2400)):
    galhos = (((0, 40), (330, 150)), ((0, 150), (230, 250)), ((150, 100), (300, 60)), ((240, 124), (430, 190)))
    for i, ((ax, ay), (bx, by)) in enumerate(galhos):
        ax, bx = x0 + lado * ax, x0 + lado * bx
        g = 11 - i * 2
        c.placa(f"frente_galho_{nome}{i}", [(ax, ay - g), (ax, ay + g), (bx, by + g * 0.3), (bx, by - g * 0.3)], SOMBRA, profundidade=-i)
    for i, (dx, dy, r) in enumerate(((60, 40, 80), (200, 70, 70), (330, 150, 60), (120, 170, 60), (230, 250, 48), (300, 56, 50), (430, 190, 40), (20, 110, 70))):
        c.bolha(f"frente_copa_{nome}{i}", x0 + lado * dx, dy, r * 1.25, r * 0.8, FLOR_FRENTE if i % 3 else FLOR_FRENTE_CLARA, -40 - i * 5, detalhe=2)
# Pétalas caindo, só perto das bordas.
for i in range(34):
    lado = i % 2
    x = s.uniform(30, 620) if lado == 0 else s.uniform(1780, 2370)
    y = s.uniform(120, 760)
    r = s.uniform(3.0, 5.5)
    giro = s.uniform(0, math.pi)
    pontos = [(x + r * math.cos(giro), y + r * math.sin(giro)), (x + r * 0.5 * math.cos(giro + 1.6), y + r * 0.5 * math.sin(giro + 1.6)), (x - r * math.cos(giro), y - r * math.sin(giro)), (x - r * 0.5 * math.cos(giro + 1.6), y - r * 0.5 * math.sin(giro + 1.6))]
    c.placa(f"petala{i}", pontos, c.brilho(misturar("#7a4a66", "#a9708c", s.random())), profundidade=-80)

c.renderizar(
    extras={
        "tema": "pátio de dojo à noite",
        "encaixe": {
            "descricao": "Nas camadas longe, perto e frente, o centro horizontal fica em x=600 do mundo e a linha y=600 da camada fica em y=520 do mundo (o topo do chão), com a câmera no centro.",
            "linhaDoChao": 600,
        },
        "paralaxeSugerida": {"ceu": 0.0, "longe": 0.12, "perto": 0.35, "frente": 1.15},
        "corAbaixo": {"longe": "#0e1222", "perto": "#080a14"},
        "pxPorUnidade": {"chao": PX_POR_UNIDADE, "plataforma": PX_POR_UNIDADE},
    }
)
