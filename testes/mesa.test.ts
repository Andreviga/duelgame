import { describe, expect, it } from "vitest";
import { gerarCodigo, Mesa } from "../servidor/mesa";
import { jogarBot } from "../src/bots/bot";
import { arena, CONTEXTO as ctx, ECONOMIA } from "../src/dados";
import type { ComandoDoCliente, Visao } from "../src/rede/protocolo";
import { criarAleatorio } from "../src/sim/aleatorio";
import { criarCombate, simularCombate } from "../src/sim/combate/combate";
import { confrontoDoJogador, esquadroesDoConfronto, estaVivo } from "../src/sim/partida/partida";

const ESCALA = 1000; // os relógios da mesa correm mil vezes mais rápido
const MS_DE_PREPARACAO = (ECONOMIA.segundosPreparacao * 1000) / ESCALA;

function novaMesa(jogadores: number, modo: "todos" | "duplas" = "todos", semente = 5) {
  const mesa = new Mesa({
    codigo: "ABCD",
    modo,
    dificuldade: "medio",
    semente,
    escalaDeTempo: ESCALA,
  });
  const sessoes = Array.from({ length: jogadores }, (_, i) => `s${i}`);
  sessoes.forEach((s, i) => expect(mesa.entrar(s, `Pessoa ${i + 1}`)).toBeNull());
  return { mesa, sessoes };
}

const visao = (mesa: Mesa, sessao: string): Visao => {
  const v = mesa.visaoDe(sessao);
  if (!v) throw new Error("sem visão");
  return v;
};

/** O "cliente" de teste joga a preparação como um bot fácil, só com o que ele vê, e manda os comandos. */
function jogarComoCliente(mesa: Mesa, sessao: string, semente: number): void {
  const v = visao(mesa, sessao);
  if (!v.partida || v.partida.fase !== "preparacao") return;
  const jogada = jogarBot(
    v.partida.economia,
    ctx,
    arena(v.partida.arena),
    { jogador: v.eu, nivel: "facil" },
    criarAleatorio(semente),
  );
  for (const c of jogada.comandos) {
    const { jogador: _jogador, ...resto } = c;
    void _jogador;
    expect(mesa.comando(sessao, resto as ComandoDoCliente), JSON.stringify(c)).toBeNull();
  }
}

describe("sala", () => {
  it("aceita até quatro jogadores; o primeiro é o anfitrião", () => {
    const { mesa } = novaMesa(4);
    expect(mesa.entrar("s9", "Quinto")).toBe("sala_cheia");
    expect(mesa.info().vagas.map((v) => [v.nome, v.anfitriao])).toEqual([
      ["Pessoa 1", true],
      ["Pessoa 2", false],
      ["Pessoa 3", false],
      ["Pessoa 4", false],
    ]);
    expect(mesa.entrar("s0", "De novo")).toBeNull(); // mesma sessão: não duplica
    expect(mesa.info().vagas).toHaveLength(4);
  });

  it("nome vazio ou comprido demais é ajustado", () => {
    const mesa = new Mesa({ codigo: "ABCD", modo: "todos", dificuldade: "facil", semente: 1 });
    mesa.entrar("a", "   ");
    mesa.entrar("b", "Um nome muito, muito comprido mesmo");
    expect(mesa.info().vagas.map((v) => v.nome)).toEqual(["Jogador 1", "Um nome muito, m"]);
  });

  it("antes de começar, quem sai libera a vaga e o anfitrião passa para o próximo", () => {
    const { mesa } = novaMesa(3);
    mesa.sair("s0", 0, true);
    expect(mesa.info().vagas.map((v) => [v.nome, v.anfitriao])).toEqual([
      ["Pessoa 2", true],
      ["Pessoa 3", false],
    ]);
    expect(mesa.comecar("s2", 0)).toBe("nao_e_anfitriao");
    expect(mesa.comecar("s1", 0)).toBeNull();
  });

  it("só o anfitrião começa; as vagas vazias viram bots; depois ninguém mais entra", () => {
    const { mesa } = novaMesa(2);
    expect(mesa.comecar("s1", 0)).toBe("nao_e_anfitriao");
    expect(mesa.comecar("zz", 0)).toBe("fora_da_sala");
    expect(mesa.comecar("s0", 0)).toBeNull();
    expect(mesa.comecar("s0", 0)).toBe("sala_iniciada");
    expect(mesa.entrar("s5", "Atrasado")).toBe("sala_iniciada");
    const p = mesa.estado;
    expect(p?.jogadores.map((j) => [j.nome, j.bot])).toEqual([
      ["Pessoa 1", null],
      ["Pessoa 2", null],
      ["Bot 1", "medio"],
      ["Bot 2", "medio"],
    ]);
    // os bots já jogaram a preparação; os humanos ainda não
    expect(p?.economia.jogadores.map((j) => j.pronto)).toEqual([false, false, true, true]);
    expect(mesa.info().iniciada).toBe(true);
  });

  it("o código da sala tem 4 letras sem I, O ou Q", () => {
    let n = 0;
    const sorteio = () => (n += 0.137) % 1;
    for (let i = 0; i < 50; i++) expect(gerarCodigo(sorteio)).toMatch(/^[A-HJ-NPR-Z]{4}$/);
  });
});

