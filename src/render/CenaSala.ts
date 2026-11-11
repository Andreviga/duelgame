import Phaser from "phaser";
import { MAXIMO_DE_JOGADORES } from "../rede/protocolo";
import { corDoJogador, desenharFundo } from "./desenho";
import { ALTURA, criarTexto, dentro, desenharBotao, LARGURA, type Ret } from "./interface";
import { jogo, meuNumero, NOME_DO_NIVEL, sairDaSalaOnline } from "./jogo";

const COMECAR: Ret = { x: 450, y: 548, largura: 300, altura: 64 };
const SAIR: Ret = { x: 24, y: 24, largura: 120, altura: 44 };

/** Sala de espera online: mostra o código, quem já entrou e, para o anfitrião, o botão de começar. */
export class CenaSala extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private textos: Phaser.GameObjects.Text[] = [];
  private fixos: Phaser.GameObjects.Text[] = [];
  private desenhado = "";

  constructor() {
    super("sala");
  }

  create(): void {
    document.body.dataset["cena"] = "sala";
    this.textos = [];
    this.desenhado = "";
    desenharFundo(this.add.graphics(), 600, 380);
    this.add.graphics().fillStyle(0x0b0f16, 0.6).fillRect(0, 0, LARGURA, ALTURA);
    this.g = this.add.graphics();
    this.fixos = [
      criarTexto(this, LARGURA / 2, 70, "CÓDIGO DA SALA", 16, 0x9fb0c8),
      criarTexto(this, SAIR.x + SAIR.largura / 2, SAIR.y + SAIR.altura / 2, "Sair", 18),
    ];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (dentro(SAIR, p.x, p.y)) {
        void sairDaSalaOnline();
        this.scene.start("inicial");
      } else if (dentro(COMECAR, p.x, p.y) && meuNumero() === 0) {
        jogo.online?.comecar();
      }
    });
  }

  override update(): void {
    const sala = jogo.sala;
    if (!sala) return;
    // Só redesenha quando a sala muda (alguém entrou ou saiu).
    const chave = JSON.stringify(sala) + meuNumero();
    if (chave === this.desenhado) return;
    this.desenhado = chave;
    for (const t of this.textos) t.destroy();
    this.textos = [];
    const g = this.g;
    g.clear();
    const texto = (
      ...args: Parameters<typeof criarTexto> extends [unknown, ...infer R] ? R : never
    ) => {
      const t = criarTexto(this, ...args);
      this.textos.push(t);
      return t;
    };

    desenharBotao(g, SAIR, 0x3a4558);
    document.body.dataset["sala"] = sala.codigo;
    texto(LARGURA / 2, 128, sala.codigo.split("").join(" "), 84, 0xffd54a);
    const modo = sala.modo === "duplas" ? "2 contra 2" : "Todos contra todos";
    texto(
      LARGURA / 2,
      196,
      `${modo} · vagas vazias viram bots no ${NOME_DO_NIVEL[sala.dificuldade].toLowerCase()}`,
      16,
      0x9fb0c8,
    );

    for (let i = 0; i < MAXIMO_DE_JOGADORES; i++) {
      const vaga = sala.vagas[i];
      const x = 330;
      const y = 240 + i * 70;
      g.fillStyle(0x0b0f16, vaga ? 0.78 : 0.4);
      g.fillRoundedRect(x, y, 540, 58, 12);
      g.fillStyle(vaga ? corDoJogador(i) : 0x3a4558, 1);
      g.fillRoundedRect(x, y, 10, 58, 4);
      if (i === meuNumero() && vaga) {
        g.lineStyle(3, 0xffd54a, 1);
        g.strokeRoundedRect(x, y, 540, 58, 12);
      }
      if (vaga) {
        texto(x + 30, y + 29, vaga.nome, 24, corDoJogador(i), 0);
        const etiqueta = [vaga.anfitriao ? "anfitrião" : "", i === meuNumero() ? "você" : ""]
          .filter(Boolean)
          .join(" · ");
        texto(x + 520, y + 29, etiqueta, 15, 0x9fb0c8, 1);
      } else {
        texto(x + 30, y + 29, "vaga livre (vira bot)", 18, 0x6b7890, 0);
      }
    }

    if (meuNumero() === 0) {
      desenharBotao(g, COMECAR, 0x2f9e5b);
      texto(COMECAR.x + COMECAR.largura / 2, COMECAR.y + COMECAR.altura / 2, "COMEÇAR", 28);
    } else {
      texto(LARGURA / 2, COMECAR.y + 32, "aguardando o anfitrião começar…", 20, 0xcfd8e3);
    }
  }
}
