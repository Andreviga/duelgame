import type Phaser from "phaser";

export const LARGURA = 1200;
export const ALTURA = 675;
export const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";

export interface Ret {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export const dentro = (r: Ret, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.largura && y >= r.y && y <= r.y + r.altura;

export function criarTexto(
  cena: Phaser.Scene,
  x: number,
  y: number,
  texto: string,
  tamanho: number,
  cor = 0xffffff,
  origemX = 0.5,
): Phaser.GameObjects.Text {
  return cena.add
    .text(x, y, texto, {
      fontFamily: FONTE,
      fontSize: `${tamanho}px`,
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#0b0f16",
      strokeThickness: Math.max(3, Math.round(tamanho / 6)),
    })
    .setOrigin(origemX, 0.5)
    .setTint(cor);
}

/** Botão desenhado à mão (retângulo arredondado). O texto é criado à parte, com `criarTexto`. */
export function desenharBotao(
  g: Phaser.GameObjects.Graphics,
  r: Ret,
  cor: number,
  selecionado = false,
): void {
  g.fillStyle(0x0b0f16, 0.6);
  g.fillRoundedRect(r.x, r.y + 4, r.largura, r.altura, 12);
  g.fillStyle(cor, 1);
  g.fillRoundedRect(r.x, r.y, r.largura, r.altura, 12);
  g.fillStyle(0xffffff, 0.14);
  g.fillRoundedRect(r.x + 3, r.y + 3, r.largura - 6, r.altura / 2 - 3, 9);
  if (selecionado) {
    g.lineStyle(4, 0xffd54a, 1);
    g.strokeRoundedRect(r.x - 2, r.y - 2, r.largura + 4, r.altura + 4, 14);
  }
}
