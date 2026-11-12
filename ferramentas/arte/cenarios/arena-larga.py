"""Cenário da arena larga: convés de navio ao pôr do sol.

Uso: blender -b -P ferramentas/arte/cenarios/arena-larga.py
     (ou: python3 ferramentas/arte/rodar_blender.py ferramentas/arte/cenarios/arena-larga.py)
Opções, depois de `--`: --saida <pasta>  --escala 0.5 (prévia rápida)  --so ceu,perto

Gera em public/cenarios/arena-larga/: ceu.png, longe.png, perto.png, chao.png, plataforma.png,
frente.png e cenario.json (tamanhos, encaixe e paralaxe sugerida para o jogo).

Encaixe das camadas largas (longe, perto e frente): o centro da camada fica atrás do centro da
arena (x = 600 do mundo) e a linha y = 600 da camada fica na altura do chão (y = 540 do mundo).
A luta acontece, na camada `perto`, entre x 700 e 1700 e y 230 e 600: ali não há nada.

Cuidado com a cor: laranja é a cor de um dos times. O pôr do sol aqui é rosado e apagado, e o
sol fica baixo, no canto, quase todo atrás do mar.
"""

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cenario import RAIZ, Cenario, misturar  # noqa: E402

ARENA = json.loads((RAIZ / "src" / "dados" / "arena-larga.json").read_text(encoding="utf-8"))
PX_POR_UNIDADE = 2  # chão e plataforma: 2 pixels por unidade do mundo

c = Cenario("arena-larga", semente=11)
# Fim de tarde: sol baixo e quente pela frente, recorte arroxeado por trás.
c.tom_do_sol = (1.0, 0.74, 0.58)
c.tom_do_recorte = (0.62, 0.48, 0.85)
s = c.sorteio


def halo(nome, x, y, raio, hexa, forca, profundidade, queda=2.0, achatar=1.0):
    """Brilho suave em volta de um ponto, sumindo aos poucos até `raio`."""
    c.halo(f"{nome}_halo", x, y, raio, hexa, forca, profundidade, queda, achatar)


def nuvem(nome, x, y, l, a, tom, borda, profundidade):
    """Nuvem comprida e facetada, com a borda de baixo acesa pelo sol que já desceu."""
    pontos = [
        (x - l / 2, y),
        (x - l * 0.3, y - a * 0.7),
        (x - l * 0.05, y - a),
        (x + l * 0.22, y - a * 0.55),
        (x + l / 2, y - a * 0.1),
        (x + l * 0.34, y + a * 0.5),
        (x - l * 0.1, y + a * 0.75),
        (x - l * 0.36, y + a * 0.45),
    ]
    c.placa(nome, pontos, c.brilho(tom), profundidade=profundidade)
    c.fita(f"{nome}_borda", [pontos[4], pontos[5], pontos[6], pontos[7]], [1.0, 2.6, 2.8, 1.0], c.brilho(borda), profundidade=profundidade - 0.4)


# ---------------------------------------------------------------------------- céu (1600×900)
c.camada("ceu", 1600, 900, transparente=False)
c.retangulo(
    "ceu",
    -10,
    -10,
    1610,
    910,
    c.degrade([(0.0, "#16152f"), (0.3, "#2a2147"), (0.55, "#4a2f55"), (0.72, "#75425a"), (0.86, "#9a5a5c"), (1.0, "#a8685c")], 0, 900),
    profundidade=900,
)
# O sol: baixo e à direita, fora do meio da luta. O mar da camada `longe` cobre a metade de baixo.
SOL = (1480, 667)
halo("sol_longe", *SOL, 760, "#b0625a", 0.5, 892, queda=1.7, achatar=1.5)
halo("sol_perto", *SOL, 250, "#d98c68", 0.5, 890, queda=1.8)
c.disco("sol", *SOL, 62, c.brilho("#e3a57a"), lados=18, profundidade=886, giro=0.2)
c.disco("sol_miolo", SOL[0], SOL[1], 48, c.brilho("#ecb98c"), lados=16, profundidade=885, giro=0.5)
# Primeiras estrelas, só no alto.
for i in range(46):
    x, y = s.uniform(0, 1600), s.uniform(8, 250)
    tom = misturar("#1c1a38", "#c9c3e6", s.uniform(0.2, 0.6) * (1 - y / 300))
    c.disco(f"estrela{i}", x, y, s.choice((1.2, 1.2, 1.6)), c.brilho(tom), lados=4, profundidade=880)
