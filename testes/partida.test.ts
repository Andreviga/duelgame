import { describe, expect, it } from "vitest";
import { jogarBot } from "../src/bots/bot";
import { jogarBots } from "../src/bots/partida";
import {
  ARENA_BASICA as arena,
  CONTEXTO as ctx,
  ECONOMIA as config,
  PARTIDA as cfg,
} from "../src/dados";
import { criarAleatorio } from "../src/sim/aleatorio";
import { criarCombate, simularCombate } from "../src/sim/combate/combate";
import { copiasDoNivel, limiteDeCampo } from "../src/sim/economia/economia";
import type { EstadoEconomia, Unidade } from "../src/sim/economia/tipos";
import {
  combater,
  comEconomia,
  concluirRodada,
  confrontoDoJogador,
  criarPartida,
  danoDaDerrota,
  esquadroesDoConfronto,
  estaVivo,
  sortearConfrontos,
} from "../src/sim/partida/partida";
import type { EstadoPartida, Modo, NivelBot, Participante } from "../src/sim/partida/tipos";

const bots = (niveis: NivelBot[]): Participante[] =>
  niveis.map((bot, i) => ({ nome: `Bot ${i + 1}`, bot }));
const nova = (
  modo: Modo = "todos",
  semente = 1,
  niveis: NivelBot[] = ["medio", "medio", "medio", "medio"],
) => criarPartida(ctx, cfg, modo, bots(niveis), semente);
const u = (id: number, personagem: string, nivel = 1): Unidade => ({ id, personagem, nivel });

/** Põe unidades direto no campo de um jogador (para montar a situação do teste). */
function comCampo(p: EstadoPartida, jogador: number, unidades: Unidade[]): EstadoPartida {
  const economia: EstadoEconomia = {
    ...p.economia,
    jogadores: p.economia.jogadores.map((j, i) =>
      i === jogador ? { ...j, campo: unidades.map((unidade, ponto) => ({ unidade, ponto })) } : j,
    ),
  };
  return comEconomia(p, economia);
}

/** Rodada em que o jogador `forte` tem um esquadrão e os outros não têm ninguém. */
function rodadaDecidida(p: EstadoPartida, fortes: number[]): EstadoPartida {
  let q = p;
  p.jogadores.forEach((_, i) => {
    q = comCampo(
      q,
      i,
      fortes.includes(i) ? [u(900 + i * 10, "ancora", 3), u(901 + i * 10, "lamina", 3)] : [],
    );
  });
  return concluirRodada(combater(q, ctx, cfg, arena), ctx);
}

/** Joga uma partida inteira só com bots. */
function jogarAteOFim(inicial: EstadoPartida, limiteDeRodadas = 60) {
  let p = inicial;
  let recusados = 0;
  while (p.fase !== "fim" && p.economia.rodada <= limiteDeRodadas) {
    const jogada = jogarBots(p, ctx, arena);
    recusados += jogada.recusados;
    p = concluirRodada(combater(jogada.partida, ctx, cfg, arena), ctx);
  }
  return { p, recusados };
}

describe("criação da partida", () => {
  it("começa na preparação da rodada 1, com vida cheia e todos com elixir e loja", () => {
    const p = nova();
    expect(p.fase).toBe("preparacao");
    expect(p.economia.rodada).toBe(1);
    expect(p.jogadores.map((j) => j.vida)).toEqual([20, 20, 20, 20].map(() => cfg.vidaInicial));
    expect(
      p.economia.jogadores.every((j) => j.loja.length === config.tamanhoLoja && j.elixir > 0),
    ).toBe(true);
    expect(p.jogadores.map((j) => j.time)).toEqual([0, 0, 1, 1]);
  });

  it("exige quatro jogadores", () => {
    expect(() => criarPartida(ctx, cfg, "todos", bots(["facil", "facil"]), 1)).toThrow(
      /4 jogadores/,
    );
  });
});

