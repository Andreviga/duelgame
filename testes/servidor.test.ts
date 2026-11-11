import { Client, type Room } from "@colyseus/sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jogarBot } from "../src/bots/bot";
import { arena, CONTEXTO as ctx } from "../src/dados";
import { MSG, NOME_DA_SALA, type ComandoDoCliente, type Visao } from "../src/rede/protocolo";
import { criarAleatorio } from "../src/sim/aleatorio";
import { criarCombate, simularCombate } from "../src/sim/combate/combate";
import { confrontoDoJogador, esquadroesDoConfronto } from "../src/sim/partida/partida";

/**
 * Teste de integração: sobe o servidor Colyseus de verdade em uma porta local e conecta
 * clientes pela rede (WebSocket), como o jogo faz. Os relógios da sala correm acelerados.
 */
const PORTA = 2571;
const ESCALA = 150;
let servidor: { gracefullyShutdown: (sair: boolean) => Promise<unknown> };

beforeAll(async () => {
  process.env["SERVIDOR_EM_TESTE"] = "1";
  const { iniciarServidor } = await import("../servidor/index");
  servidor = await iniciarServidor(PORTA);
});

afterAll(async () => {
  await servidor.gracefullyShutdown(false);
});

interface Jogador {
  sala: Room;
  visoes: Visao[];
  erros: string[];
  /** Rodadas em que este cliente já jogou a preparação e em que já conferiu o combate. */
  preparadas: Set<number>;
  /** Estado do próprio jogador quando mandou o último comando (espera mudar para mandar outro). */
  esperando: string;
  conferidas: Map<number, boolean>;
  fim: Promise<Visao>;
}

function ligar(sala: Room, jogaSozinho: boolean): Jogador {
  const j: Jogador = {
    sala,
    visoes: [],
    erros: [],
    preparadas: new Set(),
    esperando: "",
    conferidas: new Map(),
    fim: Promise.resolve(null as unknown as Visao),
  };
  j.fim = new Promise<Visao>((resolver) => {
    sala.onMessage(MSG.erro, (m: { erro: string }) => j.erros.push(m.erro));
    sala.onMessage(MSG.visao, (v: Visao) => {
      j.visoes.push(v);
      const p = v.partida;
      if (!p) return;
      const rodada = p.economia.rodada;
      const eu = p.economia.jogadores[v.eu];
      if (p.fase === "fim") resolver(v);
      if (p.fase === "preparacao" && jogaSozinho && eu && !eu.pronto) {
        // Joga como o jogo de verdade: um comando por vez, e só manda o próximo depois que
        // o servidor responde com o estado novo (os ids das unidades quem dá é o servidor).
        const meuEstado = JSON.stringify(eu);
        if (meuEstado === j.esperando) return;
        j.esperando = meuEstado;
        j.preparadas.add(rodada);
        const jogada = jogarBot(
          p.economia,
          ctx,
          arena(p.arena),
          { jogador: v.eu, nivel: "medio" },
          criarAleatorio(rodada * 7 + v.eu),
        );
        const primeiro = jogada.comandos[0];
        if (primeiro) {
          const { jogador: _jogador, ...resto } = primeiro;
          void _jogador;
          sala.send(MSG.comando, resto as ComandoDoCliente);
        }
      }
      if (p.fase === "combate" && !j.conferidas.has(rodada)) {
        // simula o próprio combate e compara com o resultado que o servidor mandou
        const i = confrontoDoJogador(p, v.eu);
        const confronto = p.confrontos[i];
        if (!confronto) return;
        const onde = arena(p.arena);
        const final = simularCombate(
          criarCombate(onde, esquadroesDoConfronto(p, ctx, onde, confronto), confronto.semente),
        );
        j.conferidas.set(rodada, final.fim?.vencedor === p.resultados[i]?.vencedor);
        sala.send("conferir", { rodada, vencedor: final.fim?.vencedor ?? null });
      }
    });
  });
  return j;
}

const cliente = () => new Client(`ws://localhost:${PORTA}`);
const prazo = <T>(promessa: Promise<T>, ms: number, oQue: string): Promise<T> =>
  Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error(`tempo esgotado: ${oQue}`)), ms),
    ),
  ]);

