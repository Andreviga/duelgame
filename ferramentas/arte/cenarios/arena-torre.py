"""Cenário da arena torre: o alto de uma torre de pedra no meio da tempestade.

Uso: blender -b -P ferramentas/arte/cenarios/arena-torre.py
     (ou: python3 ferramentas/arte/rodar_blender.py ferramentas/arte/cenarios/arena-torre.py)
Opções, depois de `--`: --saida <pasta>  --escala 0.5 (prévia rápida)  --so ceu,perto

Gera em public/cenarios/arena-torre/: ceu.png, longe.png, perto.png, chao.png, plataforma.png,
frente.png e cenario.json (tamanhos, encaixe e paralaxe sugerida para o jogo).

Encaixe das camadas largas (longe, perto e frente): o centro da camada fica atrás do centro da
arena (x = 600 do mundo) e a linha y = 600 da camada fica na altura do chão (y = 520 do mundo).
Esta arena é estreita e alta: a luta acontece, na camada `perto`, entre x 760 e 1640 e do alto
da imagem até y 600. Ali não há nada; o corpo da torre fica todo abaixo do chão.

Cuidado com a cor: verde e azul são cores de time. Aqui tudo é cinza-esverdeado bem apagado, e
o brilho dos cristais é fraco e fica nas bordas e embaixo.
"""

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cenario import RAIZ, Cenario, misturar  # noqa: E402

ARENA = json.loads((RAIZ / "src" / "dados" / "arena-torre.json").read_text(encoding="utf-8"))
PX_POR_UNIDADE = 2  # chão e plataforma: 2 pixels por unidade do mundo

c = Cenario("arena-torre", semente=23)
# Tempestade: luz fria e fraca de cima, recorte esverdeado por trás.
c.tom_do_sol = (0.62, 0.8, 0.78)
c.tom_do_recorte = (0.42, 0.66, 0.7)
s = c.sorteio


def halo(nome, x, y, raio, hexa, forca, profundidade, queda=2.0, achatar=1.0):
    """Brilho suave em volta de um ponto, sumindo aos poucos até `raio`."""
    c.halo(f"{nome}_halo", x, y, raio, hexa, forca, profundidade, queda, achatar)


def nevoa(nome, y0, y1, hexa, forca, profundidade, largura):
    c.retangulo(
        nome,
        -10,
        y0,
        largura + 10,
        y1,
        c.degrade([(0, hexa), (1, hexa)], y0, y1, alfas=[(0.0, 0.0), (0.65, forca * 0.8), (1.0, forca)]),
        profundidade=profundidade,
    )


def nuvem_pesada(nome, x, y, l, a, tom, borda, profundidade):
    """Nuvem de tempestade: massa escura e facetada, com a barriga um pouco mais clara."""
    pontos = [
        (x - l / 2, y),
        (x - l * 0.36, y - a * 0.8),
        (x - l * 0.1, y - a),
        (x + l * 0.2, y - a * 0.7),
        (x + l / 2, y - a * 0.15),
        (x + l * 0.38, y + a * 0.6),
        (x + l * 0.05, y + a),
        (x - l * 0.3, y + a * 0.7),
    ]
    c.placa(nome, pontos, c.brilho(tom), profundidade=profundidade)
    c.fita(f"{nome}_barriga", [pontos[4], pontos[5], pontos[6], pontos[7], pontos[0]], [1.0, 3.0, 3.4, 2.6, 1.0], c.brilho(borda), profundidade=profundidade - 0.4)


