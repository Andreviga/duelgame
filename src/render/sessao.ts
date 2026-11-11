import { ADVERSARIOS, ARENA_BASICA, CONTEXTO, ECONOMIA, espelhar } from "../dados";
import type { Esquadrao, Lado } from "../sim/combate/tipos";
import {
  aplicarNivel,
  criarEconomia,
  iniciarRodada,
  montarEsquadrao,
} from "../sim/economia/economia";
import type { EstadoEconomia } from "../sim/economia/tipos";

/**
 * Sessão de jogo da fase 3: um jogador contra um esquadrão fixo por rodada.
 * Guarda o que precisa sobreviver à troca entre a tela de preparação e a de combate.
 * (Na fase 4 isto dá lugar à partida completa em `src/sim/partida`.)
 */
export interface Sessao {
  economia: EstadoEconomia;
  semente: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  /** Resultado da última rodada: lado vencedor, null para empate, undefined se ainda não houve. */
  ultimo: Lado | null | undefined;
}

export const jogo: { sessao: Sessao | null } = { sessao: null };

export function novaSessao(semente: number): Sessao {
  const sessao: Sessao = {
    economia: iniciarRodada(criarEconomia(CONTEXTO, 1, semente), CONTEXTO),
    semente,
    vitorias: 0,
    derrotas: 0,
    empates: 0,
    ultimo: undefined,
  };
  jogo.sessao = sessao;
  return sessao;
}

/** Esquadrão adversário da rodada, em posições do lado esquerdo e já com os níveis aplicados. */
export function adversarioDaRodada(rodada: number): Esquadrao {
  const i = Math.min(Math.max(rodada, 1), ADVERSARIOS.length) - 1;
  const formacao = ADVERSARIOS[i];
  if (!formacao) return [];
  return formacao.vagas.map((v) => ({
    ...v,
    def: aplicarNivel(v.def, v.nivel ?? 1, ECONOMIA),
  }));
}

export function esquadroesDaRodada(s: Sessao): [Esquadrao, Esquadrao] {
  const jogador = s.economia.jogadores[0];
  const meu = jogador ? montarEsquadrao(jogador, CONTEXTO, ARENA_BASICA, 0) : [];
  return [meu, espelhar(adversarioDaRodada(s.economia.rodada), ARENA_BASICA)];
}

export function sementeDoCombate(s: Sessao): number {
  return s.semente * 1000 + s.economia.rodada;
}

/** Registra o resultado do combate e abre a preparação da rodada seguinte. */
export function concluirRodada(s: Sessao, vencedor: Lado | null): void {
  if (vencedor === 0) s.vitorias++;
  else if (vencedor === 1) s.derrotas++;
  else s.empates++;
  s.ultimo = vencedor;
  s.economia = iniciarRodada(s.economia, CONTEXTO);
}
