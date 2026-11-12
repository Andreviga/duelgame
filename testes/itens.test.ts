import { describe, expect, it } from "vitest";
import { ARENA_BASICA as arena, CONTEXTO, ITENS, PARTIDA, personagem } from "../src/dados";
import { criarCombate, simularCombate, stepCombate } from "../src/sim/combate/combate";
import { decidir } from "../src/sim/combate/ia";
import type { EstadoCombate, Evento, Item, Lutador, TipoItem } from "../src/sim/combate/tipos";
import { combater, criarPartida } from "../src/sim/partida/partida";

const lamina = personagem("lamina");
const ancora = personagem("ancora");
const CHAO = arena.chao.y;

/** Combate com itens ligados, todos no chão e sem poder agir por conta própria, salvo `livres`. */
function cena(
  posicoes: readonly [number, number],
  itens: Partial<Item>[] = [],
  ajuste?: (l: Lutador) => void,
): EstadoCombate {
  const e = criarCombate(
    arena,
    [[{ def: lamina, x: posicoes[0], y: CHAO }], [{ def: ancora, x: posicoes[1], y: CHAO }]],
    5,
    // sem itens novos caindo durante o teste
    { ...ITENS, primeiro: 1_000_000 },
  );
  return {
    ...e,
    lutadores: e.lutadores.map((l) => {
      const copia: Lutador = { ...l, noChao: true, recarga: 100_000, habRecarga: 100_000 };
      ajuste?.(copia);
      return copia;
    }),
    itens: itens.map((i, k) => ({
      id: k,
      tipo: "fruta",
      x: 0,
      y: CHAO,
      vy: 0,
      noChao: true,
      vida: 600,
      pavio: 0,
      raio: 0,
      ...i,
    })),
    proximoItem: itens.length,
  };
}

function avancar(inicial: EstadoCombate, ticks: number) {
  let e = inicial;
  const vistos: Evento[] = [];
  for (let i = 0; i < ticks; i++) {
    e = stepCombate(e);
    vistos.push(...e.eventos);
  }
  return { e, vistos };
}

const pegou = (tipo: TipoItem) => (ev: Evento) => ev.tipo === "item" && ev.item === tipo;

describe("itens desligados (o padrão)", () => {
  it("nenhum item nasce e o combate dá o mesmo resultado de antes", () => {
    const esquadroes: Parameters<typeof criarCombate>[1] = [
      [{ def: lamina, x: 380, y: CHAO }],
      [{ def: ancora, x: 820, y: CHAO }],
    ];
    const sem = criarCombate(arena, esquadroes, 9);
    expect(sem.configItens).toBeNull();
    const { e, vistos } = avancar(sem, 900);
    expect(e.itens).toEqual([]);
    expect(vistos.some((ev) => ev.tipo === "item_caiu")).toBe(false);
    // ligar os itens muda a luta; desligados, a semente dá sempre a mesma
    expect(simularCombate(criarCombate(arena, esquadroes, 9))).toEqual(
      simularCombate(criarCombate(arena, esquadroes, 9, null)),
    );
  });

  it("uma partida criada sem itens não tem regras de item", () => {
    const bots = [0, 1, 2, 3].map((i) => ({ nome: `Bot ${i}`, bot: "facil" as const }));
    expect(criarPartida(CONTEXTO, PARTIDA, "todos", bots, 3).itens).toBeNull();
    const com = criarPartida(CONTEXTO, PARTIDA, "todos", bots, 3, ["arena-basica"], ITENS);
    expect(com.itens).toBe(ITENS);
    // e a rodada com itens roda até o fim, igual nas duas vezes
    const a = combater(com, CONTEXTO, PARTIDA, arena);
    const b = combater(com, CONTEXTO, PARTIDA, arena);
    expect(a.resultados).toEqual(b.resultados);
    expect(a.resultados.length).toBeGreaterThan(0);
  });
});