def cristal(nome, x, y_base, altura, largura, material, torto=0.0, profundidade=0.0):
    """Cristal: uma ponta facetada, com a base afinada."""
    lados = 5
    giro = s.uniform(0, 1)
    v = [(x + torto, y_base - altura, profundidade)]
    for i in range(lados):
        a = giro + 2 * math.pi * i / lados
        v.append((x + torto * 0.35 + largura * math.cos(a), y_base - altura * 0.28, profundidade + largura * 0.7 * math.sin(a)))
    for i in range(lados):
        a = giro + 2 * math.pi * i / lados
        v.append((x + largura * 0.6 * math.cos(a), y_base, profundidade + largura * 0.4 * math.sin(a)))
    f = [(0, 1 + i, 1 + (i + 1) % lados) for i in range(lados)]
    f += [(1 + i, 1 + lados + i, 1 + lados + (i + 1) % lados, 1 + (i + 1) % lados) for i in range(lados)]
    return c.malha(nome, v, f, material)


# ---------------------------------------------------------------------------- céu (1600×900)
c.camada("ceu", 1600, 900, transparente=False)
c.retangulo(
    "ceu",
    -10,
    -10,
    1610,
    910,
    c.degrade([(0.0, "#070b0e"), (0.35, "#0f171a"), (0.7, "#1b2a2b"), (1.0, "#2b3f3c")], 0, 900),
    profundidade=900,
)
halo("clarao_do_fundo", 800, 760, 1100, "#3a5650", 0.5, 895, queda=1.6, achatar=2.2)
# Teto de nuvens: várias faixas largas, mais escuras em cima.
for i, (x, y, l, a, tom, borda) in enumerate(
    (
        (260, 60, 760, 60, "#0a1013", "#16211f"),
        (980, 40, 820, 54, "#0b1114", "#172320"),
        (1500, 96, 560, 50, "#0c1316", "#1a2725"),
        (620, 150, 640, 44, "#0e1619", "#1c2a28"),
        (120, 220, 520, 40, "#101a1c", "#20302d"),
        (1260, 216, 620, 42, "#101a1c", "#22332f"),
        (760, 300, 520, 30, "#142022", "#283a36"),
        (300, 390, 460, 26, "#18272a", "#2d423d"),
        (1440, 370, 420, 26, "#18272a", "#2f4540"),
        (960, 470, 520, 20, "#1d2e30", "#334a44"),
        (200, 540, 400, 18, "#213436", "#385048"),
    )
):
    nuvem_pesada(f"nuvem{i}", x, y, l, a, tom, borda, 870 - i)
# Um raio ao longe, alto e à esquerda, acima de onde se luta, e o clarão dele dentro da nuvem.
RAIO = [(334, 60), (310, 124), (342, 136), (296, 212), (324, 222), (288, 300)]
halo("raio_nuvem", 330, 70, 300, "#7fb5a8", 0.26, 858, queda=2.0, achatar=1.4)
halo("raio_longo", 310, 190, 170, "#7fb5a8", 0.12, 857, queda=2.2, achatar=0.5)
c.fita("raio", RAIO, [3.6, 3.0, 3.0, 2.2, 2.2, 0.8], c.brilho("#b9dcd2"), profundidade=855)
c.fita("raio_miolo", RAIO, [1.4, 1.2, 1.2, 0.9, 0.9, 0.3], c.brilho("#e6f7f2"), profundidade=854)
c.fita("raio_galho", [(342, 136), (378, 176), (372, 206)], [1.8, 1.2, 0.3], c.brilho("#a3cbc0"), profundidade=855)
# Outro clarão, mais fraco, do lado direito: só a luz dentro da nuvem, sem o risco.
halo("clarao_direito", 1420, 250, 300, "#5f8f84", 0.3, 858, queda=2.0, achatar=1.6)

# -------------------------------------------------------------------------- longe (2000×900)
c.camada("longe", 2000, 900)
BASE = 690
# Três planos de picos de rocha: quanto mais longe, mais claro e mais comido pela bruma.
for i, (x, pico, largura) in enumerate(((130, 250, 420), (520, 330, 380), (930, 300, 400), (1380, 270, 440), (1840, 300, 440))):
    c.montanha(f"pico3_{i}", x, pico, largura, BASE + 20, c.mat("#22332f", ambiente=0.7, luz=0.2, base=0.92), lados=7, y_fundo=910).location.y = 300