# Nuvens em faixas: roxas em cima, mais rosadas perto do horizonte; a de baixo de cada uma acende.
for i, (x, y, l, a, tom, borda) in enumerate(
    (
        (240, 150, 560, 30, "#231c40", "#5a3a5e"),
        (1130, 110, 480, 24, "#211b3e", "#553759"),
        (760, 236, 420, 18, "#2e2249", "#6e4460"),
        (120, 330, 420, 22, "#3a2850", "#8a5266"),
        (1470, 300, 400, 20, "#3a2850", "#93586a"),
        (560, 420, 520, 18, "#4a3058", "#9c5e6a"),
        (1220, 446, 460, 16, "#553660", "#b56f6c"),
        (300, 520, 480, 14, "#623c60", "#b8736c"),
        (930, 560, 560, 13, "#6f4462", "#c98670"),
        (1480, 590, 300, 10, "#7a4a62", "#d39a7a"),
    )
):
    nuvem(f"nuvem{i}", x, y, l, a, tom, borda, 870 - i)
# Um bando de gaivotas ao longe, em "v" abertos, pequeno e no canto.
for i, (x, y, t) in enumerate(((1130, 330, 9), (1166, 316, 7), (1196, 342, 6), (1228, 322, 5), (318, 260, 6), (346, 246, 5))):
    c.fita(f"gaivota{i}", [(x - t, y - t * 0.35), (x, y), (x + t, y - t * 0.45)], [0.5, 1.8, 0.5], c.brilho("#1d1933"), profundidade=860)

# -------------------------------------------------------------------------- longe (2000×900)
c.camada("longe", 2000, 900)
# O horizonte fica um pouco abaixo da linha do chão da luta (y = 600): atrás dos personagens é céu.
HORIZONTE = 636
MAR = [(0.0, "#3a2c50"), (0.12, "#2a2448"), (0.4, "#1c1c3c"), (1.0, "#11122a")]
c.retangulo("mar", -10, HORIZONTE, 2010, 910, c.degrade(MAR, HORIZONTE, 900), profundidade=400)
c.retangulo("mar_linha", -10, HORIZONTE - 1, 2010, HORIZONTE + 2, c.brilho("#6a4860"), profundidade=399)
# Reflexo do sol: faixas curtas que se alargam e apagam ao descer. O sol do céu fica em x = 1480
# de 1600 (1110 na tela); na camada `longe`, com a câmera parada, isso cai em x = 1510.
REFLEXO_X = 1510
for i in range(13):
    y = HORIZONTE + 6 + i * 17 + s.uniform(-2, 2)
    meia = 26 + i * 13 + s.uniform(-8, 8)
    tom = misturar("#d99a78", "#3a2c50", i / 14)
    dx = s.uniform(-10, 10)
    c.placa(f"reflexo{i}", [(REFLEXO_X + dx - meia, y), (REFLEXO_X + dx - meia * 0.5, y - 2.5), (REFLEXO_X + dx + meia * 0.6, y - 2.5), (REFLEXO_X + dx + meia, y), (REFLEXO_X + dx + meia * 0.4, y + 2.5), (REFLEXO_X + dx - meia * 0.6, y + 2.5)], c.brilho(tom), profundidade=390 - i)
# Ondas: riscos curtos, mais claros perto do horizonte e maiores perto de quem olha.
for i in range(150):
    t = s.random() ** 1.6
    y = HORIZONTE + 8 + t * 250
    x = s.uniform(-20, 2020)
    l = 14 + t * 60 + s.uniform(0, 14)
    tom = misturar("#4a3a66", "#1d1d3e", min(1.0, t * 1.4))
    c.placa(f"onda{i}", [(x - l, y), (x - l * 0.3, y - 1.6 - t * 1.6), (x + l * 0.5, y - 1.2 - t), (x + l, y), (x + l * 0.2, y + 1.4), (x - l * 0.5, y + 1.2)], c.brilho(tom), profundidade=380 - t * 100)
# Ilhas rochosas nas pontas, bem apagadas pela bruma.
ILHA = c.mat("#30264a", ambiente=0.7, luz=0.22, base=0.92)
ILHA_PERTO = c.mat("#231d3c", ambiente=0.65, luz=0.26, base=0.88)
for i, (x, pico, largura) in enumerate(((150, 520, 420), (420, 566, 300), (1890, 500, 460))):
    c.montanha(f"ilha_longe{i}", x, pico, largura, HORIZONTE + 2, ILHA, lados=7).location.y = 300
for i, (x, pico, largura) in enumerate(((-30, 548, 360), (1990, 560, 300), (640, 598, 200))):
    c.montanha(f"ilha_perto{i}", x, pico, largura, HORIZONTE + 2, ILHA_PERTO, lados=6).location.y = 200
