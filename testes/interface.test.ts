import { describe, expect, it } from "vitest";
import { gravarOpcoes, lerOpcoes, OPCOES_PADRAO } from "../src/render/opcoes";
import { resumoDosNocautes } from "../src/render/resumo";
import { dicaDoTutorial } from "../src/render/tutorial";

describe("opções guardadas no navegador", () => {
  it("sem nada guardado, ou com lixo, usa o padrão", () => {
    expect(lerOpcoes(null)).toEqual(OPCOES_PADRAO);
    expect(lerOpcoes("{quebrado")).toEqual(OPCOES_PADRAO);
    expect(lerOpcoes('"texto"')).toEqual(OPCOES_PADRAO);
  });

  it("grava e lê de volta o mesmo", () => {
    const o = { efeitos: 0.25, musica: 0, velocidade: 2 as const, tutorialVisto: true };
    expect(lerOpcoes(gravarOpcoes(o))).toEqual(o);
  });

  it("corrige valores fora da faixa", () => {
    const o = lerOpcoes('{"efeitos":7,"musica":-1,"velocidade":3,"tutorialVisto":"sim"}');
    expect(o).toEqual({ efeitos: 1, musica: 0, velocidade: 1, tutorialVisto: false });
  });
});

describe("tutorial", () => {
  const base = { rodada: 1, noBanco: 0, emCampo: 0, pronto: false };

  it("na rodada 1 guia compra, posicionamento e luta, nessa ordem", () => {
    expect(dicaDoTutorial(base)?.alvo).toBe("loja");
    expect(dicaDoTutorial({ ...base, noBanco: 1 })?.alvo).toBe("banco");
    expect(dicaDoTutorial({ ...base, emCampo: 1 })?.alvo).toBe("lutar");
  });

  it("depois de tocar em LUTAR não aponta mais para nada", () => {
    expect(dicaDoTutorial({ ...base, emCampo: 1, pronto: true })?.alvo).toBeNull();
  });

  it("a rodada 2 fala de fusão e a 3 de sinergias", () => {
    expect(dicaDoTutorial({ ...base, rodada: 2, emCampo: 1 })?.titulo).toContain("fusão");
    expect(dicaDoTutorial({ ...base, rodada: 3, emCampo: 2 })?.alvo).toBe("sinergias");
  });

  it("acaba depois da terceira rodada", () => {
    expect(dicaDoTutorial({ ...base, rodada: 4, emCampo: 3 })).toBeNull();
  });
});

describe("resumo do fim da rodada", () => {
  it("mostra quem mais nocauteou de cada lado e quantos caíram sozinhos", () => {
    const texto = resumoDosNocautes([
      { vitima: "Ponta", autor: "Âncora", autorDoMeuLado: true },
      { vitima: "Sombra", autor: "Âncora", autorDoMeuLado: true },
      { vitima: "Brasa", autor: "Lâmina", autorDoMeuLado: false },
      { vitima: "Faísca", autor: null, autorDoMeuLado: false },
    ]);
    expect(texto).toBe("Seu Âncora nocauteou 2  ·  Lâmina rival nocauteou 1  ·  1 caiu sozinho");
  });

  it("sem nocautes, não diz nada", () => {
    expect(resumoDosNocautes([])).toBe("");
  });
});