nevoa("bruma3", 330, 760, "#263b37", 0.6, 200, 2000)
for i, (x, pico, largura) in enumerate(((-40, 400, 380), (330, 440, 340), (700, 500, 300), (1130, 470, 320), (1560, 420, 360), (2010, 430, 380))):
    c.montanha(f"pico2_{i}", x, pico, largura, BASE + 20, c.mat("#18272a", ambiente=0.62, luz=0.26, base=0.86), lados=6, y_fundo=910)
nevoa("bruma2", 470, 780, "#1d302e", 0.55, -420, 2000)
# Outra torre ao longe, à direita, com uma janela acesa: mostra que o lugar é grande.
OUTRA = c.brilho("#0d1517")
ox, oy = 1640, 610
c.retangulo("outra_torre", ox - 26, oy - 230, ox + 26, 910, OUTRA, profundidade=-430)
c.placa("outra_torre_topo", [(ox - 36, oy - 230), (ox + 36, oy - 230), (ox + 30, oy - 250), (ox - 30, oy - 250)], OUTRA, profundidade=-431)
for k in range(4):
    c.retangulo(f"outra_ameia{k}", ox - 36 + k * 20, oy - 264, ox - 26 + k * 20, oy - 250, OUTRA, profundidade=-431)
c.placa("outra_torre_telhado", [(ox - 30, oy - 264), (ox + 30, oy - 264), (ox, oy - 340)], OUTRA, profundidade=-432)
halo("outra_janela", ox, oy - 150, 46, "#7fd6c4", 0.34, -433)
c.retangulo("outra_janela_luz", ox - 3.5, oy - 160, ox + 3.5, oy - 142, c.brilho("#a8e6d8"), profundidade=-434)
c.fita("outra_ponte", [(ox + 26, oy - 60), (ox + 150, oy - 74), (ox + 300, oy - 40)], [7, 5, 7], OUTRA, profundidade=-430)
# Picos da frente: os mais escuros, baixos no meio para não disputar com a luta.
for i, (x, pico, largura) in enumerate(((90, 520, 420), (470, 600, 360), (1000, 640, 420), (1480, 610, 380), (1900, 530, 420))):
    c.montanha(f"pico1_{i}", x, pico, largura, BASE + 30, c.mat("#0f1a1c", ambiente=0.6, luz=0.3, base=0.8), lados=6, y_fundo=910).location.y = -500
# Cristais ao longe, quase só um brilho, nas pontas.
for i, (x, y, t) in enumerate(((150, 640, 1.0), (240, 668, 0.7), (1830, 650, 1.0), (1760, 676, 0.6))):
    halo(f"cristal_longe{i}", x, y - 30 * t, 70 * t, "#3f9a8c", 0.22, -520)
    c.placa(f"cristal_longe{i}", [(x - 9 * t, y), (x, y - 62 * t), (x + 9 * t, y)], c.brilho("#3d8a7e"), profundidade=-521)
nevoa("bruma1", 600, 900, "#172829", 0.7, -560, 2000)

# -------------------------------------------------------------------------- perto (2400×900)
c.camada("perto", 2400, 900)
PEDRA = c.mat("#2a3838", ambiente=0.5, luz=0.55, base=0.72)
PEDRA_CLARA = c.mat("#374847", ambiente=0.5, luz=0.6, base=0.8)
PEDRA_ESCURA = c.mat("#1a2526", ambiente=0.5, luz=0.42, base=0.78)
ARDOSIA = c.mat("#162225", ambiente=0.5, luz=0.55, base=0.7)
FERRO = c.mat("#1c2224", ambiente=0.5, luz=0.5, base=0.8)
BREU = c.brilho("#080d0e")
PANO = c.mat("#2a2f3a", ambiente=0.5, luz=0.35, base=0.6)
CRISTAL = c.mat("#235f59", ambiente=0.6, luz=0.5, base=0.65)
CRISTAL_CLARO = c.mat("#3a8a7e", ambiente=0.65, luz=0.5, base=0.72)
LUZ_FRIA = c.brilho("#bff3e6")
CENTRO = 1200
TOPO_DA_TORRE = 646  # logo abaixo da laje do chão (que vai de y 600 a 640 nesta camada)

