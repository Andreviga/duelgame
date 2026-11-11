import type Phaser from "phaser";
import type { Lutador } from "../sim/combate/tipos";
import { misturar } from "./efeitos";

export const CORES = [0x4fa3ff, 0xff8a3d] as const;
export const CORES_ESCURAS = [0x1d4f8f, 0x9a4410] as const;
export const NOMES = ["AZUL", "LARANJA"] as const;

type G = Phaser.GameObjects.Graphics;

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
  const base = CORES[l.lado];
  const escura = CORES_ESCURAS[l.lado];
  const cor =
    brilho > 0
      ? misturar(base, 0xffffff, brilho)
      : l.atordoado > 0
        ? misturar(base, 0xffffff, 0.25)
        : base;
  const arq = l.def.arquetipo;
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
export function desenharIcone(g: G, arquetipo: string, x: number, y: number, cor: number): void {
  g.fillStyle(cor, 1);
  if (arquetipo === "tanque") {
    g.fillRoundedRect(x - 12, y - 10, 24, 20, 3);
  } else if (arquetipo === "distancia") {
    g.fillRoundedRect(x - 7, y - 11, 14, 22, 4);
    g.fillRect(x + 5, y - 2, 9, 5);
  } else if (arquetipo === "assassino") {
    g.fillRoundedRect(x - 7, y - 5, 14, 16, 4);
    g.fillTriangle(x - 9, y - 4, x + 9, y - 4, x, y - 15);
  } else {
    g.fillRoundedRect(x - 8, y - 11, 16, 22, 4);
    g.fillStyle(0x0b0f16, 0.7);
    g.fillRect(x - 8, y - 7, 16, 3);
  }
}
