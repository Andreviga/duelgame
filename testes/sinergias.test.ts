import { describe, expect, it } from "vitest";
import {
  ARENA_BASICA as arena,
  CONTEXTO as ctx,
  PARTIDA as cfg,
  personagem,
  PERSONAGENS,
  SINERGIAS,
} from "../src/dados";
import { criarCombate, simularCombate, stepCombate } from "../src/sim/combate/combate";
import { SEM_BONUS } from "../src/sim/combate/tipos";
import type {
  BonusDeCombate,
  DefPersonagem,
  EstadoCombate,
  Evento,
  Lutador,
  Vaga,
} from "../src/sim/combate/tipos";
import { montarEsquadrao, sinergiasDoJogador } from "../src/sim/economia/economia";
import { aplicarSinergias, elixirAoVencer, sinergiasEmCampo } from "../src/sim/economia/sinergias";
import type { DefSinergia } from "../src/sim/economia/sinergias";
import type { EstadoJogador } from "../src/sim/economia/tipos";
import { combater, comEconomia, concluirRodada, criarPartida } from "../src/sim/partida/partida";

const p = (id: string): DefPersonagem => personagem(id);
/** Efeitos de um degrau, lidos do JSON: balancear muda os números, não os testes. */
const ef = (grupo: "mundos" | "papeis", chave: string, degrau: 0 | 1): Record<string, number> => {
  const definicoes: Record<string, DefSinergia | undefined> = { ...SINERGIAS[grupo] };
  const efeitos = definicoes[chave]?.niveis[degrau]?.efeitos ?? {};
  return Object.fromEntries(
    Object.entries(efeitos).flatMap(([k, v]) => (typeof v === "number" ? [[k, v]] : [])),
  );
};
const CHAO = arena.chao.y;
const ativas = (...ids: string[]) => sinergiasEmCampo(ids.map(p), SINERGIAS);
const com = (id: string, ...time: string[]) =>
  aplicarSinergias(p(id), ativas(id, ...time), SINERGIAS);
const campoDe = (...ids: string[]): EstadoJogador => ({
  elixir: 0,
  loja: [],
  banco: [],
  pronto: true,
  campo: ids.map((id, i) => ({ unidade: { id: i + 1, personagem: id, nivel: 1 }, ponto: i })),
});

/** Combate montado à mão, com todos no chão; `bonecos` ficam atordoados (alvos parados). */
function cena(
  a: Vaga[],
  b: Vaga[],
  bonecos: number[] = [],
  ajuste?: (l: Lutador) => void,
): EstadoCombate {
  const e = criarCombate(arena, [a, b], 3);
  return {
    ...e,
    lutadores: e.lutadores.map((l) => {
      const c: Lutador = { ...l, noChao: true, pulosRestantes: 2, habRecarga: 100_000 };
      if (bonecos.includes(l.id)) c.atordoado = 100_000;
      ajuste?.(c);
      return c;
    }),
  };
}
const vaga = (id: string, x: number, bonus: Partial<BonusDeCombate> = {}, y = CHAO): Vaga => ({
  def: p(id),
  x,
  y,
  bonus: { ...SEM_BONUS, ...bonus },
});
function ate(inicial: EstadoCombate, condicao: (ev: Evento) => boolean, limite = 900) {
  let e = inicial;
  const vistos: Evento[] = [];
  for (let i = 0; i < limite; i++) {
    e = stepCombate(e);
    vistos.push(...e.eventos);
    if (e.eventos.some(condicao)) return { e, vistos };
  }
  throw new Error("o evento esperado não aconteceu");
}
const golpeando = (l: Lutador, direcao: -1 | 1 = 1): void => {
  l.direcao = direcao;
  l.ataque = { fase: "ativo", ticks: 3, acertou: false };
};