# O corpo da torre, embaixo da luta: um cilindro largo de pedra, com ameias, frestas e cintas.
RAIO_DA_TORRE = 356
c.cilindro("torre", CENTRO, TOPO_DA_TORRE + 30, 912, RAIO_DA_TORRE, RAIO_DA_TORRE + 26, PEDRA, lados=16, profundidade=0)
c.cilindro("torre_cornija", CENTRO, TOPO_DA_TORRE + 6, TOPO_DA_TORRE + 34, RAIO_DA_TORRE + 22, RAIO_DA_TORRE + 4, PEDRA_CLARA, lados=16, profundidade=0)
for i in range(11):
    x = CENTRO - RAIO_DA_TORRE - 14 + i * (2 * RAIO_DA_TORRE + 28) / 10
    c.caixa(f"ameia{i}", x - 22, TOPO_DA_TORRE - 26, x + 22, TOPO_DA_TORRE + 8, PEDRA_CLARA, frente=-RAIO_DA_TORRE - 26, fundo=-RAIO_DA_TORRE + 6, chanfro=4)
for i, y in enumerate((736, 834)):
    c.cilindro(f"torre_cinta{i}", CENTRO, y - 7, y + 7, RAIO_DA_TORRE + 12 + i * 8, RAIO_DA_TORRE + 13 + i * 8, PEDRA_ESCURA, lados=16, profundidade=0)
# Pedras soltas do paramento: algumas mais claras, algumas mais escuras.
for i in range(46):
    x = CENTRO + s.uniform(-0.86, 0.86) * RAIO_DA_TORRE
    y = s.uniform(TOPO_DA_TORRE + 50, 880)
    l, a = s.uniform(34, 70), s.uniform(14, 22)
    tom = misturar("#2a3838", s.choice(("#1c2829", "#34474a")), s.uniform(0.3, 0.8))
    c.caixa(f"pedra{i}", x - l / 2, y - a / 2, x + l / 2, y + a / 2, c.mat(tom, ambiente=0.55, luz=0.5, base=0.9), frente=-RAIO_DA_TORRE - 34, fundo=-RAIO_DA_TORRE - 26, chanfro=3)
# Frestas escuras e um veio de cristal brilhando fraco, bem embaixo.
for i, x in enumerate((CENTRO - 190, CENTRO, CENTRO + 190)):
    c.caixa(f"fresta{i}", x - 7, 760, x + 7, 812, BREU, frente=-RAIO_DA_TORRE - 36, fundo=-RAIO_DA_TORRE - 30)
VEIO = [(CENTRO - 110, 912), (CENTRO - 84, 868), (CENTRO - 104, 838), (CENTRO - 66, 800)]
halo("veio", CENTRO - 90, 850, 150, "#3f9a8c", 0.24, -RAIO_DA_TORRE - 44, queda=2.2)
c.fita("veio", VEIO, [9, 7, 5, 1], c.brilho("#4aa697"), profundidade=-RAIO_DA_TORRE - 40)


