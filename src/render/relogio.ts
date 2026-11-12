/** Tempo máximo que um quadro pode valer para o jogo: acima disso (aba em segundo plano, travada) ele não tenta alcançar. */
export const TETO_DO_QUADRO_MS = 100;
const PRIMEIRO_QUADRO_MS = 1000 / 60;

export interface Quadro {
  /** Tempo real desde o quadro anterior, sem teto: serve para medir a fluidez. */
  real: number;
  /** Tempo que o jogo deve avançar neste quadro: o real, até o teto. */
  ms: number;
}

/**
 * Relógio de quadros que mede o tempo de verdade.
 *
 * O `delta` que o Phaser entrega ao `update` é suavizado e fica preso perto de 16,7 ms mesmo
 * quando o aparelho só consegue 10 quadros por segundo. Usá-lo faria o jogo inteiro rodar em
 * câmera lenta em aparelho fraco (e, online, a luta seria cortada pelo relógio do servidor).
 * Com o tempo real, o aparelho lento mostra menos quadros, mas a luta dura o mesmo.
 */
export function criarRelogio(agora: () => number): { quadro: () => Quadro } {
  let anterior: number | null = null;
  return {
    quadro() {
      const t = agora();
      const real = anterior === null ? PRIMEIRO_QUADRO_MS : Math.max(0, t - anterior);
      anterior = t;
      return { real, ms: Math.min(real, TETO_DO_QUADRO_MS) };
    },
  };
}
