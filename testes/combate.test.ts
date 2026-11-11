import { describe, expect, it } from "vitest";
import { ARENA_BASICA as arena, personagem } from "../src/dados";
import {
  criarCombate,
  criarLutador,
  golpeAcerta,
  simularCombate,
  stepCombate,
  TICKS_MAXIMOS,
} from "../src/sim/combate/combate";
import type { DefPersonagem, EstadoCombate, Evento } from "../src/sim/combate/tipos";

const def = personagem("lutador");
const duelo = (semente: number, a: DefPersonagem = def, b: DefPersonagem = def) =>
  criarCombate(arena, [a, b], semente);

function ateOPrimeiroGolpe(inicial: EstadoCombate) {
  let e = inicial;
  for (let i = 0; i < 600; i++) {
    const antes = e;
    e = stepCombate(e);
    const golpe = e.eventos.find((ev) => ev.tipo === "golpe");
    if (golpe && golpe.tipo === "golpe") return { antes, depois: e, golpe };
  }
  throw new Error("ninguém acertou ninguém em 10 s");
}

describe("golpe", () => {
  it("a caixa de acerto fica na frente do atacante", () => {
    const a = criarLutador(def, 0, 0, 500, 520);
    a.direcao = 1;
    expect(golpeAcerta(a, criarLutador(def, 1, 1, 560, 520))).toBe(true);
    expect(golpeAcerta(a, criarLutador(def, 1, 1, 440, 520))).toBe(false); // atrás
    expect(golpeAcerta(a, criarLutador(def, 1, 1, 700, 520))).toBe(false); // longe
    expect(golpeAcerta(a, criarLutador(def, 1, 1, 560, 400))).toBe(false); // em cima
  });

  it("acertar soma dano, atordoa e arremessa para longe do atacante", () => {
    const { antes, depois, golpe } = ateOPrimeiroGolpe(duelo(3));
    const atacante = antes.lutadores[golpe.atacante];
    const alvoAntes = antes.lutadores[golpe.alvo];
    const alvo = depois.lutadores[golpe.alvo];
    if (!atacante || !alvoAntes || !alvo) throw new Error("lutador ausente");
    expect(alvo.dano).toBeGreaterThan(alvoAntes.dano);
    expect(alvo.atordoado).toBeGreaterThan(0);
    expect(alvo.lancado).toBe(true);
    expect(Math.sign(alvo.vx)).toBe(Math.sign(alvo.x - atacante.x) || atacante.direcao);
    expect(alvo.vy).toBeLessThan(0);
  });

  it("o mesmo golpe arremessa mais um alvo leve do que um pesado", () => {
    const leve = { ...def, peso: 60 };
    const pesado = { ...def, peso: 180 };
    const forca = (alvoDef: DefPersonagem) => {
      const { golpe } = ateOPrimeiroGolpe(duelo(3, def, alvoDef));
      return golpe.forca;
    };
    // Mesma semente: o primeiro golpe acontece igual; só o peso do alvo muda.
    expect(forca(leve)).toBeGreaterThan(forca(pesado));
  });
});