describe("itens de arena", () => {
  it("o primeiro cai no tick marcado, dentro do chão, e pousa na primeira superfície abaixo", () => {
    const esquadroes: Parameters<typeof criarCombate>[1] = [
      [{ def: lamina, x: 380, y: CHAO }],
      [{ def: ancora, x: 820, y: CHAO }],
    ];
    const antes = avancar(criarCombate(arena, esquadroes, 4, ITENS), ITENS.primeiro - 1);
    expect(antes.e.itens).toEqual([]);
    const { e, vistos } = avancar(antes.e, 1);
    expect(vistos.filter((ev) => ev.tipo === "item_caiu")).toHaveLength(1);
    const item = e.itens[0];
    if (!item) throw new Error("sem item");
    expect(item.x).toBeGreaterThan(arena.chao.x);
    expect(item.x).toBeLessThan(arena.chao.x + arena.chao.largura);
    expect(item.noChao).toBe(false);

    // a mesma semente dá o mesmo item, no mesmo lugar
    const outra = avancar(criarCombate(arena, esquadroes, 4, ITENS), ITENS.primeiro).e.itens[0];
    expect(outra).toEqual(item);

    // cai sozinho até pousar (parado, sem ninguém por perto para pegar)
    const parado: EstadoCombate = {
      ...e,
      lutadores: e.lutadores.map((l) => ({
        ...l,
        x: l.lado === 0 ? 215 : 985,
        atordoado: 100_000,
      })),
    };
    const pousado = avancar(parado, 120).e.itens[0];
    const superficies = [arena.chao, ...arena.plataformas]
      .filter((s) => item.x >= s.x && item.x <= s.x + s.largura)
      .map((s) => s.y);
    expect(pousado?.noChao).toBe(true);
    expect(pousado?.y).toBe(Math.min(...superficies));
  });

  it("nunca há mais itens na arena que o máximo, e item esquecido some", () => {
    const esquadroes: Parameters<typeof criarCombate>[1] = [
      [{ def: lamina, x: 215, y: CHAO }],
      [{ def: ancora, x: 985, y: CHAO }],
    ];
    const cfg = { ...ITENS, primeiro: 10, intervalo: 20, vida: 200 };
    let e = criarCombate(arena, esquadroes, 4, cfg);
    e = { ...e, lutadores: e.lutadores.map((l) => ({ ...l, noChao: true, atordoado: 100_000 })) };
    let maior = 0;
    let nascidos = 0;
    for (let i = 0; i < 600; i++) {
      e = stepCombate(e);
      maior = Math.max(maior, e.itens.length);
      nascidos += e.eventos.filter((ev) => ev.tipo === "item_caiu").length;
    }
    expect(maior).toBe(cfg.maximo);
    // nasceram mais do que cabem: os antigos sumiram para dar lugar
    expect(nascidos).toBeGreaterThan(cfg.maximo);
  });

  it("fruta: quem encosta pega, e a % cai (sem passar de zero)", () => {
    const comDano = cena([400, 900], [{ tipo: "fruta", x: 400 }], (l) => {
      if (l.id === 0) l.dano = 60;
    });
    const r = avancar(comDano, 1);
    expect(r.vistos.some(pegou("fruta"))).toBe(true);
    expect(r.e.lutadores[0]?.dano).toBe(60 - ITENS.cura);
    expect(r.e.itens).toEqual([]);

    const quaseZero = cena([400, 900], [{ tipo: "fruta", x: 400 }], (l) => {
      if (l.id === 0) l.dano = 10;
    });
    expect(avancar(quaseZero, 1).e.lutadores[0]?.dano).toBe(0);
  });

  it("quem está atordoado não pega item", () => {
    const e = cena([400, 900], [{ tipo: "fruta", x: 400 }], (l) => {
      if (l.id === 0) l.atordoado = 50;
    });
    const r = avancar(e, 10);
    expect(r.vistos.some(pegou("fruta"))).toBe(false);
    expect(r.e.itens).toHaveLength(1);
  });

  it("mola: lança para cima quem pisa", () => {
    const r = avancar(cena([400, 900], [{ tipo: "mola", x: 400 }]), 1);
    expect(r.vistos.some(pegou("mola"))).toBe(true);
    expect(r.e.lutadores[0]?.vy).toBeLessThan(-ITENS.impulsoMola + 2);
    expect(r.e.lutadores[0]?.noChao).toBe(false);
  });

  /** O Âncora (id 1) dá um golpe no Lâmina (id 0), que está colado à esquerda dele. */
  const golpeNoLamina = (item: TipoItem | null, quemPega: 0 | 1) =>
    avancar(
      cena([560, 620], item ? [{ tipo: item, x: quemPega === 0 ? 560 : 620 }] : [], (l) => {
        if (l.id === 1) {
          l.direcao = -1;
          l.recarga = 0;
        }
      }),
      60,
    );
  const primeiroGolpe = (vistos: Evento[]) => {
    const g = vistos.find((ev) => ev.tipo === "golpe");
    if (g?.tipo !== "golpe") throw new Error("ninguém bateu");
    return g;
  };

  it("escudo: por um tempo, quem pegou leva só parte do dano e não é arremessado", () => {
    const normal = primeiroGolpe(golpeNoLamina(null, 0).vistos);
    expect(normal.forca).toBeGreaterThan(0);
    const r = golpeNoLamina("escudo", 0);
    expect(r.vistos.some(pegou("escudo"))).toBe(true);
    const protegido = primeiroGolpe(r.vistos);
    expect(protegido.alvo).toBe(0);
    expect(protegido.forca).toBe(0);
    // e o escudo acaba
    const depois = avancar(cena([400, 900], [{ tipo: "escudo", x: 400 }]), ITENS.ticksEscudo + 2);
    expect(depois.e.lutadores[0]?.escudo).toBe(0);
  });

  it("martelo: o próximo golpe de quem pegou arremessa mais, e o martelo se gasta", () => {
    const normal = primeiroGolpe(golpeNoLamina(null, 1).vistos);
    const r = golpeNoLamina("martelo", 1);
    expect(r.vistos.some(pegou("martelo"))).toBe(true);
    const forte = primeiroGolpe(r.vistos);
    expect(forte.atacante).toBe(1);
    // a força tem uma variação pequena de dano por golpe; o martelo é bem maior que ela
    expect(forte.forca / normal.forca).toBeGreaterThan(ITENS.multiplicadorMartelo * 0.9);
    expect(r.e.lutadores[1]?.martelo).toBe(0);
  });

  it("bomba: ninguém pega; estoura sozinha e arremessa quem está perto, dos dois lados", () => {
    const bomba = { tipo: "bomba" as const, x: 600, pavio: 20, raio: ITENS.bomba.raio };
    const inicial: EstadoCombate = {
      ...cena([560, 640], [bomba]),
    };
    // um terceiro lutador, longe, não é atingido
    const comLonge: EstadoCombate = {
      ...inicial,
      lutadores: [
        ...inicial.lutadores,
        { ...(inicial.lutadores[1] as Lutador), id: 2, x: 600 + ITENS.bomba.raio + 120 },
      ],
    };
    const antes = avancar(comLonge, 19);
    expect(antes.vistos.some((ev) => ev.tipo === "item" || ev.tipo === "bomba")).toBe(false);
    expect(antes.e.itens).toHaveLength(1);

    const { e, vistos } = avancar(antes.e, 1);
    expect(vistos.some((ev) => ev.tipo === "bomba")).toBe(true);
    const golpes = vistos.flatMap((ev) => (ev.tipo === "golpe" ? [ev] : []));
    expect(golpes.map((g) => g.alvo).sort()).toEqual([0, 1]);
    expect(golpes.every((g) => g.atacante === -1)).toBe(true);
    // cada um vai para o seu lado, e ninguém leva o crédito
    expect(e.lutadores[0]?.vx).toBeLessThan(0);
    expect(e.lutadores[1]?.vx).toBeGreaterThan(0);
    expect(e.lutadores[0]?.ultimoAtacante).toBeNull();
    expect(e.itens).toEqual([]);
  });
});

