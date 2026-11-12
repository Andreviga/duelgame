import { jogarBot } from "../src/bots/bot";
import { jogarBots } from "../src/bots/partida";
import { arena, CONTEXTO, IDS_DAS_ARENAS, ITENS, PARTIDA } from "../src/dados";
import { TICKS_POR_SEGUNDO } from "../src/sim/constantes";
import { aplicar, preparacaoEncerrada } from "../src/sim/economia/economia";
import type { Erro } from "../src/sim/economia/tipos";
import {
  combater,
  comEconomia,
  concluirRodada,
  criarPartida,
  estaVivo,
} from "../src/sim/partida/partida";
import type { EstadoPartida, Modo, NivelBot } from "../src/sim/partida/tipos";
import {
  MAXIMO_DE_JOGADORES,
  type ComandoDoCliente,
  type ErroDeSala,
  type InfoDaSala,
  type Visao,
} from "../src/rede/protocolo";

export interface OpcoesDaMesa {
  codigo: string;
  modo: Modo;
  dificuldade: NivelBot;
  /** Partida com itens de arena (padrão: sem). */
  itens?: boolean;
  semente: number;
  /** Tempo, depois do combate mais longo, antes de abrir a rodada seguinte. */
  segundosExtrasDeCombate?: number;
  /** Quanto tempo a vaga de quem caiu fica reservada. */
  segundosDeReconexao?: number;
  /** Acelera os relógios da mesa (os testes usam valores altos). */
  escalaDeTempo?: number;
}

interface Vaga {
  sessao: string;
  nome: string;
  conectado: boolean;
  /** Momento em que a conexão caiu, ou null. */
  saiuEm: number | null;
  /** Saiu de vez (por vontade própria ou por tempo): um bot assume até o fim. */
  definitivo: boolean;
}

/**
 * Uma mesa de jogo online, sem nada de rede: quem está sentado, a partida e os relógios.
 * O servidor é a autoridade: comandos chegam aqui, são validados pela mesma simulação
 * do jogo local e só então mudam o estado. O tempo vem sempre de fora (`agora`, em ms).
 */
export class Mesa {
  readonly codigo: string;
  private modo: Modo;
  private dificuldade: NivelBot;
  private readonly itens: boolean;
  private readonly semente: number;
  private readonly extrasDeCombate: number;
  private readonly reconexao: number;
  private readonly escala: number;
  private vagas: Vaga[] = [];
  private partida: EstadoPartida | null = null;
  /** Momento (ms) em que a fase atual termina. */
  private fimDaFase = 0;
  private agora = 0;
  /** Combates em que o resultado conferido por um cliente não bateu com o do servidor. */
  readonly divergencias: string[] = [];

  constructor(opcoes: OpcoesDaMesa) {
    this.codigo = opcoes.codigo;
    this.modo = opcoes.modo;
    this.dificuldade = opcoes.dificuldade;
    this.itens = opcoes.itens === true;
    this.semente = opcoes.semente;
    this.extrasDeCombate = opcoes.segundosExtrasDeCombate ?? 6;
    this.reconexao = opcoes.segundosDeReconexao ?? 60;
    this.escala = opcoes.escalaDeTempo ?? 1;
  }

  get iniciada(): boolean {
    return this.partida !== null;
  }

  get encerrada(): boolean {
    return this.partida?.fase === "fim";
  }

  /** Estado completo, só para o servidor e para os testes. */
  get estado(): EstadoPartida | null {
    return this.partida;
  }

  private vagaDe(sessao: string): number {
    return this.vagas.findIndex((v) => v.sessao === sessao);
  }

  // ---------- quem entra e quem sai ----------

  entrar(sessao: string, nome: string): ErroDeSala | null {
    if (this.vagaDe(sessao) >= 0) return null;
    if (this.iniciada) return "sala_iniciada";
    if (this.vagas.length >= MAXIMO_DE_JOGADORES) return "sala_cheia";
    const limpo = nome.trim().slice(0, 16) || `Jogador ${this.vagas.length + 1}`;
    this.vagas.push({ sessao, nome: limpo, conectado: true, saiuEm: null, definitivo: false });
    return null;
  }

