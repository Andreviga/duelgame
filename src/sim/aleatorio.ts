/**
 * Gerador de números aleatórios com semente (mulberry32).
 * O estado é só um inteiro de 32 bits, guardado no estado da simulação.
 * Funções puras: recebem o estado e devolvem o valor e o próximo estado.
 */
export interface EstadoAleatorio {
  readonly s: number;
}

export function criarAleatorio(semente: number): EstadoAleatorio {
  return { s: semente >>> 0 };
}

/** Devolve um número em [0, 1) e o próximo estado do gerador. */
export function proximo(rng: EstadoAleatorio): { valor: number; rng: EstadoAleatorio } {
  const s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const valor = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { valor, rng: { s } };
}
