import { criarAleatorio, proximo, type EstadoAleatorio } from "../aleatorio";
import { criarCombate, simularCombate } from "../combate/combate";
import type { Arena, ConfigItens, Esquadrao, Lado } from "../combate/tipos";
import {
  criarEconomia,
  iniciarRodada,
  montarEsquadrao,
  removerJogador,
  sinergiasDoJogador,
} from "../economia/economia";
import { elixirAoVencer } from "../economia/sinergias";
import type { Contexto, EstadoEconomia } from "../economia/tipos";
import type {
  ConfigPartida,
  Confronto,
  EstadoPartida,
  JogadorPartida,
  Modo,
  Participante,
  ResultadoConfronto,
} from "./tipos";

export const JOGADORES_POR_PARTIDA = 4;

export function estaVivo(j: JogadorPartida): boolean {
  return j.eliminadoNaRodada === null;
}

function vivos(p: EstadoPartida): number[] {
  return p.jogadores.flatMap((j, i) => (estaVivo(j) ? [i] : []));
}

/** Vida perdida pelo lado que perde a rodada. */
export function danoDaDerrota(cfg: ConfigPartida, sobreviventes: number, rodada: number): number {
  const extra = Math.floor(rodada / cfg.rodadasPorDanoExtra);
  return cfg.danoBase + cfg.danoPorSobrevivente * sobreviventes + extra;
}

/**
 * Pareamento da rodada.
 *  - 2x2: sempre time 0 contra time 1, todos na mesma arena.
 *  - Todos contra todos: os vivos são pareados em duelos, evitando repetir o último adversário.
 *    Com três vivos, quem sobra enfrenta uma cópia ("fantasma") do esquadrão de outro jogador.
 */
export function sortearConfrontos(
  p: EstadoPartida,
  rngInicial: EstadoAleatorio,
): { confrontos: Confronto[]; rng: EstadoAleatorio } {
  let rng = rngInicial;
  const sortear = (): number => {
    const r = proximo(rng);
    rng = r.rng;
    return r.valor;
  };
  const semente = (): number => Math.floor(sortear() * 2 ** 31);
  const escolher = <T>(lista: readonly T[]): T | undefined =>
    lista[Math.floor(sortear() * lista.length)];
  const par = (a: number, b: number): Confronto => ({
    ladoA: [Math.min(a, b)],
    ladoB: [Math.max(a, b)],
    fantasma: false,
    semente: semente(),
  });

  if (p.modo === "duplas") {
    const time = (t: 0 | 1) =>
      p.jogadores.flatMap((j, i) => (j.time === t && estaVivo(j) ? [i] : []));
    return {
      confrontos: [{ ladoA: time(0), ladoB: time(1), fantasma: false, semente: semente() }],
      rng,
    };
  }

  const v = vivos(p);
  const repete = (a: number, b: number): boolean =>
    p.jogadores[a]?.ultimoAdversario === b && p.jogadores[b]?.ultimoAdversario === a;
  const [a, b, c, d] = v;

  if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
    const opcoes: [number, number, number, number][] = [
      [a, b, c, d],
      [a, c, b, d],
      [a, d, b, c],
    ];
    const novas = opcoes.filter(([w, x, y, z]) => !repete(w, x) && !repete(y, z));
    const [w, x, y, z] = escolher(novas.length > 0 ? novas : opcoes) ?? [a, b, c, d];
    return { confrontos: [par(w, x), par(y, z)], rng };
  }
  if (a !== undefined && b !== undefined && c !== undefined) {
    // Três vivos: um duelo de verdade e um contra o fantasma de um dos outros dois.
    const opcoes: [number, number, number][] = [
      [a, b, c],
      [a, c, b],
      [b, c, a],
    ];
    const novas = opcoes.filter(([w, x]) => !repete(w, x));
    const [w, x, sobra] = escolher(novas.length > 0 ? novas : opcoes) ?? [a, b, c];
    const copiado = escolher([w, x]) ?? w;
    return {
      confrontos: [
        par(w, x),
        { ladoA: [sobra], ladoB: [copiado], fantasma: true, semente: semente() },
      ],
      rng,
    };
  }
  if (a !== undefined && b !== undefined) return { confrontos: [par(a, b)], rng };
  return { confrontos: [], rng };
}