describe("duelo", () => {
  it("é determinístico: mesma semente, mesmo combate, quadro a quadro", () => {
    let a = duelo(2024);
    let b = duelo(2024);
    for (let i = 0; i < 1500; i++) {
      a = stepCombate(a);
      b = stepCombate(b);
      if (i % 100 === 0) expect(a).toEqual(b);
    }
    expect(a).toEqual(b);
  });

  it("sementes diferentes dão combates diferentes", () => {
    expect(simularCombate(duelo(1)).lutadores).not.toEqual(simularCombate(duelo(2)).lutadores);
  });

  it("stepCombate não altera o estado recebido", () => {
    let e = duelo(5);
    for (let i = 0; i < 200; i++) e = stepCombate(e);
    const copia = structuredClone(e);
    stepCombate(e);
    expect(e).toEqual(copia);
  });

  it("quem sai dos limites é eliminado e o outro vence", () => {
    const inicial = duelo(1);
    const l0 = inicial.lutadores[0];
    if (!l0) throw new Error("lutador ausente");
    const e = stepCombate({
      ...inicial,
      lutadores: [{ ...l0, x: arena.limites.esquerda - 50 }, ...inicial.lutadores.slice(1)],
    });
    expect(e.lutadores[0]?.vivo).toBe(false);
    expect(e.fim).toEqual({ vencedor: 1, motivo: "eliminacao", tick: 1 });
  });

  it("a rodada só é decidida quando o sobrevivente está a salvo; se ele também cair, é empate", () => {
    const inicial = duelo(1);
    const [l0, l1] = inicial.lutadores;
    if (!l0 || !l1) throw new Error("lutador ausente");
    // O lado 0 sai da arena; o lado 1 ainda está voando de um arremesso, sem pulo, longe do chão.
    let e = stepCombate({
      ...inicial,
      lutadores: [
        { ...l0, x: arena.limites.esquerda - 50 },
        {
          ...l1,
          x: arena.limites.direita - 60,
          y: 300,
          vx: 9,
          vy: 0,
          lancado: true,
          atordoado: 40,
        },
      ],
    });
    expect(e.lutadores[0]?.vivo).toBe(false);
    expect(e.fim).toBeNull(); // ainda não decidiu
    e = simularCombate(e);
    expect(e.lutadores[1]?.vivo).toBe(false);
    expect(e.fim?.vencedor).toBeNull();
    expect(e.fim?.motivo).toBe("eliminacao");
  });

  it("o sobrevivente arremessado que volta a pisar no chão vence", () => {
    const inicial = duelo(1);
    const [l0, l1] = inicial.lutadores;
    if (!l0 || !l1) throw new Error("lutador ausente");
    let e = stepCombate({
      ...inicial,
      lutadores: [
        { ...l0, x: arena.limites.esquerda - 50 },
        { ...l1, x: 600, y: 400, vx: 2, vy: -3, lancado: true, atordoado: 10 },
      ],
    });
    expect(e.fim).toBeNull();
    e = simularCombate(e);
    expect(e.fim?.vencedor).toBe(1);
  });

  it("no tempo esgotado vence quem tem menos dano", () => {
    const inicial = duelo(1);
    const [l0, l1] = inicial.lutadores;
    if (!l0 || !l1) throw new Error("lutador ausente");
    const e = stepCombate({
      ...inicial,
      tick: TICKS_MAXIMOS - 1,
      lutadores: [
        { ...l0, dano: 80 },
        { ...l1, dano: 20 },
      ],
    });
    expect(e.fim?.motivo).toBe("tempo");
    expect(e.fim?.vencedor).toBe(1);
  });

  it("lote de 300 sementes: todo duelo termina por eliminação e ninguém cai sozinho", () => {
    const vitorias = [0, 0];
    for (let semente = 1; semente <= 300; semente++) {
      let e = duelo(semente);
      const saidas: Evento[] = [];
      while (!e.fim) {
        e = stepCombate(e);
        saidas.push(...e.eventos.filter((ev) => ev.tipo === "saida"));
      }
      expect(e.fim.motivo, `semente ${semente}`).toBe("eliminacao");
      expect(saidas.length, `semente ${semente}`).toBeGreaterThan(0);
      for (const s of saidas) {
        expect(s.tipo === "saida" && s.porGolpe, `semente ${semente}: caiu sozinho`).toBe(true);
      }
      if (e.fim.vencedor !== null) vitorias[e.fim.vencedor] = (vitorias[e.fim.vencedor] ?? 0) + 1;
    }
    // Personagens iguais: nenhum lado deve levar vantagem clara.
    expect(vitorias[0]).toBeGreaterThan(110);
    expect(vitorias[1]).toBeGreaterThan(110);
  });
});
