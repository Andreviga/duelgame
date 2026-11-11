import Phaser from "phaser";
import { ARENA_BASICA, personagem } from "../dados";
import { criarLutador } from "../sim/combate/combate";
import type { Modo, NivelBot } from "../sim/partida/tipos";
import { desenharArena, desenharCorpo, desenharFundo } from "./desenho";
import { ALTURA, criarTexto, dentro, desenharBotao, LARGURA, type Ret } from "./interface";
import { iniciarCombates, jogo, NOME_DO_NIVEL, novaPartida } from "./jogo";

const MODOS: { modo: Modo; titulo: string; descricao: string; ret: Ret }[] = [
  {
    modo: "todos",
    titulo: "Todos contra todos",
    descricao: "duelos a cada rodada · vence o último de pé",
    ret: { x: 250, y: 300, largura: 340, altura: 96 },
  },
  {
    modo: "duplas",
    titulo: "2 contra 2",
    descricao: "você e um aliado juntos · vida do time",
    ret: { x: 610, y: 300, largura: 340, altura: 96 },
  },
];
const NIVEIS: { nivel: NivelBot; ret: Ret }[] = (["facil", "medio", "dificil"] as const).map(
  (nivel, i) => ({ nivel, ret: { x: 372 + i * 156, y: 452, largura: 144, altura: 50 } }),
);
const JOGAR: Ret = { x: 470, y: 548, largura: 260, altura: 70 };

/** Tela inicial: escolha de modo e de dificuldade dos bots. */
export class CenaInicial extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;

  constructor() {
    super("inicial");
  }

  create(): void {
    document.body.dataset["cena"] = "inicial";
    const params = new URLSearchParams(window.location.search);
    jogo.automatico = params.has("auto") && !jogo.automaticoJaRodou;
    const modoParam = params.get("modo");
    if (modoParam === "duplas" || modoParam === "todos") jogo.modo = modoParam;

    desenharFundo(this.add.graphics(), 600, 380);
    const cenario = this.add.graphics();
    desenharArena(cenario, ARENA_BASICA);
    this.add
      .container(LARGURA / 2 - 600 * 0.9, 60, [cenario])
      .setScale(0.9)
      .setAlpha(0.35);
    this.add.graphics().fillStyle(0x0b0f16, 0.55).fillRect(0, 0, LARGURA, ALTURA);

    // Quatro personagens de enfeite, um de cada cor.
    ["tanque", "lutador", "assassino", "atirador"].forEach((id, i) => {
      const g = this.add.graphics();
      const l = criarLutador(personagem(id), 0, i < 2 ? 0 : 1, 0, 0, 1, i);
      desenharCorpo(g, l, 0);
      g.setPosition(120 + (i < 2 ? i * 90 : 780 + i * 90), 200).setScale(1.3);
    });

    criarTexto(this, LARGURA / 2, 120, "ARENA DE ESQUADRÕES", 64);
    criarTexto(this, LARGURA / 2, 186, "monte o esquadrão · eles lutam sozinhos", 20, 0x9fb0c8);
    criarTexto(this, LARGURA / 2, 272, "MODO", 14, 0x9fb0c8);
    criarTexto(this, LARGURA / 2, 428, "DIFICULDADE DOS BOTS", 14, 0x9fb0c8);

    this.g = this.add.graphics();
    for (const m of MODOS) {
      criarTexto(this, m.ret.x + m.ret.largura / 2, m.ret.y + 34, m.titulo, 26).setDepth(2);
      criarTexto(
        this,
        m.ret.x + m.ret.largura / 2,
        m.ret.y + 68,
        m.descricao,
        13,
        0xcfd8e3,
      ).setDepth(2);
    }
    for (const n of NIVEIS) {
      criarTexto(
        this,
        n.ret.x + n.ret.largura / 2,
        n.ret.y + n.ret.altura / 2,
        NOME_DO_NIVEL[n.nivel],
        20,
      ).setDepth(2);
    }
    criarTexto(this, JOGAR.x + JOGAR.largura / 2, JOGAR.y + JOGAR.altura / 2, "JOGAR", 34).setDepth(
      2,
    );
    this.desenhar();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.aoApertar(p.x, p.y));
    if (jogo.automatico) this.comecar();
  }

  private aoApertar(x: number, y: number): void {
    for (const m of MODOS) if (dentro(m.ret, x, y)) jogo.modo = m.modo;
    for (const n of NIVEIS) if (dentro(n.ret, x, y)) jogo.dificuldade = n.nivel;
    if (dentro(JOGAR, x, y)) return this.comecar();
    this.desenhar();
  }

  private comecar(): void {
    const param = Number(new URLSearchParams(window.location.search).get("semente"));
    const semente =
      Number.isFinite(param) && param > 0 ? Math.floor(param) : Math.floor(Math.random() * 1e9) + 1;
    novaPartida(jogo.modo, jogo.dificuldade, semente);
    if (jogo.automatico) {
      iniciarCombates();
      this.scene.start("combate");
    } else {
      this.scene.start("preparacao");
    }
  }

  private desenhar(): void {
    this.g.clear();
    for (const m of MODOS) desenharBotao(this.g, m.ret, 0x26324a, jogo.modo === m.modo);
    for (const n of NIVEIS) desenharBotao(this.g, n.ret, 0x26324a, jogo.dificuldade === n.nivel);
    desenharBotao(this.g, JOGAR, 0x2f9e5b);
  }
}
