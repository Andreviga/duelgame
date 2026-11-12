import { describe, expect, it } from "vitest";
import { colocarCamada, colocarCeu, type Camera } from "../src/render/camadas";

const TELA = { largura: 1200, altura: 675 };
const CHAO_Y = 520;
const PARADA: Camera = { x: 600, y: CHAO_Y - 140, zoom: 1 };
const CAMADAS = [
  { nome: "longe", largura: 2000, paralaxe: 0.12 },
  { nome: "perto", largura: 2400, paralaxe: 0.35 },
  { nome: "frente", largura: 2400, paralaxe: 1.15 },
];

describe("camadas do cenário", () => {
  it("com a câmera parada, o centro da imagem fica no centro da tela e a linha do chão na altura do chão", () => {
    for (const c of CAMADAS) {
      const p = colocarCamada(
        { largura: c.largura, linhaDoChao: 600 },
        c.paralaxe,
        CHAO_Y,
        PARADA,
        TELA,
      );
      expect(p.escala).toBe(1);
      expect(p.x + c.largura / 2).toBeCloseTo(600);
      // o chão do mundo aparece em 337,5 + 140 na tela
      expect(p.y + 600).toBeCloseTo(TELA.altura / 2 + 140);
    }
  });

  it("a camada de trás desliza menos que a da frente quando a câmera anda", () => {
    const cam = { ...PARADA, x: 700 };
    const [longe, perto, frente] = CAMADAS.map(
      (c) =>
        colocarCamada({ largura: c.largura, linhaDoChao: 600 }, c.paralaxe, CHAO_Y, cam, TELA).x +
        c.largura / 2 -
        600,
    );
    expect(longe).toBeCloseTo(-12);
    expect(perto).toBeCloseTo(-35);
    expect(frente).toBeCloseTo(-115);
  });

  it("as camadas de fundo encolhem menos que o mundo no zoom", () => {
    const cam = { ...PARADA, zoom: 0.5 };
    const longe = colocarCamada({ largura: 2000, linhaDoChao: 600 }, 0.12, CHAO_Y, cam, TELA);
    const perto = colocarCamada({ largura: 2400, linhaDoChao: 600 }, 0.35, CHAO_Y, cam, TELA);
    expect(longe.escala).toBeCloseTo(0.94);
    expect(perto.escala).toBeCloseTo(0.825);
    expect(perto.escala).toBeGreaterThan(cam.zoom);
  });

  it("em nenhuma posição ou zoom da câmera a borda lateral da imagem aparece", () => {
    for (const c of CAMADAS) {
      for (const zoom of [0.42, 0.6, 0.8, 1]) {
        for (const x of [-250, 100, 600, 1100, 1450]) {
          for (const y of [-350, 200, 380, 700]) {
            const p = colocarCamada(
              { largura: c.largura, linhaDoChao: 600 },
              c.paralaxe,
              CHAO_Y,
              { x, y, zoom },
              TELA,
            );
            expect(p.x).toBeLessThanOrEqual(0);
            expect(p.x + c.largura * p.escala).toBeGreaterThanOrEqual(TELA.largura);
          }
        }
      }
    }
  });

  it("o céu cobre a tela inteira e fica parado", () => {
    const p = colocarCeu({ largura: 1600, altura: 900 }, TELA);
    expect(p).toEqual({ x: 0, y: 0, escala: 0.75 });
    const estreito = colocarCeu({ largura: 1000, altura: 900 }, TELA);
    expect(estreito.x).toBeCloseTo(0);
    expect(estreito.y + 900 * estreito.escala).toBeGreaterThanOrEqual(TELA.altura);
  });
});