describe("servidor de jogo (Colyseus)", () => {
  it("quatro clientes entram por código, jogam a partida inteira e veem os mesmos combates", async () => {
    const anfitriao = await cliente().create(NOME_DA_SALA, {
      nome: "Ana",
      modo: "todos",
      dificuldade: "facil",
      escalaDeTempo: ESCALA,
    });
    const codigo = anfitriao.roomId;
    expect(codigo).toMatch(/^[A-Z]{4}$/);
    const jogadores = [ligar(anfitriao, true)];
    for (const nome of ["Bia", "Caio", "Duda"]) {
      jogadores.push(ligar(await cliente().joinById(codigo, { nome }), true));
    }
    // sala cheia: o quinto não entra
    await expect(cliente().joinById(codigo, { nome: "Eva" })).rejects.toThrow();

    anfitriao.send(MSG.comecar);
    const finais = await prazo(Promise.all(jogadores.map((j) => j.fim)), 90_000, "fim da partida");

    const classificacao = finais[0]?.partida?.classificacao;
    expect([...(classificacao ?? [])].sort()).toEqual([0, 1, 2, 3]);
    for (const [i, v] of finais.entries()) {
      expect(v.eu).toBe(i);
      expect(v.partida?.classificacao).toEqual(classificacao); // todos viram o mesmo fim
      expect(v.sala.vagas.map((x) => x.nome)).toEqual(["Ana", "Bia", "Caio", "Duda"]);
    }
    for (const j of jogadores) {
      expect(j.erros).toEqual([]);
      expect(j.conferidas.size).toBeGreaterThan(0);
      expect([...j.conferidas.values()].every(Boolean)).toBe(true); // combate do cliente = do servidor
      // nunca recebeu a loja nem o banco de outro jogador
      for (const v of j.visoes) {
        v.partida?.economia.jogadores.forEach((outro, k) => {
          if (k !== v.eu) expect(outro.loja.length + outro.banco.length).toBe(0);
        });
      }
    }
    await Promise.all(jogadores.map((j) => j.sala.leave()));
  }, 120_000);

  it("sala com um jogador: as vagas vazias viram bots; comando inválido volta como erro", async () => {
    const sala = await cliente().create(NOME_DA_SALA, {
      nome: "Solo",
      modo: "duplas",
      dificuldade: "medio",
      escalaDeTempo: ESCALA,
    });
    const j = ligar(sala, false);
    sala.send(MSG.comecar);
    await prazo(
      new Promise<void>((ok) => {
        const espera = setInterval(() => {
          if (j.visoes.some((v) => v.partida?.fase === "preparacao")) {
            clearInterval(espera);
            ok();
          }
        }, 20);
      }),
      10_000,
      "começo da partida",
    );
    const p = j.visoes.at(-1)?.partida;
    expect(p?.modo).toBe("duplas");
    expect(p?.jogadores.map((x) => x.bot)).toEqual([null, "medio", "medio", "medio"]);
    sala.send(MSG.comando, { tipo: "vender", unidade: 12345 });
    await prazo(
      new Promise<void>((ok) => {
        const espera = setInterval(() => {
          if (j.erros.length > 0) {
            clearInterval(espera);
            ok();
          }
        }, 20);
      }),
      5_000,
      "erro do comando",
    );
    expect(j.erros).toEqual(["unidade_invalida"]);
    await sala.leave();
  }, 30_000);

  it("quem sai no meio é substituído por um bot e a partida termina para quem ficou", async () => {
    const a = await cliente().create(NOME_DA_SALA, {
      nome: "Fica",
      modo: "todos",
      dificuldade: "facil",
      escalaDeTempo: ESCALA,
    });
    const b = await cliente().joinById(a.roomId, { nome: "Sai" });
    const ja = ligar(a, true);
    const jb = ligar(b, true);
    a.send(MSG.comecar);
    await prazo(
      new Promise<void>((ok) => {
        const espera = setInterval(() => {
          if (jb.visoes.some((v) => (v.partida?.economia.rodada ?? 0) >= 2)) {
            clearInterval(espera);
            ok();
          }
        }, 20);
      }),
      30_000,
      "segunda rodada",
    );
    await b.leave();
    const fim = await prazo(ja.fim, 90_000, "fim da partida");
    expect(fim.sala.vagas[1]).toMatchObject({ nome: "Sai", conectado: false });
    expect(fim.partida?.jogadores[1]?.bot).toBe("facil");
    expect(fim.partida?.fase).toBe("fim");
    await a.leave();
  }, 120_000);
});
