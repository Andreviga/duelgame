import { describe, expect, it } from "vitest";
import { criarAleatorio, proximo } from "../src/sim/aleatorio";
import { avancarLaco, MAX_TICKS_POR_QUADRO, MS_POR_TICK, type Laco } from "../src/sim/laco";

const soma = (n: number) => n + 1;

describe("gerador com semente", () => {
  it("mesma semente gera a mesma sequência", () => {
    const seq = (semente: number) => {
      let rng = criarAleatorio(semente);
      const valores: number[] = [];
      for (let i = 0; i < 100; i++) {
        const r = proximo(rng);
        valores.push(r.valor);
        rng = r.rng;
      }
      return valores;
    };
    expect(seq(42)).toEqual(seq(42));
    expect(seq(42)).not.toEqual(seq(43));
    for (const v of seq(7)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("laço de passo fixo", () => {
  it("roda ticks inteiros e guarda o resto do tempo", () => {
    const laco = avancarLaco({ estado: 0, acumulado: 0 }, MS_POR_TICK * 2.5, soma);
    expect(laco.estado).toBe(2);
    expect(laco.acumulado).toBeCloseTo(MS_POR_TICK * 0.5);
  });

  it("o resultado não depende de como o tempo real é fatiado", () => {
    let fino: Laco<number> = { estado: 0, acumulado: 0 };
    for (let i = 0; i < 600; i++) fino = avancarLaco(fino, 5, soma);
    let grosso: Laco<number> = { estado: 0, acumulado: 0 };
    for (let i = 0; i < 100; i++) grosso = avancarLaco(grosso, 30, soma);
    expect(fino.estado).toBe(grosso.estado);
  });

  it("limita os ticks por quadro depois de uma pausa longa", () => {
    const laco = avancarLaco({ estado: 0, acumulado: 0 }, 10_000, soma);
    expect(laco.estado).toBe(MAX_TICKS_POR_QUADRO);
  });

  it("para no meio do quadro quando aoTick devolve false", () => {
    const laco = avancarLaco({ estado: 0, acumulado: 0 }, MS_POR_TICK * 4, soma, (n) => n < 2);
    expect(laco.estado).toBe(2);
  });
});