c.retangulo(
    "bruma",
    -10,
    470,
    2010,
    HORIZONTE + 24,
    c.degrade([(0, "#8a5a66"), (1, "#8a5a66")], 470, HORIZONTE + 24, alfas=[(0.0, 0.0), (0.8, 0.32), (1.0, 0.1)]),
    profundidade=150,
)


def veleiro(nome, x, y, t, lado=1):
    """Navio ao longe, em silhueta: casco, dois mastros e velas. `lado` -1 espelha."""
    casco = c.brilho("#17142b")
    vela = c.brilho("#2b2242")

    def p(dx, dy):
        return (x + lado * dx * t, y + dy * t)

    c.placa(f"{nome}_casco", [p(-62, -12), p(70, -14), p(84, -22), p(58, 4), (p(-50, 4))], casco, profundidade=120)
    c.placa(f"{nome}_popa", [p(-62, -12), p(-70, -28), p(-40, -26), p(-36, -12)], casco, profundidade=120)
    for i, (mx, altura) in enumerate(((-14, 108), (30, 88))):
        c.placa(f"{nome}_mastro{i}", [p(mx - 1.6, -12), p(mx + 1.6, -12), p(mx + 1.0, -altura), p(mx - 1.0, -altura)], casco, profundidade=119)
        for k, (base, topo, larg) in enumerate(((20, 52, 34), (56, 82, 26), (86, altura - 4, 18))):
            if topo <= base:
                continue
            c.placa(f"{nome}_vela{i}_{k}", [p(mx - larg, -base), p(mx + larg, -base), p(mx + larg * 0.82 + 5, -(base + topo) / 2), p(mx + larg * 0.8, -topo), p(mx - larg * 0.8, -topo)], vela, profundidade=118)
    c.placa(f"{nome}_bujarrona", [p(84, -22), p(112, -30), p(30, -84)], vela, profundidade=118)
    c.fita(f"{nome}_espuma", [p(-58, 5), p(0, 7), p(66, 5)], [0.6, 2.0, 0.6], c.brilho("#5a4a70"), profundidade=117)


veleiro("veleiro_e", 540, HORIZONTE + 4, 0.9, lado=1)
veleiro("veleiro_d", 1150, HORIZONTE + 2, 0.5, lado=-1)

# -------------------------------------------------------------------------- perto (2400×900)
c.camada("perto", 2400, 900)
MADEIRA = c.mat("#3a2630", ambiente=0.5, luz=0.55, base=0.75)
MADEIRA_CLARA = c.mat("#4d3338", ambiente=0.5, luz=0.6, base=0.8)
MADEIRA_ESCURA = c.mat("#22161f", ambiente=0.5, luz=0.42, base=0.8)
BREU = c.brilho("#0f0a14")
CORDA = c.brilho("#241a24")
LONA = c.mat("#6a5a66", ambiente=0.5, luz=0.55, base=0.72)
LONA_ESCURA = c.mat("#4a3d52", ambiente=0.5, luz=0.45, base=0.75)
FERRO = c.mat("#262433", ambiente=0.5, luz=0.55, base=0.8)
LATAO = c.mat("#6b5a3a", ambiente=0.55, luz=0.5, base=1.0)
LUZ = c.brilho("#ffd9a0")
CONVES = 724  # onde as coisas do fundo pisam: bem abaixo da linha do chão da luta (y = 600)
AMURADA = CONVES - 62


def enxarcia(nome, x_topo, y_topo, x_base, y_base, degraus=9, pernas=3, abre=90):
    """Escada de corda do mastro até a amurada: `pernas` cordas em leque e degraus entre elas."""
    lado = 1 if x_base > x_topo else -1
    bases = [x_base + lado * abre * (k / (pernas - 1) - 0.5) for k in range(pernas)]
    for k, xb in enumerate(bases):
        c.fita(f"{nome}_perna{k}", [(x_topo, y_topo), (xb, y_base)], 3.2, CORDA, profundidade=30)
    for d in range(1, degraus + 1):
        t = d / (degraus + 1)
        y = y_topo + (y_base - y_topo) * t
        xa = x_topo + (bases[0] - x_topo) * t
        xb = x_topo + (bases[-1] - x_topo) * t
        c.fita(f"{nome}_degrau{d}", [(xa, y), (xb, y)], 2.0, CORDA, profundidade=30)


