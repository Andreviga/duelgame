import { ARENAS, CONTEXTO as ctx, PERSONAGENS } from "../src/dados";
import { criarAleatorio, proximo } from "../src/sim/aleatorio";
import { criarCombate, stepCombate } from "../src/sim/combate/combate";
import type { Arena, DefPersonagem, Esquadrao, Lado } from "../src/sim/combate/tipos";
import { montarEsquadrao, sinergiasDoJogador } from "../src/sim/economia/economia";
import type { EstadoJogador } from "../src/sim/economia/tipos";

/**
 * Simulação em lote para balanceamento.
 * Cada combate põe frente a frente dois esquadrões sorteados com o mesmo orçamento de elixir,
 * em pontos sorteados, numa arena sorteada. Com orçamento igual, a taxa de vitória de um
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
}

const taxa = (c: Contagem): number => (c.jogos === 0 ? 0 : c.vitorias / c.jogos);
export const porcentagem = (c: Contagem): string => `${(taxa(c) * 100).toFixed(1)}%`;

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

  /** Campo sorteado: personagens diferentes até gastar o orçamento, em pontos sorteados. */
  const sortearCampo = (): EstadoJogador => {
    const disponiveis = [...elenco];
    const pontos = Array.from({ length: ctx.pontos }, (_, i) => i);
    const campo: EstadoJogador["campo"][number][] = [];
    let resta = opcoes.orcamento;
    while (campo.length < opcoes.maximoEmCampo) {
      const cabem = disponiveis.filter((d) => d.custo <= resta);
      if (cabem.length === 0) break;
      const def = cabem[inteiro(cabem.length)];
      if (!def) break;
      disponiveis.splice(disponiveis.indexOf(def), 1);
      const ponto = pontos.splice(inteiro(pontos.length), 1)[0] ?? 0;
      campo.push({ unidade: { id: campo.length + 1, personagem: def.id, nivel: 1 }, ponto });
      resta -= def.custo;
    }
    return { elixir: 0, loja: [], banco: [], campo, pronto: true };
  };

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