  /**
   * A conexão caiu (`definitivo` falso) ou o jogador saiu de vez.
   * Antes da partida, a vaga é liberada. Durante, um bot assume no lugar dele.
   */
  sair(sessao: string, agora: number, definitivo: boolean): void {
    const i = this.vagaDe(sessao);
    const vaga = this.vagas[i];
    if (!vaga) return;
    if (!this.iniciada) {
      this.vagas.splice(i, 1);
      return;
    }
    vaga.conectado = false;
    vaga.saiuEm ??= agora;
    vaga.definitivo ||= definitivo;
    this.definirBot(i, this.dificuldade);
  }

  /** O jogador reconectou a tempo: retoma a vaga e o controle. */
  voltar(sessao: string): boolean {
    const i = this.vagaDe(sessao);
    const vaga = this.vagas[i];
    if (!vaga || vaga.definitivo) return false;
    vaga.conectado = true;
    vaga.saiuEm = null;
    this.definirBot(i, null);
    return true;
  }

  private definirBot(jogador: number, bot: NivelBot | null): void {
    const p = this.partida;
    if (!p) return;
    this.partida = {
      ...p,
      jogadores: p.jogadores.map((j, i) => (i === jogador ? { ...j, bot } : j)),
    };
  }

  // ---------- partida ----------

  comecar(sessao: string, agora: number): ErroDeSala | null {
    const i = this.vagaDe(sessao);
    if (i < 0) return "fora_da_sala";
    if (i !== 0) return "nao_e_anfitriao";
    if (this.iniciada) return "sala_iniciada";
    // Vagas vazias viram bots.
    const participantes = Array.from({ length: MAXIMO_DE_JOGADORES }, (_, k) => {
      const vaga = this.vagas[k];
      return vaga
        ? { nome: vaga.nome, bot: null }
        : { nome: `Bot ${k + 1 - this.vagas.length}`, bot: this.dificuldade };
    });
    this.partida = criarPartida(
      CONTEXTO,
      PARTIDA,
      this.modo,
      participantes,
      this.semente,
      IDS_DAS_ARENAS,
      this.itens ? ITENS : null,
    );
    this.abrirPreparacao(agora);
    return null;
  }

  private abrirPreparacao(agora: number): void {
    if (!this.partida) return;
    this.partida = jogarBots(this.partida, CONTEXTO, arena(this.partida.arena)).partida;
    const ms = (CONTEXTO.config.segundosPreparacao * 1000) / this.escala;
    this.fimDaFase = agora + ms;
  }

  /** Comando de um jogador. Devolve o erro, ou null se foi aceito. */
  comando(sessao: string, comando: ComandoDoCliente): Erro | ErroDeSala | null {
    const jogador = this.vagaDe(sessao);
    if (jogador < 0) return "fora_da_sala";
    const p = this.partida;
    if (!p) return "partida_nao_iniciada";
    if (p.fase !== "preparacao") return "preparacao_encerrada";
    const r = aplicar(p.economia, CONTEXTO, { ...comando, jogador });
    if (!r.ok) return r.erro;
    this.partida = comEconomia(p, r.estado);
    return null;
  }

