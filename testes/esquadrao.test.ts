import { describe, expect, it } from "vitest";
import { ARENA_BASICA as arena, espelhar, formacao, personagem } from "../src/dados";
import { criarCombate, criarLutador, stepCombate, TICKS_MAXIMOS } from "../src/sim/combate/combate";
import { escolherAlvo } from "../src/sim/combate/ia";
import type { Esquadrao, EstadoCombate, Evento, Lutador, Vaga } from "../src/sim/combate/tipos";

const lutador = personagem("lutador");
const atirador = personagem("atirador");
const tanque = personagem("tanque");
const assassino = personagem("assassino");
const CHAO = arena.chao.y;
const vaga = (def: Vaga["def"], x: number, y = CHAO): Vaga => ({ def, x, y });

/**
 * Monta um combate já com todos no chão. Os ids em `bonecos` ficam atordoados por muito
 * tempo: servem de alvo parado para testar uma habilidade de cada vez.
 */
function montar(a: Esquadrao, b: Esquadrao, bonecos: number[], ajuste?: (l: Lutador) => void) {
  const e = criarCombate(arena, [a, b], 7);
  return {
    ...e,
    lutadores: e.lutadores.map((l) => {
      const copia: Lutador = { ...l, noChao: true, pulosRestantes: 2, habRecarga: 0 };
      if (bonecos.includes(l.id)) copia.atordoado = 100_000;
      ajuste?.(copia);
      return copia;
    }),
  };
}

/** Avança até aparecer um evento que satisfaça a condição; devolve o estado e os eventos vistos. */
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

function avancar(inicial: EstadoCombate, ticks: number) {
  let e = inicial;
  const vistos: Evento[] = [];
  for (let i = 0; i < ticks; i++) {
    e = stepCombate(e);
    vistos.push(...e.eventos);
  }
  return { e, vistos };
}

