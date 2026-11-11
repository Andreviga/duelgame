import { describe, expect, it } from "vitest";
import arenaJson from "../src/dados/arena-basica.json";
import personagensJson from "../src/dados/personagens.json";
import {
  ErroDeDados,
  validarArena,
  validarPersonagem,
  validarPersonagens,
} from "../src/dados/schemas";

describe("schemas de dados", () => {
  it("aceita os arquivos do jogo", () => {
    expect(validarArena(arenaJson).plataformas.length).toBeGreaterThan(0);
    expect(validarPersonagens(personagensJson).length).toBeGreaterThan(0);
  });

  it("recusa arena com campo faltando ou inválido", () => {
    expect(() => validarArena({ ...arenaJson, gravidade: 0 })).toThrow(ErroDeDados);
    expect(() => validarArena({ ...arenaJson, chao: undefined })).toThrow(/arena\.chao/);
    expect(() => validarArena({ ...arenaJson, nascimentos: [] })).toThrow(/nascimentos/);
    expect(() =>
      validarArena({ ...arenaJson, limites: { ...arenaJson.limites, esquerda: 300 } }),
    ).toThrow(/limites/);
  });

  it("recusa personagem com número inválido e diz qual campo", () => {
    const base = personagensJson[0];
    expect(() => validarPersonagem({ ...base, peso: -1 })).toThrow(/peso/);
    expect(() => validarPersonagem({ ...base, ataque: { ...base?.ataque, inicio: 2.5 } })).toThrow(
      /ataque\.inicio/,
    );
    expect(() => validarPersonagem({ ...base, nome: "" })).toThrow(/nome/);
  });
});
