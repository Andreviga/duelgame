import { proximo } from "../sim/aleatorio";
import { criarCombate, simularCombate } from "../sim/combate/combate";
import type { Arena } from "../sim/combate/tipos";
import type { Contexto, EstadoEconomia } from "../sim/economia/tipos";
import {
  comEconomia,
  confrontoDoJogador,
  esquadroesDoConfronto,
  estaVivo,
} from "../sim/partida/partida";
import type { EstadoPartida } from "../sim/partida/tipos";
import { jogarBot } from "./bot";

/** Quantos combates o bot difícil simula para dar nota a cada formação. */
const ENSAIOS_POR_FORMACAO = 2;

export interface JogadaDosBots {
  readonly partida: EstadoPartida;
  /** Comandos recusados pela simulação, somando todos os bots. Deve ser zero. */
  readonly recusados: number;
}

/** Todos os bots vivos jogam a preparação da rodada, um depois do outro. */
export function jogarBots(inicial: EstadoPartida, ctx: Contexto, arena: Arena): JogadaDosBots {
  let p = inicial;
  let recusados = 0;
  if (p.fase !== "preparacao") return { partida: p, recusados };

  p.jogadores.forEach((j, i) => {
    if (!j.bot || !estaVivo(j)) return;
    let rng = p.rng;
    // Sementes fixas para os ensaios do difícil: assim a nota só muda com a formação.
    const sementes: number[] = [];
    for (let k = 0; k < ENSAIOS_POR_FORMACAO; k++) {
      const r = proximo(rng);
      rng = r.rng;
      sementes.push(Math.floor(r.valor * 2 ** 31));
    }
    const confronto = p.confrontos[confrontoDoJogador(p, i)];
    const meuLado = confronto?.ladoA.includes(i) ? 0 : 1;
    const avaliar = (economia: EstadoEconomia): number => {
      if (!confronto) return 0;
      const esquadroes = esquadroesDoConfronto(comEconomia(p, economia), ctx, arena, confronto);
      let nota = 0;
      for (const semente of sementes) {
        const fim = simularCombate(criarCombate(arena, esquadroes, semente));
        const meus = fim.lutadores.filter((l) => l.vivo && l.lado === meuLado).length;
        const deles = fim.lutadores.filter((l) => l.vivo && l.lado !== meuLado).length;
        nota += (fim.fim?.vencedor === meuLado ? 10 : 0) + meus - deles;
      }
      return nota;
    };
    const jogada = jogarBot(p.economia, ctx, arena, { jogador: i, nivel: j.bot, avaliar }, rng);
    recusados += jogada.recusados;
    p = { ...comEconomia(p, jogada.economia), rng: jogada.rng };
  });
  return { partida: p, recusados };
}