def mastro(nome, x, lado):
    """Mastro com duas vergas, velas recolhidas, cesto de gávea, enxárcias e uma lanterna.

    `lado` (+1 ou -1) é para onde fica o meio do navio: as vergas avançam pouco para esse lado.
    """
    c.cilindro(f"{nome}_fuste", x, -30, CONVES + 10, 15, 22, MADEIRA, lados=8, profundidade=0)
    for i, y in enumerate((96, 330, 560)):
        c.cilindro(f"{nome}_cinta{i}", x, y - 7, y + 7, 21 - i, 22 - i, FERRO, lados=8, profundidade=-2)
    for i, (y, fora, dentro) in enumerate(((118, 300, 120), (318, 260, 100))):
        x0, x1 = (x - fora, x + dentro) if lado > 0 else (x - dentro, x + fora)
        c.caixa(f"{nome}_verga{i}", x0, y - 9, x1, y + 9, MADEIRA_CLARA, frente=-30, fundo=-12, chanfro=4)
        # Vela recolhida: gomos de lona amarrados na verga.
        n = int((x1 - x0) / 52)
        for k in range(n):
            gx = x0 + 26 + k * (x1 - x0 - 52) / max(1, n - 1)
            c.bolha(f"{nome}_lona{i}_{k}", gx, y + 22, 30, 17, LONA if k % 2 else LONA_ESCURA, -34, torto=0.12)
            c.fita(f"{nome}_amarra{i}_{k}", [(gx - 26, y - 10), (gx - 26, y + 36)], 3.0, CORDA, profundidade=-52)
    # Cesto de gávea.
    c.caixa(f"{nome}_cesto", x - 46, 196, x + 46, 236, MADEIRA_ESCURA, frente=-40, fundo=20, chanfro=5)
    c.caixa(f"{nome}_cesto_borda", x - 52, 190, x + 52, 200, MADEIRA_CLARA, frente=-44, fundo=20, chanfro=3)
    # Enxárcias para fora (até a amurada) e uma mais curta para dentro.
    enxarcia(f"{nome}_enx_fora", x, 206, x - lado * 250, AMURADA, degraus=10, pernas=3, abre=110)
    enxarcia(f"{nome}_enx_dentro", x, 206, x + lado * 120, AMURADA, degraus=8, pernas=2, abre=60)
    # Lanterna pendurada do lado de fora, com luz quente só ali.
    lx, ly = x - lado * 44, 452
    c.fita(f"{nome}_gancho", [(x - lado * 14, ly - 54), (lx, ly - 48), (lx, ly - 26)], 3.0, BREU, profundidade=-40)
    halo(f"{nome}_lanterna", lx, ly, 150, "#ffb45a", 0.36, -60, queda=2.2)
    c.caixa(f"{nome}_lanterna_teto", lx - 15, ly - 28, lx + 15, ly - 20, FERRO, frente=-62, fundo=-40, chanfro=2)
    c.retangulo(f"{nome}_lanterna_vidro", lx - 11, ly - 20, lx + 11, ly + 14, LUZ, profundidade=-62)
    for dx in (-11, 0, 11):
        c.retangulo(f"{nome}_lanterna_grade{dx}", lx + dx - 1.2, ly - 20, lx + dx + 1.2, ly + 14, BREU, profundidade=-63)
    c.caixa(f"{nome}_lanterna_base", lx - 14, ly + 14, lx + 14, ly + 20, FERRO, frente=-62, fundo=-40, chanfro=2)
    c.lampada(f"{nome}_luz", lx, ly, -110, "#ffb45a", forca=1.3, raio=150)


# Os mastros ficam logo além das pontas do chão da luta (que vai de x 720 a 1680 nesta camada).
mastro("mastro_e", 640, +1)
mastro("mastro_d", 1760, -1)

# Varal de bandeirolas entre os dois mastros, bem acima da luta, em tons apagados.
VARAL = [(640, 150), (900, 190), (1200, 206), (1500, 190), (1760, 150)]
c.fita("varal", VARAL, 2.6, CORDA, profundidade=20)
TONS_DE_BANDEIROLA = ("#4a2f3a", "#5a5250", "#34424e", "#54463a")
n = 0
for (ax, ay), (bx, by) in zip(VARAL, VARAL[1:]):
    passos = max(2, int((bx - ax) / 62))
    for k in range(passos):
        t = (k + 0.5) / passos
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        c.placa(f"bandeirola{n}", [(x - 15, y + 1), (x + 15, y + 1), (x + s.uniform(-3, 3), y + 30)], c.mat(TONS_DE_BANDEIROLA[n % 4], ambiente=0.5, luz=0.12, base=0.75), profundidade=18)
        n += 1

