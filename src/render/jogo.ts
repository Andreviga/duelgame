import { jogarBot } from "../bots/bot";
import { jogarBots } from "../bots/partida";
import { arena, CONTEXTO, IDS_DAS_ARENAS, ITENS, PARTIDA } from "../dados";
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
import { ConexaoOnline, type Ouvintes } from "../rede/cliente";
import type { ComandoDoCliente, InfoDaSala, Visao } from "../rede/protocolo";

/** Número do jogador desta máquina: 0 contra bots; online, a vaga que o servidor deu. */
export function meuNumero(): number {
  return jogo.eu;
}

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
  /** A próxima partida criada nesta máquina terá itens de arena. */
  itens: boolean;
  /** Modo de teste: o humano também é jogado por um bot. */
  automatico: boolean;
  /** O modo automático vale para uma partida só; depois o menu volta ao normal. */
  automaticoJaRodou: boolean;
  /** Partida de tutorial: a preparação mostra as dicas e o relógio não corre. */
  tutorial: boolean;
  eu: number;
  /** Conexão com a sala online, ou null jogando contra bots nesta máquina. */
  online: ConexaoOnline | null;
  sala: InfoDaSala | null;
  /** Momento (performance.now) em que a fase atual acaba, segundo o servidor. */
  prazo: number;
  conexaoCaiu: boolean;
  /** Recado para o menu mostrar uma vez (ex.: a sala online caiu). */
  recado: string;
  /** Trocar de tela; definido em main.ts. */
  irPara: (cena: string) => void;
  /** Mostrar um erro vindo do servidor na tela atual. */
  aoErro: (erro: string) => void;
} = {
  partida: null,
  modo: "todos",
  dificuldade: "medio",
  itens: false,
  automatico: false,
  automaticoJaRodou: false,
  tutorial: false,
  eu: 0,
  online: null,
  sala: null,
  prazo: 0,
  conexaoCaiu: false,
  recado: "",
  irPara: () => undefined,
  aoErro: () => undefined,
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
  const humano = q.jogadores[jogo.eu];
  if (jogo.automatico && q.fase === "preparacao" && humano && estaVivo(humano)) {
    const jogada = jogarBot(
      q.economia,
      CONTEXTO,
      arena(q.arena),
      { jogador: jogo.eu, nivel: "medio" },
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
  jogo.eu = 0;
  jogo.online = null;
  jogo.sala = null;
  const nomes =
    modo === "duplas"
      ? ["Você", "Aliado", "Rival 1", "Rival 2"]
      : ["Você", "Rival 1", "Rival 2", "Rival 3"];
  const participantes = nomes.map((nome, i) => ({ nome, bot: i === jogo.eu ? null : dificuldade }));
  jogo.partida = abrirPreparacao(
    criarPartida(
      CONTEXTO,
      PARTIDA,
      modo,
      participantes,
      semente,
      arenaFixa && IDS_DAS_ARENAS.includes(arenaFixa) ? [arenaFixa] : IDS_DAS_ARENAS,
      jogo.itens ? ITENS : null,
    ),
  );
  return jogo.partida;
}

/**
 * Comando do jogador humano na preparação.
 * Contra bots, a simulação responde na hora. Online, o comando vai para o servidor e
 * devolve null: o estado novo (ou o erro) chega depois, por mensagem.
 */
export function comandoDoHumano(comando: Comando): Resultado | null {
  if (jogo.online) {
    const { jogador: _jogador, ...resto } = comando;
    void _jogador;
    jogo.online.comando(resto as ComandoDoCliente);
    return null;
  }
  const p = partidaAtual();
  const r = aplicar(p.economia, CONTEXTO, comando);
  if (r.ok) jogo.partida = comEconomia(p, r.estado);
  return r;
}

export function humanoVivo(): boolean {
  const j = partidaAtual().jogadores[jogo.eu];
  return j !== undefined && estaVivo(j);
}

/** Fecha a preparação e resolve todos os combates da rodada (sem tela, em milissegundos). */
export function iniciarCombates(): void {
  jogo.partida = combater(partidaAtual(), CONTEXTO, PARTIDA, arenaAtual());
}

/** Índice do confronto que a tela de combate deve mostrar: o do humano, ou o primeiro se ele já caiu. */
export function confrontoParaAssistir(): number {
  const i = confrontoDoJogador(partidaAtual(), jogo.eu);
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

// ---------- online ----------

/** Tela que corresponde ao que o servidor acabou de mandar. */
function cenaDaVisao(v: Visao): string {
  const p = v.partida;
  if (!p) return "sala";
  if (p.fase === "fim") return "resultado";
  return p.fase === "combate" ? "combate" : "preparacao";
}

let chaveDaCena = "";

function ouvintes(): Ouvintes {
  return {
    aoVisao: (v) => {
      jogo.partida = v.partida;
      jogo.eu = v.eu;
      jogo.sala = v.sala;
      jogo.modo = v.sala.modo;
      jogo.dificuldade = v.sala.dificuldade;
      jogo.itens = v.sala.itens;
      jogo.prazo = performance.now() + v.msRestantes;
      // Troca de tela só quando muda a fase ou a rodada; no resto do tempo a tela atual se redesenha.
      const chave = `${cenaDaVisao(v)}:${v.partida?.economia.rodada ?? 0}`;
      if (chave !== chaveDaCena) {
        chaveDaCena = chave;
        jogo.irPara(cenaDaVisao(v));
      }
    },
    aoErro: (erro) => jogo.aoErro(erro),
    aoCair: () => {
      jogo.conexaoCaiu = true;
    },
    aoVoltar: () => {
      jogo.conexaoCaiu = false;
    },
    aoSair: () => {
      const estavaJogando = jogo.online !== null;
      jogo.online = null;
      jogo.conexaoCaiu = false;
      chaveDaCena = "";
      // Se a partida já acabou, a tela de resultado continua; senão, volta para o menu.
      if (estavaJogando && jogo.partida?.fase !== "fim") {
        jogo.partida = null;
        jogo.sala = null;
        jogo.recado = "A conexão com a sala caiu e não voltou. Você está de novo no menu.";
        jogo.irPara("inicial");
      }
    },
  };
}

export async function criarSalaOnline(nome: string): Promise<void> {
  chaveDaCena = "";
  jogo.online = await ConexaoOnline.criar(
    { nome, modo: jogo.modo, dificuldade: jogo.dificuldade, itens: jogo.itens },
    ouvintes(),
  );
}

export async function entrarNaSalaOnline(codigo: string, nome: string): Promise<void> {
  chaveDaCena = "";
  jogo.online = await ConexaoOnline.entrar(codigo, nome, ouvintes());
}

/** Ao abrir o jogo: se a página foi recarregada no meio de uma partida online, volta para ela. */
export async function retomarSalaOnline(): Promise<boolean> {
  chaveDaCena = "";
  jogo.online = await ConexaoOnline.retomar(ouvintes());
  return jogo.online !== null;
}

export async function sairDaSalaOnline(): Promise<void> {
  const conexao = jogo.online;
  jogo.online = null;
  jogo.sala = null;
  jogo.partida = null;
  chaveDaCena = "";
  await conexao?.sair();
}
