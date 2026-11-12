import { ARENAS, CONTEXTO as ctx, PERSONAGENS } from "../src/dados";
import { criarAleatorio, proximo } from "../src/sim/aleatorio";
import { criarCombate, stepCombate } from "../src/sim/combate/combate";
import type { Arena, DefPersonagem, Esquadrao, Lado } from "../src/sim/combate/tipos";
import { copiasDoNivel, montarEsquadrao, sinergiasDoJogador } from "../src/sim/economia/economia";
import type { EstadoJogador } from "../src/sim/economia/tipos";

/**
 * Simulação em lote para balanceamento.
 * Cada combate põe frente a frente dois esquadrões sorteados com o mesmo orçamento de elixir,
 * em pontos sorteados, numa arena sorteada. O elixir que sobra vira níveis de fusão.
 * Com orçamento igual, a taxa de vitória de um
 * personagem mede o quanto ele rende pelo que custa.
 */
export interface Contagem {
  jogos: number;
  vitorias: number;
}

export interface RelatorioDeLote {
  combates: number;
  porTempo: number;
  empates: number;
  quedasSozinho: number;
  /** Quem caiu sem ter sido arremessado, e em que situação (para achar defeito de IA). */
  quedasPorCaso: Record<string, number>;
  /** Maior tempo, em segundos, que um personagem ficou sem agir. */
  maiorEspera: number;
  duracaoMediana: number;
  duracaoMaxima: number;
  personagens: Record<string, Contagem>;
  /** Chave: "mundo:futebol:2" (característica e quantidade em campo). */
  sinergias: Record<string, Contagem>;
  arenas: Record<string, Contagem & { porTempo: number }>;
}

export interface OpcoesDeLote {
  combates: number;
  semente: number;
  /** Elixir gasto por esquadrão. */
  orcamento: number;
  maximoEmCampo: number;
  arenas?: readonly Arena[];
  personagens?: readonly DefPersonagem[];
  /** Medir só estas sinergias (ex.: "mundo:piratas"). Sem isto, mede todas. */
  soSinergias?: readonly string[];
}

const taxa = (c: Contagem): number => (c.jogos === 0 ? 0 : c.vitorias / c.jogos);
export const porcentagem = (c: Contagem): string => `${(taxa(c) * 100).toFixed(1)}%`;

/**
 * Campo sorteado: personagens diferentes até gastar o orçamento, em pontos sorteados.
 * O elixir que sobra vira fusão (sobe o nível de quem couber), como aconteceria no jogo.
 * `obrigatorios` entram sempre; `proibidos` nunca são sorteados.
 */
function gerarCampo(
  inteiro: (n: number) => number,
  elenco: readonly DefPersonagem[],
  opcoes: Pick<OpcoesDeLote, "orcamento" | "maximoEmCampo">,
  obrigatorios: readonly DefPersonagem[] = [],
  proibidos: readonly DefPersonagem[] = [],
): EstadoJogador {
  const disponiveis = elenco.filter((d) => !obrigatorios.includes(d) && !proibidos.includes(d));
  const pontos = Array.from({ length: ctx.pontos }, (_, i) => i);
  const campo: EstadoJogador["campo"][number][] = [];
  let resta = opcoes.orcamento;
  const entrar = (def: DefPersonagem): void => {
    const ponto = pontos.splice(inteiro(pontos.length), 1)[0] ?? 0;
    campo.push({ unidade: { id: campo.length + 1, personagem: def.id, nivel: 1 }, ponto });
    resta -= def.custo;
  };
  for (const def of obrigatorios) entrar(def);
  while (campo.length < opcoes.maximoEmCampo) {
    const cabem = disponiveis.filter((d) => d.custo <= resta);
    const def = cabem[inteiro(Math.max(1, cabem.length))];
    if (!def) break;
    disponiveis.splice(disponiveis.indexOf(def), 1);
    entrar(def);
  }
  for (;;) {
    const podem = campo.flatMap((c, i) => {
      const base = elenco.find((d) => d.id === c.unidade.personagem)?.custo ?? 99;
      const custo = base * copiasDoNivel(c.unidade.nivel);
      return c.unidade.nivel < 3 && custo <= resta ? [{ i, custo }] : [];
    });
    const escolha = podem[inteiro(Math.max(1, podem.length))];
    const atual = escolha ? campo[escolha.i] : undefined;
    if (!escolha || !atual) break;
    campo[escolha.i] = { ...atual, unidade: { ...atual.unidade, nivel: atual.unidade.nivel + 1 } };
    resta -= escolha.custo;
  }
  return { elixir: 0, loja: [], banco: [], campo, pronto: true };
}

