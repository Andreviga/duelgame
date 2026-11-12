import Phaser from "phaser";
import { ARENA_BASICA, personagem } from "../dados";
import { criarLutador } from "../sim/combate/combate";
import type { Modo, NivelBot } from "../sim/partida/tipos";
import { desenharArena, desenharCorpo, desenharFundo } from "./desenho";
import { ALTURA, criarTexto, desenharBotao, LARGURA, type Ret } from "./interface";
import {
  criarSalaOnline,
  entrarNaSalaOnline,
  iniciarCombates,
  jogo,
  NOME_DO_NIVEL,
  novaPartida,
  retomarSalaOnline,
} from "./jogo";
import { carregarSprites, posarRetrato, temSprite } from "./sprites";
import { musica, opcoes, tocar } from "./som";
import { alvoTocado } from "./toque";

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
const JOGAR: Ret = { x: 470, y: 528, largura: 260, altura: 62 };
const CRIAR_SALA: Ret = { x: 350, y: 606, largura: 240, altura: 46 };
const ENTRAR_NA_SALA: Ret = { x: 610, y: 606, largura: 240, altura: 46 };
const OPCOES: Ret = { x: 1036, y: 18, largura: 144, altura: 44 };
const TUTORIAL: Ret = { x: 880, y: 18, largura: 144, altura: 44 };
const CREDITOS: Ret = { x: 20, y: 18, largura: 144, altura: 44 };
const CHAVE_DO_NOME = "arena:nome";

/** Tela inicial: escolha de modo e de dificuldade dos bots. */
export class CenaInicial extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private aviso!: Phaser.GameObjects.Text;

  constructor() {
    super("inicial");
  }

  preload(): void {
    carregarSprites(this);
  }

  create(): void {
    document.body.dataset["cena"] = "inicial";
    musica("preparacao");
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
    ["ancora", "lamina", "faisca", "maestro"].forEach((id, i) => {
      const x = 120 + (i < 2 ? i * 90 : 780 + i * 90);
      const def = personagem(id);
      if (temSprite(this, id)) {
        const img = this.add.image(0, 0, id, "parado_0");
        posarRetrato(this, img, id, x, 200 + def.altura * 0.65, def.altura * 1.3, i >= 2);
        return;
      }
      const g = this.add.graphics();
      const l = criarLutador(def, 0, i < 2 ? 0 : 1, 0, 0, 1, i);
      desenharCorpo(g, l, 0);
      g.setPosition(x, 200).setScale(1.3);
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
    const meioDoJogar = JOGAR.y + JOGAR.altura / 2;
    criarTexto(this, JOGAR.x + JOGAR.largura / 2, meioDoJogar, "JOGAR", 32).setDepth(2);
    criarTexto(this, JOGAR.x + JOGAR.largura + 20, meioDoJogar, "contra bots", 14, 0x9fb0c8, 0);
    for (const [ret, rotulo] of [
      [CRIAR_SALA, "Criar sala online"],
      [ENTRAR_NA_SALA, "Entrar com código"],
    ] as const) {
      criarTexto(this, ret.x + ret.largura / 2, ret.y + ret.altura / 2, rotulo, 18).setDepth(2);
    }
    for (const [ret, rotulo] of [
      [OPCOES, "Opções"],
      [TUTORIAL, "Tutorial"],
      [CREDITOS, "Créditos"],
    ] as const) {
      criarTexto(this, ret.x + ret.largura / 2, ret.y + ret.altura / 2, rotulo, 18).setDepth(2);
    }
    if (!opcoes.tutorialVisto) {
      criarTexto(
        this,
        TUTORIAL.x + TUTORIAL.largura / 2,
        76,
        "primeira vez? comece aqui",
        13,
        0xffd54a,
      );
    }
    this.aviso = criarTexto(this, LARGURA / 2, 664, jogo.recado, 14, 0xff6b6b).setDepth(2);
    jogo.recado = "";
    this.desenhar();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.aoApertar(p.x, p.y));
    if (jogo.automatico) this.comecar();
    // Recarregou a página no meio de uma partida online? Volta para ela.
    else void retomarSalaOnline().catch(() => undefined);
  }

  private aoApertar(x: number, y: number): void {
    const tocado = alvoTocado<string>(
      [
        ...MODOS.map((m) => ({ id: `modo:${m.modo}`, ret: m.ret })),
        ...NIVEIS.map((n) => ({ id: `nivel:${n.nivel}`, ret: n.ret })),
        { id: "jogar", ret: JOGAR },
        { id: "opcoes", ret: OPCOES },
        { id: "tutorial", ret: TUTORIAL },
        { id: "creditos", ret: CREDITOS },
        { id: "criar", ret: CRIAR_SALA },
        { id: "entrar", ret: ENTRAR_NA_SALA },
      ],
      x,
      y,
    );
    if (tocado) tocar("clique");
    for (const m of MODOS) if (tocado === `modo:${m.modo}`) jogo.modo = m.modo;
    for (const n of NIVEIS) if (tocado === `nivel:${n.nivel}`) jogo.dificuldade = n.nivel;
    if (tocado === "jogar") return this.comecar();
    if (tocado === "opcoes") return void this.scene.start("opcoes");
    if (tocado === "tutorial") return this.comecar(true);
    if (tocado === "creditos") return void this.scene.start("creditos");
    if (tocado === "criar") return void this.online(false);
    if (tocado === "entrar") return void this.online(true);
    this.desenhar();
  }

  /** Cria uma sala ou entra em uma pelo código. Nome e código são pedidos em caixas simples do navegador. */
  private async online(entrar: boolean): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const guardado = window.localStorage.getItem(CHAVE_DO_NOME) ?? "";
    const nome = params.get("nome") ?? window.prompt("Seu nome na partida:", guardado);
    if (nome === null) return;
    window.localStorage.setItem(CHAVE_DO_NOME, nome);
    try {
      if (entrar) {
        const codigo = params.get("codigo") ?? window.prompt("Código da sala (4 letras):", "");
        if (!codigo) return;
        this.aviso.setText("entrando na sala…").setTint(0x9fb0c8);
        await entrarNaSalaOnline(codigo, nome);
      } else {
        this.aviso.setText("criando a sala…").setTint(0x9fb0c8);
        await criarSalaOnline(nome);
      }
    } catch {
      this.aviso
        .setText(
          entrar
            ? "Não deu para entrar: confira o código (a sala pode estar cheia ou já ter começado)."
            : "Não deu para falar com o servidor de jogo.",
        )
        .setTint(0xff6b6b);
    }
  }

  private comecar(tutorial = false): void {
    const param = Number(new URLSearchParams(window.location.search).get("semente"));
    const semente =
      Number.isFinite(param) && param > 0 ? Math.floor(param) : Math.floor(Math.random() * 1e9) + 1;
    const arenaFixa = new URLSearchParams(window.location.search).get("arena") ?? undefined;
    jogo.tutorial = tutorial;
    // O tutorial é sempre a mesma partida: todos contra todos, bots fáceis, arena básica.
    if (tutorial) novaPartida("todos", "facil", 7, "arena-basica");
    else novaPartida(jogo.modo, jogo.dificuldade, semente, arenaFixa);
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
    desenharBotao(this.g, CRIAR_SALA, 0x2f5c8a);
    desenharBotao(this.g, ENTRAR_NA_SALA, 0x2f5c8a);
    desenharBotao(this.g, OPCOES, 0x26324a);
    desenharBotao(this.g, CREDITOS, 0x26324a);
    desenharBotao(this.g, TUTORIAL, opcoes.tutorialVisto ? 0x26324a : 0x8a6a1f);
  }
}