describe("a IA e os itens", () => {
  const base = (itens: Partial<Item>[], ajuste?: (l: Lutador) => void) => {
    const e = cena([500, 900], itens, ajuste);
    const eu = e.lutadores[0];
    if (!eu) throw new Error("sem lutador");
    return decidir(eu, e.lutadores, arena, 0.5, [], e.itens);
  };

  it("foge de uma bomba prestes a estourar", () => {
    const bomba = { tipo: "bomba" as const, pavio: 40, raio: ITENS.bomba.raio };
    const aDireita = base([{ ...bomba, x: 560 }]);
    expect(aDireita.ia).toBe("recuar");
    expect(aDireita.entrada.mover).toBe(-1);
    expect(base([{ ...bomba, x: 440 }]).entrada.mover).toBe(1);
    // com pavio longo, ou longe dela, segue a vida
    expect(base([{ ...bomba, x: 560, pavio: 400 }]).ia).not.toBe("recuar");
    expect(base([{ ...bomba, x: 560 + ITENS.bomba.raio + 100 }]).ia).not.toBe("recuar");
  });

  it("desvia para pegar um item útil que esteja mais perto que o inimigo", () => {
    const escudo = base([{ tipo: "escudo", x: 400 }]);
    expect(escudo.ia).toBe("item");
    expect(escudo.entrada.mover).toBe(-1);
    expect(base([{ tipo: "martelo", x: 620 }]).entrada.mover).toBe(1);
  });

  it("não vai atrás de fruta sem dano, de martelo que já tem, de mola, nem de item longe ou em outro andar", () => {
    expect(base([{ tipo: "fruta", x: 400 }]).ia).not.toBe("item");
    expect(
      base([{ tipo: "fruta", x: 400 }], (l) => {
        if (l.id === 0) l.dano = 50;
      }).ia,
    ).toBe("item");
    expect(
      base([{ tipo: "martelo", x: 400 }], (l) => {
        if (l.id === 0) l.martelo = 1.8;
      }).ia,
    ).not.toBe("item");
    expect(base([{ tipo: "mola", x: 400 }]).ia).not.toBe("item");
    expect(base([{ tipo: "escudo", x: 220 }]).ia).not.toBe("item");
    expect(base([{ tipo: "escudo", x: 400, y: CHAO - 120 }]).ia).not.toBe("item");
  });
});
