import { TICKS_POR_SEGUNDO, type EstadoSim } from "./estado";
import { step } from "./step";

export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
/** Limite de ticks por quadro, para não travar depois de a aba ficar parada. */
export const MAX_TICKS_POR_QUADRO = 5;

export interface Laco {
  readonly estado: EstadoSim;
  /** Tempo real acumulado que ainda não virou tick, em ms. */
  readonly acumulado: number;
}

/**
 * Acumulador de passo fixo: recebe o tempo real decorrido (vindo de fora, do render)
 * e roda quantos ticks inteiros couberem. A simulação em si nunca lê o relógio.
 */
export function avancarLaco(laco: Laco, msDecorridos: number): Laco {
  let acumulado = laco.acumulado + Math.max(0, msDecorridos);
  let estado = laco.estado;
  let ticks = 0;
  while (acumulado >= MS_POR_TICK && ticks < MAX_TICKS_POR_QUADRO) {
    estado = step(estado);
    acumulado -= MS_POR_TICK;
    ticks++;
  }
  if (ticks === MAX_TICKS_POR_QUADRO) acumulado = Math.min(acumulado, MS_POR_TICK);
  return { estado, acumulado };
}