def torreao(nome, x, lado):
    """Torreão lateral, mais alto que a luta: fuste, ameias, telhado em cone, fresta acesa,
    lanterna de cristal do lado de fora, estandarte rasgado e uma ponte quebrada até a torre.

    `lado` (+1 ou -1) é para onde fica o meio do cenário.
    """
    topo = 250
    c.cilindro(f"{nome}_fuste", x, topo + 20, 912, 66, 86, PEDRA, lados=10, profundidade=40)
    c.cilindro(f"{nome}_cornija", x, topo - 4, topo + 26, 86, 68, PEDRA_CLARA, lados=10, profundidade=40)
    for i in range(5):
        ax = x - 72 + i * 36
        c.caixa(f"{nome}_ameia{i}", ax - 12, topo - 30, ax + 12, topo, PEDRA_CLARA, frente=-50, fundo=-22, chanfro=3)
    c.cone(f"{nome}_telhado", x, topo - 22, topo - 210, 78, ARDOSIA, lados=8, giro=0.2)
    c.cilindro(f"{nome}_ponteira", x, topo - 250, topo - 204, 2, 5, FERRO, lados=5, profundidade=40)
    for i, y in enumerate((430, 640)):
        c.cilindro(f"{nome}_cinta{i}", x, y - 6, y + 6, 72 + i * 5, 73 + i * 5, PEDRA_ESCURA, lados=10, profundidade=40)
    # Fresta acesa com luz fria, virada para fora.
    fx, fy = x - lado * 20, 360
    halo(f"{nome}_fresta", fx, fy, 90, "#7fd6c4", 0.3, -52)
    c.caixa(f"{nome}_fresta_moldura", fx - 12, fy - 34, fx + 12, fy + 34, PEDRA_ESCURA, frente=-48, fundo=-40, chanfro=2)
    c.retangulo(f"{nome}_fresta_luz", fx - 5, fy - 26, fx + 5, fy + 26, LUZ_FRIA, profundidade=-50)
    # Lanterna de cristal num braço de ferro, do lado de fora.
    lx, ly = x - lado * 118, 500
    c.fita(f"{nome}_braco", [(x - lado * 70, ly - 66), (lx, ly - 70), (lx, ly - 40)], 5, FERRO, profundidade=-30)
    halo(f"{nome}_lanterna", lx, ly, 140, "#5fc7b6", 0.3, -60, queda=2.2)
    cristal(f"{nome}_lanterna_cristal", lx, ly + 26, 60, 13, CRISTAL_CLARO, profundidade=-64)
    c.caixa(f"{nome}_lanterna_aro", lx - 16, ly + 22, lx + 16, ly + 30, FERRO, frente=-80, fundo=-50, chanfro=2)
    c.lampada(f"{nome}_luz", lx, ly, -110, "#6fd6c4", forca=1.0, raio=140)
    # Estandarte rasgado, do lado de dentro, alto.
    bx = x + lado * 78
    c.fita(f"{nome}_haste", [(x + lado * 60, 300), (bx + lado * 26, 296)], 4, FERRO, profundidade=-30)
    c.placa(f"{nome}_estandarte", [(bx - 16, 300), (bx + 16, 300), (bx + 16, 404), (bx + 6, 388), (bx, 420), (bx - 8, 392), (bx - 16, 410)], PANO, profundidade=-32)
    c.retangulo(f"{nome}_estandarte_faixa", bx - 16, 318, bx + 16, 324, c.mat("#4a5560", ambiente=0.5, luz=0.3, base=1.0), profundidade=-33)
    # Ponte quebrada na direção da torre, abaixo da linha da luta.
    py = 716
    x0 = x + lado * 80
    x1 = x + lado * 250
    c.caixa(f"{nome}_ponte", min(x0, x1), py, max(x0, x1), py + 26, PEDRA, frente=-30, fundo=20, chanfro=4)
    c.placa(f"{nome}_ponte_arco", [(x0, py + 26), (x1, py + 26), (x1 - lado * 30, py + 60), (x0 + lado * 40, py + 120), (x0, py + 150)], PEDRA_ESCURA, profundidade=22)
    for k in range(3):
        qx = x1 + lado * (18 + k * 26)
        c.caixa(f"{nome}_ponte_resto{k}", qx - 10, py + 6 + k * 16, qx + 10, py + 24 + k * 18, PEDRA_ESCURA, frente=-20, fundo=10, chanfro=3)
    # Corrente pendurada da ponte.
    for k in range(7):
        c.disco(f"{nome}_elo{k}", x1 - lado * 12, py + 34 + k * 13, 5.5, FERRO, lados=6, profundidade=-34 - (k % 2))


