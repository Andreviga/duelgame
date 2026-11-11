import Phaser from "phaser";
import { criarEstado } from "../sim/estado";
import { avancarLaco, type Laco } from "../sim/laco";

/** Cena que só lê o estado da simulação e desenha. */
export class CenaArena extends Phaser.Scene {
  private laco: Laco = { estado: criarEstado(1), acumulado: 0 };
  private grafico!: Phaser.GameObjects.Graphics;
  private texto!: Phaser.GameObjects.Text;

  constructor() {
    super("arena");
  }

  create(): void {
    this.grafico = this.add.graphics();
    this.texto = this.add.text(16, 16, "", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#cfd8e3",
    });
  }

  override update(_tempo: number, delta: number): void {
    this.laco = avancarLaco(this.laco, delta);
    this.desenhar();
  }

  private desenhar(): void {
    const { bloco, tick } = this.laco.estado;
    this.grafico.clear();
    this.grafico.fillStyle(0x4fa3ff, 1);
    this.grafico.fillRect(
      bloco.x - bloco.largura / 2,
      bloco.y - bloco.altura,
      bloco.largura,
      bloco.altura,
    );
    this.texto.setText(`tick ${tick}`);
  }
}