describe("pareamento (todos contra todos)", () => {
  it("com quatro vivos: dois duelos, cada jogador em exatamente um", () => {
    for (let s = 1; s <= 30; s++) {
      const p = nova("todos", s);
      expect(p.confrontos).toHaveLength(2);
      const todos = p.confrontos.flatMap((c) => [...c.ladoA, ...c.ladoB]).sort();
      expect(todos).toEqual([0, 1, 2, 3]);
      expect(p.confrontos.every((c) => !c.fantasma)).toBe(true);
    }
  });

  it("evita repetir o adversário da rodada anterior", () => {
    for (let s = 1; s <= 40; s++) {
      const p = nova("todos", s);
      const jogadores = p.jogadores.map((j, i) => ({
        ...j,
        ultimoAdversario: [1, 0, 3, 2][i] ?? null,
      }));
      const { confrontos } = sortearConfrontos({ ...p, jogadores }, criarAleatorio(s));
      for (const c of confrontos) {
        const a = c.ladoA[0] ?? -1;
        expect(jogadores[a]?.ultimoAdversario).not.toBe(c.ladoB[0]);
      }
    }
  });

  it("com três vivos: um duelo e um contra o fantasma de outro jogador", () => {
    const p = nova("todos", 3);
    const jogadores = p.jogadores.map((j, i) => (i === 2 ? { ...j, eliminadoNaRodada: 1 } : j));
    for (let s = 1; s <= 20; s++) {
      const { confrontos } = sortearConfrontos({ ...p, jogadores }, criarAleatorio(s));
      expect(confrontos).toHaveLength(2);
      const real = confrontos.find((c) => !c.fantasma);
      const fantasma = confrontos.find((c) => c.fantasma);
      if (!real || !fantasma) throw new Error("faltou um confronto");
      const noDuelo = [...real.ladoA, ...real.ladoB];
      expect(noDuelo).not.toContain(2);
      expect(noDuelo).not.toContain(fantasma.ladoA[0]); // quem sobra não está no duelo
      expect(noDuelo).toContain(fantasma.ladoB[0]); // o fantasma copia alguém do duelo
    }
  });

  it("com dois vivos: um duelo entre eles", () => {
    const p = nova();
    const jogadores = p.jogadores.map((j, i) =>
      i === 0 || i === 3 ? { ...j, eliminadoNaRodada: 2 } : j,
    );
    const { confrontos } = sortearConfrontos({ ...p, jogadores }, criarAleatorio(1));
    expect(confrontos.map((c) => [c.ladoA, c.ladoB])).toEqual([[[1], [2]]]);
  });

  it("é determinístico pela semente", () => {
    expect(nova("todos", 9).confrontos).toEqual(nova("todos", 9).confrontos);
  });
});

