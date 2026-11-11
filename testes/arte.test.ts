import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  alturaDoPersonagem,
  montarAtlas,
  nomeDoQuadro,
  validarQuadros,
} from "../ferramentas/arte/atlas";
import { codificarPng, decodificarPng, type Imagem } from "../ferramentas/arte/png";
import { ARENA_BASICA as arena, personagem } from "../src/dados";
import {
  animacaoDoLutador,
  ESPEC,
  nomeDoQuadro as nomeNoJogo,
  quadroDeNocaute,
  TICKS_DE_NOCAUTE,
} from "../src/render/animacao";
import { criarLutador } from "../src/sim/combate/combate";
import type { Lutador } from "../src/sim/combate/tipos";

/** Especificação pequena (quadros de 16 px) para os testes rodarem rápido. */
const espec = { ...ESPEC, quadro: 16 };

/** Quadro de teste: um bloco opaco cuja posição e cor dependem de `variante`. */
function quadro(variante: number, lado = 16): Imagem {
  const rgba = new Uint8Array(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      const dentro = y >= 2 && y < Math.round(lado * espec.linhaDeBase) && x >= 3;
      rgba[i] = (variante * 37) % 256;
      rgba[i + 1] = (x * 16) % 256;
      rgba[i + 2] = (y * 16) % 256;
      rgba[i + 3] = dentro ? 255 : 0;
    }
  }
  return { largura: lado, altura: lado, rgba };
}

function conjuntoCompleto(): Map<string, Imagem> {
  const m = new Map<string, Imagem>();
  let n = 0;
  for (const a of espec.animacoes) {
    for (let i = 0; i < a.quadros; i++) m.set(nomeDoQuadro(a.nome, i), quadro(n++));
  }
  return m;
}
const validar = (m: Map<string, Imagem>) => validarQuadros(m, { ...espec });
/** `MINIMO_DE_PIXELS` é para quadros de 256 px; nos de 16 px dos testes o bloco opaco tem menos. */
const semVazios = (erros: string[]) => erros.filter((e) => !e.includes("vazio"));

describe("PNG", () => {
  it("o que é escrito é lido de volta igual", () => {
    const original = quadro(5, 32);
    const lido = decodificarPng(codificarPng(original, deflateSync), inflateSync);
    expect(lido.largura).toBe(32);
    expect(lido.altura).toBe(32);
    expect(Array.from(lido.rgba)).toEqual(Array.from(original.rgba));
  });

  it("recusa o que não é PNG", () => {
    expect(() => decodificarPng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), inflateSync)).toThrow(
      /PNG/,
    );
  });
});

describe("validação dos quadros", () => {
  it("um conjunto completo passa", () => {
    expect(semVazios(validar(conjuntoCompleto()))).toEqual([]);
    expect(conjuntoCompleto().size).toBe(49);
  });

  it("acusa animação ausente", () => {
    const m = conjuntoCompleto();
    for (let i = 0; i < 6; i++) m.delete(nomeDoQuadro("nocaute", i));
    expect(semVazios(validar(m))).toEqual(['animação "nocaute" ausente']);
  });

  it("acusa número de quadros errado, para menos e para mais", () => {
    const menos = conjuntoCompleto();
    menos.delete(nomeDoQuadro("atacar", 5));
    expect(semVazios(validar(menos))).toEqual(['animação "atacar": 5 quadros, esperado 6']);
    const mais = conjuntoCompleto();
    mais.set(nomeDoQuadro("atacar", 6), quadro(99));
    expect(semVazios(validar(mais))).toEqual(["atacar_6: quadro que não está na especificação"]);
  });

  it("acusa quadro vazio", () => {
    const m = conjuntoCompleto();
    m.set(nomeDoQuadro("cair", 1), { largura: 16, altura: 16, rgba: new Uint8Array(16 * 16 * 4) });
    expect(validar(m)).toContain("cair_1: quadro vazio");
  });

  it("acusa quadro de tamanho errado", () => {
    const m = conjuntoCompleto();
    m.set(nomeDoQuadro("parado", 0), quadro(1, 32));
    expect(semVazios(validar(m))).toEqual(["parado_0: tamanho 32x32, esperado 16x16"]);
  });

  it("acusa quadro repetido dentro de andar (e só de andar)", () => {
    const m = conjuntoCompleto();
    const primeiro = m.get(nomeDoQuadro("andar", 0));
    if (!primeiro) throw new Error("sem quadro");
    m.set(nomeDoQuadro("andar", 5), primeiro);
    expect(semVazios(validar(m))).toEqual(['animação "andar": os quadros 0 e 5 são iguais']);
    const parado = conjuntoCompleto();
    const p0 = parado.get(nomeDoQuadro("parado", 0));
    if (p0) parado.set(nomeDoQuadro("parado", 3), p0);
    expect(semVazios(validar(parado))).toEqual([]);
  });
});

