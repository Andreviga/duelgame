import Phaser from "phaser";
import { desenharFundo } from "./desenho";
import { ALTURA, criarTexto, desenharBotao, LARGURA, type Ret } from "./interface";
import { DEGRAUS_DE_VOLUME, type Opcoes } from "./opcoes";
import { opcoes, salvarOpcoes, tocar } from "./som";
import { alvoTocado } from "./toque";

const VOLTAR: Ret = { x: 450, y: 560, largura: 300, altura: 60 };
const LINHAS: { rotulo: string; chave: "efeitos" | "musica"; y: number }[] = [
  { rotulo: "Volume dos efeitos", chave: "efeitos", y: 210 },
  { rotulo: "Volume da música", chave: "musica", y: 310 },
];
const VELOCIDADES: readonly Opcoes["velocidade"][] = [1, 2, 4];
const Y_VELOCIDADE = 410;
const degrau = (i: number, y: number): Ret => ({ x: 560 + i * 84, y, largura: 72, altura: 54 });

/** Tela de opções: volume dos efeitos, volume da música e velocidade com que o combate começa. */
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
    criarTexto(this, LARGURA / 2, 100, "OPÇÕES", 52);
    for (const linha of LINHAS) {
      criarTexto(this, 530, linha.y + 27, linha.rotulo, 22, 0xe8eef7, 1);
      DEGRAUS_DE_VOLUME.forEach((v, i) => {
        const r = degrau(i, linha.y);
        const texto = v === 0 ? "mudo" : `${Math.round(v * 100)}%`;
        criarTexto(this, r.x + r.largura / 2, r.y + r.altura / 2, texto, 16).setDepth(2);
      });
    }
    criarTexto(this, 530, Y_VELOCIDADE + 27, "Velocidade do combate", 22, 0xe8eef7, 1);
    VELOCIDADES.forEach((v, i) => {
      const r = degrau(i, Y_VELOCIDADE);
      criarTexto(this, r.x + r.largura / 2, r.y + r.altura / 2, `${v}x`, 18).setDepth(2);
    });
    criarTexto(
      this,
      LARGURA / 2,
      500,
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
            DEGRAUS_DE_VOLUME.map((v, i) => ({
              id: () => void (opcoes[linha.chave] = v),
              ret: degrau(i, linha.y),
            })),
          ),
          ...VELOCIDADES.map((v, i) => ({
            id: () => void (opcoes.velocidade = v),
            ret: degrau(i, Y_VELOCIDADE),
          })),
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
      DEGRAUS_DE_VOLUME.forEach((v, i) =>
        desenharBotao(this.g, degrau(i, linha.y), 0x26324a, opcoes[linha.chave] === v),
      );
    }
    VELOCIDADES.forEach((v, i) =>
      desenharBotao(this.g, degrau(i, Y_VELOCIDADE), 0x26324a, opcoes.velocidade === v),
    );
    desenharBotao(this.g, VOLTAR, 0x2f5c8a);
  }
}