describe("contagem de características", () => {
  it("o elenco tem 3 personagens por mundo e 3 por papel", () => {
    for (const mundo of ["futebol", "piratas", "monstros", "dojo"]) {
      expect(PERSONAGENS.filter((d) => d.mundo === mundo)).toHaveLength(3);
    }
    for (const papel of ["corpo", "distancia", "tanque", "assassino"]) {
      expect(PERSONAGENS.filter((d) => d.papel === papel)).toHaveLength(3);
    }
    expect(PERSONAGENS.map((d) => d.custo).sort()).toEqual([2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5]);
  });

  it("um personagem sozinho não ativa nada; dois ativam o primeiro degrau; três, o segundo", () => {
    const de = (lista: ReturnType<typeof ativas>, chave: string) =>
      lista.find((s) => s.chave === chave);
    expect(de(ativas("maestro"), "futebol")).toMatchObject({ quantidade: 1, nivel: null });
    expect(de(ativas("maestro"), "futebol")?.proximo?.minimo).toBe(2);
    expect(de(ativas("maestro", "ponta"), "futebol")?.nivel?.minimo).toBe(2);
    expect(de(ativas("maestro", "ponta", "paredao"), "futebol")?.nivel?.minimo).toBe(3);
    expect(de(ativas("maestro", "ponta", "paredao"), "futebol")?.proximo).toBeNull();
  });

  it("cópias do mesmo personagem contam uma vez só", () => {
    const lista = sinergiasEmCampo([p("maestro"), p("maestro"), p("maestro")], SINERGIAS);
    expect(lista.find((s) => s.chave === "futebol")).toMatchObject({ quantidade: 1, nivel: null });
  });

  it("cada personagem conta para o mundo dele e para o papel dele", () => {
    const lista = ativas("maestro", "canhoneiro"); // futebol + piratas, os dois à distância
    expect(lista.find((s) => s.chave === "distancia")?.nivel?.minimo).toBe(2);
    expect(lista.find((s) => s.chave === "futebol")?.nivel).toBeNull();
    expect(lista.find((s) => s.chave === "piratas")?.nivel).toBeNull();
  });
});