function abrirRodada(p: EstadoPartida, ctx: Contexto): EstadoPartida {
  const economia = iniciarRodada(p.economia, ctx, p.jogadores.map(estaVivo));
  const sorteio = sortearConfrontos(p, p.rng);
  return {
    ...p,
    fase: "preparacao",
    economia,
    rng: sorteio.rng,
    confrontos: sorteio.confrontos,
    resultados: [],
  };
}

/** Cria a partida e já abre a preparação da primeira rodada. */
export function criarPartida(
  ctx: Contexto,
  cfg: ConfigPartida,
  modo: Modo,
  participantes: readonly Participante[],
  semente: number,
  /** Arenas possíveis; uma é sorteada para a partida inteira. */
  arenas: readonly string[] = ["arena-basica"],
  /** Regras dos itens de arena; null (o padrão) cria a partida sem itens. */
  itens: ConfigItens | null = null,
): EstadoPartida {
  if (participantes.length !== JOGADORES_POR_PARTIDA) {
    throw new Error(`a partida precisa de ${JOGADORES_POR_PARTIDA} jogadores`);
  }
  const jogadores: JogadorPartida[] = participantes.map((j, i) => ({
    nome: j.nome,
    bot: j.bot,
    time: i < JOGADORES_POR_PARTIDA / 2 ? 0 : 1,
    vida: cfg.vidaInicial,
    eliminadoNaRodada: null,
    ultimoAdversario: null,
  }));
  const sorteio = proximo(criarAleatorio((semente ^ 0x9e3779b9) >>> 0));
  const arena = arenas[Math.floor(sorteio.valor * arenas.length)] ?? "arena-basica";
  const inicial: EstadoPartida = {
    modo,
    arena,
    fase: "preparacao",
    economia: criarEconomia(ctx, jogadores.length, semente),
    rng: sorteio.rng,
    jogadores,
    confrontos: [],
    resultados: [],
    classificacao: null,
    itens,
  };
  return abrirRodada(inicial, ctx);
}

/** Troca a economia da partida (depois de um comando do jogador ou de um bot). */
export function comEconomia(p: EstadoPartida, economia: EstadoEconomia): EstadoPartida {
  return { ...p, economia };
}

/** Os dois esquadrões de um confronto, prontos para `criarCombate`. */
export function esquadroesDoConfronto(
  p: EstadoPartida,
  ctx: Contexto,
  arena: Arena,
  c: Confronto,
): [Esquadrao, Esquadrao] {
  const lado = (ids: readonly number[], qual: Lado): Esquadrao =>
    ids.flatMap((id, posicao) => {
      const j = p.economia.jogadores[id];
      if (!j) return [];
      return montarEsquadrao(j, ctx, arena, qual, { dono: id, segundo: posicao > 0 });
    });
  return [lado(c.ladoA, 0), lado(c.ladoB, 1)];
}

/** O confronto de verdade (não como fantasma) em que o jogador luta nesta rodada. */
export function confrontoDoJogador(p: EstadoPartida, jogador: number): number {
  return p.confrontos.findIndex(
    (c) => c.ladoA.includes(jogador) || (!c.fantasma && c.ladoB.includes(jogador)),
  );
}

/** Encerra a preparação: simula todos os combates da rodada e guarda os resultados. */
export function combater(
  p: EstadoPartida,
  ctx: Contexto,
  cfg: ConfigPartida,
  arena: Arena,
): EstadoPartida {
  if (p.fase !== "preparacao") return p;
  const resultados: ResultadoConfronto[] = p.confrontos.map((c) => {
    const final = simularCombate(
      criarCombate(arena, esquadroesDoConfronto(p, ctx, arena, c), c.semente, p.itens),
    );
    const conta = (lado: Lado) => final.lutadores.filter((l) => l.vivo && l.lado === lado).length;
    const sobreviventes: [number, number] = [conta(0), conta(1)];
    const vencedor = final.fim?.vencedor ?? null;
    const dano =
      vencedor === null ? 0 : danoDaDerrota(cfg, sobreviventes[vencedor], p.economia.rodada);
    // Sinergias que rendem elixir ao vencer (o fantasma não ganha nada).
    const elixirExtra: Record<number, number> = {};
    const vencedores = vencedor === 0 ? c.ladoA : vencedor === 1 && !c.fantasma ? c.ladoB : [];
    for (const id of vencedores) {
      const j = p.economia.jogadores[id];
      const extra = j ? elixirAoVencer(sinergiasDoJogador(j, ctx)) : 0;
      if (extra > 0) elixirExtra[id] = extra;
    }
    return { vencedor, sobreviventes, ticks: final.fim?.tick ?? 0, dano, elixirExtra };
  });
  return { ...p, fase: "combate", resultados };
}