describe("atlas", () => {
  it("cada quadro vai para a sua célula, uma animação por linha, no formato que o Phaser lê", () => {
    const m = conjuntoCompleto();
    const { imagem, json } = montarAtlas("lamina", m, espec);
    expect([imagem.largura, imagem.altura]).toEqual([8 * 16, 9 * 16]);
    expect(Object.keys(json.frames)).toHaveLength(49);
    expect(json.frames["andar_3"]?.frame).toEqual({ x: 48, y: 16, w: 16, h: 16 });
    expect(json.meta.image).toBe("lamina.png");
    expect(json.meta.animacoes["cair"]).toEqual({ quadros: 2, laco: true });
    // os pixels da célula são os do quadro original
    const original = m.get("andar_3");
    const x0 = 48;
    const y0 = 16;
    for (const [x, y] of [
      [0, 0],
      [5, 7],
      [15, 15],
    ] as const) {
      const noAtlas = imagem.rgba.subarray(
        ((y0 + y) * imagem.largura + x0 + x) * 4,
        ((y0 + y) * imagem.largura + x0 + x) * 4 + 4,
      );
      const noQuadro = original?.rgba.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
      expect(Array.from(noAtlas)).toEqual(Array.from(noQuadro ?? []));
    }
  });

  it("mede a altura do personagem dos pés (linha de base) ao topo", () => {
    const m = conjuntoCompleto();
    expect(alturaDoPersonagem(m, espec)).toBe(Math.round(16 * espec.linhaDeBase) - 2);
    expect(montarAtlas("x", m, espec).json.meta.alturaDoPersonagem).toBe(
      alturaDoPersonagem(m, espec),
    );
  });

  it("o atlas publicado do jogo tem todos os quadros da especificação", async () => {
    const { default: atlas } = await import("../public/sprites/lamina.json");
    const nomes = ESPEC.animacoes.flatMap((a) =>
      Array.from({ length: a.quadros }, (_, i) => `${a.nome}_${i}`),
    );
    expect(Object.keys(atlas.frames).sort()).toEqual(nomes.sort());
    expect(atlas.meta.alturaDoPersonagem).toBeGreaterThan(100);
  });
});

describe("animação a partir do estado da simulação", () => {
  const def = personagem("lamina");
  const base = (ajuste: Partial<Lutador> = {}): Lutador => ({
    ...criarLutador(def, 0, 0, 500, arena.chao.y),
    noChao: true,
    ...ajuste,
  });
  const anim = (ajuste: Partial<Lutador>, tick = 0) => animacaoDoLutador(base(ajuste), tick);

  it("parado, andando, pulando e caindo", () => {
    expect(anim({}).animacao).toBe("parado");
    expect(anim({ vx: 3 }).animacao).toBe("andar");
    expect(anim({ vx: -3 }).animacao).toBe("andar");
    expect(anim({ noChao: false, vy: -8 }).animacao).toBe("pular");
    expect(anim({ noChao: false, vy: 5 }).animacao).toBe("cair");
  });

  it("o golpe percorre os quadros de atacar do começo ao fim", () => {
    const a = def.ataque;
    const quadros = [
      anim({ ataque: { fase: "inicio", ticks: a.inicio, acertou: false } }),
      anim({ ataque: { fase: "ativo", ticks: a.ativo, acertou: false } }),
      anim({ ataque: { fase: "recuperacao", ticks: 1, acertou: true } }),
    ];
    expect(quadros.map((q) => q.animacao)).toEqual(["atacar", "atacar", "atacar"]);
    expect(quadros[0]?.indice).toBe(0);
    expect(quadros[1]?.indice).toBeGreaterThan(0);
    expect(quadros[2]?.indice).toBe(5);
  });

  it("a habilidade em andamento usa a animação de habilidade", () => {
    const duracao = def.habilidade.duracao;
    const inicio = anim({ hab: { ticks: duracao, atingidos: [], restante: 0, alvo: null } });
    const fim = anim({ hab: { ticks: 1, atingidos: [], restante: 0, alvo: null } });
    expect(inicio).toEqual({ animacao: "habilidade", indice: 0 });
    expect(fim.animacao).toBe("habilidade");
    expect(fim.indice).toBeGreaterThan(4);
  });

  it("atordoado no ar é arremessado; no chão, atingido; e os dois têm prioridade sobre o resto", () => {
    expect(anim({ atordoado: 20, noChao: false, lancado: true }).animacao).toBe("arremessado");
    expect(anim({ atordoado: 20 })).toEqual({ animacao: "atingido", indice: 0 });
    expect(anim({ atordoado: 3 })).toEqual({ animacao: "atingido", indice: 2 });
    const golpeando = { fase: "ativo" as const, ticks: 2, acertou: false };
    expect(anim({ atordoado: 10, ataque: golpeando, vx: 5 }).animacao).toBe("atingido");
  });

  it("as animações em laço avançam com o relógio, a 12 quadros por segundo, e dão a volta", () => {
    const ticksPorQuadro = 60 / ESPEC.quadrosPorSegundo;
    expect(anim({ vx: 3 }, 0).indice).toBe(0);
    expect(anim({ vx: 3 }, ticksPorQuadro).indice).toBe(1);
    expect(anim({ vx: 3 }, ticksPorQuadro * 7).indice).toBe(7);
    expect(anim({ vx: 3 }, ticksPorQuadro * 8).indice).toBe(0);
  });

  it("todo quadro escolhido existe no atlas", () => {
    const nomes = new Set(
      ESPEC.animacoes.flatMap((a) => Array.from({ length: a.quadros }, (_, i) => `${a.nome}_${i}`)),
    );
    const estados: Partial<Lutador>[] = [
      {},
      { vx: 4 },
      { noChao: false, vy: -13 },
      { noChao: false, vy: -0.1 },
      { noChao: false, vy: 12 },
      { atordoado: 40, noChao: false },
      { atordoado: 1 },
      { hab: { ticks: 3, atingidos: [], restante: 0, alvo: null } },
      { ataque: { fase: "recuperacao", ticks: 12, acertou: true } },
    ];
    for (const estado of estados) {
      for (const tick of [0, 7, 33, 1000])
        expect(nomes.has(nomeNoJogo(anim(estado, tick)))).toBe(true);
    }
    for (let t = 0; t <= TICKS_DE_NOCAUTE + 5; t++)
      expect(nomes.has(nomeNoJogo(quadroDeNocaute(t)))).toBe(true);
    expect(quadroDeNocaute(0).indice).toBe(0);
    expect(quadroDeNocaute(TICKS_DE_NOCAUTE).indice).toBe(5);
  });
});
