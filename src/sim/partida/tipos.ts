import type { EstadoAleatorio } from "../aleatorio";
import type { Lado } from "../combate/tipos";
import type { EstadoEconomia } from "../economia/tipos";

export interface ConfigPartida {
  readonly vidaInicial: number;
  /** Vida perdida ao perder uma rodada: base + porSobrevivente × inimigos que sobraram. */
  readonly danoBase: number;
  readonly danoPorSobrevivente: number;
  /** A cada tantas rodadas, a derrota custa 1 de vida a mais (a partida não se arrasta). */
  readonly rodadasPorDanoExtra: number;
}

export type Modo = "todos" | "duplas";
export type NivelBot = "facil" | "medio" | "dificil";

export interface JogadorPartida {
  readonly nome: string;
  /** `null` para jogador humano. */
  readonly bot: NivelBot | null;
  /** Time no modo 2x2 (jogadores 0 e 1 contra 2 e 3). No todos contra todos não é usado. */
  readonly time: 0 | 1;
  readonly vida: number;
  /** Rodada em que foi eliminado, ou `null` se ainda está na partida. */
  readonly eliminadoNaRodada: number | null;
  readonly ultimoAdversario: number | null;
}

/** Um combate da rodada. No 2x2, cada lado tem dois jogadores. */
export interface Confronto {
  readonly ladoA: readonly number[];
  readonly ladoB: readonly number[];
  /** O lado B é uma cópia do esquadrão de outro jogador, que não ganha nem perde nada aqui. */
  readonly fantasma: boolean;
  readonly semente: number;
}

export interface ResultadoConfronto {
  readonly vencedor: Lado | null;
  readonly sobreviventes: readonly [number, number];
  readonly ticks: number;
  /** Vida que o lado perdedor perde (0 em empate). */
  readonly dano: number;
  /** Elixir extra de sinergia para cada jogador do lado vencedor (id do jogador -> elixir). */
  readonly elixirExtra: Readonly<Record<number, number>>;
}

export interface EstadoPartida {
  readonly modo: Modo;
  /** Id da arena sorteada para a partida inteira. */
  readonly arena: string;
  readonly fase: "preparacao" | "combate" | "fim";
  readonly economia: EstadoEconomia;
  /** Gerador próprio da partida (pareamento, sementes dos combates, bots). */
  readonly rng: EstadoAleatorio;
  readonly jogadores: readonly JogadorPartida[];
  readonly confrontos: readonly Confronto[];
  /** Resultado de cada confronto da rodada, na mesma ordem (preenchido na fase de combate). */
  readonly resultados: readonly ResultadoConfronto[];
  /** Jogadores do primeiro ao último lugar, quando a partida acaba. */
  readonly classificacao: readonly number[] | null;
}

export interface Participante {
  readonly nome: string;
  readonly bot: NivelBot | null;
}
