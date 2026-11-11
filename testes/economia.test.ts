import { describe, expect, it } from "vitest";
import {
  ARENA_BASICA as arena,
  CONTEXTO as ctx,
  ECONOMIA as config,
  personagem,
} from "../src/dados";
import { criarCombate, simularCombate } from "../src/sim/combate/combate";
import {
  aplicar,
  aplicarNivel,
  copiasDoNivel,
  criarEconomia,
  ganhoDeElixir,
  iniciarRodada,
  limiteDeCampo,
  montarEsquadrao,
  preparacaoEncerrada,
  tickPreparacao,
  valorDeVenda,
} from "../src/sim/economia/economia";
import type {
  Comando,
  Erro,
  EstadoEconomia,
  EstadoJogador,
  Unidade,
} from "../src/sim/economia/tipos";

const nova = (semente = 1) => iniciarRodada(criarEconomia(ctx, 1, semente), ctx);
const eu = (e: EstadoEconomia): EstadoJogador => {
  const j = e.jogadores[0];
  if (!j) throw new Error("sem jogador");
  return j;
};
/** Troca campos do jogador 0 para montar a situação do teste. */
const com = (
  e: EstadoEconomia,
  parcial: Partial<EstadoJogador>,
  extra: Partial<EstadoEconomia> = {},
): EstadoEconomia => ({
  ...e,
  ...extra,
  jogadores: [{ ...eu(e), ...parcial }],
});
const u = (id: number, p: string, nivel = 1): Unidade => ({ id, personagem: p, nivel });
const ok = (e: EstadoEconomia, c: Comando) => {
  const r = aplicar(e, ctx, c);
  if (!r.ok) throw new Error(`comando falhou: ${r.erro}`);
  return r;
};
const erro = (e: EstadoEconomia, c: Comando): Erro | null => {
  const r = aplicar(e, ctx, c);
  return r.ok ? null : r.erro;
};
const cartasNoJogo = (e: EstadoEconomia, id: string) => {
  const j = eu(e);
  const unidades = [...j.banco, ...j.campo.map((c) => c.unidade)].filter(
    (x) => x.personagem === id,
  );
  return (
    (e.baralho[id] ?? 0) +
    j.loja.filter((c) => c === id).length +
    unidades.reduce((s, x) => s + copiasDoNivel(x.nivel), 0)
  );
};

describe("rodada", () => {
  it("começa com elixir, loja cheia e cronômetro", () => {
    const e = nova();
    expect(e.rodada).toBe(1);
    expect(eu(e).elixir).toBe(ganhoDeElixir(config, 1));
    expect(eu(e).loja).toHaveLength(config.tamanhoLoja);
    expect(eu(e).loja.every((c) => c !== null)).toBe(true);
    expect(e.ticksRestantes).toBe(config.segundosPreparacao * 60);
    expect(eu(e).pronto).toBe(false);
  });

  it("o elixir que sobra acumula, até o teto", () => {
    const e1 = nova();
    const e2 = iniciarRodada(e1, ctx);
    expect(eu(e2).elixir).toBe(ganhoDeElixir(config, 1) + ganhoDeElixir(config, 2));
    const rico = iniciarRodada(com(e1, { elixir: config.tetoElixir - 1 }), ctx);
    expect(eu(rico).elixir).toBe(config.tetoElixir);
  });

  it("o ganho por rodada cresce e para no máximo", () => {
    expect(ganhoDeElixir(config, 2)).toBeGreaterThan(ganhoDeElixir(config, 1));
    expect(ganhoDeElixir(config, 99)).toBe(config.ganhoMaximo);
  });

  it("o limite de campo cresce com as rodadas e para no último valor", () => {
    expect(limiteDeCampo(config, 1)).toBe(config.limiteCampo[0]);
    expect(limiteDeCampo(config, 5)).toBeGreaterThan(limiteDeCampo(config, 1));
    expect(limiteDeCampo(config, 99)).toBe(config.limiteCampo.at(-1));
  });

  it("a loja é determinística pela semente", () => {
    expect(eu(nova(5)).loja).toEqual(eu(nova(5)).loja);
    const lojas = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => eu(nova(s)).loja.join()));
    expect(lojas.size).toBeGreaterThan(1);
  });

  it("o cronômetro encerra a preparação e bloqueia comandos", () => {
    let e = nova();
    expect(preparacaoEncerrada(e)).toBe(false);
    for (let i = 0; i < config.segundosPreparacao * 60; i++) e = tickPreparacao(e);
    expect(e.ticksRestantes).toBe(0);
    expect(preparacaoEncerrada(e)).toBe(true);
    expect(erro(e, { tipo: "comprar", jogador: 0, carta: 0 })).toBe("preparacao_encerrada");
    expect(tickPreparacao(e)).toBe(e);
  });

  it("'pronto' encerra a preparação do jogador", () => {
    const e = ok(nova(), { tipo: "pronto", jogador: 0 }).estado;
    expect(preparacaoEncerrada(e)).toBe(true);
    expect(erro(e, { tipo: "atualizar", jogador: 0 })).toBe("preparacao_encerrada");
    expect(eu(iniciarRodada(e, ctx)).pronto).toBe(false);
  });
});

