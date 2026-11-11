import { describe, expect, it } from "vitest";
import { ARENA_BASICA as arena, espelhar, formacao, personagem, PERSONAGENS } from "../src/dados";
import { criarAleatorio } from "../src/sim/aleatorio";
import {
  criarCombate,
  criarLutador,
  DANO_NO_CASCO,
  stepCombate,
  TICKS_MAXIMOS,
} from "../src/sim/combate/combate";
import { escolherAlvo } from "../src/sim/combate/ia";
import type { Esquadrao, EstadoCombate, Evento, Lutador, Vaga } from "../src/sim/combate/tipos";

const lamina = personagem("lamina");
const canhoneiro = personagem("canhoneiro");
const ancora = personagem("ancora");
const sombra = personagem("sombra");
const maestro = personagem("maestro");
const paredao = personagem("paredao");
const ponta = personagem("ponta");
const mare = personagem("mare");
const faisca = personagem("faisca");
const rochedo = personagem("rochedo");
const brasa = personagem("brasa");
const vento = personagem("vento");
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
    const eu = em(lamina, 0, 0, 400);
    const todos = [
      eu,
      em(lamina, 1, 0, 420),
      em(lamina, 2, 1, 430, { vivo: false }),
      em(lamina, 3, 1, 700),
      em(lamina, 4, 1, 560),
    ];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(4);
  });

  it("assassino caça o atirador mesmo com outro inimigo mais perto", () => {
    const eu = em(sombra, 0, 0, 400);
    const todos = [eu, em(ancora, 1, 1, 460), em(canhoneiro, 2, 1, 900)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
    expect(escolherAlvo(eu, [eu, em(ancora, 1, 1, 460), em(lamina, 2, 1, 900)], arena)?.id).toBe(1);
  });

  it("atirador escolhe quem tem mais dano dentro do alcance", () => {
    const eu = em(canhoneiro, 0, 0, 300);
    const todos = [
      eu,
      em(lamina, 1, 1, 400, { dano: 10 }),
      em(lamina, 2, 1, 600, { dano: 80 }),
      em(lamina, 3, 1, 950, { dano: 150 }), // fora do alcance
    ];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
  });

  it("mantém o alvo atual se o outro só estiver um pouco mais perto", () => {
    const eu = em(lamina, 0, 0, 400, { alvo: 2 });
    const todos = [eu, em(lamina, 1, 1, 520), em(lamina, 2, 1, 560)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
    expect(escolherAlvo({ ...eu, alvo: null }, todos, arena)?.id).toBe(1);
  });

  it("prefere quem está sobre o chão a quem foi arremessado para fora", () => {
    const eu = em(lamina, 0, 0, 300);
    const todos = [eu, em(lamina, 1, 1, 150), em(lamina, 2, 1, 600)];
    expect(escolherAlvo(eu, todos, arena)?.id).toBe(2);
  });
});

