import type Phaser from "phaser";
import type { Arena, Lutador, Mundo, Papel } from "../sim/combate/tipos";
import { misturar } from "./efeitos";

/** Uma cor por jogador: azul, laranja, verde e roxo. */
export const CORES = [0x4fa3ff, 0xff8a3d, 0x5fd67a, 0xb98bff] as const;
export const CORES_ESCURAS = [0x1d4f8f, 0x9a4410, 0x1f7a3a, 0x5a3aa0] as const;

export function corDoJogador(jogador: number): number {
  return CORES[jogador % CORES.length] ?? 0xffffff;
}

function corEscuraDoJogador(jogador: number): number {
  return CORES_ESCURAS[jogador % CORES_ESCURAS.length] ?? 0x333333;
}
export const NOMES = ["AZUL", "LARANJA"] as const;

type G = Phaser.GameObjects.Graphics;

/** Cor de cada mundo, usada no emblema do personagem e nas cartas. */
export const COR_DO_MUNDO: Readonly<Record<Mundo, number>> = {
  futebol: 0xf2c94c,
  piratas: 0x56b6c2,
  monstros: 0xf2713d,
  dojo: 0xe05a6d,
};
export const NOME_DO_MUNDO: Readonly<Record<Mundo, string>> = {
  futebol: "Futebol",
  piratas: "Piratas",
  monstros: "Monstros",
  dojo: "Dojo",
};
export const NOME_DO_PAPEL: Readonly<Record<Papel, string>> = {
  corpo: "Corpo a corpo",
  distancia: "À distância",
  tanque: "Tanque",
  assassino: "Assassino",
};

/**
 * Emblema do mundo (cabe em ~14 px): bola para o Futebol, caveira-xis para os Piratas,
 * chifres para os Monstros e faixa com nó para o Dojo.
 */
export function desenharEmblema(g: G, mundo: Mundo, x: number, y: number, escala = 1): void {
  const cor = COR_DO_MUNDO[mundo];
  const r = 7 * escala;
  g.fillStyle(0x0b0f16, 0.85);
  g.fillCircle(x, y, r + 2 * escala);
  g.fillStyle(cor, 1);
  if (mundo === "futebol") {
    g.fillCircle(x, y, r);
    g.fillStyle(0x0b0f16, 0.9);
    g.fillCircle(x, y, r * 0.38);
  } else if (mundo === "piratas") {
    g.lineStyle(3.2 * escala, cor, 1);
    g.lineBetween(x - r * 0.75, y - r * 0.75, x + r * 0.75, y + r * 0.75);
    g.lineBetween(x - r * 0.75, y + r * 0.75, x + r * 0.75, y - r * 0.75);
  } else if (mundo === "monstros") {
    g.fillTriangle(x - r, y + r * 0.7, x - r * 0.1, y + r * 0.7, x - r * 0.75, y - r);
    g.fillTriangle(x + r, y + r * 0.7, x + r * 0.1, y + r * 0.7, x + r * 0.75, y - r);
  } else {
    g.fillRect(x - r, y - r * 0.32, r * 2, r * 0.64);
    g.fillCircle(x, y, r * 0.5);
  }
}

const LARGURA = 1200;
const ALTURA = 675;

/**
 * Desenha o corpo de um lutador em coordenadas locais (origem no centro do corpo).
 * Cada arquétipo tem uma silhueta própria, para dar para reconhecer sem ler nada:
 *  - corpo a corpo: bloco com faixa na testa e punho;
 *  - à distância: mais fino, com visor e cano;
 *  - tanque: largo, com ombreiras e contorno grosso;
 *  - assassino: pequeno, com capuz pontudo e cachecol.
 */