describe("comprar", () => {
  it("tira o elixir, esvazia a carta e põe a unidade no banco", () => {
    const e = com(nova(), { loja: ["lamina", "ancora", "canhoneiro"], elixir: 10 });
    const r = ok(e, { tipo: "comprar", jogador: 0, carta: 1 });
    const j = eu(r.estado);
    expect(j.elixir).toBe(10 - personagem("ancora").custo);
    expect(j.loja).toEqual(["lamina", null, "canhoneiro"]);
    expect(j.banco).toEqual([u(e.proximoId, "ancora")]);
    expect(r.estado.proximoId).toBe(e.proximoId + 1);
    expect(eu(e).banco).toEqual([]); // o estado antigo não mudou
  });

  it("inválidos: carta vazia, índice fora, sem elixir, banco cheio, jogador errado", () => {
    const e = com(nova(), { loja: ["lamina", null, "ancora"], elixir: 4 }); // dá para a Lâmina (4), não para a Âncora (5)
    expect(erro(e, { tipo: "comprar", jogador: 0, carta: 1 })).toBe("carta_invalida");
    expect(erro(e, { tipo: "comprar", jogador: 0, carta: 7 })).toBe("carta_invalida");
    expect(erro(e, { tipo: "comprar", jogador: 0, carta: -1 })).toBe("carta_invalida");
    expect(erro(e, { tipo: "comprar", jogador: 0, carta: 2 })).toBe("elixir_insuficiente");
    expect(erro(e, { tipo: "comprar", jogador: 3, carta: 0 })).toBe("jogador_invalido");
    expect(erro(e, { tipo: "comprar", jogador: 0.5, carta: 0 })).toBe("jogador_invalido");
    // banco cheio de unidades que não se fundem entre si nem com a carta comprada
    const banco = [1, 2, 3, 4].map((n) => u(100 + n, "canhoneiro", n));
    while (banco.length < config.tamanhoBanco)
      banco.push(u(200 + banco.length, "ancora", banco.length - 3));
    const cheio = com(e, { banco });
    expect(erro(cheio, { tipo: "comprar", jogador: 0, carta: 0 })).toBe("banco_cheio");
  });

  it("com o banco cheio, ainda dá para comprar se a compra fundir", () => {
    const banco = [
      u(100, "lamina"),
      ...Array.from({ length: config.tamanhoBanco - 1 }, (_, i) => u(101 + i, "ancora", 4)),
    ];
    const e = com(nova(), { loja: ["lamina", null, null], elixir: 5, banco });
    const r = ok(e, { tipo: "comprar", jogador: 0, carta: 0 });
    expect(eu(r.estado).banco).toHaveLength(config.tamanhoBanco);
    expect(eu(r.estado).banco[0]).toEqual(u(100, "lamina", 2));
  });
});