describe("efeitos de cada sinergia", () => {
  it("Futebol 2: mais velocidade; 3: mais arremesso horizontal", () => {
    const v = ef("mundos", "futebol", 0)["velocidade"] ?? 0;
    expect(v).toBeGreaterThan(1);
    expect(com("maestro", "ponta").def.velocidade).toBeCloseTo(p("maestro").velocidade * v);
    expect(com("maestro", "ponta").bonus.arremessoHorizontal).toBe(1);
    const tres = com("maestro", "ponta", "paredao");
    expect(tres.def.velocidade).toBeCloseTo(
      p("maestro").velocidade * (ef("mundos", "futebol", 1)["velocidade"] ?? 0),
    );
    expect(tres.bonus.arremessoHorizontal).toBe(ef("mundos", "futebol", 1)["arremessoHorizontal"]);
    expect(tres.bonus.arremessoHorizontal).toBeGreaterThan(1);
  });

  it("Piratas 2: elixir ao vencer; 3: primeiro golpe mais forte", () => {
    expect(elixirAoVencer(ativas("mare", "canhoneiro"))).toBe(1);
    expect(elixirAoVencer(ativas("mare"))).toBe(0);
    expect(com("mare", "canhoneiro").bonus.primeiroGolpe).toBe(1);
    const golpe = ef("mundos", "piratas", 1)["primeiroGolpe"] ?? 0;
    expect(golpe).toBeGreaterThan(1);
    expect(com("canhoneiro", "mare", "ancora").bonus.primeiroGolpe).toBe(golpe);
    expect(elixirAoVencer(ativas("mare", "canhoneiro", "ancora"))).toBe(1);
  });

  it("Monstros 2: mais peso; 3: explode ao sair", () => {
    const peso = ef("mundos", "monstros", 0)["peso"] ?? 0;
    expect(peso).toBeGreaterThan(1);
    expect(com("brasa", "faisca").def.peso).toBeCloseTo(p("brasa").peso * peso);
    expect(com("brasa", "faisca").bonus.danoExplosao).toBe(0);
    const tres = com("brasa", "faisca", "rochedo").bonus;
    expect(tres.danoExplosao).toBe(SINERGIAS.explosao.dano);
    expect(tres.raioExplosao).toBe(SINERGIAS.explosao.raio);
  });

  it("Dojo 2: golpes mais rápidos; 3: habilidade carrega mais rápido", () => {
    const base = p("lamina");
    const ataque = ef("mundos", "dojo", 0)["velocidadeDeAtaque"] ?? 0;
    const recarga = ef("mundos", "dojo", 1)["recargaHabilidade"] ?? 0;
    expect(ataque).toBeGreaterThan(1);
    expect(recarga).toBeGreaterThan(1);
    const dois = com("lamina", "sombra").def;
    expect(dois.ataque.inicio).toBe(Math.round(base.ataque.inicio / ataque));
    expect(dois.ataque.recarga).toBe(Math.round(base.ataque.recarga / ataque));
    expect(dois.ataque.recarga).toBeLessThan(base.ataque.recarga);
    expect(dois.habilidade.recarga).toBe(base.habilidade.recarga);
    const tres = com("lamina", "sombra", "vento").def;
    expect(tres.habilidade.recarga).toBe(Math.round(base.habilidade.recarga / recarga));
    expect(tres.habilidade.recarga).toBeLessThan(base.habilidade.recarga);
  });

  it("Corpo a corpo 2 e 3: mais dano, no golpe e na habilidade", () => {
    const base = p("lamina").ataque.dano;
    const d2 = ef("papeis", "corpo", 0)["dano"] ?? 0;
    const d3 = ef("papeis", "corpo", 1)["dano"] ?? 0;
    expect(d3).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(1);
    expect(com("lamina", "mare").def.ataque.dano).toBeCloseTo(base * d2);
    expect(com("lamina", "mare", "brasa").def.ataque.dano).toBeCloseTo(base * d3);
    expect(com("lamina", "mare").def.habilidade.dano).toBeCloseTo(p("lamina").habilidade.dano * d2);
  });

  it("À distância 2: mais alcance; 3: projéteis atravessam", () => {
    const alcance = ef("papeis", "distancia", 0)["alcance"] ?? 0;
    expect(alcance).toBeGreaterThan(1);
    expect(com("maestro", "canhoneiro").def.ataque.alcance).toBeCloseTo(
      p("maestro").ataque.alcance * alcance,
    );
    expect(com("maestro", "canhoneiro").bonus.perfura).toBe(false);
    expect(com("maestro", "canhoneiro", "vento").bonus.perfura).toBe(true);
  });

  it("Tanque 2 e 3: o time inteiro fica protegido perto de um tanque", () => {
    // o bônus do tanque é para os vizinhos: vale também para quem não é tanque
    const p2 = ef("papeis", "tanque", 0)["protecaoVizinhos"] ?? 0;
    const p3 = ef("papeis", "tanque", 1)["protecaoVizinhos"] ?? 0;
    expect(p3).toBeGreaterThan(p2);
    const vizinho = aplicarSinergias(
      p("lamina"),
      ativas("lamina", "paredao", "ancora"),
      SINERGIAS,
    ).bonus;
    expect(vizinho.protecaoVizinhos).toBe(p2);
    expect(vizinho.raioVizinho).toBe(SINERGIAS.raioVizinho);
    const tres = aplicarSinergias(
      p("lamina"),
      ativas("lamina", "paredao", "ancora", "rochedo"),
      SINERGIAS,
    );
    expect(tres.bonus.protecaoVizinhos).toBe(p3);
    expect(
      aplicarSinergias(p("lamina"), ativas("lamina", "paredao"), SINERGIAS).bonus.protecaoVizinhos,
    ).toBe(0);
  });

  it("Assassino 2: primeiro ataque crítico; 3: invisibilidade", () => {
    expect(com("sombra", "ponta").bonus.primeiroGolpe).toBe(SINERGIAS.multiplicadorCritico);
    expect(com("sombra", "ponta").bonus.ticksInvisivel).toBe(0);
    expect(com("sombra", "ponta", "faisca").bonus.ticksInvisivel).toBe(SINERGIAS.ticksInvisivel);
  });

  it("os bônus de mundo e de papel só valem para quem tem a característica", () => {
    const time = ativas("maestro", "ponta", "lamina"); // 2 de futebol + 1 do dojo
    const lamina = aplicarSinergias(p("lamina"), time, SINERGIAS);
    expect(lamina.def).toEqual(p("lamina"));
    expect(lamina.bonus).toEqual(SEM_BONUS);
  });

  it("mundo e papel se somam no mesmo personagem", () => {
    // Capitã Maré é pirata e corpo a corpo: com 3 piratas e 2 de corpo a corpo, leva os dois bônus.
    const maré = aplicarSinergias(
      p("mare"),
      ativas("mare", "canhoneiro", "ancora", "lamina"),
      SINERGIAS,
    );
    expect(maré.bonus.primeiroGolpe).toBe(ef("mundos", "piratas", 1)["primeiroGolpe"]);
    expect(maré.def.ataque.dano).toBeCloseTo(
      p("mare").ataque.dano * (ef("papeis", "corpo", 0)["dano"] ?? 0),
    );
  });
});

