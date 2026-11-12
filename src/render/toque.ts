/** Retângulo na tela do jogo (1200×675). */
export interface Ret {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Tamanho mínimo da área de toque, em unidades do jogo. Em um celular deitado com 390 px de altura
 * a tela do jogo fica em 58% do tamanho, então 76 unidades dão os 44 px que um dedo precisa.
 */
export const ALVO_MINIMO = 76;

export interface Alvo<T> {
  id: T;
  ret: Ret;
}

/** Área que responde ao toque: o próprio retângulo, crescido até o mínimo em volta do centro. */
export function areaDeToque(r: Ret, minimo = ALVO_MINIMO): Ret {
  const largura = Math.max(r.largura, minimo);
  const altura = Math.max(r.altura, minimo);
  return {
    x: r.x - (largura - r.largura) / 2,
    y: r.y - (altura - r.altura) / 2,
    largura,
    altura,
  };
}

const contem = (r: Ret, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.largura && y >= r.y && y <= r.y + r.altura;

/**
 * Qual alvo o toque em (x, y) acertou, ou null. Quem foi tocado dentro do desenho ganha; senão,
 * vale a área de toque crescida e, se duas se sobrepõem, a do centro mais próximo.
 */
export function alvoTocado<T>(
  alvos: readonly Alvo<T>[],
  x: number,
  y: number,
  minimo = ALVO_MINIMO,
): T | null {
  for (const a of alvos) if (contem(a.ret, x, y)) return a.id;
  let melhor: T | null = null;
  let menor = Infinity;
  for (const a of alvos) {
    if (!contem(areaDeToque(a.ret, minimo), x, y)) continue;
    const d = Math.hypot(a.ret.x + a.ret.largura / 2 - x, a.ret.y + a.ret.altura / 2 - y);
    if (d < menor) {
      menor = d;
      melhor = a.id;
    }
  }
  return melhor;
}