describe("fusão", () => {
  it("dois iguais do mesmo nível viram um de nível maior", () => {
    const e = com(nova(), { loja: ["lamina", null, null], elixir: 9, banco: [u(50, "lamina")] });
    const r = ok(e, { tipo: "comprar", jogador: 0, carta: 0 });
    expect(eu(r.estado).banco).toEqual([u(50, "lamina", 2)]);
    expect(r.fusoes).toEqual([{ personagem: "lamina", nivel: 2, unidade: 50 }]);
  });

  it("funde em cadeia: 1+1 vira 2, que com outro 2 vira 3", () => {
    const e = com(nova(), {
      loja: ["lamina", null, null],
      elixir: 9,
      banco: [u(50, "lamina"), u(51, "lamina", 2)],
    });
    const r = ok(e, { tipo: "comprar", jogador: 0, carta: 0 });
    expect(eu(r.estado).banco.map((x) => x.nivel)).toEqual([3]);
    expect(r.fusoes.map((f) => f.nivel)).toEqual([2, 3]);
  });

  it("quem está em campo é quem fica, no mesmo ponto", () => {
    const e = com(nova(), {
      loja: ["lamina", null, null],
      elixir: 9,
      campo: [{ unidade: u(50, "lamina"), ponto: 3 }],
    });
    const j = eu(ok(e, { tipo: "comprar", jogador: 0, carta: 0 }).estado);
    expect(j.banco).toEqual([]);
    expect(j.campo).toEqual([{ unidade: u(50, "lamina", 2), ponto: 3 }]);
  });

  it("não funde personagens diferentes, níveis diferentes, nem o nível máximo", () => {
    const max = config.nivelMaximo;
    const e = com(nova(), {
      loja: ["lamina", "ancora", null],
      elixir: 20,
      banco: [u(50, "lamina", 2), u(51, "ancora", max), u(52, "ancora", max)],
    });
    const r1 = ok(e, { tipo: "comprar", jogador: 0, carta: 0 });
    expect(r1.fusoes).toEqual([]);
    expect(eu(r1.estado).banco).toHaveLength(4);
    expect(eu(r1.estado).banco.filter((x) => x.personagem === "ancora")).toHaveLength(2);
  });

  it("nível maior tem mais dano e mais peso, e é mais difícil de arremessar", () => {
    const base = personagem("lamina");
    const n3 = aplicarNivel(base, 3, config);
    expect(aplicarNivel(base, 1, config)).toBe(base);
    expect(n3.ataque.dano).toBeCloseTo(base.ataque.dano * (config.multiplicadores.dano[2] ?? 0));
    expect(n3.peso).toBeGreaterThan(base.peso);
    expect(n3.altura).toBeGreaterThan(base.altura);
    // Na prática: nível 3 contra nível 1 vence quase sempre.
    let vitorias = 0;
    for (let s = 1; s <= 40; s++) {
      const fim = simularCombate(
        criarCombate(arena, [[{ def: n3, x: 380, y: 520 }], [{ def: base, x: 820, y: 520 }]], s),
      ).fim;
      if (fim?.vencedor === 0) vitorias++;
    }
    expect(vitorias).toBeGreaterThan(34);
  });
});

describe("vender", () => {
  it("devolve o elixir e as cartas para o baralho; vale para banco e campo", () => {
    const e = com(nova(), {
      elixir: 0,
      banco: [u(50, "ancora")],
      campo: [{ unidade: u(51, "lamina", 3), ponto: 0 }],
    });
    const antes = e.baralho["lamina"] ?? 0;
    const r1 = ok(e, { tipo: "vender", jogador: 0, unidade: 50 });
    expect(eu(r1.estado).elixir).toBe(personagem("ancora").custo);
    expect(eu(r1.estado).banco).toEqual([]);
    const r2 = ok(r1.estado, { tipo: "vender", jogador: 0, unidade: 51 });
    expect(eu(r2.estado).campo).toEqual([]);
    expect(r2.estado.baralho["lamina"]).toBe(antes + 4);
    expect(valorDeVenda(ctx, u(51, "lamina", 3))).toBe(
      Math.floor(personagem("lamina").custo * 4 * config.reembolsoNiveisMaiores),
    );
  });

  it("o elixir da venda respeita o teto", () => {
    const e = com(nova(), { elixir: config.tetoElixir, banco: [u(50, "ancora")] });
    expect(eu(ok(e, { tipo: "vender", jogador: 0, unidade: 50 }).estado).elixir).toBe(
      config.tetoElixir,
    );
  });

  it("inválido: unidade que não existe", () => {
    expect(erro(nova(), { tipo: "vender", jogador: 0, unidade: 999 })).toBe("unidade_invalida");
  });
});

