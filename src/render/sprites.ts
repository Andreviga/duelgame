import type Phaser from "phaser";
import especJson from "../dados/animacoes.json";
import spritesJson from "../dados/sprites.json";
import { mostrarFalha } from "./falhas";

/** Personagens que têm atlas em `public/sprites` (os outros são desenhados com formas). */
export const SPRITES: readonly string[] = spritesJson;
/** O sprite é desenhado um pouco maior que a caixa de colisão, para a arma e os gestos aparecerem. */
export const FOLGA_DO_SPRITE = 1.45;
const LINHA_DE_BASE: number = especJson.linhaDeBase;

/**
 * Põe na fila de carga os atlas que ainda não foram carregados, com uma barra de progresso.
 * Chamar no `preload` da cena. Se algum arquivo falhar, mostra a tela de falha.
 */
export function carregarSprites(cena: Phaser.Scene): void {
  const faltam = SPRITES.filter((id) => !cena.textures.exists(id));
  if (faltam.length === 0) return;
  for (const id of faltam) {
    cena.load.atlas(id, `sprites/${id}.png`, `sprites/${id}.json`);
    cena.load.json(`${id}:atlas`, `sprites/${id}.json`);
  }
  const { width, height } = cena.scale;
  const barra = cena.add.graphics();
  const texto = cena.add
    .text(width / 2, height / 2 - 40, "carregando…", {
      fontFamily: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
      fontSize: "22px",
      color: "#e8eef7",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const desenhar = (fracao: number): void => {
    barra.clear();
    barra.fillStyle(0x1b2333, 1).fillRoundedRect(width / 2 - 200, height / 2, 400, 18, 9);
    barra.fillStyle(0x4fa3ff, 1);
    barra.fillRoundedRect(width / 2 - 200, height / 2, Math.max(18, 400 * fracao), 18, 9);
  };
  desenhar(0);
  cena.load.on("progress", desenhar);
  cena.load.once("loaderror", () => mostrarFalha("carga"));
  cena.load.once("complete", () => {
    cena.load.off("progress", desenhar);
    barra.destroy();
    texto.destroy();
  });
}

export const temSprite = (cena: Phaser.Scene, id: string): boolean =>
  SPRITES.includes(id) && cena.textures.exists(id);

/** Escala que faz o sprite ter a altura de um personagem com `alturaNoJogo` pixels de caixa. */
export function escalaDoSprite(cena: Phaser.Scene, id: string, alturaNoJogo: number): number {
  const meta: unknown = cena.cache.json.get(`${id}:atlas`);
  const altura =
    (meta as { meta?: { alturaDoPersonagem?: number } } | undefined)?.meta?.alturaDoPersonagem ??
    180;
  return (alturaNoJogo / altura) * FOLGA_DO_SPRITE;
}

/** Deixa a imagem como o retrato parado do personagem, com os pés em (x, y). */
export function posarRetrato(
  cena: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  id: string,
  x: number,
  y: number,
  alturaNoJogo: number,
  olhaParaAEsquerda: boolean,
): void {
  img.setTexture(id, "parado_0");
  img.setOrigin(0.5, LINHA_DE_BASE);
  img.setPosition(x, y);
  img.setScale(escalaDoSprite(cena, id, alturaNoJogo));
  img.setFlipX(olhaParaAEsquerda);
}
