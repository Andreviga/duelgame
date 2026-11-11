import { criarAleatorio, type EstadoAleatorio } from "./aleatorio";

/** Ticks de simulação por segundo. */
export const TICKS_POR_SEGUNDO = 60;

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

export interface EstadoSim {
  readonly tick: number;
  readonly rng: EstadoAleatorio;
  readonly bloco: Retangulo;
}

export function criarEstado(semente: number): EstadoSim {
  return {
    tick: 0,
    rng: criarAleatorio(semente),
    bloco: { x: 600, y: 500, largura: 80, altura: 80 },
  };
}