export function desenharCorpo(g: G, l: Readonly<Lutador>, brilho: number): void {
  const w = l.def.largura;
  const h = l.def.altura;
  const d = l.direcao;
  const fase = l.ataque.fase;
  const avanco = fase === "inicio" ? -5 : fase === "ativo" ? 9 : fase === "recuperacao" ? 3 : 0;
  const ox = avanco * d;
  const base = corDoJogador(l.dono);
  const escura = corEscuraDoJogador(l.dono);
  const cor =
    brilho > 0
      ? misturar(base, 0xffffff, brilho)
      : l.atordoado > 0
        ? misturar(base, 0xffffff, 0.25)
        : base;
  const arq = l.def.papel;
  const raio = arq === "tanque" ? 6 : 10;
  const borda = arq === "tanque" ? 6 : 3;

  if (arq === "assassino") {
    // cachecol atrás e capuz pontudo
    g.fillStyle(escura, 1);
    g.fillTriangle(
      ox - d * (w / 2 - 2),
      -h / 2 + 16,
      ox - d * (w / 2 + 22),
      -h / 2 + 10,
      ox - d * (w / 2 + 16),
      -h / 2 + 26,
    );
    g.fillTriangle(ox - w / 2 - 3, -h / 2 + 8, ox + w / 2 + 3, -h / 2 + 8, ox - d * 4, -h / 2 - 20);
  }

  g.fillStyle(escura, 1);
  g.fillRoundedRect(-w / 2 + ox - borda, -h / 2 - borda, w + borda * 2, h + borda * 2, raio + 2);
  g.fillStyle(cor, 1);
  g.fillRoundedRect(-w / 2 + ox, -h / 2, w, h, raio);
  g.fillStyle(0xffffff, 0.2);
  g.fillRoundedRect(-w / 2 + ox + 4, -h / 2 + 4, w - 8, 10, 5);

  if (arq === "tanque") {
    g.fillStyle(misturar(base, 0xffffff, 0.45), 1);
    g.fillRoundedRect(-w / 2 + ox - 8, -h / 2 - 4, 22, 16, 4);
    g.fillRoundedRect(w / 2 + ox - 14, -h / 2 - 4, 22, 16, 4);
    g.fillStyle(escura, 1);
    g.fillRect(-w / 2 + ox + 6, h / 2 - 18, w - 12, 5);
  } else if (arq === "corpo") {
    g.fillStyle(escura, 1);
    g.fillRect(-w / 2 + ox, -h / 2 + 9, w, 5);
  } else if (arq === "assassino") {
    g.fillStyle(cor, 1);
    g.fillTriangle(ox - w / 2 + 2, -h / 2 + 8, ox + w / 2 - 2, -h / 2 + 8, ox - d * 4, -h / 2 - 14);
  }

  desenharEmblema(g, l.def.mundo, ox - d * (w * 0.18), h / 2 - 16, arq === "tanque" ? 1.15 : 0.9);

  // Olhos: visor para o atirador, olho para os outros; X quando atordoado.
  const olhoX = ox + d * (w * 0.22);
  const olhoY = -h / 2 + (arq === "tanque" ? 26 : 22);
  if (l.atordoado > 0) {
    g.lineStyle(3, 0x0b0f16, 1);
    g.lineBetween(olhoX - 5, olhoY - 5, olhoX + 5, olhoY + 5);
    g.lineBetween(olhoX - 5, olhoY + 5, olhoX + 5, olhoY - 5);
  } else if (arq === "distancia") {
    g.fillStyle(0x0b0f16, 1);
    g.fillRoundedRect(ox + (d === 1 ? -4 : -w / 2 + 2), olhoY - 5, w / 2 + 2, 10, 4);
    g.fillStyle(0xbdfcff, 1);
    g.fillRect(ox + d * (w / 2 - 9) - 3, olhoY - 2, 6, 4);
  } else {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(olhoX - 6, olhoY - 6, 12, arq === "tanque" ? 9 : 13, 4);
    g.fillStyle(0x0b0f16, 1);
    g.fillRect(olhoX - 2 + d * 2, olhoY - 3, 5, arq === "tanque" ? 5 : 7);
  }

  if (arq === "distancia") {
    // cano: recua ao atirar
    const recuo = fase === "ativo" || fase === "recuperacao" ? -5 : 0;
    g.fillStyle(0x0b0f16, 1);
    g.fillRoundedRect(ox + (d === 1 ? w / 2 - 6 + recuo : -w / 2 - 16 - recuo), 0, 22, 9, 3);
    g.fillStyle(misturar(base, 0xffffff, 0.5), 1);
    g.fillRect(ox + (d === 1 ? w / 2 + 10 + recuo : -w / 2 - 14 - recuo), 2, 4, 5);
    return;
  }

  // Punho e corte do golpe corpo a corpo.
  const alcance = l.def.ataque.alcance;
  const grosso = arq === "tanque" ? 13 : 9;
  if (fase === "inicio") {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ox - d * (w / 2 + 2), 4, arq === "tanque" ? 11 : 8);
  } else if (fase === "ativo" || fase === "recuperacao") {
    const total = fase === "ativo" ? l.def.ataque.ativo : l.def.ataque.recuperacao;
    const alfa = fase === "ativo" ? 1 : Math.max(0, l.ataque.ticks / total) * 0.6;
    g.fillStyle(0xffffff, alfa);
    g.fillCircle(ox + d * (w / 2 + alcance - 8), 2, grosso + 1);
    const arco = (cx: number, abertura: number): void => {
      g.beginPath();
      if (d === 1) g.arc(cx, 2, alcance, -abertura, abertura, false);
      else g.arc(cx, 2, alcance, Math.PI - abertura, Math.PI + abertura, false);
      g.strokePath();
    };
    g.lineStyle(grosso, 0xffffff, alfa * 0.9);
    arco(ox + d * (w / 2 - 6), 1.0);
    g.lineStyle(4, base, alfa * 0.8);
    arco(ox + d * (w / 2 - 14), 0.8);
  }
}

