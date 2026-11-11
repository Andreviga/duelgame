import { describe, expect, it } from "vitest";
import { ARENA_BASICA as arena, personagem } from "../src/dados";
import { criarLutador } from "../src/sim/combate/combate";
import { foraDosLimites, moverLutador } from "../src/sim/combate/fisica";
import type { Entrada, Evento, Lutador } from "../src/sim/combate/tipos";

const def = personagem("lamina");
const NADA: Entrada = {
  mover: 0,
  pular: false,
  descer: false,
  atacar: false,
  habilidade: false,
  encarar: 0,
};
const PULAR: Entrada = { ...NADA, pular: true };

function rodar(l: Lutador, ticks: number, entrada: Entrada = NADA): Evento[] {
  const eventos: Evento[] = [];
  for (let i = 0; i < ticks; i++) moverLutador(l, entrada, arena, eventos);
  return eventos;
}

const plataforma = arena.plataformas[0] ?? { x: 0, y: 0, largura: 0 };
const meioDaPlataforma = plataforma.x + plataforma.largura / 2;

describe("física", () => {
  it("cai e pousa no chão sólido", () => {
    const l = criarLutador(def, 0, 0, 600, 450);
    const eventos = rodar(l, 60);
    expect(l.y).toBe(arena.chao.y);
    expect(l.noChao).toBe(true);
    expect(l.emPlataforma).toBe(false);
    expect(eventos.filter((e) => e.tipo === "pouso")).toHaveLength(1);
  });

  it("pousa em plataforma quando vem de cima", () => {
    const l = criarLutador(def, 0, 0, meioDaPlataforma, plataforma.y - 80);
    rodar(l, 60);
    expect(l.y).toBe(plataforma.y);
    expect(l.emPlataforma).toBe(true);
  });

  it("atravessa a plataforma quando sobe por baixo", () => {
    const l = criarLutador(def, 0, 0, meioDaPlataforma, arena.chao.y);
    rodar(l, 2);
    moverLutador(l, PULAR, arena, []);
    let maisAlto = l.y;
    for (let i = 0; i < 20; i++) {
      moverLutador(l, NADA, arena, []);
      maisAlto = Math.min(maisAlto, l.y);
    }
    expect(maisAlto).toBeLessThan(plataforma.y); // passou por dentro dela
    rodar(l, 60);
    expect(l.y).toBe(plataforma.y); // e pousou em cima na descida
  });

  it("desce da plataforma quando pede para descer", () => {
    const l = criarLutador(def, 0, 0, meioDaPlataforma, plataforma.y - 10);
    rodar(l, 30);
    expect(l.emPlataforma).toBe(true);
    moverLutador(l, { ...NADA, descer: true }, arena, []);
    rodar(l, 60);
    expect(l.y).toBe(arena.chao.y);
  });

  it("não dá para descer pelo chão sólido", () => {
    const l = criarLutador(def, 0, 0, 600, arena.chao.y);
    rodar(l, 2);
    rodar(l, 30, { ...NADA, descer: true });
    expect(l.y).toBe(arena.chao.y);
  });

  it("tem pulo e pulo duplo, e não um terceiro", () => {
    const l = criarLutador(def, 0, 0, 600, arena.chao.y);
    rodar(l, 2);
    const eventos: Evento[] = [];
    moverLutador(l, PULAR, arena, eventos);
    for (let i = 0; i < 10; i++) moverLutador(l, NADA, arena, eventos);
    moverLutador(l, PULAR, arena, eventos);
    for (let i = 0; i < 10; i++) moverLutador(l, NADA, arena, eventos);
    const vyAntes = l.vy;
    moverLutador(l, PULAR, arena, eventos); // terceiro: ignorado
    expect(l.vy).toBeCloseTo(vyAntes + arena.gravidade);
    expect(eventos.filter((e) => e.tipo === "pulo")).toHaveLength(2);
    rodar(l, 120);
    expect(l.pulosRestantes).toBe(2); // pousar devolve os pulos
  });

  it("quem sai andando da beirada fica só com o pulo no ar", () => {
    const l = criarLutador(def, 0, 0, arena.chao.x + arena.chao.largura - 5, arena.chao.y);
    rodar(l, 2);
    rodar(l, 20, { ...NADA, mover: 1 });
    expect(l.noChao).toBe(false);
    expect(l.pulosRestantes).toBe(1);
  });

  it("o chão sólido bloqueia pelos lados", () => {
    const l = criarLutador(def, 0, 0, arena.chao.x - 60, arena.chao.y + 30);
    l.vy = -arena.gravidade; // anula a gravidade do primeiro tick
    moverLutador(l, { ...NADA, mover: 1 }, arena, []);
    for (let i = 0; i < 5; i++) {
      l.vy = -arena.gravidade;
      l.vx = 8;
      moverLutador(l, NADA, arena, []);
    }
    expect(l.x).toBeLessThanOrEqual(arena.chao.x - def.largura / 2);
  });

  it("atordoado não obedece à entrada", () => {
    const l = criarLutador(def, 0, 0, 600, arena.chao.y);
    rodar(l, 2);
    l.atordoado = 30;
    rodar(l, 10, { ...PULAR, mover: 1 });
    expect(l.x).toBe(600);
    expect(l.y).toBe(arena.chao.y);
  });

  it("impulso mantém a velocidade horizontal, mas é cortado perto da beirada", () => {
    const l = criarLutador(def, 0, 0, 600, arena.chao.y);
    rodar(l, 2);
    l.vx = 10;
    l.impulso = 5;
    rodar(l, 5);
    expect(l.vx).toBe(10); // a entrada parada não freou
    rodar(l, 1);
    expect(l.vx).toBeLessThan(10); // impulso acabou: volta a frear

    const b = criarLutador(def, 0, 0, arena.chao.x + arena.chao.largura - 40, arena.chao.y);
    rodar(b, 2);
    b.vx = 10;
    b.impulso = 30;
    rodar(b, 3);
    expect(b.impulso).toBe(0);
  });

  it("detecta saída pelos quatro limites", () => {
    const lim = arena.limites;
    expect(foraDosLimites(criarLutador(def, 0, 0, 600, 500), arena)).toBe(false);
    expect(foraDosLimites(criarLutador(def, 0, 0, lim.esquerda - 1, 300), arena)).toBe(true);
    expect(foraDosLimites(criarLutador(def, 0, 0, lim.direita + 1, 300), arena)).toBe(true);
    expect(foraDosLimites(criarLutador(def, 0, 0, 600, lim.topo - 1), arena)).toBe(true);
    expect(foraDosLimites(criarLutador(def, 0, 0, 600, lim.fundo + def.altura + 1), arena)).toBe(
      true,
    );
  });
});