describe("mecânicas de sinergia no combate", () => {
  it("primeiro golpe com bônus: só o primeiro golpe da rodada sai mais forte, e é marcado como crítico", () => {
    const inicial = cena(
      [vaga("lamina", 500, { primeiroGolpe: 2 })],
      [vaga("ancora", 550)],
      [1],
      (l) => {
        if (l.id === 0) golpeando(l);
      },
    );
    const e1 = stepCombate(inicial);
    const g1 = e1.eventos.find((ev) => ev.tipo === "golpe");
    expect(g1?.tipo === "golpe" && g1.critico).toBe(true);
    const dano1 = e1.lutadores[1]?.dano ?? 0;
    expect(dano1).toBeGreaterThan(p("lamina").ataque.dano * 2 * 0.89);
    expect(e1.lutadores[0]?.golpes).toBe(1);
    // segundo golpe, no mesmo alvo recolocado na frente
    const de = {
      ...e1,
      lutadores: e1.lutadores.map((l) =>
        l.id === 0
          ? { ...l, ataque: { fase: "ativo" as const, ticks: 3, acertou: false } }
          : { ...l, x: 550, y: CHAO, vx: 0, vy: 0 },
      ),
    };
    const e2 = stepCombate(de);
    const g2 = e2.eventos.find((ev) => ev.tipo === "golpe");
    expect(g2?.tipo === "golpe" && g2.critico).toBe(false);
    expect((e2.lutadores[1]?.dano ?? 0) - dano1).toBeLessThan(p("lamina").ataque.dano * 1.11);
  });

  it("arremesso horizontal: o alvo sai mais rápido para o lado, com a mesma altura", () => {
    const lancar = (bonus: Partial<BonusDeCombate>) =>
      stepCombate(
        cena([vaga("lamina", 500, bonus)], [vaga("lamina", 550)], [1], (l) => {
          if (l.id === 0) golpeando(l);
        }),
      ).lutadores[1];
    const normal = lancar({});
    const forte = lancar({ arremessoHorizontal: 1.2 });
    expect(forte?.vx).toBeCloseTo((normal?.vx ?? 0) * 1.2);
    expect(forte?.vy).toBeCloseTo(normal?.vy ?? 0);
  });

  it("projétil que atravessa: acerta dois inimigos em fila; sem o bônus, só o primeiro", () => {
    const atirar = (bonus: Partial<BonusDeCombate>) => {
      const inicial = cena(
        [vaga("canhoneiro", 300, bonus)],
        [vaga("ancora", 520), vaga("ancora", 640)],
        [1, 2],
      );
      const tiro = ate(inicial, (ev) => ev.tipo === "tiro");
      // deixa só esse projétil voar
      let e: EstadoCombate = {
        ...tiro.e,
        lutadores: tiro.e.lutadores.map((l) => (l.id === 0 ? { ...l, recarga: 100_000 } : l)),
      };
      const atingidos = new Set<number>();
      for (let i = 0; i < 80; i++) {
        e = stepCombate(e);
        for (const ev of e.eventos)
          if (ev.tipo === "golpe" && ev.atacante === 0) atingidos.add(ev.alvo);
      }
      return [...atingidos].sort();
    };
    expect(atirar({})).toEqual([1]);
    expect(atirar({ perfura: true })).toEqual([1, 2]);
  });

  it("proteção de tanque: perto de um tanque aliado o arremesso é menor; longe, não", () => {
    const protecao = { protecaoVizinhos: 0.25, raioVizinho: 150 };
    const forca = (xDoTanque: number) => {
      const inicial = cena(
        [vaga("lamina", 500)],
        [vaga("lamina", 550, protecao), vaga("ancora", xDoTanque, protecao)],
        [1, 2],
        (l) => {
          if (l.id === 0) golpeando(l);
        },
      );
      const g = stepCombate(inicial).eventos.find((ev) => ev.tipo === "golpe" && ev.alvo === 1);
      return g?.tipo === "golpe" ? g.forca : 0;
    };
    const longe = forca(950);
    const perto = forca(640);
    expect(perto).toBeCloseTo(longe * 0.75, 1);
  });

  it("explosão ao sair: quem está no raio leva o dano; aliados e quem está longe, não", () => {
    const fora = arena.limites.esquerda - 10;
    const inicial = cena(
      [vaga("brasa", 300, { danoExplosao: 14, raioExplosao: 650 }), vaga("faisca", 320)],
      [vaga("lamina", 300), vaga("lamina", 990)],
      [0, 1, 2, 3],
      (l) => {
        if (l.id === 0) l.x = fora;
      },
    );
    const e = stepCombate(inicial);
    expect(e.eventos.some((ev) => ev.tipo === "explosao" && ev.id === 0)).toBe(true);
    expect(e.lutadores[0]?.vivo).toBe(false);
    expect(e.lutadores[2]?.dano).toBe(14); // inimigo perto da saída
    expect(e.lutadores[3]?.dano).toBe(0); // inimigo longe
    expect(e.lutadores[1]?.dano).toBe(0); // aliado
  });

  it("invisível: começa a rodada sem poder ser escolhido como alvo, e depois aparece", () => {
    const inicial = cena(
      [vaga("sombra", 400, { ticksInvisivel: 120 })],
      [vaga("lamina", 520)],
      [0],
    );
    expect(inicial.lutadores[0]?.invisivel).toBe(120);
    const e1 = stepCombate(inicial);
    expect(e1.lutadores[1]?.alvo).toBeNull();
    expect(e1.lutadores[1]?.ia).toBe("procurar");
    let e = e1;
    for (let i = 0; i < 125; i++) e = stepCombate(e);
    expect(e.lutadores[0]?.invisivel).toBe(0);
    expect(e.lutadores[1]?.alvo).toBe(0);
  });

  it("invisível de novo depois de cada nocaute que causar", () => {
    const inicial = cena(
      [vaga("sombra", 500, { ticksInvisivel: 120 })],
      [vaga("lamina", 550), vaga("lamina", 900)],
      [1, 2],
      (l) => {
        if (l.id === 0) l.invisivel = 0;
        if (l.id === 1) {
          l.x = arena.limites.direita + 5; // já vai sair neste tick...
          l.ultimoAtacante = 0; // ...e foi a Sombra quem bateu por último
        }
      },
    );
    const e = stepCombate(inicial);
    expect(e.lutadores[1]?.vivo).toBe(false);
    expect(e.lutadores[0]?.invisivel).toBe(120);
  });

  it("o esquadrão montado a partir do campo já vem com as sinergias aplicadas", () => {
    const campo = campoDe("maestro", "ponta", "paredao", "lamina");
    expect(sinergiasDoJogador(campo, ctx).find((s) => s.chave === "futebol")?.nivel?.minimo).toBe(
      3,
    );
    const esquadrao = montarEsquadrao(campo, ctx, arena, 0);
    const de = (id: string) => esquadrao.find((v) => v.def.id === id);
    const futebol3 = ef("mundos", "futebol", 1);
    expect(de("ponta")?.def.velocidade).toBeCloseTo(
      p("ponta").velocidade * (futebol3["velocidade"] ?? 0),
    );
    expect(de("ponta")?.bonus?.arremessoHorizontal).toBe(futebol3["arremessoHorizontal"]);
    expect(de("lamina")?.def.velocidade).toBe(p("lamina").velocidade);
    const combate = criarCombate(arena, [esquadrao, []], 1);
    expect(combate.lutadores.find((l) => l.def.id === "maestro")?.bonus.arremessoHorizontal).toBe(
      futebol3["arremessoHorizontal"],
    );
    expect(simularCombate(combate).fim?.vencedor).toBe(0);
  });
});