describe("vida e eliminação", () => {
  it("o dano da derrota cresce com os inimigos que sobraram e com as rodadas", () => {
    expect(danoDaDerrota(cfg, 1, 1)).toBe(cfg.danoBase + cfg.danoPorSobrevivente);
    expect(danoDaDerrota(cfg, 4, 1)).toBeGreaterThan(danoDaDerrota(cfg, 1, 1));
    expect(danoDaDerrota(cfg, 1, cfg.rodadasPorDanoExtra * 2)).toBe(danoDaDerrota(cfg, 1, 1) + 2);
  });

  it("quem perde a rodada perde vida; quem vence não perde", () => {
    const p = nova("todos", 4);
    const vencedores = p.confrontos.map((c) => c.ladoA[0] ?? -1);
    const depois = rodadaDecidida(p, vencedores);
    for (const c of p.confrontos) {
      const a = c.ladoA[0] ?? -1;
      const b = c.ladoB[0] ?? -1;
      expect(depois.jogadores[a]?.vida).toBe(cfg.vidaInicial);
      expect(depois.jogadores[b]?.vida).toBe(cfg.vidaInicial - danoDaDerrota(cfg, 2, 1));
      expect(depois.jogadores[a]?.ultimoAdversario).toBe(b);
    }
    expect(depois.economia.rodada).toBe(2);
    expect(depois.fase).toBe("preparacao");
  });

  it("empate (os dois sem ninguém) não tira vida de ninguém", () => {
    const depois = rodadaDecidida(nova(), []);
    expect(depois.jogadores.map((j) => j.vida)).toEqual(
      depois.jogadores.map(() => cfg.vidaInicial),
    );
  });

  it("vida zerada elimina, devolve as cartas ao baralho e tira o jogador das rodadas seguintes", () => {
    let p = nova("todos", 4);
    const fraco = p.confrontos[0]?.ladoB[0] ?? -1;
    p = { ...p, jogadores: p.jogadores.map((j, i) => (i === fraco ? { ...j, vida: 1 } : j)) };
    const antes = ctx.personagens.map((d) => d.id);
    const depois = rodadaDecidida(
      p,
      p.confrontos.map((c) => c.ladoA[0] ?? -1),
    );
    expect(depois.jogadores[fraco]?.eliminadoNaRodada).toBe(1);
    expect(depois.jogadores[fraco]?.vida).toBe(0);
    expect(depois.economia.jogadores[fraco]).toMatchObject({
      banco: [],
      campo: [],
      loja: [],
      pronto: true,
    });
    expect(
      depois.confrontos.flatMap((c) => [...c.ladoA, ...(c.fantasma ? [] : c.ladoB)]),
    ).not.toContain(fraco);
    expect(confrontoDoJogador(depois, fraco)).toBe(-1);
    // Nenhuma carta se perdeu.
    for (const id of antes) {
      const emJogo = depois.economia.jogadores.reduce(
        (s, j) =>
          s +
          j.loja.filter((c) => c === id).length +
          [...j.banco, ...j.campo.map((c) => c.unidade)]
            .filter((x) => x.personagem === id && x.id < 900)
            .reduce((t, x) => t + copiasDoNivel(x.nivel), 0),
        0,
      );
      expect((depois.economia.baralho[id] ?? 0) + emJogo).toBeGreaterThanOrEqual(
        config.copiasPorPersonagem,
      );
    }
  });

  it("o fantasma não perde vida quando a cópia dele perde", () => {
    let p = nova("todos", 3);
    p = {
      ...p,
      jogadores: p.jogadores.map((j, i) => (i === 3 ? { ...j, eliminadoNaRodada: 1 } : j)),
    };
    const sorteio = sortearConfrontos(p, criarAleatorio(5));
    p = { ...p, confrontos: sorteio.confrontos };
    const fantasma = p.confrontos.find((c) => c.fantasma);
    const real = p.confrontos.find((c) => !c.fantasma);
    if (!fantasma || !real) throw new Error("faltou confronto");
    const copiado = fantasma.ladoB[0] ?? -1;
    const sobra = fantasma.ladoA[0] ?? -1;
    // Só quem enfrenta o fantasma tem esquadrão: o copiado perde o duelo de verdade e a cópia perde o outro.
    const depois = rodadaDecidida(p, [
      sobra,
      real.ladoA[0] === copiado ? (real.ladoB[0] ?? -1) : (real.ladoA[0] ?? -1),
    ]);
    const perdasDoCopiado = cfg.vidaInicial - (depois.jogadores[copiado]?.vida ?? 0);
    expect(perdasDoCopiado).toBe(danoDaDerrota(cfg, 2, 1)); // uma derrota só, não duas
    expect(depois.jogadores[sobra]?.vida).toBe(cfg.vidaInicial);
  });

  it("a partida acaba quando sobra um, e a classificação segue a ordem de eliminação", () => {
    let p = nova("todos", 2);
    p = {
      ...p,
      jogadores: p.jogadores.map((j, i) =>
        i === 1
          ? { ...j, eliminadoNaRodada: 2, vida: 0 }
          : i === 3
            ? { ...j, eliminadoNaRodada: 4, vida: 0 }
            : i === 2
              ? { ...j, vida: 1 }
              : j,
      ),
    };
    // Estamos na rodada 5: os outros dois caíram nas rodadas 2 e 4.
    p = comEconomia(p, { ...p.economia, rodada: 5 });
    p = { ...p, confrontos: sortearConfrontos(p, criarAleatorio(1)).confrontos };
    const fim = rodadaDecidida(p, [0]);
    expect(fim.fase).toBe("fim");
    expect(fim.classificacao).toEqual([0, 2, 3, 1]);
    expect(concluirRodada(fim, ctx)).toBe(fim); // depois do fim, nada muda
  });
});

