import { describe, expect, it } from "vitest";
import {
  criarMedidor,
  gravarOpcoes,
  lerOpcoes,
  OPCOES_PADRAO,
  usarImagensDeCenario,
} from "../src/render/opcoes";
import { criarRelogio, TETO_DO_QUADRO_MS } from "../src/render/relogio";
import { resumoDosNocautes } from "../src/render/resumo";
import { ALVO_MINIMO, alvoTocado, areaDeToque } from "../src/render/toque";
import { dicaDoTutorial } from "../src/render/tutorial";

describe("opções guardadas no navegador", () => {
  it("sem nada guardado, ou com lixo, usa o padrão", () => {
    expect(lerOpcoes(null)).toEqual(OPCOES_PADRAO);
    expect(lerOpcoes("{quebrado")).toEqual(OPCOES_PADRAO);
    expect(lerOpcoes('"texto"')).toEqual(OPCOES_PADRAO);
  });

  it("grava e lê de volta o mesmo", () => {
    const o = {
      efeitos: 0.25,
      musica: 0,
      velocidade: 2 as const,
      tutorialVisto: true,
      cenario: "codigo" as const,
      cenarioLento: true,
    };
    expect(lerOpcoes(gravarOpcoes(o))).toEqual(o);
  });

  it("corrige valores fora da faixa", () => {
    const o = lerOpcoes('{"efeitos":7,"musica":-1,"velocidade":3,"tutorialVisto":"sim"}');
    expect(o).toEqual({
      efeitos: 1,
      musica: 0,
      velocidade: 1,
      tutorialVisto: false,
      cenario: "auto",
      cenarioLento: false,
    });
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

describe("área de toque", () => {
  const atualizar = { x: 1014, y: 548, largura: 162, altura: 44 };
  const lutar = { x: 1014, y: 602, largura: 162, altura: 48 };
  const alvos = [
    { id: "atualizar", ret: atualizar },
    { id: "lutar", ret: lutar },
  ];

  it("cresce o botão pequeno até o mínimo, em volta do centro", () => {
    expect(areaDeToque(atualizar)).toEqual({ x: 1014, y: 532, largura: 162, altura: ALVO_MINIMO });
    expect(areaDeToque({ x: 0, y: 0, largura: 200, altura: 100 })).toEqual({
      x: 0,
      y: 0,
      largura: 200,
      altura: 100,
    });
  });

  it("toque dentro do desenho acerta aquele botão", () => {
    expect(alvoTocado(alvos, 1050, 560)).toBe("atualizar");
    expect(alvoTocado(alvos, 1050, 640)).toBe("lutar");
  });

  it("toque na folga em volta também vale", () => {
    expect(alvoTocado(alvos, 1050, 536)).toBe("atualizar");
    expect(alvoTocado(alvos, 1050, 660)).toBe("lutar");
  });

  it("entre dois botões, ganha o de centro mais próximo", () => {
    expect(alvoTocado(alvos, 1050, 595)).toBe("atualizar");
    expect(alvoTocado(alvos, 1050, 599)).toBe("lutar");
  });

  it("longe de todos, não acerta nenhum", () => {
    expect(alvoTocado(alvos, 600, 300)).toBeNull();
  });
});

describe("cenário em imagens ou leve", () => {
  const auto = { ...OPCOES_PADRAO };

  it("no automático usa as imagens até o aparelho se mostrar lento", () => {
    expect(usarImagensDeCenario(auto, null)).toBe(true);
    expect(usarImagensDeCenario({ ...auto, cenarioLento: true }, null)).toBe(false);
  });

  it("a escolha do jogador vale mais que a medida", () => {
    expect(usarImagensDeCenario({ ...auto, cenario: "imagens", cenarioLento: true }, null)).toBe(
      true,
    );
    expect(usarImagensDeCenario({ ...auto, cenario: "codigo" }, null)).toBe(false);
  });

  it("o pedido no endereço vale mais que tudo", () => {
    expect(usarImagensDeCenario({ ...auto, cenario: "imagens" }, "codigo")).toBe(false);
    expect(usarImagensDeCenario({ ...auto, cenario: "codigo" }, "imagens")).toBe(true);
  });

  it("o medidor acusa lento abaixo de 24 quadros por segundo, uma vez só, depois de 4 segundos", () => {
    const lento = criarMedidor();
    const respostas: (string | null)[] = [];
    for (let i = 0; i < 60; i++) respostas.push(lento.medir(100)); // 10 quadros por segundo
    expect(respostas.filter((r) => r !== null)).toEqual(["lento"]);
    expect(respostas.indexOf("lento")).toBe(39); // no quadro que completa 4 segundos

    const fluido = criarMedidor();
    const outras: (string | null)[] = [];
    for (let i = 0; i < 400; i++) outras.push(fluido.medir(16.7));
    expect(outras.filter((r) => r !== null)).toEqual(["ok"]);
  });
});

describe("relógio de quadros", () => {
  it("mede o tempo real entre quadros, mesmo quando o aparelho está lento", () => {
    let t = 1000;
    const relogio = criarRelogio(() => t);
    expect(relogio.quadro().ms).toBeCloseTo(1000 / 60); // primeiro quadro: não há anterior
    t += 90; // 11 quadros por segundo
    expect(relogio.quadro()).toEqual({ real: 90, ms: 90 });
    t += 16;
    expect(relogio.quadro()).toEqual({ real: 16, ms: 16 });
  });

  it("um quadro travado não faz o jogo dar um salto: vale até o teto", () => {
    let t = 0;
    const relogio = criarRelogio(() => t);
    relogio.quadro();
    t += 5000; // a aba ficou em segundo plano
    expect(relogio.quadro()).toEqual({ real: 5000, ms: TETO_DO_QUADRO_MS });
  });

  it("dez segundos reais valem dez segundos de jogo a 60 ou a 12 quadros por segundo", () => {
    for (const passo of [1000 / 60, 1000 / 12]) {
      let t = 0;
      const relogio = criarRelogio(() => t);
      relogio.quadro();
      let jogo = 0;
      while (t < 10_000) {
        t += passo;
        jogo += relogio.quadro().ms;
      }
      expect(jogo).toBeCloseTo(t, 3);
    }
  });
});
