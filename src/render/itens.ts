import type Phaser from "phaser";
import type { Item, TipoItem } from "../sim/combate/tipos";

export const NOME_DO_ITEM: Readonly<Record<TipoItem, string>> = {
  fruta: "Fruta",
  bomba: "Bomba",
  mola: "Mola",
  escudo: "Escudo",
  martelo: "Martelo",
};

export const COR_DO_ITEM: Readonly<Record<TipoItem, number>> = {
  fruta: 0xff7a8a,
  bomba: 0x2a2f3a,
  mola: 0xc9d4e6,
  escudo: 0x8fe6ff,
  martelo: 0xffd54a,
};

/**
 * Desenha um item de arena em coordenadas do mundo; (x, y) é a base dele, como na simulação.
 * São ícones simples feitos por código, do mesmo jeito que os efeitos. `tick` anima o pavio.
 */
export function desenharItem(
  g: Phaser.GameObjects.Graphics,
  item: Readonly<Item>,
  tamanho: number,
  tick: number,
): void {
  const { x, y } = item;
  const t = tamanho;
  const cy = y - t / 2;
  // Sombra no chão e um aro claro, para o item se destacar do cenário.
  if (item.noChao) {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 1, t * 1.1, t * 0.28);
  }
  g.lineStyle(3, 0xffffff, 0.85);
  switch (item.tipo) {
    case "fruta":
      g.fillStyle(COR_DO_ITEM.fruta, 1);
      g.fillCircle(x, cy + 2, t * 0.42);
      g.strokeCircle(x, cy + 2, t * 0.42);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x - t * 0.14, cy - t * 0.06, t * 0.1);
      g.fillStyle(0x5fd67a, 1);
      g.fillTriangle(x, cy - t * 0.36, x + t * 0.3, cy - t * 0.56, x + t * 0.08, cy - t * 0.26);
      break;
    case "bomba": {
      // Pisca cada vez mais rápido perto de estourar.
      const perto = item.noChao && item.pavio < 70;
      const aceso = perto && Math.floor(tick / (item.pavio < 30 ? 3 : 6)) % 2 === 0;
      g.fillStyle(aceso ? 0xff5a4a : COR_DO_ITEM.bomba, 1);
      g.fillCircle(x, cy + 3, t * 0.44);
      g.strokeCircle(x, cy + 3, t * 0.44);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(x - t * 0.16, cy - t * 0.06, t * 0.1);
      g.lineStyle(3, 0xc9a469, 1);
      g.lineBetween(x + t * 0.1, cy - t * 0.36, x + t * 0.3, cy - t * 0.6);
      g.fillStyle(tick % 8 < 4 ? 0xffd54a : 0xff8a3d, 1);
      g.fillCircle(x + t * 0.32, cy - t * 0.64, t * 0.12);
      break;
    }
    case "mola":
      g.lineStyle(4, COR_DO_ITEM.mola, 1);
      for (let i = 0; i < 4; i++) {
        const y0 = y - 4 - i * (t * 0.2);
        g.lineBetween(x - t * 0.36, y0, x + t * 0.36, y0 - t * 0.1);
        g.lineBetween(x + t * 0.36, y0 - t * 0.1, x - t * 0.36, y0 - t * 0.2);
      }
      g.fillStyle(0xff8a8a, 1);
      g.fillRoundedRect(x - t * 0.5, y - t - 2, t, 7, 3);
      g.fillStyle(0x5b6b82, 1);
      g.fillRoundedRect(x - t * 0.5, y - 5, t, 5, 2);
      break;
    case "escudo":
      g.fillStyle(COR_DO_ITEM.escudo, 1);
      g.fillTriangle(x - t * 0.42, cy - t * 0.1, x + t * 0.42, cy - t * 0.1, x, cy + t * 0.5);
      g.fillRoundedRect(x - t * 0.42, cy - t * 0.44, t * 0.84, t * 0.4, 4);
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(x - 2, cy - t * 0.34, 4, t * 0.6);
      g.fillRect(x - t * 0.22, cy - t * 0.12, t * 0.44, 4);
      break;
    case "martelo":
      g.fillStyle(0x8a6a3c, 1);
      g.fillRoundedRect(x - 3, cy - t * 0.2, 6, t * 0.7, 2);
      g.fillStyle(COR_DO_ITEM.martelo, 1);
      g.fillRoundedRect(x - t * 0.46, cy - t * 0.5, t * 0.92, t * 0.38, 5);
      g.lineStyle(3, 0xffffff, 0.85);
      g.strokeRoundedRect(x - t * 0.46, cy - t * 0.5, t * 0.92, t * 0.38, 5);
      break;
  }
}