describe("modo 2x2", () => {
  it("um só confronto, com os dois de cada time juntos na mesma arena", () => {
    let p = nova("duplas", 1);
    expect(p.confrontos.map((c) => [c.ladoA, c.ladoB])).toEqual([
      [
        [0, 1],
        [2, 3],
      ],
    ]);
    for (let i = 0; i < 4; i++) p = comCampo(p, i, [u(100 + i, "lamina")]);
    const c = p.confrontos[0];
    if (!c) throw new Error("sem confronto");
    const [a, b] = esquadroesDoConfronto(p, ctx, arena, c);
    expect(a.map((v) => v.dono)).toEqual([0, 1]);
    expect(b.map((v) => v.dono)).toEqual([2, 3]);
    // O segundo jogador de cada lado usa os pontos do aliado: ninguém nasce no mesmo lugar.
    expect(new Set([...a, ...b].map((v) => v.x)).size).toBe(4);
    expect(a[1]?.x).toBe(arena.pontosAliado[0]?.x);
    const combate = criarCombate(arena, [a, b], c.semente);
    expect(combate.lutadores.map((l) => [l.lado, l.dono])).toEqual([
      [0, 0],
      [0, 1],
      [1, 2],
      [1, 3],
    ]);
    expect(simularCombate(combate).fim).not.toBeNull();
  });

  it("a vida é do time: os dois perdem juntos e a partida acaba quando um time zera", () => {
    let p = nova("duplas", 1);
    let depois = rodadaDecidida(p, [0, 1]);
    const perda = danoDaDerrota(cfg, 4, 1);
    expect(depois.jogadores.map((j) => j.vida)).toEqual(
      [20, 20, 20 - perda, 20 - perda].map((v) => v + cfg.vidaInicial - 20),
    );
    p = {
      ...depois,
      jogadores: depois.jogadores.map((j) => (j.time === 1 ? { ...j, vida: 1 } : j)),
    };
    depois = rodadaDecidida(p, [0, 1]);
    expect(depois.fase).toBe("fim");
    expect(depois.classificacao?.slice(0, 2).sort()).toEqual([0, 1]);
    expect(depois.jogadores.filter(estaVivo).map((j) => j.time)).toEqual([0, 0]);
  });
});

describe("bots", () => {
  const niveis: NivelBot[] = ["facil", "medio", "dificil"];

  it.each(niveis)(
    "o bot %s só emite comandos válidos, fica pronto e respeita os limites",
    (nivel) => {
      for (let s = 1; s <= 6; s++) {
        let p = nova("todos", s, [nivel, nivel, nivel, nivel]);
        for (let rodada = 0; rodada < 8 && p.fase !== "fim"; rodada++) {
          const jogada = jogarBots(p, ctx, arena);
          expect(jogada.recusados).toBe(0);
          p.jogadores.forEach((j, i) => {
            const eco = jogada.partida.economia.jogadores[i];
            if (!estaVivo(j) || !eco) return;
            expect(eco.pronto).toBe(true);
            expect(eco.campo.length).toBeLessThanOrEqual(limiteDeCampo(config, p.economia.rodada));
            expect(eco.banco.length).toBeLessThanOrEqual(config.tamanhoBanco);
            expect(eco.elixir).toBeGreaterThanOrEqual(0);
            expect(new Set(eco.campo.map((c) => c.ponto)).size).toBe(eco.campo.length);
          });
          p = concluirRodada(combater(jogada.partida, ctx, cfg, arena), ctx);
        }
      }
    },
  );

  it("o bot médio põe alguém em campo já na primeira rodada e busca fusões", () => {
    const p = nova("todos", 5);
    const jogada = jogarBot(
      p.economia,
      ctx,
      arena,
      { jogador: 0, nivel: "medio" },
      criarAleatorio(1),
    );
    expect(jogada.economia.jogadores[0]?.campo.length).toBeGreaterThan(0);
    expect(jogada.comandos.at(-1)).toEqual({ tipo: "pronto", jogador: 0 });
    // Com um lutador no banco e um lutador na loja, compra o lutador (e funde).
    const eco: EstadoEconomia = {
      ...p.economia,
      jogadores: p.economia.jogadores.map((j, i) =>
        i === 0
          ? { ...j, elixir: 4, loja: ["ancora", "lamina", "canhoneiro"], banco: [u(500, "lamina")] }
          : j,
      ),
    };
    const comFusao = jogarBot(eco, ctx, arena, { jogador: 0, nivel: "medio" }, criarAleatorio(1));
    expect(comFusao.comandos[0]).toEqual({ tipo: "comprar", jogador: 0, carta: 1 });
    const todas = [
      ...(comFusao.economia.jogadores[0]?.campo ?? []).map((c) => c.unidade),
      ...(comFusao.economia.jogadores[0]?.banco ?? []),
    ];
    expect(todas).toEqual([u(500, "lamina", 2)]);
  });

  it("o bot médio deixa o tanque na frente e o atirador atrás", () => {
    const p = nova("todos", 5);
    const eco: EstadoEconomia = {
      ...p.economia,
      rodada: 3,
      jogadores: p.economia.jogadores.map((j, i) =>
        i === 0
          ? { ...j, elixir: 0, banco: [u(500, "canhoneiro"), u(501, "ancora"), u(502, "lamina")] }
          : j,
      ),
    };
    const campo =
      jogarBot(eco, ctx, arena, { jogador: 0, nivel: "medio" }, criarAleatorio(1)).economia
        .jogadores[0]?.campo ?? [];
    const x = (personagem: string) =>
      arena.pontos[campo.find((c) => c.unidade.personagem === personagem)?.ponto ?? -1]?.x ?? 0;
    expect(campo).toHaveLength(3);
    expect(x("ancora")).toBeGreaterThan(x("lamina"));
    expect(x("lamina")).toBeGreaterThan(x("canhoneiro"));
  });

  it("bot de jogador eliminado ou humano não joga", () => {
    let p = criarPartida(
      ctx,
      cfg,
      "todos",
      [{ nome: "Você", bot: null }, ...bots(["medio", "medio", "medio"])],
      1,
    );
    p = {
      ...p,
      jogadores: p.jogadores.map((j, i) => (i === 3 ? { ...j, eliminadoNaRodada: 1 } : j)),
    };
    const depois = jogarBots(p, ctx, arena).partida;
    expect(depois.economia.jogadores[0]).toEqual(p.economia.jogadores[0]);
    expect(depois.economia.jogadores[3]).toEqual(p.economia.jogadores[3]);
    expect(depois.economia.jogadores[1]?.pronto).toBe(true);
  });
});