# Amurada: corrimão, balaústres e a tábua de baixo, de ponta a ponta.
c.caixa("amurada_corrimao", -10, AMURADA - 8, 2410, AMURADA + 6, MADEIRA_CLARA, frente=-30, fundo=10, chanfro=4)
c.caixa("amurada_rodape", -10, CONVES - 12, 2410, CONVES + 2, MADEIRA, frente=-26, fundo=10, chanfro=3)
for i, x in enumerate(range(20, 2400, 56)):
    grosso = i % 6 == 0
    c.cilindro(f"balaustre{i}", x, AMURADA + 6, CONVES - 12, 9 if grosso else 5, 11 if grosso else 7, MADEIRA_ESCURA if not grosso else MADEIRA, lados=6, profundidade=-6)
    if grosso:
        c.caixa(f"balaustre_topo{i}", x - 13, AMURADA - 18, x + 13, AMURADA - 8, MADEIRA, frente=-34, fundo=8, chanfro=3)

# Convés: tábuas escuras até embaixo, sem linha clara (para ninguém achar que dá para pisar).
c.retangulo("conves", -10, CONVES, 2410, 910, c.degrade([(0, "#24161f"), (0.45, "#170e16"), (1, "#0d0a10")], CONVES, 900), profundidade=-100)
for i in range(9):
    y = CONVES + 10 + i * i * 2.4 + i * 6
    c.retangulo(f"conves_junta{i}", -10, y, 2410, y + 1.6, c.brilho(misturar("#2e1d27", "#120b12", i / 9)), profundidade=-101)
for i in range(30):
    x, y = s.uniform(0, 2400), s.uniform(CONVES + 12, 860)
    l = s.uniform(70, 160)
    c.placa(f"conves_tabua{i}", [(x, y), (x + l, y), (x + l + 10, y + 7), (x + 8, y + 7)], c.brilho(misturar("#24161f", "#2b1b25", s.random() * (1 - (y - CONVES) / 200))), profundidade=-101.5)


def barril(nome, x, y_base, altura=92, raio=34, profundidade=-150):
    c.cilindro(f"{nome}_cima", x, y_base - altura, y_base - altura * 0.5, raio * 0.86, raio, MADEIRA_CLARA, lados=10, profundidade=profundidade)
    c.cilindro(f"{nome}_baixo", x, y_base - altura * 0.5, y_base, raio, raio * 0.86, MADEIRA, lados=10, profundidade=profundidade)
    for i, t in enumerate((0.14, 0.5, 0.86)):
        r = raio * (0.9 + 0.12 * (1 - abs(t - 0.5) * 2))
        c.cilindro(f"{nome}_aro{i}", x, y_base - altura * t - 3, y_base - altura * t + 3, r, r, FERRO, lados=10, profundidade=profundidade - 2)


def caixote(nome, x0, y_base, lado_, profundidade=-150):
    y0 = y_base - lado_
    c.caixa(f"{nome}", x0, y0, x0 + lado_, y_base, MADEIRA, frente=profundidade - lado_ * 0.5, fundo=profundidade, chanfro=4)
    borda = max(6, lado_ * 0.1)
    for i, (a, b, d, e) in enumerate(((x0, y0, x0 + lado_, y0 + borda), (x0, y_base - borda, x0 + lado_, y_base), (x0, y0, x0 + borda, y_base), (x0 + lado_ - borda, y0, x0 + lado_, y_base))):
        c.retangulo(f"{nome}_ripa{i}", a, b, d, e, MADEIRA_CLARA, profundidade=profundidade - lado_ * 0.5 - 1)
    c.fita(f"{nome}_cruz", [(x0 + borda, y0 + borda), (x0 + lado_ - borda, y_base - borda)], borda * 0.9, MADEIRA_CLARA, profundidade=profundidade - lado_ * 0.5 - 0.5)


# Carga no convés, abaixo da linha da luta: barris e caixotes.
PISO = CONVES + 46
caixote("caixote_e1", 470, PISO, 104)
caixote("caixote_e2", 372, PISO, 78)
caixote("caixote_e3", 486, PISO - 104, 70)
barril("barril_e1", 730, PISO + 6)
barril("barril_e2", 810, PISO + 2, altura=80, raio=30)
barril("barril_d1", 1640, PISO + 2, altura=80, raio=30)
caixote("caixote_d1", 1820, PISO, 84)
caixote("caixote_d2", 1830, PISO - 84, 62)