describe("escolha de alvo", () => {
  const em = (
    def: Vaga["def"],
    id: number,
    lado: 0 | 1,
    x: number,
    extra: Partial<Lutador> = {},
  ) => ({
    ...criarLutador(def, id, lado, x, CHAO),
    ...extra,
  });

  it("corpo a corpo escolhe o inimigo mais próximo e ignora aliados e eliminados", () => {
    const eu = em(lutador, 0, 0, 400);
    const todos = [
      eu,
      em(lutador, 1, 0, 420),
      em(lutador, 2, 1, 430, { vivo: false }),
      em(lutador, 3, 1, 700),
      em(lutador, 4, 1, 560),
    ];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(4);
  });

  it("assassino caça o atirador mesmo com outro inimigo mais perto", () => {
    const eu = em(assassino, 0, 0, 400);
    const todos = [eu, em(tanque, 1, 1, 460), em(atirador, 2, 1, 900)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
    expect(escolherAlvo(eu, [eu, em(tanque, 1, 1, 460), em(lutador, 2, 1, 900)], arena)?.id).toBe(
      1,
    );
  });

  it("atirador escolhe quem tem mais dano dentro do alcance", () => {
    const eu = em(atirador, 0, 0, 300);
    const todos = [
      eu,
      em(lutador, 1, 1, 400, { dano: 10 }),
      em(lutador, 2, 1, 600, { dano: 80 }),
      em(lutador, 3, 1, 950, { dano: 150 }), // fora do alcance
    ];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
  });

  it("mantém o alvo atual se o outro só estiver um pouco mais perto", () => {
    const eu = em(lutador, 0, 0, 400, { alvo: 2 });
    const todos = [eu, em(lutador, 1, 1, 520), em(lutador, 2, 1, 560)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
    expect(escolherAlvo({ ...eu, alvo: null }, todos, arena)?.id).toBe(1);
  });

  it("prefere quem está sobre o chão a quem foi arremessado para fora", () => {
    const eu = em(lutador, 0, 0, 300);
    const todos = [eu, em(lutador, 1, 1, 150), em(lutador, 2, 1, 600)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
  });
});

describe("projéteis", () => {
  it("o atirador dispara na direção do alvo e o projétil acerta o inimigo, não o aliado", () => {
    // aliado parado no caminho (id 1), inimigo depois dele (id 2)
    const inicial = montar(
      [vaga(atirador, 300), vaga(lutador, 450)],
      [vaga(lutador, 600)],
      [1, 2],
      (l) => {
        l.habRecarga = 100_000; // só o tiro normal
      },
    );
    const tiro = ate(inicial, (ev) => ev.tipo === "tiro");
    expect(tiro.e.projeteis).toHaveLength(1);
    expect(tiro.e.projeteis[0]?.vx).toBeGreaterThan(0);
    expect(tiro.e.projeteis[0]?.lado).toBe(0);

    const golpe = ate(tiro.e, (ev) => ev.tipo === "golpe");
    const ev = golpe.vistos.find((v) => v.tipo === "golpe");
    expect(ev?.tipo === "golpe" && ev.alvo).toBe(2);
    expect(ev?.tipo === "golpe" && ev.atacante).toBe(0);
    expect(golpe.e.lutadores[2]?.vx).toBeGreaterThan(0); // arremessado para longe do atirador
    expect(golpe.e.lutadores[1]?.dano).toBe(0);
  });

  it("o projétil some quando acaba o tempo de vida", () => {
    const inicial = montar([vaga(atirador, 300)], [vaga(lutador, 600)], [1], (l) => {
      l.habRecarga = 100_000;
    });
    const tiro = ate(inicial, (ev) => ev.tipo === "tiro");
    const p = tiro.e.projeteis[0];
    if (!p) throw new Error("sem projétil");
    // tira o alvo do caminho e deixa o projétil voar sozinho
    const semAlvo = {
      ...tiro.e,
      lutadores: tiro.e.lutadores.map((l) => (l.id === 1 ? { ...l, y: 290, x: 600 } : l)),
      projeteis: [{ ...p, vida: 5 }],
    };
    expect(avancar(semAlvo, 4).e.projeteis.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(avancar(semAlvo, 5).e.projeteis.filter((q) => q.id === p.id)).toHaveLength(0);
  });
});

describe("habilidades", () => {
  const usou = (tipo: string) => (ev: Evento) => ev.tipo === "habilidade" && ev.habilidade === tipo;

  it("investida: corre e acerta quem está no caminho, uma vez cada", () => {
    const inicial = montar([vaga(lutador, 350)], [vaga(lutador, 520), vaga(lutador, 480)], [1, 2]);
    const inicio = ate(inicial, usou("investida"));
    expect(Math.abs(inicio.e.lutadores[0]?.vx ?? 0)).toBe(lutador.habilidade.velocidade);
    expect(inicio.e.lutadores[0]?.habRecarga).toBe(lutador.habilidade.recarga);
    const { vistos } = avancar(inicio.e, lutador.habilidade.duracao + 2);
    const golpes = vistos.filter((ev) => ev.tipo === "golpe");
    expect(golpes.map((g) => g.tipo === "golpe" && g.alvo).sort()).toEqual([1, 2]);
  });

  it("investida não é usada se for terminar fora do chão", () => {
    const inicial = montar(
      [vaga(lutador, arena.chao.x + arena.chao.largura - 160)],
      [vaga(lutador, 960)],
      [1],
    );
    const { vistos } = avancar(inicial, 120);
    expect(vistos.some(usou("investida"))).toBe(false);
  });

  it("rajada: dispara a quantidade de projéteis da habilidade", () => {
    const inicial = montar([vaga(atirador, 300)], [vaga(tanque, 650)], [1], (l) => {
      l.recarga = 100_000; // sem tiro normal
    });
    const inicio = ate(inicial, usou("rajada"));
    const hab = atirador.habilidade;
    const { vistos } = avancar(inicio.e, hab.duracao * hab.quantidade + 2);
    const tiros = [...inicio.e.eventos, ...vistos].filter((ev) => ev.tipo === "tiro");
    expect(tiros).toHaveLength(hab.quantidade);
  });

  it("pisão: arremessa todos os inimigos em volta, para os dois lados, e não quem está longe", () => {
    const inicial = montar(
      [vaga(tanque, 600)],
      [vaga(lutador, 680), vaga(lutador, 520), vaga(lutador, 900)],
      [1, 2, 3],
      (l) => {
        if (l.id === 0) l.recarga = 100_000; // sem golpe normal
      },
    );
    const { e, vistos } = ate(inicial, (ev) => ev.tipo === "pisao");
    const atingidos = vistos
      .filter((ev) => ev.tipo === "golpe")
      .map((g) => g.tipo === "golpe" && g.alvo);
    expect(atingidos.sort()).toEqual([1, 2]);
    expect(e.lutadores[1]?.vx).toBeGreaterThan(0);
    expect(e.lutadores[2]?.vx).toBeLessThan(0);
    expect(e.lutadores[3]?.dano).toBe(0);
  });

  it("salto: o assassino cai atrás do alvo, ainda sobre o chão", () => {
    const inicial = montar([vaga(assassino, 300)], [vaga(atirador, 650)], [1]);
    let { e } = ate(inicial, usou("salto"));
    expect(e.lutadores[0]?.noChao).toBe(false);
    for (let i = 0; i < 120 && !e.lutadores[0]?.noChao; i++) e = stepCombate(e);
    const a = e.lutadores[0];
    expect(a?.noChao).toBe(true);
    expect(a?.x).toBeGreaterThan(650);
    expect(a?.x).toBeLessThan(arena.chao.x + arena.chao.largura);
  });

  it("ser atingido cancela a habilidade em andamento", () => {
    const inicial = montar([vaga(tanque, 600)], [vaga(lutador, 660)], [], (l) => {
      if (l.id === 0) l.hab = { ticks: 10, atingidos: [], restante: 0 };
      if (l.id === 1) {
        l.direcao = -1;
        l.ataque = { fase: "ativo", ticks: 3, acertou: false };
      }
    });
    const e = stepCombate(inicial);
    expect(e.eventos.some((ev) => ev.tipo === "golpe" && ev.alvo === 0)).toBe(true);
    expect(e.lutadores[0]?.hab.ticks).toBe(0);
  });
});

describe("fim da rodada com esquadrões", () => {
  const noFim = (ajuste: (l: Lutador) => void) => {
    const e = montar(
      [vaga(lutador, 300), vaga(lutador, 350)],
      [vaga(lutador, 800), vaga(lutador, 850)],
      [],
      ajuste,
    );
    return stepCombate({ ...e, tick: TICKS_MAXIMOS - 1 }).fim;
  };

  it("um lado sem ninguém perde", () => {
    const e = montar([vaga(lutador, 300)], [vaga(lutador, 800), vaga(lutador, 850)], [], (l) => {
      if (l.lado === 1) l.x = arena.limites.direita + 100;
    });
    expect(stepCombate(e).fim).toEqual({ vencedor: 0, motivo: "eliminacao", tick: 1 });
  });

  it("tempo esgotado: vence quem tem mais sobreviventes", () => {
    const fim = noFim((l) => {
      if (l.id === 0) l.vivo = false;
      if (l.lado === 1) l.dano = 200;
    });
    expect(fim).toMatchObject({ vencedor: 1, motivo: "tempo" });
  });

  it("tempo esgotado com o mesmo número de sobreviventes: vence a menor porcentagem somada", () => {
    const fim = noFim((l) => {
      l.dano = l.lado === 0 ? 30 : 40;
    });
    expect(fim).toMatchObject({ vencedor: 0, motivo: "tempo" });
  });

  it("tempo esgotado com tudo igual: empate", () => {
    expect(noFim(() => undefined)).toMatchObject({ vencedor: null, motivo: "tempo" });
  });
});

describe("combate 4x4", () => {
  const padrao = formacao("padrao").vagas;
  const invertida = formacao("invertida").vagas;
  const plataformas = formacao("plataformas").vagas;
  const criar = (a: Esquadrao, b: Esquadrao, semente: number) =>
    criarCombate(arena, [a, espelhar(b, arena)], semente);

  it("é determinístico quadro a quadro", () => {
    let a = criar(padrao, plataformas, 99);
    let b = criar(padrao, plataformas, 99);
    for (let i = 0; i < 1800; i++) {
      a = stepCombate(a);
      b = stepCombate(b);
      if (i % 150 === 0) expect(a).toEqual(b);
    }
    expect(a).toEqual(b);
    expect(a.projeteis.length + a.proximoProjetil).toBeGreaterThan(0);
  });

  it("lote: todo combate termina por eliminação, ninguém cai sozinho nem fica parado", () => {
    const confrontos: [Esquadrao, Esquadrao][] = [
      [padrao, padrao],
      [padrao, plataformas],
      [plataformas, invertida],
      [invertida, invertida],
    ];
    const usadas = new Set<string>();
    const porTempo: number[] = [];
    const quedasSozinho: number[] = [];
    let maiorEspera = 0;
    for (const [a, b] of confrontos) {
      for (let semente = 1; semente <= 60; semente++) {
        let e = criar(a, b, semente);
        const ultimo = e.lutadores.map((l) => ({ x: l.x, y: l.y, tick: 0 }));
        while (!e.fim) {
          e = stepCombate(e);
          for (const ev of e.eventos) {
            if (ev.tipo === "saida" && !ev.porGolpe) quedasSozinho.push(semente);
            if (ev.tipo === "habilidade") usadas.add(ev.habilidade);
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
            else maiorEspera = Math.max(maiorEspera, e.tick - u.tick);
          }
        }
        if (e.fim.motivo !== "eliminacao") porTempo.push(semente);
      }
    }
    expect(porTempo, "combates que acabaram por tempo").toEqual([]);
    expect(quedasSozinho, "quedas sem ter sido arremessado").toEqual([]);
    // Esperar na beirada um inimigo voltar é normal; ficar 8 s sem fazer nada não é.
    expect(maiorEspera).toBeLessThan(8 * 60);
    expect([...usadas].sort()).toEqual(["investida", "pisao", "rajada", "salto"]);
  }, 60_000);

  it("a posição inicial muda o resultado: tanque na frente vence atirador na frente", () => {
    const N = 150;
    let vitoriasComoEsquerda = 0;
    let vitoriasComoDireita = 0;
    for (let semente = 1; semente <= N; semente++) {
      let e = criar(padrao, invertida, semente);
      while (!e.fim) e = stepCombate(e);
      if (e.fim.vencedor === 0) vitoriasComoEsquerda++;
      e = criar(invertida, padrao, semente);
      while (!e.fim) e = stepCombate(e);
      if (e.fim.vencedor === 1) vitoriasComoDireita++;
    }
    // Mesmos quatro personagens dos dois lados; só as posições mudam.
    expect(vitoriasComoEsquerda / N).toBeGreaterThan(0.53);
    expect(vitoriasComoDireita / N).toBeGreaterThan(0.53);
  }, 60_000);
});
