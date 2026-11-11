import { TICKS_POR_SEGUNDO } from "./constantes";

export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
/** Limite de ticks por quadro, para não travar depois de a aba ficar parada. */
export const MAX_TICKS_POR_QUADRO = 5;

export interface Laco<T> {
  readonly estado: T;
  /** Tempo real acumulado que ainda não virou tick, em ms. */
  readonly acumulado: number;
}

/**
 * Acumulador de passo fixo: recebe o tempo real decorrido (vindo de fora, do render)
 * e roda quantos ticks inteiros couberem. A simulação em si nunca lê o relógio.
 * `aoTick` é chamado depois de cada tick; se devolver `false`, o laço para neste quadro.
 */
export function avancarLaco<T>(
  laco: Laco<T>,
  msDecorridos: number,
  step: (estado: T) => T,
  aoTick?: (estado: T) => boolean,
): Laco<T> {
  let acumulado = laco.acumulado + Math.max(0, msDecorridos);
  let estado = laco.estado;
  let ticks = 0;
  while (acumulado >= MS_POR_TICK && ticks < MAX_TICKS_POR_QUADRO) {
    estado = step(estado);
    acumulado -= MS_POR_TICK;
    ticks++;
    if (aoTick?.(estado) === false) break;
  }
  if (ticks === MAX_TICKS_POR_QUADRO) acumulado = Math.min(acumulado, MS_POR_TICK);
  return { estado, acumulado };
}