function classificar(jogadores: readonly JogadorPartida[]): number[] {
  return jogadores
    .map((_, i) => i)
    .sort((a, b) => {
      const ja = jogadores[a];
      const jb = jogadores[b];
      if (!ja || !jb) return 0;
      // Quem sobreviveu vem primeiro; depois, quem caiu mais tarde; depois, quem tinha mais vida.
      const ra = ja.eliminadoNaRodada ?? Infinity;
      const rb = jb.eliminadoNaRodada ?? Infinity;
      if (ra !== rb) return rb - ra;
      if (ja.vida !== jb.vida) return jb.vida - ja.vida;
      return a - b;
    });
}

/**
 * Aplica os resultados da rodada: tira vida de quem perdeu, elimina quem zerou e
 * abre a rodada seguinte, ou encerra a partida.
 */
export function concluirRodada(p: EstadoPartida, ctx: Contexto): EstadoPartida {
  if (p.fase !== "combate") return p;
  const rodada = p.economia.rodada;
  const jogadores = p.jogadores.map((j) => ({ ...j }));

  p.confrontos.forEach((c, i) => {
    const r = p.resultados[i];
    if (!r) return;
    if (!c.fantasma) {
      for (const a of c.ladoA) {
        const j = jogadores[a];
        if (j) j.ultimoAdversario = c.ladoB[0] ?? null;
      }
      for (const b of c.ladoB) {
        const j = jogadores[b];
        if (j) j.ultimoAdversario = c.ladoA[0] ?? null;
      }
    }
    if (r.vencedor === null) return;
    const perdedores = r.vencedor === 0 ? (c.fantasma ? [] : c.ladoB) : c.ladoA;
    // No 2x2 a vida é do time: os dois perdem juntos, mesmo que um já tenha... (não há eliminação individual).
    const atingidos =
      p.modo === "duplas"
        ? jogadores.flatMap((j, k) => (j.time === jogadores[perdedores[0] ?? -1]?.time ? [k] : []))
        : perdedores;
    for (const k of atingidos) {
      const j = jogadores[k];
      if (j) j.vida = Math.max(0, j.vida - r.dano);
    }
  });

  let economia = p.economia;
  // Elixir de sinergia para quem venceu.
  const ganhos = new Map<number, number>();
  for (const r of p.resultados) {
    for (const [id, extra] of Object.entries(r.elixirExtra)) {
      ganhos.set(Number(id), (ganhos.get(Number(id)) ?? 0) + extra);
    }
  }
  if (ganhos.size > 0) {
    economia = {
      ...economia,
      jogadores: economia.jogadores.map((j, i) => ({
        ...j,
        elixir: Math.min(ctx.config.tetoElixir, j.elixir + (ganhos.get(i) ?? 0)),
      })),
    };
  }
  jogadores.forEach((j, i) => {
    if (j.eliminadoNaRodada === null && j.vida <= 0) {
      j.eliminadoNaRodada = rodada;
      economia = removerJogador(economia, i);
    }
  });

  const restantes = jogadores.filter(estaVivo);
  const acabou =
    p.modo === "duplas"
      ? !restantes.some((j) => j.time === 0) || !restantes.some((j) => j.time === 1)
      : restantes.length <= 1;
  const base: EstadoPartida = { ...p, jogadores, economia };
  if (acabou) return { ...base, fase: "fim", classificacao: classificar(jogadores) };
  return abrirRodada(base, ctx);
}
