import type { Comando } from "../sim/economia/tipos";
import type { EstadoPartida, Modo, NivelBot } from "../sim/partida/tipos";

/** Nome da sala no servidor e tipos de mensagem. Cliente e servidor usam este mesmo arquivo. */
export const NOME_DA_SALA = "partida";
export const MAXIMO_DE_JOGADORES = 4;

export const MSG = {
  /** servidor -> cliente: `Visao` */
  visao: "visao",
  /** servidor -> cliente: `{ erro: string }` */
  erro: "erro",
  /** cliente -> servidor: `ComandoDoCliente` */
  comando: "comando",
  /** cliente -> servidor: o anfitrião começa a partida */
  comecar: "comecar",
} as const;

/** Comando sem o número do jogador: quem decide de quem é o comando é o servidor. */
export type ComandoDoCliente = Comando extends infer C
  ? C extends { jogador: number }
    ? Omit<C, "jogador">
    : never
  : never;

export interface VagaDaSala {
  readonly nome: string;
  readonly conectado: boolean;
  readonly anfitriao: boolean;
}

export interface InfoDaSala {
  readonly codigo: string;
  readonly modo: Modo;
  readonly dificuldade: NivelBot;
  readonly iniciada: boolean;
  readonly vagas: readonly VagaDaSala[];
}

/**
 * Tudo o que um jogador recebe do servidor. `partida` já vem filtrada:
 * a loja e o banco dos outros jogadores, o baralho e os geradores aleatórios não são enviados.
 */
export interface Visao {
  readonly sala: InfoDaSala;
  /** Número do jogador que recebe esta visão. */
  readonly eu: number;
  readonly partida: EstadoPartida | null;
  /** Milissegundos até a fase atual acabar (para o cronômetro do cliente). */
  readonly msRestantes: number;
}

export type ErroDeSala =
  "sala_cheia" | "sala_iniciada" | "nao_e_anfitriao" | "fora_da_sala" | "partida_nao_iniciada";

export interface OpcoesDeEntrada {
  readonly nome?: string;
  readonly modo?: Modo;
  readonly dificuldade?: NivelBot;
}