# Castelo de popa, à direita: um degrau alto de madeira com escada, porta com janela acesa e o timão.
POPA_X, POPA_Y = 2030, CONVES - 150
c.caixa("popa", POPA_X, POPA_Y, 2410, CONVES + 60, MADEIRA, frente=-170, fundo=-20, chanfro=6)
c.caixa("popa_beiral", POPA_X - 12, POPA_Y - 12, 2410, POPA_Y + 6, MADEIRA_CLARA, frente=-180, fundo=-20, chanfro=4)
for i in range(5):
    c.caixa(f"popa_degrau{i}", POPA_X - 34 - i * 30, POPA_Y + 26 + i * 34, POPA_X + 2, POPA_Y + 40 + i * 34, MADEIRA_CLARA, frente=-176, fundo=-150, chanfro=3)
c.caixa("popa_grade", POPA_X, POPA_Y - 70, 2410, POPA_Y - 60, MADEIRA_CLARA, frente=-176, fundo=-160, chanfro=3)
for i, x in enumerate(range(POPA_X + 16, 2400, 52)):
    c.cilindro(f"popa_balaustre{i}", x, POPA_Y - 60, POPA_Y - 12, 5, 7, MADEIRA_ESCURA, lados=6, profundidade=-168)
# Porta da cabine com uma janela redonda acesa.
PORTA_X = 2262
c.caixa("porta", PORTA_X - 46, POPA_Y + 34, PORTA_X + 46, CONVES + 56, MADEIRA_ESCURA, frente=-176, fundo=-170, chanfro=4)
halo("vigia", PORTA_X, POPA_Y + 84, 130, "#ffb45a", 0.3, -182, queda=2.2)
c.disco("vigia_aro", PORTA_X, POPA_Y + 84, 25, LATAO, lados=12, profundidade=-178)
c.disco("vigia_vidro", PORTA_X, POPA_Y + 84, 18, LUZ, lados=12, profundidade=-179)
c.retangulo("vigia_cruz_h", PORTA_X - 18, POPA_Y + 83, PORTA_X + 18, POPA_Y + 85.4, BREU, profundidade=-180)
c.retangulo("vigia_cruz_v", PORTA_X - 1.2, POPA_Y + 66, PORTA_X + 1.2, POPA_Y + 102, BREU, profundidade=-180)
c.lampada("vigia_luz", PORTA_X, POPA_Y + 84, -240, "#ffb060", forca=1.2, raio=150)
# Timão, em cima do castelo de popa.
TIMAO = (2190, POPA_Y - 108)
c.cilindro("timao_pe", TIMAO[0], TIMAO[1], POPA_Y - 12, 7, 12, MADEIRA_ESCURA, lados=6, profundidade=-166)
anel = [(TIMAO[0] + 52 * math.cos(2 * math.pi * k / 16), TIMAO[1] + 52 * math.sin(2 * math.pi * k / 16)) for k in range(17)]
c.fita("timao_aro", anel, 9, MADEIRA_CLARA, profundidade=-190)
for k in range(8):
    a = math.pi * k / 4 + 0.2
    c.fita(f"timao_raio{k}", [(TIMAO[0], TIMAO[1]), (TIMAO[0] + 68 * math.cos(a), TIMAO[1] + 68 * math.sin(a))], [7, 4], MADEIRA, profundidade=-189)
c.disco("timao_cubo", *TIMAO, 13, LATAO, lados=8, profundidade=-192)

# Canhão pequeno no convés, abaixo da linha da luta.
CANHAO = (980, CONVES + 44)
c.fita("canhao_cano", [(CANHAO[0] + 52, CANHAO[1] - 34), (CANHAO[0] - 62, CANHAO[1] - 62)], [34, 24], FERRO, profundidade=-140)
c.fita("canhao_boca", [(CANHAO[0] - 58, CANHAO[1] - 61), (CANHAO[0] - 70, CANHAO[1] - 64)], [30, 30], LATAO, profundidade=-141)
c.caixa("canhao_carreta", CANHAO[0] - 30, CANHAO[1] - 36, CANHAO[0] + 66, CANHAO[1] - 8, MADEIRA_ESCURA, frente=-146, fundo=-120, chanfro=4)
for dx in (-12, 48):
    c.disco(f"canhao_roda{dx}", CANHAO[0] + dx, CANHAO[1] - 6, 17, MADEIRA, lados=10, profundidade=-150)
    c.disco(f"canhao_eixo{dx}", CANHAO[0] + dx, CANHAO[1] - 6, 5, LATAO, lados=6, profundidade=-151)

