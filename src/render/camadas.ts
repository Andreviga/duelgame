/** Câmera do combate: ponto do mundo no centro da tela e zoom. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Tela {
  largura: number;
  altura: number;
}

/** Onde desenhar uma camada: canto de cima à esquerda, na tela, e a escala da imagem. */
export interface Colocacao {
  x: number;
  y: number;
  escala: number;
}

/** Ponto do mundo que fica atrás do centro horizontal de toda camada larga. */
export const CENTRO_DO_MUNDO_X = 600;
/** Quanto acima do chão fica o centro da câmera "parada", a referência do encaixe. */
export const ALTURA_DA_CAMERA_PARADA = 140;
/** A imagem sobra um pouco além da tela, para a borda nunca aparecer por arredondamento. */
const FOLGA = 2;

/**
 * Coloca na tela uma camada larga do cenário (longe, perto ou frente).
 *
 * Encaixe: com a câmera parada e zoom 1, o centro horizontal da imagem fica atrás de x = 600 do
 * mundo e a linha `linhaDoChao` da imagem fica na altura do chão da arena.
 * Paralaxe: a camada enxerga só uma fração do movimento e do zoom da câmera (0 = parada na tela,
 * 1 = presa ao mundo, mais que 1 = na frente da luta).
 * Cobertura: a imagem nunca fica mais estreita que a tela nem mostra a borda lateral; se o zoom
 * pedir, ela para de encolher e de deslizar.
 */
export function colocarCamada(
  imagem: { largura: number; linhaDoChao: number },
  paralaxe: number,
  chaoY: number,
  cam: Camera,
  tela: Tela,
): Colocacao {
  const paradaY = chaoY - ALTURA_DA_CAMERA_PARADA;
  const camX = CENTRO_DO_MUNDO_X + paralaxe * (cam.x - CENTRO_DO_MUNDO_X);
  const camY = paradaY + paralaxe * (cam.y - paradaY);
  const escalaMinima = (tela.largura + FOLGA * 2) / imagem.largura;
  const escala = Math.max(escalaMinima, 1 + paralaxe * (cam.zoom - 1));
  const largura = imagem.largura * escala;
  const xLivre = tela.largura / 2 + (CENTRO_DO_MUNDO_X - camX) * escala - largura / 2;
  // Prende de modo que a imagem cubra de 0 até a largura da tela.
  const x = Math.min(-FOLGA, Math.max(tela.largura + FOLGA - largura, xLivre));
  const y = tela.altura / 2 + (chaoY - camY) * escala - imagem.linhaDoChao * escala;
  return { x, y, escala };
}

/** O céu não se mexe: cobre a tela inteira, centralizado, sem deformar. */
export function colocarCeu(imagem: { largura: number; altura: number }, tela: Tela): Colocacao {
  const escala = Math.max(tela.largura / imagem.largura, tela.altura / imagem.altura);
  return {
    x: (tela.largura - imagem.largura * escala) / 2,
    y: (tela.altura - imagem.altura * escala) / 2,
    escala,
  };
}