export function rodarLote(opcoes: OpcoesDeLote): RelatorioDeLote {
  const arenas = opcoes.arenas ?? ARENAS;
  const elenco = opcoes.personagens ?? PERSONAGENS;
  let rng = criarAleatorio(opcoes.semente);
  const sortear = (): number => {
    const r = proximo(rng);
    rng = r.rng;
    return r.valor;
  };
  const inteiro = (n: number): number => Math.floor(sortear() * n);

  const sortearCampo = (): EstadoJogador => gerarCampo(inteiro, elenco, opcoes);

  const rel: RelatorioDeLote = {
    combates: 0,
    porTempo: 0,
    empates: 0,
    quedasSozinho: 0,
    quedasPorCaso: {},
    maiorEspera: 0,
    duracaoMediana: 0,
    duracaoMaxima: 0,
    personagens: Object.fromEntries(elenco.map((d) => [d.id, { jogos: 0, vitorias: 0 }])),
    sinergias: {},
    arenas: Object.fromEntries(arenas.map((a) => [a.id, { jogos: 0, vitorias: 0, porTempo: 0 }])),
  };
  const duracoes: number[] = [];

  for (let n = 0; n < opcoes.combates; n++) {
    const arena = arenas[inteiro(arenas.length)];
    if (!arena) continue;
    const campos = [sortearCampo(), sortearCampo()];
    const esquadroes = campos.map((c, i) => montarEsquadrao(c, ctx, arena, i === 0 ? 0 : 1)) as [
      Esquadrao,
      Esquadrao,
    ];
    let e = criarCombate(arena, esquadroes, inteiro(2 ** 31));
    const ultimo = e.lutadores.map((l) => ({ x: l.x, y: l.y, tick: 0 }));
    while (!e.fim) {
      const antes = e;
      e = stepCombate(e);
      for (const ev of e.eventos) {
        if (ev.tipo !== "saida" || ev.porGolpe) continue;
        rel.quedasSozinho++;
        const l = e.lutadores[ev.id];
        const anterior = antes.lutadores[ev.id];
        const autor = e.lutadores.find((o) => o.id === l?.ultimoAtacante);
        const caso = `${l?.def.id} (${arena.id}; ${anterior?.ia}; último golpe de ${autor?.def.id ?? "ninguém"})`;
        rel.quedasPorCaso[caso] = (rel.quedasPorCaso[caso] ?? 0) + 1;
      }
      for (const l of e.lutadores) {
        const u = ultimo[l.id];
        if (!u || !l.vivo) continue;
        const agiu =
          Math.abs(l.x - u.x) + Math.abs(l.y - u.y) > 8 ||
          l.ataque.fase !== "nenhum" ||
          l.hab.ticks > 0 ||
          l.atordoado > 0;
        if (agiu) Object.assign(u, { x: l.x, y: l.y, tick: e.tick });
        else rel.maiorEspera = Math.max(rel.maiorEspera, (e.tick - u.tick) / 60);
      }
    }
    rel.combates++;
    duracoes.push(e.fim.tick / 60);
    const vencedor: Lado | null = e.fim.vencedor;
    const daArena = rel.arenas[arena.id];
    if (daArena) {
      daArena.jogos++;
      if (vencedor === 0) daArena.vitorias++; // vitórias do lado esquerdo: deve ficar perto de 50%
      if (e.fim.motivo === "tempo") daArena.porTempo++;
    }
    if (e.fim.motivo === "tempo") rel.porTempo++;
    if (vencedor === null) {
      rel.empates++;
      continue;
    }
    campos.forEach((c, lado) => {
      const venceu = vencedor === lado;
      for (const em of c.campo) {
        const cont = rel.personagens[em.unidade.personagem];
        if (cont) {
          cont.jogos++;
          if (venceu) cont.vitorias++;
        }
      }
      for (const s of sinergiasDoJogador(c, ctx)) {
        const chave = `${s.tipo}:${s.chave}:${Math.min(s.quantidade, 3)}`;
        const cont = (rel.sinergias[chave] ??= { jogos: 0, vitorias: 0 });
        cont.jogos++;
        if (venceu) cont.vitorias++;
      }
    });
  }
  duracoes.sort((a, b) => a - b);
  rel.duracaoMediana = duracoes[Math.floor(duracoes.length / 2)] ?? 0;
  rel.duracaoMaxima = duracoes.at(-1) ?? 0;
  return rel;
}

