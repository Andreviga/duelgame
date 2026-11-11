import { describe, expect, it } from "vitest";
import { criarAleatorio, proximo } from "../src/sim/aleatorio";
import { criarEstado } from "../src/sim/estado";
import { simular, step } from "../src/sim/step";
import { avancarLaco, MAX_TICKS_POR_QUADRO, MS_POR_TICK } from "../src/sim/laco";

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

describe("simulação", () => {
  it("duas execuções com a mesma semente dão o mesmo estado", () => {
    const a = simular(criarEstado(12345), 60 * 90);
    const b = simular(criarEstado(12345), 60 * 90);
    expect(a).toEqual(b);
    expect(a.tick).toBe(60 * 90);
  });

  it("sementes diferentes dão estados diferentes", () => {
    expect(simular(criarEstado(1), 100)).not.toEqual(simular(criarEstado(2), 100));
  });

  it("step não altera o estado recebido", () => {
    const inicial = criarEstado(9);
    const copia = structuredClone(inicial);
    step(inicial);
    expect(inicial).toEqual(copia);
  });
});

describe("laço de passo fixo", () => {
  it("roda ticks inteiros e guarda o resto do tempo", () => {
    const laco = avancarLaco({ estado: criarEstado(1), acumulado: 0 }, MS_POR_TICK * 2.5);
    expect(laco.estado.tick).toBe(2);
    expect(laco.acumulado).toBeCloseTo(MS_POR_TICK * 0.5);
  });

  it("o resultado não depende de como o tempo real é fatiado", () => {
    let fino = { estado: criarEstado(5), acumulado: 0 };
    for (let i = 0; i < 600; i++) fino = avancarLaco(fino, 5);
    let grosso = { estado: criarEstado(5), acumulado: 0 };
    for (let i = 0; i < 100; i++) grosso = avancarLaco(grosso, 30);
    expect(fino.estado).toEqual(grosso.estado);
  });

  it("limita os ticks por quadro depois de uma pausa longa", () => {
    const laco = avancarLaco({ estado: criarEstado(1), acumulado: 0 }, 10_000);
    expect(laco.estado.tick).toBe(MAX_TICKS_POR_QUADRO);
  });
});