/** Miniatura do arquétipo para o placar (cabe em um quadrado de ~22 px). */
export function desenharIcone(g: G, papel: string, x: number, y: number, cor: number): void {
  g.fillStyle(cor, 1);
  if (papel === "tanque") {
    g.fillRoundedRect(x - 12, y - 10, 24, 20, 3);
  } else if (papel === "distancia") {
    g.fillRoundedRect(x - 7, y - 11, 14, 22, 4);
    g.fillRect(x + 5, y - 2, 9, 5);
  } else if (papel === "assassino") {
    g.fillRoundedRect(x - 7, y - 5, 14, 16, 4);
    g.fillTriangle(x - 9, y - 4, x + 9, y - 4, x, y - 15);
  } else {
    g.fillRoundedRect(x - 8, y - 11, 16, 22, 4);
    g.fillStyle(0x0b0f16, 0.7);
    g.fillRect(x - 8, y - 7, 16, 3);
  }
}

interface Tema {
  /** Céu, de cima para baixo. */
  ceu: readonly [number, number];
  chao: number;
  chaoTopo: number;
  chaoRisco: number;
  chaoBase: number;
  plataforma: number;
  plataformaTopo: number;
}

/** Aparência de cada arena. A que não estiver aqui usa o tema da arena básica. */
const TEMAS: Readonly<Record<string, Tema>> = {
  // Pátio de dojo ao anoitecer.
  "arena-basica": {
    ceu: [0x0c111b, 0x2b2f52],
    chao: 0x2c384f,
    chaoTopo: 0x8fa6c9,
    chaoRisco: 0x3a4863,
    chaoBase: 0x1b2333,
    plataforma: 0x4d6185,
    plataformaTopo: 0xb9cbe8,
  },
  // Convés de navio ao pôr do sol.
  "arena-larga": {
    ceu: [0x1c1a3a, 0xc8603a],
    chao: 0x6b4426,
    chaoTopo: 0xd9a25e,
    chaoRisco: 0x4f311b,
    chaoBase: 0x3a2413,
    plataforma: 0x7a5230,
    plataformaTopo: 0xe6bd80,
  },
  // Torre de pedra no meio da tempestade.
  "arena-torre": {
    ceu: [0x0a1014, 0x24423f],
    chao: 0x3d4a48,
    chaoTopo: 0x9fc4b8,
    chaoRisco: 0x2b3534,
    chaoBase: 0x1c2423,
    plataforma: 0x4f6660,
    plataformaTopo: 0xb8e0d2,
  },
};
const TEMA_PADRAO = "arena-basica";
const temaDe = (arena: string): Tema => TEMAS[arena] ?? (TEMAS[TEMA_PADRAO] as Tema);

/**
 * Cenário de fundo da arena, em coordenadas de tela, com um pouco de paralaxe conforme a câmera.
 * É só enfeite: nada aqui existe na simulação.
 */