/** Relatório em texto (tabelas em Markdown). */
export function formatarRelatorio(rel: RelatorioDeLote): string {
  const linhas: string[] = [];
  linhas.push(`# Lote de ${rel.combates} combates`);
  linhas.push("");
  linhas.push(
    `Por tempo: ${rel.porTempo} · empates: ${rel.empates} · quedas sem arremesso: ${rel.quedasSozinho} · ` +
      `maior espera: ${rel.maiorEspera.toFixed(1)} s · duração mediana: ${rel.duracaoMediana.toFixed(1)} s · ` +
      `máxima: ${rel.duracaoMaxima.toFixed(1)} s`,
  );
  for (const [caso, n] of Object.entries(rel.quedasPorCaso)) linhas.push(`- queda: ${caso} × ${n}`);
  const tabela = (titulo: string, itens: [string, Contagem][]): void => {
    linhas.push("", `## ${titulo}`, "", "| | Vitória | Jogos |", "|---|---|---|");
    for (const [nome, c] of [...itens].sort((a, b) => taxa(b[1]) - taxa(a[1]))) {
      linhas.push(`| ${nome} | ${porcentagem(c)} | ${c.jogos} |`);
    }
  };
  const elenco = new Map(PERSONAGENS.map((d) => [d.id, d]));
  tabela(
    "Personagens",
    Object.entries(rel.personagens).map(([id, c]) => {
      const d = elenco.get(id);
      return [d ? `${d.nome} (${d.mundo}, ${d.papel}, ${d.custo})` : id, c];
    }),
  );
  tabela("Características em campo (quantidade)", Object.entries(rel.sinergias));
  tabela("Arenas (vitória do lado esquerdo)", Object.entries(rel.arenas));
  return linhas.join("\n");
}

export interface EfeitoDeSinergia {
  chave: string;
  minimo: number;
  /** Vitórias do time que tem a característica, com o bônus e com o bônus desligado. */
  com: Contagem;
  sem: Contagem;
}

/**
 * Mede quanto cada degrau de sinergia rende: os mesmos combates (mesmos times, pontos e semente)
 * são simulados com o bônus e com aquele bônus desligado. A diferença é o que a sinergia vale.
 */