describe("servidor autoritativo", () => {
  it("comando válido muda o estado do jogador que mandou, e só dele", () => {
    const { mesa } = novaMesa(2);
    mesa.comecar("s0", 0);
    const antes = mesa.estado?.economia.jogadores ?? [];
    const carta = antes[1]?.loja.findIndex((c) => c !== null) ?? 0;
    expect(mesa.comando("s1", { tipo: "comprar", carta })).toBeNull();
    const depois = mesa.estado?.economia.jogadores ?? [];
    expect(depois[1]?.banco).toHaveLength(1);
    expect(depois[1]?.elixir).toBeLessThan(antes[1]?.elixir ?? 0);
    expect(depois[0]).toEqual(antes[0]);
  });

  it("comando inválido é recusado e não muda nada", () => {
    const { mesa } = novaMesa(2);
    expect(mesa.comando("s0", { tipo: "atualizar" })).toBe("partida_nao_iniciada");
    mesa.comecar("s0", 0);
    const antes = mesa.estado;
    expect(mesa.comando("s0", { tipo: "vender", unidade: 999 })).toBe("unidade_invalida");
    expect(mesa.comando("s0", { tipo: "posicionar", unidade: 1, ponto: 99 })).toBe(
      "ponto_invalido",
    );
    expect(mesa.comando("zz", { tipo: "pronto" })).toBe("fora_da_sala");
    expect(mesa.estado).toBe(antes);
    // um comando forjado com o número de outro jogador não vale: o servidor usa a vaga de quem mandou
    const forjado = { tipo: "pronto", jogador: 1 } as unknown as ComandoDoCliente;
    expect(mesa.comando("s0", forjado)).toBeNull();
    expect(mesa.estado?.economia.jogadores.map((j) => j.pronto).slice(0, 2)).toEqual([true, false]);
  });

  it("cada jogador vê a própria loja e o próprio banco, não os dos outros", () => {
    const { mesa } = novaMesa(2);
    mesa.comecar("s0", 0);
    mesa.comando("s1", { tipo: "comprar", carta: 0 });
    const v0 = visao(mesa, "s0");
    const v1 = visao(mesa, "s1");
    expect(v0.eu).toBe(0);
    expect(v1.eu).toBe(1);
    expect(v0.partida?.economia.jogadores[0]?.loja).toHaveLength(ECONOMIA.tamanhoLoja);
    expect(v0.partida?.economia.jogadores[1]).toMatchObject({ loja: [], banco: [] });
    expect(v1.partida?.economia.jogadores[1]?.banco).toHaveLength(1);
    expect(v1.partida?.economia.jogadores[0]).toMatchObject({ loja: [], banco: [] });
    // o campo dos outros é público (é o que aparece na arena); baralho e geradores não saem do servidor
    expect(v0.partida?.economia.jogadores[2]?.campo.length).toBeGreaterThan(0);
    expect(v0.partida?.economia.baralho).toEqual({});
    expect(v0.partida?.rng).toEqual({ s: 0 });
    expect(v0.partida?.economia.rng).toEqual({ s: 0 });
    expect(mesa.visaoDe("zz")).toBeNull();
  });
});