  /**
   * Faz o tempo andar: vence reservas de vaga, encerra a preparação e abre a rodada seguinte.
   * Devolve true se algo mudou e as visões precisam ser reenviadas.
   */
  avancar(agora: number): boolean {
    this.agora = agora;
    let mudou = false;
    for (const vaga of this.vagas) {
      const prazo = (this.reconexao * 1000) / this.escala;
      if (vaga.saiuEm !== null && !vaga.definitivo && agora - vaga.saiuEm > prazo) {
        vaga.definitivo = true;
        mudou = true;
      }
    }
    let p = this.partida;
    if (!p || p.fase === "fim") return mudou;

    if (p.fase === "preparacao") {
      const restante = Math.max(0, this.fimDaFase - agora);
      const ticks = Math.ceil((restante / 1000) * TICKS_POR_SEGUNDO * this.escala);
      p = comEconomia(p, { ...p.economia, ticksRestantes: ticks });
      this.partida = p;
      if (!preparacaoEncerrada(p.economia)) return mudou;
      // Quem caiu no meio da preparação e não ficou pronto é jogado por um bot.
      const onde = arena(p.arena);
      p.jogadores.forEach((j, i) => {
        const eco = p?.economia.jogadores[i];
        if (!p || !j.bot || !estaVivo(j) || !eco || eco.pronto) return;
        const aberta = comEconomia(p, { ...p.economia, ticksRestantes: 1 });
        const jogada = jogarBot(
          aberta.economia,
          CONTEXTO,
          onde,
          { jogador: i, nivel: j.bot },
          p.rng,
        );
        p = { ...comEconomia(p, jogada.economia), rng: jogada.rng };
      });
      p = combater(p, CONTEXTO, PARTIDA, onde);
      const maisLongo = p.resultados.reduce((m, r) => Math.max(m, r.ticks), 0);
      const segundos = maisLongo / TICKS_POR_SEGUNDO + this.extrasDeCombate;
      this.fimDaFase = agora + (segundos * 1000) / this.escala;
      this.partida = p;
      return true;
    }

    if (agora < this.fimDaFase) return mudou;
    this.partida = concluirRodada(p, CONTEXTO);
    if (this.partida.fase === "preparacao") this.abrirPreparacao(agora);
    return true;
  }

  /** O cliente simulou o próprio combate e informa o vencedor que viu; divergência fica registrada. */
  conferir(sessao: string, rodada: number, vencedor: number | null): boolean {
    const jogador = this.vagaDe(sessao);
    const p = this.partida;
    if (!p || jogador < 0 || p.economia.rodada !== rodada || p.resultados.length === 0) return true;
    const i = p.confrontos.findIndex(
      (c) => c.ladoA.includes(jogador) || (!c.fantasma && c.ladoB.includes(jogador)),
    );
    const esperado = p.resultados[i]?.vencedor;
    if (i < 0 || esperado === undefined || esperado === vencedor) return true;
    this.divergencias.push(
      `rodada ${rodada}, jogador ${jogador}: cliente ${vencedor}, servidor ${esperado}`,
    );
    return false;
  }

  // ---------- o que cada um vê ----------

  info(): InfoDaSala {
    return {
      codigo: this.codigo,
      modo: this.modo,
      dificuldade: this.dificuldade,
      itens: this.itens,
      iniciada: this.iniciada,
      vagas: this.vagas.map((v, i) => ({
        nome: v.nome,
        conectado: v.conectado,
        anfitriao: i === 0,
      })),
    };
  }

  /** Visão de um jogador: a loja e o banco dos outros, o baralho e os geradores ficam de fora. */
  visaoDe(sessao: string): Visao | null {
    const eu = this.vagaDe(sessao);
    if (eu < 0) return null;
    const p = this.partida;
    const partida: EstadoPartida | null = p && {
      ...p,
      rng: { s: 0 },
      economia: {
        ...p.economia,
        rng: { s: 0 },
        baralho: {},
        jogadores: p.economia.jogadores.map((j, i) =>
          i === eu ? j : { ...j, loja: [], banco: [] },
        ),
      },
    };
    return {
      sala: this.info(),
      eu,
      partida,
      msRestantes: Math.max(0, this.fimDaFase - this.agora),
    };
  }

  sessoes(): string[] {
    return this.vagas.filter((v) => v.conectado).map((v) => v.sessao);
  }

  get vazia(): boolean {
    return this.vagas.every((v) => !v.conectado);
  }
}

/** Código de sala: 4 letras fáceis de ditar (sem I, O, Q, que se confundem). */
export function gerarCodigo(sortear: () => number): string {
  const letras = "ABCDEFGHJKLMNPRSTUVWXYZ";
  return Array.from({ length: 4 }, () => letras[Math.floor(sortear() * letras.length)]).join("");
}