export function desenharFundo(g: G, camX: number, camY: number, arena = TEMA_PADRAO): void {
  g.clear();
  const tema = temaDe(arena);
  const faixas = 14;
  for (let i = 0; i < faixas; i++) {
    g.fillStyle(misturar(tema.ceu[0], tema.ceu[1], i / (faixas - 1)), 1);
    g.fillRect(0, (ALTURA / faixas) * i, LARGURA, ALTURA / faixas + 1);
  }
  const px = (600 - camX) * 0.06;
  const py = (380 - camY) * 0.04;

  if (arena === "arena-larga") {
    // Sol baixo, reflexo no mar, nuvens e dois navios ao longe.
    g.fillStyle(0xffd27a, 0.9);
    g.fillCircle(880 + px, 430 + py, 86);
    g.fillStyle(0xffe9b0, 0.35);
    g.fillCircle(880 + px, 430 + py, 120);
    g.fillStyle(0x3a2a55, 0.55);
    for (const [x, y, l] of [
      [180, 150, 220],
      [520, 110, 300],
      [960, 180, 240],
    ] as const) {
      g.fillEllipse(x + px * 0.5, y + py, l, 34);
      g.fillEllipse(x + 60 + px * 0.5, y - 16 + py, l * 0.6, 30);
    }
    const mar = 470 + py;
    g.fillStyle(0x1b2748, 1);
    g.fillRect(0, mar, LARGURA, ALTURA - mar);
    g.fillStyle(0xffb05c, 0.35);
    for (let i = 0; i < 7; i++) g.fillRect(800 + px - i * 12, mar + 10 + i * 22, 160 + i * 24, 5);
    g.fillStyle(0x2c3d6b, 1);
    for (let i = 0; i < 9; i++) {
      const y = mar + 16 + i * 24;
      for (let x = -40 + ((i * 53) % 90); x < LARGURA; x += 150)
        g.fillEllipse(x + px * 2, y, 70, 5);
    }
    g.fillStyle(0x15182c, 0.9);
    for (const [x, t] of [
      [210, 1],
      [1060, 0.7],
    ] as const) {
      const bx = x + px * 1.5;
      g.fillTriangle(bx - 70 * t, mar - 4, bx + 70 * t, mar - 4, bx + 44 * t, mar + 20 * t);
      g.fillTriangle(bx - 70 * t, mar - 4, bx + 44 * t, mar + 20 * t, bx - 50 * t, mar + 20 * t);
      g.fillRect(bx - 3 * t, mar - 110 * t, 6 * t, 108 * t);
      g.fillTriangle(
        bx + 4 * t,
        mar - 104 * t,
        bx + 4 * t,
        mar - 30 * t,
        bx + 58 * t,
        mar - 30 * t,
      );
      g.fillTriangle(bx - 6 * t, mar - 90 * t, bx - 6 * t, mar - 36 * t, bx - 44 * t, mar - 36 * t);
    }
    return;
  }

  if (arena === "arena-torre") {
    // Nuvens pesadas, um raio ao longe, picos de rocha e cristais.
    g.fillStyle(0x16242a, 0.9);
    for (const [x, y, l] of [
      [140, 90, 420],
      [560, 60, 520],
      [1020, 110, 460],
      [360, 170, 380],
      [860, 200, 420],
    ] as const) {
      g.fillEllipse(x + px * 0.5, y + py, l, 70);
    }
    g.lineStyle(4, 0xd6fff2, 0.55);
    g.beginPath();
    g.moveTo(980 + px, 120 + py);
    g.lineTo(950 + px, 210 + py);
    g.lineTo(985 + px, 220 + py);
    g.lineTo(940 + px, 330 + py);
    g.strokePath();
    g.fillStyle(0x13201f, 1);
    for (const [x, topo, l] of [
      [60, 300, 200],
      [300, 380, 260],
      [760, 340, 240],
      [1010, 260, 220],
      [1180, 400, 200],
    ] as const) {
      g.fillTriangle(x - l / 2 + px * 2, ALTURA, x + px * 2, topo + py, x + l / 2 + px * 2, ALTURA);
    }
    g.fillStyle(0x4fe0cc, 0.5);
    for (const [x, y, t] of [
      [120, 470, 1],
      [330, 520, 0.7],
      [1040, 430, 1.1],
      [820, 500, 0.8],
    ] as const) {
      const cx = x + px * 2;
      g.fillTriangle(cx - 10 * t, y + py + 50 * t, cx, y + py, cx + 10 * t, y + py + 50 * t);
      g.fillTriangle(
        cx + 6 * t,
        y + py + 50 * t,
        cx + 20 * t,
        y + py + 16 * t,
        cx + 28 * t,
        y + py + 50 * t,
      );
    }
    return;
  }

  // Arena básica: lua, montanhas e um portal de dojo ao longe, com lanternas.
  g.fillStyle(0xdfe6ff, 0.16);
  g.fillCircle(930 + px, 150 + py, 96);
  g.fillStyle(0x4a5a8a, 0.75);
  g.fillCircle(930 + px, 150 + py, 70);
  g.fillStyle(0x1a2338, 0.9);
  g.fillTriangle(-60 + px * 2, ALTURA, 240 + px * 2, 330 + py, 560 + px * 2, ALTURA);
  g.fillTriangle(380 + px * 2, ALTURA, 760 + px * 2, 270 + py, 1120 + px * 2, ALTURA);
  g.fillTriangle(820 + px * 2, ALTURA, 1100 + px * 2, 380 + py, 1340 + px * 2, ALTURA);
  const bx = 250 + px * 3;
  const by = 520 + py;
  g.fillStyle(0x111828, 1);
  g.fillRect(bx - 70, by - 120, 12, 140);
  g.fillRect(bx + 58, by - 120, 12, 140);
  g.fillRect(bx - 92, by - 132, 184, 12);
  g.fillRect(bx - 78, by - 104, 156, 8);
  g.fillTriangle(bx - 104, by - 132, bx - 92, by - 144, bx - 92, by - 132);
  g.fillTriangle(bx + 104, by - 132, bx + 92, by - 144, bx + 92, by - 132);
  for (const x of [bx - 40, bx + 40, 900 + px * 3, 1010 + px * 3]) {
    g.fillStyle(0xffb347, 0.22);
    g.fillCircle(x, by - 70, 18);
    g.fillStyle(0xffc866, 0.9);
    g.fillRoundedRect(x - 6, by - 78, 12, 16, 4);
  }
}

