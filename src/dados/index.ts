import arenaBasicaJson from "./arena-basica.json";
import arenaLargaJson from "./arena-larga.json";
import arenaTorreJson from "./arena-torre.json";
import economiaJson from "./economia.json";
import formacoesJson from "./formacoes.json";
import itensJson from "./itens.json";
import partidaJson from "./partida.json";
import personagensJson from "./personagens.json";
import sinergiasJson from "./sinergias.json";
import {
  ErroDeDados,
  validarArena,
  validarEconomia,
  validarFormacoes,
  validarItens,
  validarPartida,
  validarPersonagens,
  validarSinergias,
} from "./schemas";
import type { Contexto } from "../sim/economia/tipos";
import type { Formacao } from "./schemas";
import type { Arena, DefPersonagem, Esquadrao } from "../sim/combate/tipos";

export const ARENA_BASICA = validarArena(arenaBasicaJson);
export const ARENAS: readonly Arena[] = [
  ARENA_BASICA,
  validarArena(arenaLargaJson),
  validarArena(arenaTorreJson),
];
export const IDS_DAS_ARENAS = ARENAS.map((a) => a.id);
export const PERSONAGENS = validarPersonagens(personagensJson);
export const FORMACOES = validarFormacoes(formacoesJson, PERSONAGENS, ARENA_BASICA);
export const ECONOMIA = validarEconomia(economiaJson);
export const PARTIDA = validarPartida(partidaJson);
export const SINERGIAS = validarSinergias(sinergiasJson);
/** Regras dos itens de arena. Só valem na partida criada com itens ligados. */
export const ITENS = validarItens(itensJson);

for (const a of ARENAS) {
  if (a.pontos.length !== ARENA_BASICA.pontos.length) {
    throw new ErroDeDados(`${a.id}: todas as arenas precisam do mesmo número de pontos`);
  }
}

/** Contexto da economia com os dados do jogo. */
export const CONTEXTO: Contexto = {
  config: ECONOMIA,
  personagens: PERSONAGENS,
  sinergias: SINERGIAS,
  pontos: ARENA_BASICA.pontos.length,
};

export function personagem(id: string): DefPersonagem {
  const def = PERSONAGENS.find((p) => p.id === id);
  if (!def) throw new ErroDeDados(`personagem desconhecido: ${id}`);
  return def;
}

export function arena(id: string): Arena {
  const a = ARENAS.find((x) => x.id === id);
  if (!a) throw new ErroDeDados(`arena desconhecida: ${id}`);
  return a;
}

export function formacao(id: string): Formacao {
  const f = FORMACOES.find((x) => x.id === id);
  if (!f) throw new ErroDeDados(`formação desconhecida: ${id}`);
  return f;
}

/** Espelha um esquadrão para o lado direito da arena. */
export function espelhar(esquadrao: Esquadrao, onde: Arena): Esquadrao {
  const soma = onde.chao.x * 2 + onde.chao.largura;
  return esquadrao.map((v) => ({ ...v, x: soma - v.x }));
}