describe("atualizar a loja", () => {
  it("cobra elixir e sorteia cartas novas, sem criar nem perder cartas", () => {
    const e = nova(3);
    const r = ok(e, { tipo: "atualizar", jogador: 0 });
    expect(eu(r.estado).elixir).toBe(eu(e).elixir - config.custoAtualizar);
    expect(eu(r.estado).loja).toHaveLength(config.tamanhoLoja);
    expect(r.estado.rng).not.toEqual(e.rng);
    for (const p of ctx.personagens) {
      expect(cartasNoJogo(r.estado, p.id)).toBe(config.copiasPorPersonagem);
    }
  });

  it("inválido: sem elixir", () => {
    expect(erro(com(nova(), { elixir: 0 }), { tipo: "atualizar", jogador: 0 })).toBe(
      "elixir_insuficiente",
    );
  });

  it("inválido: baralho vazio", () => {
    const vazio = Object.fromEntries(ctx.personagens.map((p) => [p.id, 0]));
    const e = com(nova(), { loja: [null, null, null], elixir: 5 }, { baralho: vazio });
    expect(erro(e, { tipo: "atualizar", jogador: 0 })).toBe("baralho_vazio");
  });
});

describe("posicionar e recolher", () => {
  const base = () =>
    com(nova(), { banco: [u(50, "lamina"), u(51, "ancora"), u(52, "canhoneiro")] }, { rodada: 1 });

  it("leva do banco para um ponto livre", () => {
    const j = eu(ok(base(), { tipo: "posicionar", jogador: 0, unidade: 51, ponto: 4 }).estado);
    expect(j.campo).toEqual([{ unidade: u(51, "ancora"), ponto: 4 }]);
    expect(j.banco.map((x) => x.id)).toEqual([50, 52]);
  });

  it("respeita o limite de campo da rodada", () => {
    let e = base();
    expect(limiteDeCampo(config, 1)).toBe(2);
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 0 }).estado;
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 51, ponto: 1 }).estado;
    expect(erro(e, { tipo: "posicionar", jogador: 0, unidade: 52, ponto: 2 })).toBe("campo_cheio");
    // Em uma rodada mais adiante cabe mais gente.
    expect(
      erro({ ...e, rodada: 3 }, { tipo: "posicionar", jogador: 0, unidade: 52, ponto: 2 }),
    ).toBeNull();
  });

  it("ponto ocupado: quem vem do banco troca de lugar com quem estava lá, mesmo com o campo cheio", () => {
    let e = base();
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 0 }).estado;
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 51, ponto: 1 }).estado;
    const j = eu(ok(e, { tipo: "posicionar", jogador: 0, unidade: 52, ponto: 1 }).estado);
    expect(j.campo.find((c) => c.ponto === 1)?.unidade.id).toBe(52);
    expect(j.banco.map((x) => x.id)).toEqual([51]);
    expect(j.campo).toHaveLength(2);
  });

  it("dentro do campo: muda de ponto, ou troca com quem está no destino", () => {
    let e = base();
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 0 }).estado;
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 51, ponto: 1 }).estado;
    const movido = eu(ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 5 }).estado);
    expect(movido.campo.find((c) => c.unidade.id === 50)?.ponto).toBe(5);
    const trocado = eu(ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 1 }).estado);
    expect(trocado.campo.find((c) => c.unidade.id === 50)?.ponto).toBe(1);
    expect(trocado.campo.find((c) => c.unidade.id === 51)?.ponto).toBe(0);
  });

  it("inválidos: ponto que não existe, unidade que não existe", () => {
    const e = base();
    for (const ponto of [-1, ctx.pontos, 2.5, Number.NaN]) {
      expect(erro(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto })).toBe(
        "ponto_invalido",
      );
    }
    expect(erro(e, { tipo: "posicionar", jogador: 0, unidade: 999, ponto: 0 })).toBe(
      "unidade_invalida",
    );
  });

  it("recolher devolve ao banco; inválido se não está em campo, não existe ou o banco está cheio", () => {
    let e = base();
    e = ok(e, { tipo: "posicionar", jogador: 0, unidade: 50, ponto: 0 }).estado;
    const j = eu(ok(e, { tipo: "recolher", jogador: 0, unidade: 50 }).estado);
    expect(j.campo).toEqual([]);
    expect(j.banco.map((x) => x.id)).toEqual([51, 52, 50]);
    expect(erro(e, { tipo: "recolher", jogador: 0, unidade: 51 })).toBe("fora_do_campo");
    expect(erro(e, { tipo: "recolher", jogador: 0, unidade: 999 })).toBe("unidade_invalida");
    const cheio = com(e, {
      banco: Array.from({ length: config.tamanhoBanco }, (_, i) =>
        u(200 + i, "sombra", (i % 4) + 1),
      ),
    });
    expect(erro(cheio, { tipo: "recolher", jogador: 0, unidade: 50 })).toBe("banco_cheio");
  });
});

