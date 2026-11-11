import { describe, expect, it } from "vitest";
import arenaJson from "../src/dados/arena-basica.json";
import economiaJson from "../src/dados/economia.json";
import formacoesJson from "../src/dados/formacoes.json";
import personagensJson from "../src/dados/personagens.json";
import {
  ErroDeDados,
  validarArena,
  validarEconomia,
  validarFormacoes,
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
    expect(() => validarPersonagem({ ...base, papel: "mago" })).toThrow(/papel/);
    expect(() =>
      validarPersonagem({ ...base, habilidade: { ...base?.habilidade, tipo: "voar" } }),
    ).toThrow(/habilidade\.tipo/);
  });

  it("personagem à distância e habilidade de tiro precisam de projétil", () => {
    const corpo = personagensJson.find((p) => p.papel === "corpo");
    expect(() => validarPersonagem({ ...corpo, papel: "distancia" })).toThrow(/projetil/);
    expect(() =>
      validarPersonagem({ ...corpo, habilidade: { ...corpo?.habilidade, tipo: "canhao" } }),
    ).toThrow(/projetil/);
    expect(() => validarPersonagem({ ...corpo, mundo: "marte" })).toThrow(/mundo/);
  });

  it("recusa ponto de posicionamento fora do lado esquerdo ou solto no ar", () => {
    expect(() => validarArena({ ...arenaJson, pontos: [{ x: 900, y: 520 }] })).toThrow(
      /metade esquerda/,
    );
    expect(() => validarArena({ ...arenaJson, pontos: [{ x: 300, y: 100 }] })).toThrow(/em cima/);
    expect(() => validarArena({ ...arenaJson, pontos: [] })).toThrow(/pontos/);
  });

  it("recusa economia com multiplicadores faltando ou reembolso acima de 1", () => {
    expect(validarEconomia(economiaJson).tamanhoLoja).toBe(3);
    expect(() =>
      validarEconomia({
        ...economiaJson,
        multiplicadores: { ...economiaJson.multiplicadores, dano: [1, 2] },
      }),
    ).toThrow(/um por nível/);
    expect(() => validarEconomia({ ...economiaJson, reembolsoNivel1: 1.5 })).toThrow(/entre 0 e 1/);
    expect(() => validarPersonagem({ ...personagensJson[0], custo: 0 })).toThrow(/custo/);
  });

  it("recusa formação com personagem desconhecido ou fora da metade esquerda", () => {
    const arena = validarArena(arenaJson);
    const personagens = validarPersonagens(personagensJson);
    expect(validarFormacoes(formacoesJson, personagens, arena).length).toBeGreaterThan(0);
    const com = (vaga: object) => [{ id: "x", nome: "X", vagas: [vaga] }];
    expect(() =>
      validarFormacoes(com({ personagem: "dragao", x: 300, y: 520 }), personagens, arena),
    ).toThrow(/desconhecido/);
    expect(() =>
      validarFormacoes(com({ personagem: "ancora", x: 900, y: 520 }), personagens, arena),
    ).toThrow(/metade esquerda/);
  });
});
