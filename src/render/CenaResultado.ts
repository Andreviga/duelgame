import Phaser from "phaser";
import { estaVivo } from "../sim/partida/partida";
import { corDoJogador, desenharFundo } from "./desenho";
import { ALTURA, criarTexto, dentro, desenharBotao, LARGURA, type Ret } from "./interface";
import { meuNumero, jogo, NOME_DO_NIVEL, partidaAtual, sairDaSalaOnline } from "./jogo";
import { musica, tocar } from "./som";

const DE_NOVO: Ret = { x: 450, y: 560, largura: 300, altura: 64 };
const POSICOES = ["1º", "2º", "3º", "4º"];

/** Tela de resultado: classificação final e botão para jogar de novo. */
export class CenaResultado extends Phaser.Scene {
  constructor() {
    super("resultado");
  }

  create(): void {
    document.body.dataset["cena"] = "resultado";
    const p = partidaAtual();
    const classificacao = p.classificacao ?? [];
    desenharFundo(this.add.graphics(), 600, 380);
    this.add.graphics().fillStyle(0x0b0f16, 0.6).fillRect(0, 0, LARGURA, ALTURA);
    const g = this.add.graphics();

    const humano = p.jogadores[meuNumero()];
    const duplas = p.modo === "duplas";
    const venceu = duplas
      ? humano !== undefined && estaVivo(humano)
      : classificacao[0] === meuNumero();
    const posicao = classificacao.indexOf(meuNumero());
    musica(null);
    tocar(venceu ? "vitoria" : "derrota");
    const titulo = venceu
      ? "VOCÊ VENCEU!"
      : duplas
        ? "SEU TIME PERDEU"
        : `VOCÊ FICOU EM ${POSICOES[posicao] ?? "?"}`;
    criarTexto(this, LARGURA / 2, 96, titulo, 60, venceu ? 0xffd54a : 0xe8eef7);
    const modo = duplas ? "2 contra 2" : "Todos contra todos";
    criarTexto(
      this,
      LARGURA / 2,
      152,
      `${modo} · bots no ${NOME_DO_NIVEL[jogo.dificuldade].toLowerCase()} · ${p.economia.rodada} rodadas`,
      18,
      0x9fb0c8,
    );

    classificacao.forEach((id, i) => {
      const j = p.jogadores[id];
      if (!j) return;
      const y = 210 + i * 78;
      const x = 330;
      g.fillStyle(0x0b0f16, 0.75);
      g.fillRoundedRect(x, y, 540, 64, 12);
      g.fillStyle(corDoJogador(id), 1);
      g.fillRoundedRect(x, y, 10, 64, 4);
      if (id === meuNumero()) {
        g.lineStyle(3, 0xffd54a, 1);
        g.strokeRoundedRect(x, y, 540, 64, 12);
      }
      // No 2x2 os dois de cada time dividem a posição.
      const lugar = duplas ? (i < 2 ? "1º" : "2º") : (POSICOES[i] ?? "");
      criarTexto(
        this,
        x + 52,
        y + 32,
        lugar,
        30,
        i === 0 || (duplas && i < 2) ? 0xffd54a : 0xffffff,
      );
      criarTexto(this, x + 100, y + 32, j.nome, 24, corDoJogador(id), 0);
      const detalhe = estaVivo(j) ? `♥ ${j.vida}` : `eliminado na rodada ${j.eliminadoNaRodada}`;
      criarTexto(this, x + 520, y + 32, detalhe, 16, estaVivo(j) ? 0x5fd67a : 0x9fb0c8, 1);
    });

    desenharBotao(g, DE_NOVO, 0x2f9e5b);
    criarTexto(
      this,
      DE_NOVO.x + DE_NOVO.largura / 2,
      DE_NOVO.y + DE_NOVO.altura / 2,
      "JOGAR DE NOVO",
      26,
    );
    this.input.on("pointerdown", (ponteiro: Phaser.Input.Pointer) => {
      if (dentro(DE_NOVO, ponteiro.x, ponteiro.y)) {
        if (jogo.online) void sairDaSalaOnline();
        jogo.partida = null;
        jogo.automatico = false;
        jogo.automaticoJaRodou = true;
        this.scene.start("inicial");
      }
    });
  }
}
