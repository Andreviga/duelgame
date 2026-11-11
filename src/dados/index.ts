import adversariosJson from "./adversarios.json";
import arenaBasicaJson from "./arena-basica.json";
import economiaJson from "./economia.json";
import formacoesJson from "./formacoes.json";
import personagensJson from "./personagens.json";
import {
  ErroDeDados,
  validarArena,
  validarEconomia,
  validarFormacoes,
  validarPersonagens,
} from "./schemas";
import type { Contexto } from "../sim/economia/tipos";
import type { Formacao } from "./schemas";
import type { Arena, DefPersonagem, Esquadrao } from "../sim/combate/tipos";

export const ARENA_BASICA = validarArena(arenaBasicaJson);
export const PERSONAGENS = validarPersonagens(personagensJson);
export const FORMACOES = validarFormacoes(formacoesJson, PERSONAGENS, ARENA_BASICA);
export const ECONOMIA = validarEconomia(economiaJson);
/** Esquadrão fixo de cada rodada (posições do lado esquerdo; espelhe para usar como adversário). */
export const ADVERSARIOS = validarFormacoes(adversariosJson, PERSONAGENS, ARENA_BASICA);
/** Contexto da economia com os dados do jogo. */
export const CONTEXTO: Contexto = {
  config: ECONOMIA,
  personagens: PERSONAGENS,
  pontos: ARENA_BASICA.pontos.length,
};

export function personagem(id: string): DefPersonagem {
  const def = PERSONAGENS.find((p) => p.id === id);
  if (!def) throw new ErroDeDados(`personagem desconhecido: ${id}`);
  return def;
}

export function formacao(id: string): Formacao {
  const f = FORMACOES.find((x) => x.id === id);
  if (!f) throw new ErroDeDados(`formação desconhecida: ${id}`);
  return f;
}

/** Espelha um esquadrão para o lado direito da arena. */
export function espelhar(esquadrao: Esquadrao, arena: Arena): Esquadrao {
  const soma = arena.chao.x * 2 + arena.chao.largura;
  return esquadrao.map((v) => ({ ...v, x: soma - v.x }));
}