describe("do campo para o combate", () => {
  it("monta o esquadrão nos pontos da arena, espelhado no lado direito e com os níveis", () => {
    const e = com(nova(), {
      campo: [
        { unidade: u(50, "ancora", 2), ponto: 4 },
        { unidade: u(51, "canhoneiro"), ponto: 0 },
      ],
    });
    const p0 = arena.pontos[0];
    const p4 = arena.pontos[4];
    if (!p0 || !p4) throw new Error("arena sem pontos");
    const esq = montarEsquadrao(eu(e), ctx, arena, 0);
    expect(esq.map((v) => [v.def.id, v.x, v.y, v.nivel])).toEqual([
      ["ancora", p4.x, p4.y, 2],
      ["canhoneiro", p0.x, p0.y, 1],
    ]);
    expect(esq[0]?.def.peso).toBeGreaterThan(personagem("ancora").peso);
    const dir = montarEsquadrao(eu(e), ctx, arena, 1);
    expect(dir[0]?.x).toBe(arena.chao.x * 2 + arena.chao.largura - p4.x);
    const combate = criarCombate(arena, [esq, dir], 1);
    expect(combate.lutadores.map((l) => l.nivel)).toEqual([2, 1, 2, 1]);
  });
});

describe("partida de vários comandos", () => {
  it("nenhuma carta é criada ou perdida depois de comprar, vender e atualizar muitas vezes", () => {
    let e = nova(11);
    let rng = 12345;
    const sorteio = (n: number) => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng % n;
    };
    for (let i = 0; i < 400; i++) {
      const j = eu(e);
      const todas = [...j.banco, ...j.campo.map((c) => c.unidade)];
      const opcoes: Comando[] = [
        { tipo: "comprar", jogador: 0, carta: sorteio(3) },
        { tipo: "atualizar", jogador: 0 },
        {
          tipo: "vender",
          jogador: 0,
          unidade: todas[sorteio(Math.max(1, todas.length))]?.id ?? -1,
        },
        {
          tipo: "posicionar",
          jogador: 0,
          unidade: todas[sorteio(Math.max(1, todas.length))]?.id ?? -1,
          ponto: sorteio(ctx.pontos),
        },
      ];
      const comando = opcoes[sorteio(opcoes.length)];
      if (!comando) continue;
      const r = aplicar(e, ctx, comando);
      if (r.ok) e = r.estado;
      if (i % 40 === 39) e = iniciarRodada(e, ctx);
      for (const p of ctx.personagens)
        expect(cartasNoJogo(e, p.id)).toBe(config.copiasPorPersonagem);
      expect(eu(e).elixir).toBeGreaterThanOrEqual(0);
      expect(eu(e).elixir).toBeLessThanOrEqual(config.tetoElixir);
      expect(eu(e).banco.length).toBeLessThanOrEqual(config.tamanhoBanco);
      expect(eu(e).campo.length).toBeLessThanOrEqual(limiteDeCampo(config, e.rodada));
      expect(new Set(eu(e).campo.map((c) => c.ponto)).size).toBe(eu(e).campo.length);
    }
  });
});
