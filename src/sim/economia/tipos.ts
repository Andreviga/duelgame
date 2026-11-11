import type { EstadoAleatorio } from "../aleatorio";
import type { DefPersonagem } from "../combate/tipos";

export interface ConfigEconomia {
  /** Elixir ganho na rodada r: base + porRodada × r, limitado a ganhoMaximo. */
  readonly elixirBase: number;
  readonly elixirPorRodada: number;
  readonly ganhoMaximo: number;
  /** O elixir guardado nunca passa disto. */
  readonly tetoElixir: number;
  readonly custoAtualizar: number;
  readonly tamanhoLoja: number;
  readonly tamanhoBanco: number;
  /** Limite de personagens em campo por rodada (a última posição vale para as seguintes). */
  readonly limiteCampo: readonly number[];
  /** Cópias de cada personagem no baralho comum. */
  readonly copiasPorPersonagem: number;
  readonly nivelMaximo: number;
  /** Fração do elixir investido que a venda devolve. */
  readonly reembolsoNivel1: number;
  readonly reembolsoNiveisMaiores: number;
  readonly segundosPreparacao: number;
  /** Multiplicadores por nível (índice 0 = nível 1). */
  readonly multiplicadores: {
    readonly dano: readonly number[];
    readonly peso: readonly number[];
    readonly tamanho: readonly number[];
  };
}

/** Tudo de que a economia precisa e que não muda durante a partida. */
export interface Contexto {
  readonly config: ConfigEconomia;
  readonly personagens: readonly DefPersonagem[];
  /** Quantos pontos de posicionamento a arena tem para cada jogador. */
  readonly pontos: number;
}

export interface Unidade {
  readonly id: number;
  readonly personagem: string;
  readonly nivel: number;
}

export interface EmCampo {
  readonly unidade: Unidade;
  /** Índice do ponto de posicionamento da arena. */
  readonly ponto: number;
}

export interface EstadoJogador {
  readonly elixir: number;
  /** Cartas à venda; `null` é uma carta já comprada. */
  readonly loja: readonly (string | null)[];
  readonly banco: readonly Unidade[];
  readonly campo: readonly EmCampo[];
  /** Encerrou a preparação desta rodada. */
  readonly pronto: boolean;
}

export interface EstadoEconomia {
  readonly rodada: number;
  readonly rng: EstadoAleatorio;
  /** Cópias de cada personagem que ainda estão no baralho comum. */
  readonly baralho: Readonly<Record<string, number>>;
  readonly jogadores: readonly EstadoJogador[];
  readonly proximoId: number;
  /** Ticks que faltam para a preparação acabar sozinha. */
  readonly ticksRestantes: number;
}

export type Comando =
  | { readonly tipo: "comprar"; readonly jogador: number; readonly carta: number }
  | { readonly tipo: "vender"; readonly jogador: number; readonly unidade: number }
  | { readonly tipo: "atualizar"; readonly jogador: number }
  /** Coloca a unidade em um ponto da arena (vinda do banco ou de outro ponto). Ponto ocupado: troca. */
  | {
      readonly tipo: "posicionar";
      readonly jogador: number;
      readonly unidade: number;
      readonly ponto: number;
    }
  /** Tira a unidade do campo e devolve ao banco. */
  | { readonly tipo: "recolher"; readonly jogador: number; readonly unidade: number }
  | { readonly tipo: "pronto"; readonly jogador: number };

export type Erro =
  | "jogador_invalido"
  | "preparacao_encerrada"
  | "carta_invalida"
  | "elixir_insuficiente"
  | "banco_cheio"
  | "baralho_vazio"
  | "unidade_invalida"
  | "ponto_invalido"
  | "campo_cheio"
  | "fora_do_campo";

export interface Fusao {
  readonly personagem: string;
  readonly nivel: number;
  readonly unidade: number;
}

export type Resultado =
  | { readonly ok: true; readonly estado: EstadoEconomia; readonly fusoes: readonly Fusao[] }
  | { readonly ok: false; readonly erro: Erro };

export const MENSAGENS: Readonly<Record<Erro, string>> = {
  jogador_invalido: "Jogador inválido",
  preparacao_encerrada: "A preparação já acabou",
  carta_invalida: "Essa carta não está à venda",
  elixir_insuficiente: "Elixir insuficiente",
  banco_cheio: "O banco está cheio",
  baralho_vazio: "Não há mais cartas no baralho",
  unidade_invalida: "Personagem não encontrado",
  ponto_invalido: "Não dá para posicionar aí",
  campo_cheio: "O campo está cheio",
  fora_do_campo: "Esse personagem não está em campo",
};