# Os torreões ficam logo além das plataformas laterais (que vão de x 790 a 1610 nesta camada).
torreao("torreao_e", 690, +1)
torreao("torreao_d", 1710, -1)

# Rochedos onde os torreões se apoiam, e cristais brotando deles, só nas pontas e embaixo.
ROCHA = c.mat("#141f20", ambiente=0.55, luz=0.45, base=0.8)
for i, (x, pico, largura) in enumerate(((240, 540, 520), (520, 660, 380), (2160, 520, 540), (1880, 670, 380))):
    c.montanha(f"rochedo{i}", x, pico, largura, 912, ROCHA, lados=7).location.y = -90
for i, (x, y, altura, largura, torto) in enumerate(
    (
        (240, 650, 150, 26, -14),
        (330, 700, 96, 18, 16),
        (150, 710, 110, 20, -22),
        (520, 760, 84, 16, 10),
        (806, 846, 70, 13, -8),
        (2160, 630, 160, 28, 16),
        (2070, 694, 100, 18, -14),
        (2250, 700, 116, 20, 22),
        (1880, 770, 84, 16, -10),
        (1594, 850, 66, 12, 8),
    )
):
    halo(f"cristal{i}", x, y - altura * 0.5, altura * 1.0, "#2f7f76", 0.16, -180 - i)
    cristal(f"cristal{i}", x, y, altura, largura, CRISTAL if i % 2 else CRISTAL_CLARO, torto=torto, profundidade=-200 - i)
    c.lampada(f"cristal_luz{i}", x, y - altura * 0.5, -260, "#5fc7b6", forca=0.5, raio=altura)

# O fundo do abismo: escuro até embaixo, com bruma subindo.
c.retangulo(
    "bruma_torre",
    -10,
    640,
    2410,
    910,
    c.degrade([(0, "#1d3231"), (1, "#0b1213")], 640, 900, alfas=[(0.0, 0.0), (0.45, 0.4), (1.0, 0.86)]),
    profundidade=-400,
)
for i, (nx, ny, nr) in enumerate(((300, 800, 480), (2100, 800, 500), (1200, 860, 640))):
    halo(f"tufo{i}", nx, ny, nr, "#2f4f4b", 0.28, -405 - i, queda=1.8, achatar=6.5)

# --------------------------------------------------------------------------- chão (1200×80)
chao = ARENA["chao"]
LARGURA_DO_CHAO = chao["largura"] * PX_POR_UNIDADE
ALTURA_DO_CHAO = chao["altura"] * PX_POR_UNIDADE
c.camada("chao", LARGURA_DO_CHAO, ALTURA_DO_CHAO)
c.retangulo("chao_corpo", 0, 0, LARGURA_DO_CHAO, ALTURA_DO_CHAO, c.degrade([(0, "#34474a"), (1, "#172324")], 0, ALTURA_DO_CHAO), profundidade=10)
# Laje de pedra em duas fiadas desencontradas, cada bloco com um tom e um chanfro que pega a luz.
FIADA = (ALTURA_DO_CHAO - 18) / 2
for fiada in range(2):
    y0 = 18 + fiada * FIADA
    x = -60.0 if fiada else 0.0
    i = 0
    while x < LARGURA_DO_CHAO:
        largura = s.choice((100, 120, 140, 160))
        tom = misturar("#40575a", "#2e4144", s.random())
        if fiada:
            tom = misturar(tom, "#141f20", 0.42)
        c.caixa(f"bloco{fiada}_{i}", max(x + 2, 0), y0 + 2, min(x + largura - 2, LARGURA_DO_CHAO), y0 + FIADA - 2, c.mat(tom, ambiente=0.62, luz=0.5, base=0.82), frente=-8, fundo=0, chanfro=5)
        x += largura
        i += 1