export function medirSinergias(opcoes: OpcoesDeLote): EfeitoDeSinergia[] {
  const arenas = opcoes.arenas ?? ARENAS;
  let rng = criarAleatorio(opcoes.semente);
  const sortear = (): number => {
    const r = proximo(rng);
    rng = r.rng;
    return r.valor;
  };
  const inteiro = (n: number): number => Math.floor(sortear() * n);
  const embaralhar = <T>(lista: readonly T[]): T[] => {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const k = inteiro(i + 1);
      const a = copia[i];
      const b = copia[k];
      if (a !== undefined && b !== undefined) [copia[i], copia[k]] = [b, a];
    }
    return copia;
  };
  const resultados: EfeitoDeSinergia[] = [];
  const grupos = [
    ...Object.entries(ctx.sinergias.mundos).map(([k, def]) => ({ tipo: "mundo" as const, k, def })),
    ...Object.entries(ctx.sinergias.papeis).map(([k, def]) => ({ tipo: "papel" as const, k, def })),
  ];
  for (const { tipo, k, def } of grupos) {
    if (opcoes.soSinergias && !opcoes.soSinergias.includes(`${tipo}:${k}`)) continue;
    const dentro = PERSONAGENS.filter((d) => (tipo === "mundo" ? d.mundo : d.papel) === k);
    // Contexto com este bônus desligado (os outros continuam valendo).
    const semEste: typeof ctx = {
      ...ctx,
      sinergias: {
        ...ctx.sinergias,
        mundos: {
          ...ctx.sinergias.mundos,
          ...(tipo === "mundo" ? { [k]: { ...def, niveis: [] } } : {}),
        },
        papeis: {
          ...ctx.sinergias.papeis,
          ...(tipo === "papel" ? { [k]: { ...def, niveis: [] } } : {}),
        },
      },
    };
    for (const nivel of def.niveis) {
      const efeito: EfeitoDeSinergia = {
        chave: `${tipo}:${k}`,
        minimo: nivel.minimo,
        com: { jogos: 0, vitorias: 0 },
        sem: { jogos: 0, vitorias: 0 },
      };
      for (let n = 0; n < opcoes.combates; n++) {
        const arena = arenas[inteiro(arenas.length)];
        if (!arena) continue;
        const membros = embaralhar(dentro).slice(0, nivel.minimo);
        // O resto do time vem de fora da característica, para a contagem ficar exata.
        const meu = gerarCampo(inteiro, PERSONAGENS, opcoes, membros, dentro);
        const rival = gerarCampo(inteiro, PERSONAGENS, opcoes);
        const semente = inteiro(2 ** 31);
        const meuLado: Lado = inteiro(2) === 0 ? 0 : 1;
        for (const [contexto, cont] of [
          [ctx, efeito.com],
          [semEste, efeito.sem],
        ] as const) {
          const a = montarEsquadrao(meu, contexto, arena, meuLado);
          const b = montarEsquadrao(rival, ctx, arena, meuLado === 0 ? 1 : 0);
          let e = criarCombate(arena, meuLado === 0 ? [a, b] : [b, a], semente);
          while (!e.fim) e = stepCombate(e);
          cont.jogos++;
          if (e.fim.vencedor === meuLado) cont.vitorias++;
        }
      }
      resultados.push(efeito);
    }
  }
  return resultados;
}

export function formatarSinergias(efeitos: readonly EfeitoDeSinergia[]): string {
  const linhas = [
    "## Efeito de cada sinergia (mesmos combates, com e sem o bônus)",
    "",
    "| Característica | Em campo | Com o bônus | Sem o bônus | Diferença | Jogos |",
    "|---|---|---|---|---|---|",
  ];
  for (const e of efeitos) {
    const diferenca = (taxa(e.com) - taxa(e.sem)) * 100;
    linhas.push(
      `| ${e.chave} | ${e.minimo} | ${porcentagem(e.com)} | ${porcentagem(e.sem)} | ` +
        `${diferenca >= 0 ? "+" : ""}${diferenca.toFixed(1)} | ${e.com.jogos} |`,
    );
  }
  return linhas.join("\n");
}

/**
 * Determinismo: roda cada combate duas vezes com a mesma semente e compara o estado final inteiro.
 * Devolve quantos combates divergiram (deve ser zero).
 */
export function conferirDeterminismo(combates: number, semente: number): number {
  let rng = criarAleatorio(semente);
  const inteiro = (n: number): number => {
    const r = proximo(rng);
    rng = r.rng;
    return Math.floor(r.valor * n);
  };
  const opcoes = { orcamento: 14, maximoEmCampo: 4 };
  let divergentes = 0;
  for (let n = 0; n < combates; n++) {
    const arena = ARENAS[inteiro(ARENAS.length)];
    if (!arena) continue;
    const campos = [
      gerarCampo(inteiro, PERSONAGENS, opcoes),
      gerarCampo(inteiro, PERSONAGENS, opcoes),
    ];
    const s = inteiro(2 ** 31);
    const rodar = (): string => {
      const esquadroes = campos.map((c, i) => montarEsquadrao(c, ctx, arena, i === 0 ? 0 : 1)) as [
        Esquadrao,
        Esquadrao,
      ];
      let e = criarCombate(arena, esquadroes, s);
      while (!e.fim) e = stepCombate(e);
      return JSON.stringify({
        t: e.tick,
        f: e.fim,
        l: e.lutadores.map((l) => [l.x, l.y, l.dano, l.vivo]),
      });
    };
    if (rodar() !== rodar()) divergentes++;
  }
  return divergentes;
}
