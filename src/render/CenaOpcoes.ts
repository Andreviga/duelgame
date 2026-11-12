import Phaser from "phaser";
import { desenharFundo } from "./desenho";
import { ALTURA, criarTexto, desenharBotao, LARGURA, type Ret } from "./interface";
import { DEGRAUS_DE_VOLUME } from "./opcoes";
import { opcoes, salvarOpcoes, tocar } from "./som";
import { alvoTocado } from "./toque";

const VOLTAR: Ret = { x: 450, y: 580, largura: 300, altura: 60 };

/** Uma linha da tela: um rótulo e as escolhas, das quais uma está marcada. */
interface Linha {
  rotulo: string;
  y: number;
  largura: number;
  escolhas: { texto: string; marcada: () => boolean; escolher: () => void }[];
}

const volume = (chave: "efeitos" | "musica") =>
  DEGRAUS_DE_VOLUME.map((v) => ({
    texto: v === 0 ? "mudo" : `${Math.round(v * 100)}%`,
    marcada: () => opcoes[chave] === v,
    escolher: () => void (opcoes[chave] = v),
  }));

const LINHAS: Linha[] = [
  { rotulo: "Volume dos efeitos", y: 160, largura: 72, escolhas: volume("efeitos") },
  { rotulo: "Volume da música", y: 250, largura: 72, escolhas: volume("musica") },
  {
    rotulo: "Velocidade do combate",
    y: 340,
    largura: 72,
    escolhas: ([1, 2, 4] as const).map((v) => ({
      texto: `${v}x`,
      marcada: () => opcoes.velocidade === v,
      escolher: () => void (opcoes.velocidade = v),
    })),
  },
  {
    rotulo: "Cenário",
    y: 430,
    largura: 128,
    escolhas: (
      [
        ["auto", "automático"],
        ["imagens", "completo"],
        ["codigo", "leve"],
      ] as const
    ).map(([valor, texto]) => ({
      texto,
      marcada: () => opcoes.cenario === valor,
      escolher: () => {
        opcoes.cenario = valor;
        // Escolher de novo o automático dá outra chance ao cenário completo.
        if (valor === "auto") opcoes.cenarioLento = false;
      },
    })),
  },
];
const ret = (linha: Linha, i: number): Ret => ({
  x: 560 + i * (linha.largura + 12),
  y: linha.y,
  largura: linha.largura,
  altura: 54,
});

/** Tela de opções: volumes, velocidade inicial do combate e o tipo de cenário. */
export class CenaOpcoes extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;

  constructor() {
    super("opcoes");
  }

  create(): void {
    document.body.dataset["cena"] = "opcoes";
    desenharFundo(this.add.graphics(), 600, 380);
    this.add.graphics().fillStyle(0x0b0f16, 0.6).fillRect(0, 0, LARGURA, ALTURA);
    this.g = this.add.graphics();
    criarTexto(this, LARGURA / 2, 84, "OPÇÕES", 52);
    for (const linha of LINHAS) {
      criarTexto(this, 530, linha.y + 27, linha.rotulo, 22, 0xe8eef7, 1);
      linha.escolhas.forEach((e, i) => {
        const r = ret(linha, i);
        criarTexto(this, r.x + r.largura / 2, r.y + r.altura / 2, e.texto, 16).setDepth(2);
      });
    }
    criarTexto(
      this,
      LARGURA / 2,
      520,
      "No automático, o jogo troca para o cenário leve se o aparelho ficar lento.",
      14,
      0x9fb0c8,
    );
    criarTexto(
      this,
      LARGURA / 2,
      542,
      "A velocidade também troca durante a luta, pelo botão do canto ou pela tecla V.",
      14,
      0x9fb0c8,
    );
    criarTexto(
      this,
      VOLTAR.x + VOLTAR.largura / 2,
      VOLTAR.y + VOLTAR.altura / 2,
      "VOLTAR",
      26,
    ).setDepth(2);
    this.desenhar();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const tocado = alvoTocado<() => void>(
        [
          { id: () => this.scene.start("inicial"), ret: VOLTAR },
          ...LINHAS.flatMap((linha) =>
            linha.escolhas.map((e, i) => ({ id: e.escolher, ret: ret(linha, i) })),
          ),
        ],
        p.x,
        p.y,
      );
      if (!tocado) return;
      tocado();
      salvarOpcoes();
      tocar("golpe");
      this.desenhar();
    });
  }

  private desenhar(): void {
    this.g.clear();
    for (const linha of LINHAS) {
      linha.escolhas.forEach((e, i) => desenharBotao(this.g, ret(linha, i), 0x26324a, e.marcada()));
    }
    desenharBotao(this.g, VOLTAR, 0x2f5c8a);
  }
}
