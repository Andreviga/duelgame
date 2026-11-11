import type { DefImpacto } from "./tipos";

/** Peso de referência: com este peso, o arremesso não é ampliado nem reduzido. */
export const PESO_REFERENCIA = 100;

/**
 * Força do arremesso (velocidade inicial, em px por tick).
 * Cresce em linha reta com a porcentagem do alvo (já contando o golpe) e é
 * inversamente proporcional ao peso do alvo.
 */
export function forcaArremesso(ataque: DefImpacto, danoDoAlvo: number, pesoDoAlvo: number): number {
  const bruta = ataque.arremessoBase + ataque.arremessoCrescimento * danoDoAlvo;
  return bruta * (PESO_REFERENCIA / pesoDoAlvo);
}

/** Ticks de atordoamento: cresce com a força do arremesso. */
export function ticksDeAtordoamento(forca: number): number {
  return Math.floor(6 + forca * 1.8);
}

/** Decompõe a força em velocidade. Ângulo em graus acima do horizonte; `direcao` é para onde o alvo voa. */
export function velocidadeDeArremesso(
  forca: number,
  anguloGraus: number,
  direcao: -1 | 1,
): { vx: number; vy: number } {
  const rad = (anguloGraus * Math.PI) / 180;
  return { vx: Math.cos(rad) * forca * direcao, vy: -Math.sin(rad) * forca };
}
