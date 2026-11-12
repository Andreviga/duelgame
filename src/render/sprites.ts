import type Phaser from "phaser";
import especJson from "../dados/animacoes.json";
import spritesJson from "../dados/sprites.json";

/** Personagens que têm atlas em `public/sprites` (os outros são desenhados com formas). */
export const SPRITES: readonly string[] = spritesJson;
/** O sprite é desenhado um pouco maior que a caixa de colisão, para a arma e os gestos aparecerem. */
export const FOLGA_DO_SPRITE = 1.45;
const LINHA_DE_BASE: number = especJson.linhaDeBase;

/** Põe na fila de carga os atlas que ainda não foram carregados. Chamar no `preload` da cena. */
export function carregarSprites(cena: Phaser.Scene): void {
  for (const id of SPRITES) {
    if (cena.textures.exists(id)) continue;
    cena.load.atlas(id, `sprites/${id}.png`, `sprites/${id}.json`);
    cena.load.json(`${id}:atlas`, `sprites/${id}.json`);
  }
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
