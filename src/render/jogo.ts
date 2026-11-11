import { jogarBot } from "../bots/bot";
import { jogarBots } from "../bots/partida";
import { arena, CONTEXTO, IDS_DAS_ARENAS, PARTIDA } from "../dados";
import type { Arena } from "../sim/combate/tipos";
import { aplicar } from "../sim/economia/economia";
import type { Comando, Resultado } from "../sim/economia/tipos";
import {
  combater,
  comEconomia,
  concluirRodada,
  confrontoDoJogador,
  criarPartida,
  estaVivo,
} from "../sim/partida/partida";
import type { EstadoPartida, Modo, NivelBot } from "../sim/partida/tipos";

/** O jogador humano é sempre o primeiro. */
export const HUMANO = 0;

export const NOME_DO_NIVEL: Readonly<Record<NivelBot, string>> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

/**
 * Estado da partida em andamento, compartilhado entre as telas.
 * Toda regra está em `src/sim/partida`; aqui só se guarda o estado e se encadeiam as chamadas.
 */
export const jogo: {
  partida: EstadoPartida | null;
  modo: Modo;
  dificuldade: NivelBot;
  /** Modo de teste: o humano também é jogado por um bot. */
  automatico: boolean;
  /** O modo automático vale para uma partida só; depois o menu volta ao normal. */
  automaticoJaRodou: boolean;
} = {
  partida: null,
  modo: "todos",
  dificuldade: "medio",
  automatico: false,
  automaticoJaRodou: false,
};

export function partidaAtual(): EstadoPartida {
  if (!jogo.partida) throw new Error("nenhuma partida em andamento");
  return jogo.partida;
}

/** Arena sorteada para a partida em andamento. */
export function arenaAtual(): Arena {
  return arena(partidaAtual().arena);
}

/** Bots jogam a preparação assim que a rodada abre; o humano joga depois, pela tela. */
function abrirPreparacao(p: EstadoPartida): EstadoPartida {
  let q = jogarBots(p, CONTEXTO, arena(p.arena)).partida;
  const humano = q.jogadores[HUMANO];
  if (jogo.automatico && q.fase === "preparacao" && humano && estaVivo(humano)) {
    const jogada = jogarBot(
      q.economia,
      CONTEXTO,
      arena(q.arena),
      { jogador: HUMANO, nivel: "medio" },
      q.rng,
    );
    q = { ...comEconomia(q, jogada.economia), rng: jogada.rng };
  }
  return q;
}

export function novaPartida(
  modo: Modo,
  dificuldade: NivelBot,
  semente: number,
  /** Arena fixa (id); sem ela, uma das arenas do jogo é sorteada. */
  arenaFixa?: string,
): EstadoPartida {
  jogo.modo = modo;
  jogo.dificuldade = dificuldade;
  const nomes =
    modo === "duplas"
      ? ["Você", "Aliado", "Rival 1", "Rival 2"]
      : ["Você", "Rival 1", "Rival 2", "Rival 3"];
  const participantes = nomes.map((nome, i) => ({ nome, bot: i === HUMANO ? null : dificuldade }));
  jogo.partida = abrirPreparacao(
    criarPartida(
      CONTEXTO,
      PARTIDA,
      modo,
      participantes,
      semente,
      arenaFixa && IDS_DAS_ARENAS.includes(arenaFixa) ? [arenaFixa] : IDS_DAS_ARENAS,
    ),
  );
  return jogo.partida;
}

/** Comando do jogador humano na preparação. */
export function comandoDoHumano(comando: Comando): Resultado {
  const p = partidaAtual();
  const r = aplicar(p.economia, CONTEXTO, comando);
  if (r.ok) jogo.partida = comEconomia(p, r.estado);
  return r;
}

export function humanoVivo(): boolean {
  const j = partidaAtual().jogadores[HUMANO];
  return j !== undefined && estaVivo(j);
}

/** Fecha a preparação e resolve todos os combates da rodada (sem tela, em milissegundos). */
export function iniciarCombates(): void {
  jogo.partida = combater(partidaAtual(), CONTEXTO, PARTIDA, arenaAtual());
}

/** Índice do confronto que a tela de combate deve mostrar: o do humano, ou o primeiro se ele já caiu. */
export function confrontoParaAssistir(): number {
  const i = confrontoDoJogador(partidaAtual(), HUMANO);
  return i >= 0 ? i : 0;
}

/**
 * Aplica os resultados da rodada e diz qual tela vem depois.
 * Se o humano já foi eliminado, a preparação seguinte é só dos bots e o combate começa direto.
 */
export function avancarRodada(): "preparacao" | "combate" | "resultado" {
  let p = concluirRodada(partidaAtual(), CONTEXTO);
  if (p.fase === "fim") {
    jogo.partida = p;
    return "resultado";
  }
  p = abrirPreparacao(p);
  jogo.partida = p;
  if (humanoVivo() && !jogo.automatico) return "preparacao";
  iniciarCombates();
  return "combate";
}