# Beiral claro: a linha reta que mostra onde se pisa, com um friso embaixo.
c.retangulo("chao_beiral", 0, 0, LARGURA_DO_CHAO, 12, c.brilho("#b4d3ca"), profundidade=-20)
c.retangulo("chao_beiral_luz", 0, 0, LARGURA_DO_CHAO, 3, c.brilho("#d8ece6"), profundidade=-21)
c.retangulo("chao_beiral_sombra", 0, 12, LARGURA_DO_CHAO, 18, c.brilho("#4a6260"), profundidade=-20)
for x in range(40, LARGURA_DO_CHAO, 80):
    c.retangulo(f"chao_friso{x}", x - 1, 12, x + 1, 18, c.brilho("#32474a"), profundidade=-21)
# Runas gastas na primeira fiada e um cristal pequeno engastado em cada ponta, sem brilho forte.
for i, x in enumerate(range(150, LARGURA_DO_CHAO - 100, 150)):
    y = 33
    forma = i % 3
    tom = c.brilho("#5d7f7a")
    if forma == 0:
        c.fita(f"runa{i}", [(x - 7, y + 8), (x, y - 8), (x + 7, y + 8)], 2.2, tom, profundidade=-24)
    elif forma == 1:
        c.fita(f"runa{i}", [(x - 7, y - 8), (x + 7, y), (x - 7, y + 8)], 2.2, tom, profundidade=-24)
    else:
        c.fita(f"runa{i}a", [(x, y - 9), (x, y + 9)], 2.2, tom, profundidade=-24)
        c.fita(f"runa{i}b", [(x - 7, y - 3), (x + 7, y + 3)], 2.2, tom, profundidade=-24)
for nome, x in (("e", 26), ("d", LARGURA_DO_CHAO - 26)):
    c.disco(f"engaste_{nome}", x, 48, 15, c.brilho("#1c2a2b"), lados=6, profundidade=-24)
    c.disco(f"engaste_cristal_{nome}", x, 48, 10, c.brilho("#4aa697"), lados=6, profundidade=-25, giro=0.5)
    c.disco(f"engaste_luz_{nome}", x - 3, 45, 4, c.brilho("#8fd6c8"), lados=4, profundidade=-26)
# Musgo escuro em alguns cantos, sem cor de time.
for i in range(7):
    x = s.uniform(20, LARGURA_DO_CHAO - 60)
    c.placa(f"musgo{i}", [(x, 18), (x + s.uniform(26, 56), 18), (x + s.uniform(14, 30), 18 + s.uniform(6, 12)), (x + 6, 18 + s.uniform(3, 7))], c.brilho("#22373a"), profundidade=-22)

# --------------------------------------------------------------------- plataforma (380×40)
c.camada("plataforma", 380, 40)
# A metade de cima é a laje (10 unidades do mundo); a de baixo, a sombra dela, quase sumindo.
c.retangulo("laje", 0, 0, 380, 20, c.degrade([(0, "#5c7a76"), (1, "#33494a")], 0, 20), profundidade=0)
c.retangulo("laje_topo", 0, 0, 380, 6, c.brilho("#c4e0d8"), profundidade=-5)
c.retangulo("laje_topo_luz", 0, 0, 380, 2, c.brilho("#e2f2ee"), profundidade=-6)
c.retangulo("laje_base", 0, 17, 380, 20, c.brilho("#223436"), profundidade=-5)
for x in (95, 190, 285):
    c.retangulo(f"laje_junta{x}", x - 1, 6, x + 1, 17, c.brilho("#2d4244"), profundidade=-5)
# Pontas com um grampo de ferro e um cristal pequeno, que é o que "segura" a laje no ar.
for x0, x1 in ((0, 12), (368, 380)):
    c.retangulo(f"laje_grampo{x0}", x0, 0, x1, 20, c.brilho("#3a4648"), profundidade=-7)
    c.retangulo(f"laje_grampo_luz{x0}", x0, 0, x1, 3, c.brilho("#8fa5a2"), profundidade=-8)
