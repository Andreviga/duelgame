import { proximo } from "./aleatorio";
import type { EstadoSim } from "./estado";

/**
 * Avança a simulação em um tick (1/60 s). Função pura: não altera o estado recebido.
 * Na fase 0 o bloco fica parado; o gerador é sorteado a cada tick só para exercitar o determinismo.
 */
export function step(estado: EstadoSim): EstadoSim {
  const { rng } = proximo(estado.rng);
  return { ...estado, tick: estado.tick + 1, rng };
}

/** Avança n ticks de uma vez (útil para testes e simulação sem render). */
export function simular(estado: EstadoSim, ticks: number): EstadoSim {
  let atual = estado;
  for (let i = 0; i < ticks; i++) atual = step(atual);
  return atual;
}