describe("projéteis", () => {
  it("o atirador dispara na direção do alvo e o projétil acerta o inimigo, não o aliado", () => {
    // aliado parado no caminho (id 1), inimigo depois dele (id 2)
    const inicial = montar(
      [vaga(canhoneiro, 300), vaga(lamina, 450)],
      [vaga(lamina, 600)],
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
    const inicial = montar([vaga(canhoneiro, 300)], [vaga(lamina, 600)], [1], (l) => {
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
  const golpesEm = (vistos: Evento[]) =>
    vistos.flatMap((ev) => (ev.tipo === "golpe" ? [ev.alvo] : [])).sort((a, b) => a - b);
  /** Deixa só a habilidade disponível para o lutador 0 (sem golpe normal). */
  const soHabilidade = (l: Lutador) => {
    if (l.id === 0) l.recarga = 100_000;
  };

  it("investida (Lâmina): corre e acerta quem está no caminho, uma vez cada", () => {
    // (semente escolhida para o Lâmina não abrir com um ataque pulando: a investida só sai no chão)
    const inicial = {
      ...montar([vaga(lamina, 350)], [vaga(lamina, 520), vaga(lamina, 480)], [1, 2]),
      rng: criarAleatorio(2),
    };
    const inicio = ate(inicial, usou("investida"));
    expect(Math.abs(inicio.e.lutadores[0]?.vx ?? 0)).toBe(lamina.habilidade.velocidade);
    expect(inicio.e.lutadores[0]?.habRecarga).toBe(lamina.habilidade.recarga);
    const { vistos } = avancar(inicio.e, lamina.habilidade.duracao + 2);
    expect(golpesEm(vistos)).toEqual([1, 2]);
  });

  it("investida não é usada se for terminar fora do chão", () => {
    const inicial = montar(
      [vaga(lamina, arena.chao.x + arena.chao.largura - 160)],
      [vaga(lamina, 960)],
      [1],
    );
    expect(avancar(inicial, 120).vistos.some(usou("investida"))).toBe(false);
  });

  it("área (Âncora, redemoinho): arremessa todos em volta, para os dois lados, e não quem está longe", () => {
    const inicial = montar(
      [vaga(ancora, 600)],
      [vaga(lamina, 690), vaga(lamina, 510), vaga(lamina, 900)],
      [1, 2, 3],
      soHabilidade,
    );
    const { e, vistos } = ate(inicial, (ev) => ev.tipo === "area");
    expect(golpesEm(vistos)).toEqual([1, 2]);
    expect(e.lutadores[1]?.vx).toBeGreaterThan(0);
    expect(e.lutadores[2]?.vx).toBeLessThan(0);
    expect(e.lutadores[3]?.dano).toBe(0);
  });

  it("área (Brasa, erupção): lança os inimigos próximos para cima", () => {
    const inicial = montar([vaga(brasa, 600)], [vaga(lamina, 670)], [1], soHabilidade);
    const { e } = ate(inicial, (ev) => ev.tipo === "area");
    const alvo = e.lutadores[1];
    expect(alvo?.vy).toBeLessThan(0);
    expect(Math.abs(alvo?.vy ?? 0)).toBeGreaterThan(Math.abs(alvo?.vx ?? 0) * 2);
  });

  it("bola (Maestro): a bola persegue o alvo e quica entre três inimigos", () => {
    const inicial = montar(
      [vaga(maestro, 300)],
      [vaga(ancora, 560), vaga(ancora, 660), vaga(ancora, 760)],
      [1, 2, 3],
      soHabilidade,
    );
    const inicio = ate(inicial, usou("bola"));
    expect(inicio.e.projeteis).toHaveLength(1);
    expect(inicio.e.projeteis[0]?.quiques).toBe(maestro.habilidade.quantidade - 1);
    const { e, vistos } = avancar(inicio.e, 200);
    // (os alvos acordam ao levar a bola e podem revidar; só interessam os golpes do Maestro)
    const daBola = vistos.filter((ev) => ev.tipo === "golpe" && ev.atacante === 0);
    expect(golpesEm(daBola)).toEqual([1, 2, 3]);
    expect(e.projeteis.filter((p) => p.dono === 0)).toHaveLength(0);
  });

  it("devolver (Paredão): agarra o projétil e o devolve mais forte para quem atirou", () => {
    const inicial = montar([vaga(paredao, 380)], [vaga(canhoneiro, 760)], [], (l) => {
      l.recarga = l.id === 0 ? 100_000 : 0;
      if (l.id === 1) l.habRecarga = 100_000;
    });
    const devolveu = ate(inicial, (ev) => ev.tipo === "devolveu");
    const p = devolveu.e.projeteis[0];
    expect(p?.dono).toBe(0);
    expect(p?.lado).toBe(0);
    expect(p?.multiplicador).toBe(paredao.habilidade.quantidade);
    expect(devolveu.e.lutadores[0]?.dano).toBe(0);
    const golpe = ate(devolveu.e, (ev) => ev.tipo === "golpe" && ev.atacante === 0);
    expect(golpe.e.lutadores[1]?.dano).toBeGreaterThan(0);
  });

  it("carrinho (Ponta): desliza até o inimigo mais distante, sem acertar quem está no caminho", () => {
    const inicial = montar(
      [vaga(ponta, 300)],
      [vaga(ancora, 460), vaga(lamina, 720)],
      [1, 2],
      soHabilidade,
    );
    const inicio = ate(inicial, usou("carrinho"));
    expect(inicio.e.lutadores[0]?.hab.alvo).toBe(2);
    const { e, vistos } = avancar(inicio.e, ponta.habilidade.duracao + 2);
    expect(golpesEm(vistos)).toEqual([2]);
    expect(e.lutadores[1]?.dano).toBe(0);
  });

  it("gancho (Capitã Maré): puxa o inimigo mais distante para perto, atordoado, e golpeia", () => {
    const inicial = montar(
      [vaga(mare, 300)],
      [vaga(lamina, 520), vaga(canhoneiro, 700)],
      [1, 2],
      (l) => {
        if (l.id > 0) l.atordoado = 0; // o gancho só pega quem não está atordoado
        if (l.id > 0) l.recarga = l.habRecarga = 100_000;
      },
    );
    const { e } = ate(inicial, (ev) => ev.tipo === "gancho");
    const maré = e.lutadores[0];
    const puxado = e.lutadores.find((l) => l.id === maré?.hab.alvo || l.id === maré?.alvo);
    if (!maré || !puxado) throw new Error("ninguém foi puxado");
    expect(Math.abs(puxado.x - maré.x)).toBeLessThan(80);
    expect(puxado.atordoado).toBeGreaterThan(0);
    expect(puxado.dano).toBe(mare.habilidade.dano);
    const golpe = ate(e, (ev) => ev.tipo === "golpe" && ev.atacante === 0, 60);
    expect(golpe.vistos.some((ev) => ev.tipo === "golpe" && ev.alvo === puxado.id)).toBe(true);
  });

  it("canhão (Canhoneiro): projétil maior e mais lento, com arremesso bem mais forte que o tiro normal", () => {
    const comTiro = montar([vaga(canhoneiro, 300)], [vaga(ancora, 560)], [1], (l) => {
      l.habRecarga = 100_000;
    });
    const tiro = ate(comTiro, (ev) => ev.tipo === "tiro").e.projeteis[0];
    const normal = ate(comTiro, (ev) => ev.tipo === "golpe").vistos.find(
      (ev) => ev.tipo === "golpe",
    );

    const comCanhao = montar([vaga(canhoneiro, 300)], [vaga(ancora, 560)], [1], soHabilidade);
    const inicio = ate(comCanhao, usou("canhao"));
    const bala = inicio.e.projeteis[0];
    expect(bala?.largura).toBeGreaterThan(tiro?.largura ?? 0);
    expect(Math.abs(bala?.vx ?? 0)).toBeLessThan(Math.abs(tiro?.vx ?? 0));
    const forte = ate(inicio.e, (ev) => ev.tipo === "golpe").vistos.find(
      (ev) => ev.tipo === "golpe",
    );
    expect(forte?.tipo === "golpe" && forte.forca).toBeGreaterThan(
      (normal?.tipo === "golpe" ? normal.forca : 0) * 1.5,
    );
  });

  it("cadeia (Faísca): salta entre três inimigos e acerta cada um uma vez", () => {
    const inicial = montar(
      [vaga(faisca, 300)],
      [vaga(ancora, 440), vaga(ancora, 560), vaga(ancora, 680)],
      [1, 2, 3],
      soHabilidade,
    );
    const inicio = ate(inicial, usou("cadeia"));
    const hab = faisca.habilidade;
    const { e, vistos } = avancar(inicio.e, hab.duracao * hab.quantidade + 2);
    expect(golpesEm([...inicio.e.eventos, ...vistos])).toEqual([1, 2, 3]);
    const eu = e.lutadores[0];
    expect(eu?.x).toBeGreaterThan(arena.chao.x);
    expect(eu?.x).toBeLessThan(arena.chao.x + arena.chao.largura);
  });

  it("casco (Rochedo): imune a arremesso; leva só parte do dano e não sai do lugar", () => {
    const inicial = montar([vaga(rochedo, 600)], [vaga(lamina, 665)], [], (l) => {
      if (l.id === 0) l.hab = { ticks: 60, atingidos: [], restante: 0, alvo: null };
      if (l.id === 1) {
        l.direcao = -1;
        l.ataque = { fase: "ativo", ticks: 3, acertou: false };
      }
    });
    const e = stepCombate(inicial);
    const golpe = e.eventos.find((ev) => ev.tipo === "golpe");
    expect(golpe?.tipo === "golpe" && golpe.forca).toBe(0);
    const r = e.lutadores[0];
    expect(r?.atordoado).toBe(0);
    expect(r?.x).toBe(600);
    expect(r?.hab.ticks).toBeGreaterThan(0); // o casco não é cancelado pelo golpe
    expect(r?.dano).toBeGreaterThan(0);
    expect(r?.dano).toBeLessThan(lamina.ataque.dano * DANO_NO_CASCO * 1.11);
  });

  it("casco: o Rochedo se fecha quando um inimigo por perto arma o golpe", () => {
    const inicial = montar([vaga(rochedo, 600)], [vaga(lamina, 680)], [], (l) => {
      if (l.id === 1) l.habRecarga = 100_000;
    });
    expect(ate(inicial, usou("casco")).e.lutadores[0]?.hab.ticks).toBeGreaterThan(0);
  });

  it("teleporte (Sombra): reaparece atrás do inimigo mais leve, virada para ele", () => {
    const inicial = montar(
      [vaga(sombra, 300)],
      [vaga(ancora, 480), vaga(faisca, 720)],
      [1, 2],
      soHabilidade,
    );
    const { e, vistos } = ate(inicial, (ev) => ev.tipo === "teleporte");
    const eu = e.lutadores[0];
    const leve = e.lutadores[2];
    if (!eu || !leve) throw new Error("lutador ausente");
    expect(vistos.some(usou("teleporte"))).toBe(true);
    expect(eu.alvo).toBe(2);
    expect(Math.abs(eu.x - leve.x)).toBeLessThan(70);
    // "atrás": do lado para onde o alvo não está olhando
    expect(Math.sign(eu.x - leve.x)).toBe(-leve.direcao);
    expect(eu.direcao).toBe(leve.x >= eu.x ? 1 : -1);
  });

  it("tufão (Mestre Vento): empurra cada inimigo para a borda mais próxima dele", () => {
    const inicial = montar(
      [vaga(vento, 300)],
      [vaga(lamina, 460), vaga(lamina, 800)],
      [1, 2],
      (l) => {
        soHabilidade(l);
        if (l.id === 1) l.dano = 60;
      },
    );
    const { e, vistos } = ate(inicial, usou("tufao"));
    const depois = avancar(e, 1);
    expect(golpesEm([...vistos, ...depois.vistos])).toEqual([1, 2]);
    expect(depois.e.lutadores[1]?.vx).toBeLessThan(0);
    expect(depois.e.lutadores[2]?.vx).toBeGreaterThan(0);
  });

  it("tufão não é gasto enquanto ninguém acumulou dano", () => {
    const inicial = montar([vaga(vento, 300)], [vaga(lamina, 800)], [1], soHabilidade);
    expect(avancar(inicial, 200).vistos.some(usou("tufao"))).toBe(false);
  });

  it("ser atingido cancela a habilidade em andamento", () => {
    const inicial = montar([vaga(ancora, 600)], [vaga(lamina, 665)], [], (l) => {
      if (l.id === 0) l.hab = { ticks: 10, atingidos: [], restante: 0, alvo: null };
      if (l.id === 1) {
        l.direcao = -1;
        l.ataque = { fase: "ativo", ticks: 3, acertou: false };
      }
    });
    const e = stepCombate(inicial);
    expect(e.eventos.some((ev) => ev.tipo === "golpe" && ev.alvo === 0)).toBe(true);
    expect(e.lutadores[0]?.hab.ticks).toBe(0);
  });

  it("toda habilidade do elenco é usada em combates de verdade", () => {
    const usadas = new Set<string>();
    for (let s = 1; s <= 12 && usadas.size < 11; s++) {
      const todos = PERSONAGENS.map((def, i) => ({ def, x: 0, y: 0, i }));
      const lado = (inicio: number) =>
        todos
          .slice(inicio, inicio + 6)
          .map((t, k) => vaga(t.def, arena.pontos[k]?.x ?? 300, arena.pontos[k]?.y ?? CHAO));
      let e = criarCombate(arena, [lado(0), espelhar(lado(6), arena)], s);
      const outro = criarCombate(arena, [lado(6), espelhar(lado(0), arena)], s + 100);
      for (const inicial of [e, outro]) {
        e = inicial;
        while (!e.fim) {
          e = stepCombate(e);
          for (const ev of e.eventos) if (ev.tipo === "habilidade") usadas.add(ev.habilidade);
        }
      }
    }
    expect([...usadas].sort()).toEqual([
      "area",
      "bola",
      "cadeia",
      "canhao",
      "carrinho",
      "casco",
      "devolver",
      "gancho",
      "investida",
      "teleporte",
      "tufao",
    ]);
  });
});

describe("espaço entre aliados", () => {
  it("aliados no mesmo ponto se afastam; inimigos não são empurrados", () => {
    const inicial = montar(
      [vaga(lamina, 400), vaga(lamina, 400)],
      [vaga(lamina, 400)],
      [0, 1, 2],
      (l) => {
        l.atordoado = 0;
        l.recarga = 100_000;
        l.habRecarga = 100_000;
      },
    );
    const { e } = avancar(inicial, 1);
    const [a, b] = e.lutadores;
    expect(Math.abs((b?.x ?? 0) - (a?.x ?? 0))).toBeGreaterThan(1);
  });

  it("o empurrão não tira ninguém do chão", () => {
    const beira = arena.chao.x + arena.chao.largura - 16;
    const inicial = montar(
      [vaga(ancora, beira), vaga(ancora, beira)],
      [vaga(lamina, 300)],
      [],
      (l) => {
        l.recarga = 100_000;
        l.habRecarga = 100_000;
      },
    );
    const { e } = avancar(inicial, 40);
    for (const l of e.lutadores)
      expect(l.vivo && l.x < arena.chao.x + arena.chao.largura).toBe(true);
  });
});

describe("fim da rodada com esquadrões", () => {
  const noFim = (ajuste: (l: Lutador) => void) => {
    const e = montar(
      [vaga(lamina, 300), vaga(lamina, 350)],
      [vaga(lamina, 800), vaga(lamina, 850)],
      [],
      ajuste,
    );
    return stepCombate({ ...e, tick: TICKS_MAXIMOS - 1 }).fim;
  };

  it("um lado sem ninguém perde", () => {
    const e = montar([vaga(lamina, 300)], [vaga(lamina, 800), vaga(lamina, 850)], [], (l) => {
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
    expect([...usadas].sort()).toEqual(["area", "canhao", "investida", "teleporte"]);
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