describe("relógio da mesa", () => {
  it("a preparação acaba quando todos ficam prontos, sem esperar o tempo", () => {
    const { mesa } = novaMesa(2);
    mesa.comecar("s0", 0);
    expect(mesa.avancar(1)).toBe(false);
    mesa.comando("s0", { tipo: "pronto" });
    expect(mesa.avancar(2)).toBe(false);
    mesa.comando("s1", { tipo: "pronto" });
    expect(mesa.avancar(3)).toBe(true);
    expect(mesa.estado?.fase).toBe("combate");
    expect(mesa.estado?.resultados).toHaveLength(2);
    expect(mesa.comando("s0", { tipo: "atualizar" })).toBe("preparacao_encerrada");
  });

  it("a preparação também acaba pelo tempo; o cronômetro vai na visão", () => {
    const { mesa } = novaMesa(1);
    mesa.comecar("s0", 0);
    mesa.avancar(MS_DE_PREPARACAO / 2);
    const meio = visao(mesa, "s0");
    expect(meio.msRestantes).toBeCloseTo(MS_DE_PREPARACAO / 2);
    expect(meio.partida?.economia.ticksRestantes).toBe((ECONOMIA.segundosPreparacao * 60) / 2);
    expect(meio.partida?.fase).toBe("preparacao");
    expect(mesa.avancar(MS_DE_PREPARACAO + 1)).toBe(true);
    expect(mesa.estado?.fase).toBe("combate");
  });

  it("depois do tempo do combate, abre a preparação da rodada seguinte", () => {
    const { mesa } = novaMesa(1);
    mesa.comecar("s0", 0);
    mesa.comando("s0", { tipo: "pronto" });
    mesa.avancar(1);
    const espera = visao(mesa, "s0").msRestantes;
    expect(espera).toBeGreaterThan(0);
    expect(mesa.avancar(1 + espera / 2)).toBe(false);
    expect(mesa.avancar(2 + espera)).toBe(true);
    expect(mesa.estado?.fase).toBe("preparacao");
    expect(mesa.estado?.economia.rodada).toBe(2);
    expect(mesa.estado?.economia.jogadores[0]?.pronto).toBe(false);
  });
});

describe("partida inteira pela mesa", () => {
  it.each(["todos", "duplas"] as const)(
    "%s: quatro clientes jogam até o fim e todos veem o mesmo combate",
    (modo) => {
      const { mesa, sessoes } = novaMesa(4, modo, 11);
      mesa.comecar("s0", 0);
      let agora = 0;
      let conferidos = 0;
      for (let passo = 0; passo < 400 && !mesa.encerrada; passo++) {
        const fase = mesa.estado?.fase;
        if (fase === "preparacao") {
          sessoes.forEach((s, i) => jogarComoCliente(mesa, s, passo * 10 + i));
          agora += 1;
          mesa.avancar(agora);
          expect(mesa.estado?.fase).toBe("combate");
          // cada cliente simula o próprio combate só com o que recebeu e compara com o servidor
          for (const s of sessoes) {
            const v = visao(mesa, s);
            const p = v.partida;
            if (!p) continue;
            const i = confrontoDoJogador(p, v.eu);
            const confronto = p.confrontos[i];
            if (!confronto) continue;
            const esquadroes = esquadroesDoConfronto(p, ctx, arena(p.arena), confronto);
            const final = simularCombate(
              criarCombate(arena(p.arena), esquadroes, confronto.semente),
            );
            expect(final.fim?.vencedor).toBe(p.resultados[i]?.vencedor);
            expect(mesa.conferir(s, p.economia.rodada, final.fim?.vencedor ?? null)).toBe(true);
            conferidos++;
          }
        } else {
          agora += visao(mesa, "s0").msRestantes + 1;
          mesa.avancar(agora);
        }
      }
      const p = mesa.estado;
      expect(p?.fase).toBe("fim");
      expect([...(p?.classificacao ?? [])].sort()).toEqual([0, 1, 2, 3]);
      expect(conferidos).toBeGreaterThan(8);
      expect(mesa.divergencias).toEqual([]);
      expect(mesa.conferir("s0", p?.economia.rodada ?? 0, 0)).toBeTypeOf("boolean");
    },
  );

  it("um resultado diferente do servidor fica registrado como divergência", () => {
    const { mesa } = novaMesa(1);
    mesa.comecar("s0", 0);
    mesa.comando("s0", { tipo: "pronto" });
    mesa.avancar(1);
    const certo = mesa.estado?.resultados[confrontoDoJogador(mesa.estado, 0)]?.vencedor ?? null;
    expect(mesa.conferir("s0", 1, certo)).toBe(true);
    expect(mesa.conferir("s0", 1, certo === 0 ? 1 : 0)).toBe(false);
    expect(mesa.divergencias).toHaveLength(1);
  });
});