# Bruma dourada rente ao convés, separando o fundo da luta, mais forte nas pontas.
c.retangulo(
    "bruma_conves",
    -10,
    590,
    2410,
    840,
    c.degrade([(0, "#5a3a52"), (1, "#5a3a52")], 590, 840, alfas=[(0.0, 0.0), (0.5, 0.22), (1.0, 0.0)]),
    profundidade=-260,
)
for i, (nx, ny, nr) in enumerate(((240, 760, 460), (2160, 760, 480), (1200, 790, 620))):
    halo(f"tufo_conves{i}", nx, ny, nr, "#6a4560", 0.26, -265 - i, queda=1.8, achatar=7.5)

# --------------------------------------------------------------------------- chão (1920×80)
chao = ARENA["chao"]
LARGURA_DO_CHAO = chao["largura"] * PX_POR_UNIDADE
ALTURA_DO_CHAO = chao["altura"] * PX_POR_UNIDADE
c.camada("chao", LARGURA_DO_CHAO, ALTURA_DO_CHAO)
c.retangulo("chao_corpo", 0, 0, LARGURA_DO_CHAO, ALTURA_DO_CHAO, c.degrade([(0, "#5a3d33"), (1, "#2a1b1c")], 0, ALTURA_DO_CHAO), profundidade=10)
# Viga de convés: pranchas em pé, cada uma com um tom e um chanfro que pega a luz.
x, i = 0.0, 0
while x < LARGURA_DO_CHAO:
    largura = s.choice((84, 96, 108, 120))
    tom = misturar("#6a4638", "#523529", s.random())
    c.caixa(f"prancha{i}", max(x + 1.5, 0), 20, min(x + largura - 1.5, LARGURA_DO_CHAO), ALTURA_DO_CHAO - 3, c.mat(tom, ambiente=0.62, luz=0.5, base=0.72), frente=-8, fundo=0, chanfro=4)
    # Veio da madeira: dois riscos finos por prancha.
    for k in range(2):
        vx = x + largura * s.uniform(0.25, 0.75)
        c.retangulo(f"veio{i}_{k}", vx, 26 + s.uniform(0, 14), vx + 1.2, ALTURA_DO_CHAO - 8 - s.uniform(0, 14), c.brilho(misturar(tom, "#2a1b1c", 0.45)), profundidade=-9)
    x += largura
    i += 1
# Borda clara de cima: a linha reta que mostra onde se pisa, com uma faixa de sombra embaixo.
c.retangulo("chao_borda", 0, 0, LARGURA_DO_CHAO, 12, c.brilho("#e2c9a0"), profundidade=-20)
c.retangulo("chao_borda_luz", 0, 0, LARGURA_DO_CHAO, 3, c.brilho("#f3e4c4"), profundidade=-21)
c.retangulo("chao_borda_sombra", 0, 12, LARGURA_DO_CHAO, 20, c.brilho("#3a2622"), profundidade=-20)
# Cravos de latão na faixa de sombra e reforços de ferro nas pontas e no meio.
for x in range(48, LARGURA_DO_CHAO, 96):
    c.disco(f"cravo{x}", x, 16, 3.2, c.brilho("#b89a5a"), lados=6, profundidade=-22)
for i, x in enumerate((0, LARGURA_DO_CHAO / 2 - 22, LARGURA_DO_CHAO - 44)):
    c.caixa(f"reforco{i}", x, 12, x + 44, ALTURA_DO_CHAO, c.mat("#34313f", ambiente=0.6, luz=0.5, base=0.8), frente=-14, fundo=-6, chanfro=3)
    for dy in (26, 62):
        c.disco(f"reforco_rebite{i}_{dy}", x + 22, dy, 4, c.brilho("#6c6a7c"), lados=6, profundidade=-16)

# --------------------------------------------------------------------- plataforma (380×40)
c.camada("plataforma", 380, 40)
# A metade de cima é a tábua (10 unidades do mundo); a de baixo, a sombra dela, quase sumindo.
c.retangulo("tabua", 0, 0, 380, 20, c.degrade([(0, "#8a6248"), (1, "#553a30")], 0, 20), profundidade=0)
c.retangulo("tabua_topo", 0, 0, 380, 6, c.brilho("#e6cfa6"), profundidade=-5)
c.retangulo("tabua_topo_luz", 0, 0, 380, 2, c.brilho("#f5e8cc"), profundidade=-6)
c.retangulo("tabua_base", 0, 17, 380, 20, c.brilho("#33221f"), profundidade=-5)
for x in (76, 152, 228, 304):
    c.retangulo(f"tabua_junta{x}", x - 1, 6, x + 1, 17, c.brilho("#45302a"), profundidade=-5)