describe("sinergia na partida", () => {
  it("Piratas 2: quem vence a rodada com dois piratas em campo ganha +1 de elixir", () => {
    const bots = [0, 1, 2, 3].map((i) => ({ nome: `Bot ${i}`, bot: "medio" as const }));
    let partida = criarPartida(ctx, cfg, "todos", bots, 4);
    const vencedor = partida.confrontos[0]?.ladoA[0] ?? 0;
    const outro = partida.confrontos[1]?.ladoA[0] ?? 0;
    partida = comEconomia(partida, {
      ...partida.economia,
      jogadores: partida.economia.jogadores.map((j, i) =>
        i === vencedor
          ? { ...j, elixir: 3, campo: campoDe("mare", "canhoneiro").campo }
          : i === outro
            ? { ...j, elixir: 3, campo: campoDe("lamina", "sombra").campo }
            : { ...j, elixir: 3, campo: [] },
      ),
    });
    const lutada = combater(partida, ctx, cfg, arena);
    expect(lutada.resultados[0]?.elixirExtra).toEqual({ [vencedor]: 1 });
    expect(lutada.resultados[1]?.elixirExtra).toEqual({});
    const depois = concluirRodada(lutada, ctx);
    const ganhoDaRodada = (depois.economia.jogadores[outro]?.elixir ?? 0) - 3;
    expect(depois.economia.jogadores[vencedor]?.elixir).toBe(3 + ganhoDaRodada + 1);
  });
});