describe("partidas inteiras entre bots", () => {
  it("é determinística: mesma semente, mesma partida", () => {
    const a = jogarAteOFim(nova("todos", 21, ["facil", "medio", "medio", "facil"])).p;
    const b = jogarAteOFim(nova("todos", 21, ["facil", "medio", "medio", "facil"])).p;
    expect(a).toEqual(b);
  }, 60_000);

  it("todos contra todos: toda partida termina com classificação completa e sem comando recusado", () => {
    for (let s = 1; s <= 12; s++) {
      const { p, recusados } = jogarAteOFim(nova("todos", s, ["facil", "medio", "medio", "facil"]));
      expect(p.fase, `semente ${s}`).toBe("fim");
      expect(recusados).toBe(0);
      expect([...(p.classificacao ?? [])].sort()).toEqual([0, 1, 2, 3]);
      expect(p.jogadores.filter(estaVivo)).toHaveLength(1);
      expect(p.economia.rodada).toBeLessThan(40);
    }
  }, 60_000);

  it("2x2: toda partida termina com um time vencedor", () => {
    for (let s = 1; s <= 8; s++) {
      const { p, recusados } = jogarAteOFim(
        nova("duplas", s, ["medio", "facil", "medio", "facil"]),
      );
      expect(p.fase, `semente ${s}`).toBe("fim");
      expect(recusados).toBe(0);
      const times = new Set(p.jogadores.filter(estaVivo).map((j) => j.time));
      expect(times.size).toBe(1);
    }
  }, 60_000);

  it("bots melhores terminam em posições melhores", () => {
    const soma: Record<NivelBot, number> = { facil: 0, medio: 0, dificil: 0 };
    const vezes: Record<NivelBot, number> = { facil: 0, medio: 0, dificil: 0 };
    const mesas: NivelBot[][] = [
      ["facil", "medio", "dificil", "medio"],
      ["dificil", "facil", "medio", "facil"],
      ["medio", "dificil", "facil", "dificil"],
    ];
    for (let s = 1; s <= 12; s++) {
      const mesa = mesas[s % mesas.length] ?? [];
      const { p } = jogarAteOFim(nova("todos", s, mesa));
      (p.classificacao ?? []).forEach((jogador, posicao) => {
        const nivel = mesa[jogador];
        if (!nivel) return;
        soma[nivel] += posicao + 1;
        vezes[nivel]++;
      });
    }
    const media = (n: NivelBot) => soma[n] / vezes[n];
    expect(media("medio")).toBeLessThan(media("facil"));
    expect(media("dificil")).toBeLessThan(media("facil"));
  }, 120_000);
});