# Pontas amarradas com corda, como um andaime de bordo.
for x in (16, 364):
    c.retangulo(f"tabua_corda{x}", x - 7, 0, x + 7, 20, c.brilho("#9a8a6c"), profundidade=-9)
    for dy in (4, 9, 14):
        c.retangulo(f"tabua_corda_risco{x}_{dy}", x - 7, dy, x + 7, dy + 1.4, c.brilho("#5a4e3c"), profundidade=-10)
c.retangulo("tabua_veio", 44, 11, 336, 12, c.brilho("#6a4a3a"), profundidade=-5)
c.retangulo("tabua_sombra", 6, 20, 374, 40, c.degrade([(0, "#0a0609"), (1, "#0a0609")], 20, 40, alfas=[(0.0, 0.42), (1.0, 0.0)]), profundidade=0)

# ------------------------------------------------------------------------- frente (2400×900)
c.camada("frente", 2400, 900)
SOMBRA = c.brilho("#0c0810")
LONA_FRENTE = c.mat("#3d3246", ambiente=0.5, luz=0.45, base=0.65)
LONA_FRENTE_CLARA = c.mat("#4d4056", ambiente=0.5, luz=0.5, base=0.7)
# Cordame entrando pelos cantos de cima: cabos escuros, uma ponta de vela e uma roldana de cada lado.
for nome, lado, x0 in (("e", 1, 0), ("d", -1, 2400)):

    def px(dx):
        return x0 + lado * dx

    for i, ((ax, ay), (bx, by), g) in enumerate(
        (
            ((0, 250), (430, -10), 7),
            ((0, 120), (250, -10), 5),
            ((0, 380), (150, -10), 6),
            ((60, -10), (330, 150), 4),
        )
    ):
        c.fita(f"frente_cabo_{nome}{i}", [(px(ax), ay), (px(bx), by)], g, SOMBRA, profundidade=-i)
    # Ponta de vela pendendo do canto.
    c.placa(f"frente_vela_{nome}", [(px(-10), -10), (px(300), -10), (px(250), 60), (px(170), 96), (px(90), 150), (px(-10), 210)], LONA_FRENTE, profundidade=-30)
    c.placa(f"frente_vela_dobra_{nome}", [(px(-10), -10), (px(170), -10), (px(120), 60), (px(-10), 120)], LONA_FRENTE_CLARA, profundidade=-31)
    for k, (dx, dy) in enumerate(((250, 60), (170, 96), (90, 150))):
        c.disco(f"frente_ilhos_{nome}{k}", px(dx - 12), dy - 10, 5, SOMBRA, lados=8, profundidade=-32)
    # Roldana pendurada num cabo.
    rx, ry = px(330), 150
    c.caixa(f"frente_roldana_{nome}", rx - 17, ry, rx + 17, ry + 46, c.mat("#2a1c22", ambiente=0.5, luz=0.45, base=0.8), frente=-60, fundo=-40, chanfro=5)
    c.disco(f"frente_roldana_roda_{nome}", rx, ry + 23, 11, c.mat("#6b5a3a", ambiente=0.55, luz=0.45, base=1.0), lados=10, profundidade=-62)
    c.fita(f"frente_roldana_cabo_{nome}", [(rx, ry + 46), (rx + lado * 8, ry + 150), (rx - lado * 6, ry + 250)], [4, 4, 2], SOMBRA, profundidade=-41)
# Respingos do mar, só perto das bordas e embaixo.
for i in range(26):
    lado = i % 2
    x = s.uniform(30, 520) if lado == 0 else s.uniform(1880, 2370)
    y = s.uniform(560, 860)
    c.disco(f"respingo{i}", x, y, s.uniform(1.4, 3.0), c.brilho(misturar("#8a7a9a", "#c9b8c8", s.random()), alfa=0.7), lados=6, profundidade=-80)

c.renderizar(
    extras={
        "tema": "convés de navio ao pôr do sol",
        "encaixe": {
            "descricao": "Nas camadas longe, perto e frente, o centro horizontal fica em x=600 do mundo e a linha y=600 da camada fica em y=540 do mundo (o topo do chão), com a câmera no centro.",
            "linhaDoChao": 600,
        },
        "paralaxeSugerida": {"ceu": 0.0, "longe": 0.12, "perto": 0.35, "frente": 1.15},
        "corAbaixo": {"longe": "#11122a", "perto": "#0d0a10"},
        "pxPorUnidade": {"chao": PX_POR_UNIDADE, "plataforma": PX_POR_UNIDADE},
    }
)