/** Chão sólido, plataformas e limites da arena, em coordenadas do mundo. */
export function desenharArena(g: G, a: Arena): void {
  g.clear();
  const tema = temaDe(a.id);

  // Limites da arena: só aparecem quando a câmera abre.
  const lim = a.limites;
  g.lineStyle(6, 0xff4d5e, 0.35);
  g.strokeRect(lim.esquerda, lim.topo, lim.direita - lim.esquerda, lim.fundo - lim.topo);
  g.lineStyle(26, 0xff4d5e, 0.07);
  g.strokeRect(lim.esquerda, lim.topo, lim.direita - lim.esquerda, lim.fundo - lim.topo);

  // Chão sólido: bloco com base afunilada.
  const c = a.chao;
  g.fillStyle(tema.chaoBase, 1);
  g.fillTriangle(
    c.x + 40,
    c.y + c.altura,
    c.x + c.largura - 40,
    c.y + c.altura,
    c.x + c.largura / 2,
    c.y + c.altura + 150,
  );
  g.fillStyle(tema.chao, 1);
  g.fillRoundedRect(c.x, c.y, c.largura, c.altura, 6);
  g.fillStyle(tema.chaoTopo, 1);
  g.fillRoundedRect(c.x, c.y, c.largura, 7, 3);
  g.fillStyle(tema.chaoRisco, 1);
  for (let x = c.x + 50; x < c.x + c.largura; x += 100) g.fillRect(x, c.y + 14, 3, c.altura - 20);

  // Plataformas atravessáveis: finas e mais claras.
  for (const p of a.plataformas) {
    g.fillStyle(0x0b0f16, 0.35);
    g.fillRoundedRect(p.x + 3, p.y + 5, p.largura, 10, 5);
    g.fillStyle(tema.plataforma, 1);
    g.fillRoundedRect(p.x, p.y, p.largura, 10, 5);
    g.fillStyle(tema.plataformaTopo, 1);
    g.fillRoundedRect(p.x, p.y, p.largura, 3, 2);
  }
}

/** Pinos amarelos que mostram o nível de fusão (nada no nível 1). */
export function desenharPinos(g: G, x: number, y: number, nivel: number, tamanho = 4): void {
  if (nivel <= 1) return;
  const passo = tamanho * 2.6;
  const x0 = x - ((nivel - 1) * passo) / 2;
  for (let i = 0; i < nivel; i++) {
    g.fillStyle(0x0b0f16, 0.8);
    g.fillCircle(x0 + i * passo, y, tamanho + 1.5);
    g.fillStyle(0xffd54a, 1);
    g.fillCircle(x0 + i * passo, y, tamanho);
  }
}