describe("queda e reconexão", () => {
  const PRAZO = (60 * 1000) / ESCALA;

  it("quem cai é jogado por um bot; se volta a tempo, retoma a vaga", () => {
    const { mesa } = novaMesa(2);
    mesa.comecar("s0", 0);
    mesa.sair("s1", 10, false);
    expect(mesa.info().vagas[1]?.conectado).toBe(false);
    expect(mesa.estado?.jogadores[1]?.bot).toBe("medio");
    expect(mesa.sessoes()).toEqual(["s0"]);

    // a rodada anda sem ele: no fim do tempo, o bot joga a preparação que ele deixou pela metade
    mesa.comando("s0", { tipo: "pronto" });
    mesa.avancar(MS_DE_PREPARACAO + 1);
    expect(mesa.estado?.fase).toBe("combate");
    expect(mesa.estado?.economia.jogadores[1]?.pronto).toBe(true);
    expect(mesa.estado?.economia.jogadores[1]?.campo.length).toBeGreaterThan(0);

    expect(mesa.voltar("s1")).toBe(true);
    expect(mesa.info().vagas[1]?.conectado).toBe(true);
    expect(mesa.estado?.jogadores[1]?.bot).toBeNull();
    expect(visao(mesa, "s1").eu).toBe(1);
  });

  it("depois do prazo, a vaga fica com o bot até o fim", () => {
    const { mesa } = novaMesa(2);
    mesa.comecar("s0", 0);
    mesa.sair("s1", 10, false);
    mesa.avancar(10 + PRAZO / 2); // ainda dentro do prazo: a vaga continua reservada
    mesa.avancar(11 + PRAZO);
    expect(mesa.voltar("s1")).toBe(false);
    expect(mesa.estado?.jogadores[1]?.bot).toBe("medio");
  });

  it("quem sai de propósito não volta; a partida continua e termina", () => {
    const { mesa } = novaMesa(2, "todos", 3);
    mesa.comecar("s0", 0);
    mesa.sair("s1", 5, true);
    expect(mesa.voltar("s1")).toBe(false);
    let agora = 5;
    for (let passo = 0; passo < 400 && !mesa.encerrada; passo++) {
      if (mesa.estado?.fase === "preparacao") mesa.comando("s0", { tipo: "pronto" });
      agora += visao(mesa, "s0").msRestantes + 1;
      mesa.avancar(agora);
    }
    expect(mesa.encerrada).toBe(true);
    // o jogador que ficou só apertou "pronto": perdeu; mas a vaga do que saiu jogou de verdade
    const p = mesa.estado;
    expect(p?.jogadores.filter(estaVivo).length).toBe(1);
    expect(mesa.vazia).toBe(false);
    mesa.sair("s0", agora, true);
    expect(mesa.vazia).toBe(true);
  });
});
