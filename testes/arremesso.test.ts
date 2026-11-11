import { describe, expect, it } from "vitest";
import {
  forcaArremesso,
  ticksDeAtordoamento,
  velocidadeDeArremesso,
} from "../src/sim/combate/arremesso";
import { personagem } from "../src/dados";

const ataque = { ...personagem("lamina").ataque, arremessoBase: 5, arremessoCrescimento: 0.1 };

describe("fórmula de arremesso", () => {
  it("com 0% e peso de referência, é a força base", () => {
    expect(forcaArremesso(ataque, 0, 100)).toBeCloseTo(5);
  });

  it("cresce em linha reta com a porcentagem do alvo", () => {
    expect(forcaArremesso(ataque, 50, 100)).toBeCloseTo(10);
    expect(forcaArremesso(ataque, 100, 100)).toBeCloseTo(15);
    expect(forcaArremesso(ataque, 150, 100)).toBeCloseTo(20);
  });

  it("alvo mais pesado voa menos; mais leve voa mais", () => {
    expect(forcaArremesso(ataque, 100, 200)).toBeCloseTo(7.5);
    expect(forcaArremesso(ataque, 100, 50)).toBeCloseTo(30);
    expect(forcaArremesso(ataque, 80, 150)).toBeLessThan(forcaArremesso(ataque, 80, 100));
  });

  it("o atordoamento cresce com a força", () => {
    expect(ticksDeAtordoamento(5)).toBe(15);
    expect(ticksDeAtordoamento(20)).toBe(42);
    expect(ticksDeAtordoamento(20)).toBeGreaterThan(ticksDeAtordoamento(10));
  });

  it("a velocidade segue o ângulo e a direção", () => {
    const d = velocidadeDeArremesso(10, 0, 1);
    expect(d.vx).toBeCloseTo(10);
    expect(d.vy).toBeCloseTo(0);
    const e = velocidadeDeArremesso(10, 90, -1);
    expect(e.vx).toBeCloseTo(0);
    expect(e.vy).toBeCloseTo(-10);
    const diag = velocidadeDeArremesso(10, 45, -1);
    expect(diag.vx).toBeLessThan(0);
    expect(diag.vy).toBeLessThan(0);
    expect(Math.hypot(diag.vx, diag.vy)).toBeCloseTo(10);
  });
});