for x in (26, 354):
    c.placa(f"laje_cristal{x}", [(x - 6, 17), (x, 5), (x + 6, 17)], c.brilho("#4aa697"), profundidade=-9)
    c.placa(f"laje_cristal_luz{x}", [(x - 2, 14), (x, 7), (x + 1, 14)], c.brilho("#9fe0d2"), profundidade=-10)
c.retangulo("laje_veio", 50, 11, 330, 12, c.brilho("#3f5858"), profundidade=-5)
c.retangulo("laje_sombra", 6, 20, 374, 40, c.degrade([(0, "#04080a"), (1, "#04080a")], 20, 40, alfas=[(0.0, 0.42), (1.0, 0.0)]), profundidade=0)

# ------------------------------------------------------------------------- frente (2400×900)
c.camada("frente", 2400, 900)
SOMBRA = c.brilho("#060a0b")
ROCHA_FRENTE = c.mat("#111a1b", ambiente=0.5, luz=0.4, base=0.7)
ROCHA_FRENTE_CLARA = c.mat("#1b2829", ambiente=0.5, luz=0.45, base=0.75)
# Restos de um arco de pedra entrando pelos cantos de cima, com correntes penduradas.
for nome, lado, x0 in (("e", 1, 0), ("d", -1, 2400)):

    def px(dx):
        return x0 + lado * dx

    blocos = ((-10, -10, 150, 70), (130, -10, 250, 52), (230, -10, 340, 36), (-10, 60, 96, 150), (-10, 140, 60, 236), (80, 62, 170, 112), (320, -10, 410, 24))
    for i, (ax, ay, bx, by) in enumerate(blocos):
        xa, xb = sorted((px(ax), px(bx)))
        c.caixa(f"frente_bloco_{nome}{i}", xa, ay, xb, by, ROCHA_FRENTE if i % 2 else ROCHA_FRENTE_CLARA, frente=-40 - i * 4, fundo=0, chanfro=6)
    for k, (dx, comprimento) in enumerate(((120, 9), (300, 6))):
        cx = px(dx)
        y0 = 112 if k == 0 else 36
        for e in range(comprimento):
            c.disco(f"frente_elo_{nome}{k}_{e}", cx + (2 if e % 2 else -2), y0 + e * 17, 7, SOMBRA, lados=6, profundidade=-70 - (e % 2))
        c.placa(f"frente_gancho_{nome}{k}", [(cx - 9, y0 + comprimento * 17), (cx + 9, y0 + comprimento * 17), (cx + 5, y0 + comprimento * 17 + 22), (cx - 12, y0 + comprimento * 17 + 14)], SOMBRA, profundidade=-72)
# Chuva: riscos finos e inclinados, só perto das bordas, quase transparentes.
CHUVA = c.brilho("#9fc4bb", alfa=0.32)
for i in range(70):
    lado = i % 2
    x = s.uniform(10, 560) if lado == 0 else s.uniform(1840, 2390)
    y = s.uniform(40, 840)
    l = s.uniform(26, 56)
    c.fita(f"chuva{i}", [(x, y), (x - l * 0.22, y + l)], 1.4, CHUVA, profundidade=-90)

c.renderizar(
    extras={
        "tema": "torre de pedra na tempestade",
        "encaixe": {
            "descricao": "Nas camadas longe, perto e frente, o centro horizontal fica em x=600 do mundo e a linha y=600 da camada fica em y=520 do mundo (o topo do chão), com a câmera no centro.",
            "linhaDoChao": 600,
        },
        "paralaxeSugerida": {"ceu": 0.0, "longe": 0.12, "perto": 0.35, "frente": 1.15},
        "corAbaixo": {"longe": "#0f1a1c", "perto": "#0b1213"},
        "pxPorUnidade": {"chao": PX_POR_UNIDADE, "plataforma": PX_POR_UNIDADE},
    }
)
