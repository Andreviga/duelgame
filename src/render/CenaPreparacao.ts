import Phaser from "phaser";
import { CONTEXTO, ECONOMIA, PARTIDA, personagem } from "../dados";
import { criarLutador } from "../sim/combate/combate";
import type { DefPersonagem, Lado, Lutador } from "../sim/combate/tipos";
import {
  aplicarNivel,
  limiteDeCampo,
  sinergiasDoJogador,
  preparacaoEncerrada,
  tickPreparacao,
  valorDeVenda,
} from "../sim/economia/economia";
import {
  MENSAGENS,
  type Comando,
  type Erro,
  type EstadoEconomia,
  type Unidade,
} from "../sim/economia/tipos";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";
import { avancarLaco, type Laco } from "../sim/laco";
import {
  COR_DO_MUNDO,
  corDoJogador,
  desenharArena,
  desenharEmblema,
  NOME_DO_MUNDO,
  NOME_DO_PAPEL,
  desenharCorpo,
  desenharFundo,
  desenharPinos,
} from "./desenho";
import { comEconomia, confrontoDoJogador, estaVivo } from "../sim/partida/partida";
import {
  arenaAtual,
  comandoDoHumano,
  meuNumero,
  iniciarCombates,
  jogo,
  partidaAtual,
} from "./jogo";
import { CamadasDoCenario, carregarCenarios } from "./cenarios";
import { carregarSprites, posarRetrato, temSprite } from "./sprites";
import { musica, opcoes, salvarOpcoes, tocar, type Efeito } from "./som";
import { alvoTocado } from "./toque";
import { dicaDoTutorial } from "./tutorial";

const LARGURA = 1200;
const ALTURA = 675;
const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const COR_ELIXIR = 0x7ef0d0;

// Enquadramento fixo da arena na parte de cima da tela.
// O zoom é ajustado em `create` para o chão da arena caber sempre na mesma largura de tela.
let ZOOM = 0.8;
const MUNDO_X = 600;
const MUNDO_Y = 410;
const TELA_Y = 262;
const paraTelaX = (x: number): number => (x - MUNDO_X) * ZOOM + LARGURA / 2;
const paraTelaY = (y: number): number => (y - MUNDO_Y) * ZOOM + TELA_Y;

// Painel de baixo.
const PAINEL_Y = 452;
const BANCO = { x: 28, y: 520, largura: 80, altura: 104, passo: 88 };
const LOJA = { x: 580, y: 476, largura: 132, altura: 172, passo: 142 };
const COLUNA = { x: 1014, largura: 162 };
const BOTAO_ATUALIZAR = { x: COLUNA.x, y: 548, largura: COLUNA.largura, altura: 44 };
const BOTAO_LUTAR = { x: COLUNA.x, y: 602, largura: COLUNA.largura, altura: 48 };
const RAIO_DO_PONTO = 46;
const CAIXA_DO_TUTORIAL = { x: 270, y: 98, largura: 660, altura: 92 };
const PULAR_TUTORIAL = { x: 810, y: 196, largura: 120, altura: 30 };

interface Ret {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

interface Arrasto {
  unidade: Unidade;
  origem: "banco" | "campo";
  x: number;
  y: number;
}

const dentro = (r: Ret, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.largura && y >= r.y && y <= r.y + r.altura;

/**
 * Tela de preparação: loja, banco e posicionamento na arena, com arrastar e soltar.
 * Toda ação vira um comando da simulação (`aplicar`); a tela só desenha o estado.
 */
export class CenaPreparacao extends Phaser.Scene {
  private laco!: Laco<EstadoEconomia>;
  private fundo!: Phaser.GameObjects.Graphics;
  private painel!: Phaser.GameObjects.Graphics;
  private sobre!: Phaser.GameObjects.Graphics;
  private bonecos = new Map<string, Phaser.GameObjects.Graphics>();
  private retratos = new Map<string, Phaser.GameObjects.Image>();
  private rotulos = new Map<string, Phaser.GameObjects.Text>();
  private usados = new Set<string>();
  private modelos = new Map<string, Lutador>();
  private arrasto: Arrasto | null = null;
  private aviso = { texto: "", ms: 0, cor: 0xffffff };
  private pisca = 0;

  constructor() {
    super("preparacao");
  }

  preload(): void {
    carregarSprites(this);
    carregarCenarios(this, [arenaAtual().id]);
  }

  create(): void {
    this.bonecos = new Map();
    this.retratos = new Map();
    this.rotulos = new Map();
    this.arrasto = null;

    document.body.dataset["cena"] = "preparacao";
    musica("preparacao");
    this.laco = { estado: partidaAtual().economia, acumulado: 0 };
    jogo.aoErro = (erro) => {
      tocar("erro");
      this.avisar(MENSAGENS[erro as Erro] ?? erro, 0xff6b6b);
    };

    ZOOM = Math.min(0.8, 640 / arenaAtual().chao.largura);
    this.fundo = this.add.graphics().setDepth(0);
    const cenario = this.add.graphics();
    const mundo = this.add
      .container(LARGURA / 2 - MUNDO_X * ZOOM, TELA_Y - MUNDO_Y * ZOOM, [cenario])
      .setScale(ZOOM)
      .setDepth(1);
    // Cenário em imagens, se a arena tiver; senão, o desenho por código.
    const camadas = CamadasDoCenario.para(this, arenaAtual());
    if (camadas) {
      const profundidade = (pecas: Phaser.GameObjects.GameObject[], valor: number): void => {
        for (const p of pecas) (p as Phaser.GameObjects.Image).setDepth(valor);
      };
      profundidade(camadas.criarFundo(), 0.5);
      camadas.criarPiso().forEach((img, i) => mundo.addAt(img, i));
      profundidade(camadas.criarFrente(), 1.5);
      // A mesma câmera do enquadramento fixo desta tela, escrita como centro e zoom.
      camadas.atualizar({ x: MUNDO_X, y: MUNDO_Y + (ALTURA / 2 - TELA_Y) / ZOOM, zoom: ZOOM });
    } else {
      desenharFundo(this.fundo, MUNDO_X, 380, arenaAtual().id);
    }
    desenharArena(cenario, arenaAtual(), camadas !== null);
    this.painel = this.add.graphics().setDepth(2);
    this.sobre = this.add.graphics().setDepth(4);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.aoApertar(p.x, p.y));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.arrasto) {
        this.arrasto.x = p.x;
        this.arrasto.y = p.y;
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.aoSoltar(p.x, p.y));
  }

  private get estado(): EstadoEconomia {
    return partidaAtual().economia;
  }

  private get eu() {
    const j = this.estado.jogadores[meuNumero()];
    if (!j) throw new Error("sem jogador");
    return j;
  }

  private meuConfronto() {
    const p = partidaAtual();
    return p.confrontos[confrontoDoJogador(p, meuNumero())];
  }

  /** Lado da arena em que o jogador luta nesta rodada (0 = esquerda). Online, pode ser o direito. */
  private ladoDoJogador(jogador: number): Lado {
    const confronto = this.meuConfronto();
    return confronto?.ladoB.includes(jogador) && !confronto.ladoA.includes(jogador) ? 1 : 0;
  }

  /** Posição na tela de um dos meus pontos. */
  private telaX(x: number): number {
    return paraTelaX(this.xNoLado(x, this.meuLado()));
  }

  private meuLado(): Lado {
    return this.ladoDoJogador(meuNumero());
  }

  /** Posição horizontal, no mundo, de um ponto de posicionamento para quem luta no lado dado. */
  private xNoLado(x: number, lado: Lado): number {
    const chao = arenaAtual().chao;
    return lado === 0 ? x : chao.x * 2 + chao.largura - x;
  }

  /** Pontos em que eu posiciono: os do aliado se eu for o segundo jogador do meu lado (2x2). */
  private meusPontos() {
    const confronto = this.meuConfronto();
    const doMeuLado = (this.meuLado() === 0 ? confronto?.ladoA : confronto?.ladoB) ?? [];
    return doMeuLado.indexOf(meuNumero()) > 0 ? arenaAtual().pontosAliado : arenaAtual().pontos;
  }

  private avisar(texto: string, cor = 0xffd54a): void {
    this.aviso = { texto, ms: 1900, cor };
  }

  /** Envia um comando para a simulação (ou para o servidor) e mostra o erro ou a fusão, se houver. */
  private comando(c: Comando): void {
    const r = comandoDoHumano(c);
    const somDoComando: Partial<Record<Comando["tipo"], Efeito>> = {
      comprar: "compra",
      vender: "venda",
      pronto: "pronto",
    };
    const som = somDoComando[c.tipo] ?? "clique";
    if (!r) return tocar(som); // online: a resposta chega depois, pelo servidor
    if (!r.ok) {
      tocar("erro");
      this.avisar(MENSAGENS[r.erro], 0xff6b6b);
      return;
    }
    const fusao = r.fusoes.at(-1);
    tocar(fusao ? "fusao" : som);
    if (fusao) this.avisar(`Fusão! ${personagem(fusao.personagem).nome} nível ${fusao.nivel}`);
  }

  // ---------- entrada ----------

  private retDoBanco(i: number): Ret {
    return {
      x: BANCO.x + i * BANCO.passo,
      y: BANCO.y,
      largura: BANCO.largura,
      altura: BANCO.altura,
    };
  }

  private retDaCarta(i: number): Ret {
    return { x: LOJA.x + i * LOJA.passo, y: LOJA.y, largura: LOJA.largura, altura: LOJA.altura };
  }

  private areaDoBanco(): Ret {
    return {
      x: BANCO.x - 8,
      y: BANCO.y - 8,
      largura: BANCO.passo * ECONOMIA.tamanhoBanco + 8,
      altura: BANCO.altura + 16,
    };
  }

  private areaDaLoja(): Ret {
    return {
      x: LOJA.x - 6,
      y: LOJA.y - 6,
      largura: LOJA.passo * ECONOMIA.tamanhoLoja + 2,
      altura: LOJA.altura + 12,
    };
  }

  private pontoMaisProximo(x: number, y: number): number | null {
    let melhor: number | null = null;
    let melhorDist = RAIO_DO_PONTO;
    this.meusPontos().forEach((p, i) => {
      const d = Math.hypot(this.telaX(p.x) - x, paraTelaY(p.y) - 26 - y);
      if (d < melhorDist) {
        melhor = i;
        melhorDist = d;
      }
    });
    return melhor;
  }

  private aoApertar(x: number, y: number): void {
    const botao = alvoTocado(
      [
        ...(jogo.tutorial ? [{ id: "pular" as const, ret: PULAR_TUTORIAL }] : []),
        { id: "atualizar" as const, ret: BOTAO_ATUALIZAR },
        { id: "lutar" as const, ret: BOTAO_LUTAR },
      ],
      x,
      y,
    );
    if (botao === "pular") return this.encerrarTutorial("Tutorial pulado.");
    if (this.eu.pronto) return;
    if (botao === "atualizar") return this.comando({ tipo: "atualizar", jogador: meuNumero() });
    if (botao === "lutar") return this.comando({ tipo: "pronto", jogador: meuNumero() });
    for (let i = 0; i < this.eu.loja.length; i++) {
      if (this.eu.loja[i] !== null && dentro(this.retDaCarta(i), x, y)) {
        return this.comando({ tipo: "comprar", jogador: meuNumero(), carta: i });
      }
    }
    this.eu.banco.forEach((u, i) => {
      if (dentro(this.retDoBanco(i), x, y)) this.arrasto = { unidade: u, origem: "banco", x, y };
    });
    const ponto = this.pontoMaisProximo(x, y);
    const noPonto = this.eu.campo.find((c) => c.ponto === ponto);
    if (noPonto) this.arrasto = { unidade: noPonto.unidade, origem: "campo", x, y };
  }

  private aoSoltar(x: number, y: number): void {
    const a = this.arrasto;
    if (!a) return;
    this.arrasto = null;
    const id = a.unidade.id;
    const ponto = this.pontoMaisProximo(x, y);
    if (ponto !== null) {
      const jaLa = this.eu.campo.some((c) => c.ponto === ponto && c.unidade.id === id);
      if (!jaLa) this.comando({ tipo: "posicionar", jogador: meuNumero(), unidade: id, ponto });
    } else if (dentro(this.areaDaLoja(), x, y)) {
      const valor = valorDeVenda(CONTEXTO, a.unidade);
      this.comando({ tipo: "vender", jogador: meuNumero(), unidade: id });
      this.avisar(`Vendido por ${valor} de elixir`, COR_ELIXIR);
    } else if (dentro(this.areaDoBanco(), x, y) && a.origem === "campo") {
      this.comando({ tipo: "recolher", jogador: meuNumero(), unidade: id });
    }
  }

  // ---------- desenho ----------

  /** Graphics reaproveitado para desenhar um personagem; some sozinho se não for usado no quadro. */
  private boneco(
    chave: string,
    def: DefPersonagem,
    nivel: number,
    dono: number,
    x: number,
    y: number,
    escala: number,
    alfa = 1,
    profundidade = 3,
  ): void {
    let g = this.bonecos.get(chave);
    if (!g) {
      g = this.add.graphics();
      this.bonecos.set(chave, g);
    }
    const idModelo = `${def.id}:${nivel}:${dono}`;
    let modelo = this.modelos.get(idModelo);
    if (!modelo) {
      // Aliados olham para a direita; adversários, para a esquerda.
      const lado: Lado = this.ladoDoJogador(dono);
      modelo = criarLutador(aplicarNivel(def, nivel, ECONOMIA), 0, lado, 0, 0, nivel, dono);
      this.modelos.set(idModelo, modelo);
    }
    this.usados.add(`b:${chave}`);
    g.clear();
    if (temSprite(this, def.id)) {
      // Personagem com atlas: o retrato parado no lugar da forma geométrica.
      let img = this.retratos.get(chave);
      if (!img) {
        img = this.add.image(0, 0, def.id, "parado_0");
        this.retratos.set(chave, img);
      }
      posarRetrato(this, img, def.id, x, y, modelo.def.altura * escala, modelo.direcao === -1);
      img.setAlpha(alfa).setDepth(profundidade).setVisible(true);
      g.setVisible(false);
      return;
    }
    this.retratos.get(chave)?.setVisible(false);
    desenharCorpo(g, modelo, 0);
    // (x, y) é a base do personagem; o desenho tem origem no centro do corpo.
    g.setPosition(x, y - (modelo.def.altura / 2) * escala);
    g.setScale(escala).setAlpha(alfa).setDepth(profundidade).setVisible(true);
  }

  private rotulo(
    chave: string,
    x: number,
    y: number,
    texto: string,
    tamanho: number,
    cor: number,
    origemX = 0.5,
    profundidade = 5,
  ): Phaser.GameObjects.Text {
    let t = this.rotulos.get(chave);
    if (!t) {
      t = this.add.text(0, 0, "", {
        fontFamily: FONTE,
        fontSize: `${tamanho}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#0b0f16",
        strokeThickness: Math.max(3, Math.round(tamanho / 6)),
      });
      this.rotulos.set(chave, t);
    }
    this.usados.add(`r:${chave}`);
    if (t.text !== texto) t.setText(texto);
    t.setPosition(x, y).setOrigin(origemX, 0.5).setTint(cor).setDepth(profundidade);
    t.setVisible(true).setAlpha(1).setScale(1);
    return t;
  }

  private gota(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    g.fillStyle(COR_ELIXIR, 1);
    g.fillCircle(x, y + r * 0.25, r);
    g.fillTriangle(x - r * 0.86, y - r * 0.2, x + r * 0.86, y - r * 0.2, x, y - r * 1.5);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x - r * 0.35, y + r * 0.1, r * 0.28);
  }

  private botao(r: Ret, texto: string, chave: string, cor: number, ativo: boolean): void {
    const g = this.painel;
    g.fillStyle(0x0b0f16, 0.6);
    g.fillRoundedRect(r.x, r.y + 3, r.largura, r.altura, 10);
    g.fillStyle(ativo ? cor : 0x2a3346, 1);
    g.fillRoundedRect(r.x, r.y, r.largura, r.altura, 10);
    g.fillStyle(0xffffff, ativo ? 0.16 : 0.05);
    g.fillRoundedRect(r.x + 3, r.y + 3, r.largura - 6, r.altura / 2 - 3, 8);
    this.rotulo(
      chave,
      r.x + r.largura / 2,
      r.y + r.altura / 2,
      texto,
      19,
      ativo ? 0xffffff : 0x7a879c,
    );
  }

  override update(_tempo: number, delta: number): void {
    const ms = Math.min(delta, 50);
    if (!jogo.online) {
      // Contra bots o relógio da preparação anda aqui; online, quem manda é o servidor.
      // No tutorial o relógio fica parado: a rodada só começa quando o jogador toca em LUTAR.
      if (!jogo.tutorial) {
        this.laco = avancarLaco(
          { estado: this.estado, acumulado: this.laco.acumulado },
          ms,
          tickPreparacao,
        );
        jogo.partida = comEconomia(partidaAtual(), this.laco.estado);
      }
      if (preparacaoEncerrada(this.estado)) {
        iniciarCombates();
        this.scene.start("combate");
        return;
      }
    }
    this.aviso.ms = Math.max(0, this.aviso.ms - ms);

    this.usados.clear();
    this.painel.clear();
    this.sobre.clear();
    this.desenharArenaEUnidades();
    this.desenharPainel();
    this.desenharTopo();
    this.desenharJogadores();
    this.desenharSinergias();
    this.desenharTutorial(ms);
    this.desenharArrasto();

    for (const [chave, g] of this.bonecos) if (!this.usados.has(`b:${chave}`)) g.setVisible(false);
    for (const [chave, img] of this.retratos)
      if (!this.usados.has(`b:${chave}`)) img.setVisible(false);
    for (const [chave, t] of this.rotulos) if (!this.usados.has(`r:${chave}`)) t.setVisible(false);
  }

  private desenharArenaEUnidades(): void {
    const g = this.sobre;
    const eu = this.eu;
    const limite = limiteDeCampo(ECONOMIA, this.estado.rodada);
    const arrastando = this.arrasto;
    const alvo = arrastando ? this.pontoMaisProximo(arrastando.x, arrastando.y) : null;
    const campoCheio = eu.campo.length >= limite;

    // Pontos de posicionamento do jogador.
    this.meusPontos().forEach((p, i) => {
      const x = this.telaX(p.x);
      const y = paraTelaY(p.y);
      const ocupante = eu.campo.find((c) => c.ponto === i);
      const destaque = alvo === i;
      const bloqueado = !ocupante && campoCheio && arrastando?.origem === "banco";
      const cor = bloqueado ? 0xff6b6b : corDoJogador(meuNumero());
      const alfa = arrastando ? (destaque ? 1 : 0.7) : ocupante ? 0.35 : 0.5;
      g.lineStyle(destaque ? 5 : 3, cor, alfa);
      g.strokeEllipse(x, y - 2, destaque ? 62 : 52, destaque ? 20 : 16);
      if (!ocupante) {
        g.fillStyle(cor, alfa * 0.25);
        g.fillEllipse(x, y - 2, 52, 16);
      }
      if (ocupante && arrastando?.unidade.id !== ocupante.unidade.id) {
        const def = personagem(ocupante.unidade.personagem);
        this.boneco(
          `campo${ocupante.unidade.id}`,
          def,
          ocupante.unidade.nivel,
          meuNumero(),
          x,
          y,
          ZOOM,
        );
        const altura = aplicarNivel(def, ocupante.unidade.nivel, ECONOMIA).altura * ZOOM;
        desenharPinos(g, x, y - altura - 12, ocupante.unidade.nivel, 4);
      }
    });

    // Aliado (2x2) e adversários desta rodada, com o campo que eles já montaram.
    const p = partidaAtual();
    const confronto = p.confrontos[confrontoDoJogador(p, meuNumero())];
    const mostrar = (id: number, segundo: boolean, lado: Lado): void => {
      if (id === meuNumero()) return;
      const pontos = segundo ? arenaAtual().pontosAliado : arenaAtual().pontos;
      for (const c of p.economia.jogadores[id]?.campo ?? []) {
        const ponto = pontos[c.ponto];
        if (!ponto) continue;
        const x = paraTelaX(this.xNoLado(ponto.x, lado));
        const y = paraTelaY(ponto.y);
        const def = personagem(c.unidade.personagem);
        this.boneco(`outro${id}:${c.unidade.id}`, def, c.unidade.nivel, id, x, y, ZOOM, 0.85);
        const altura = aplicarNivel(def, c.unidade.nivel, ECONOMIA).altura * ZOOM;
        desenharPinos(g, x, y - altura - 12, c.unidade.nivel, 4);
      }
    };
    confronto?.ladoA.forEach((id, i) => mostrar(id, i > 0, 0));
    confronto?.ladoB.forEach((id, i) => mostrar(id, i > 0, 1));
    const meuLado = this.meuLado();
    const outros = (meuLado === 0 ? confronto?.ladoB : confronto?.ladoA) ?? [];
    const rivais = outros.map((id) => p.jogadores[id]?.nome ?? "?").join(" + ");
    const titulo = confronto?.fantasma
      ? `CÓPIA DE ${rivais.toUpperCase()}`
      : `CONTRA ${rivais.toUpperCase()}`;
    const xMeu = paraTelaX(this.xNoLado(380, meuLado));
    const xDeles = paraTelaX(this.xNoLado(820, meuLado));
    this.rotulo("advTitulo", xDeles, 86, titulo, 14, corDoJogador(outros[0] ?? 1));
    this.rotulo(
      "meuTitulo",
      xMeu,
      86,
      `SEU CAMPO  ${eu.campo.length}/${limite}`,
      14,
      campoCheio ? 0xffd54a : corDoJogador(meuNumero()),
    );
  }

  private desenharPainel(): void {
    const g = this.painel;
    const eu = this.eu;
    g.fillStyle(0x0d121b, 1);
    g.fillRect(0, PAINEL_Y, LARGURA, ALTURA - PAINEL_Y);
    g.fillStyle(0x2c384f, 1);
    g.fillRect(0, PAINEL_Y, LARGURA, 3);

    // Banco de reservas.
    this.rotulo(
      "bancoTitulo",
      BANCO.x,
      490,
      `BANCO  ${eu.banco.length}/${ECONOMIA.tamanhoBanco}`,
      14,
      0x9fb0c8,
      0,
    );
    this.rotulo("dica", BANCO.x + 150, 490, "arraste para um ponto azul da arena", 13, 0x5b6b82, 0);
    for (let i = 0; i < ECONOMIA.tamanhoBanco; i++) {
      const r = this.retDoBanco(i);
      g.fillStyle(0x1b2333, 1);
      g.fillRoundedRect(r.x, r.y, r.largura, r.altura, 10);
      g.lineStyle(2, 0x2c384f, 1);
      g.strokeRoundedRect(r.x, r.y, r.largura, r.altura, 10);
      const u = eu.banco[i];
      if (!u || this.arrasto?.unidade.id === u.id) continue;
      this.boneco(
        `banco${u.id}`,
        personagem(u.personagem),
        u.nivel,
        meuNumero(),
        r.x + r.largura / 2,
        r.y + r.altura - 18,
        0.85,
      );
      desenharPinos(this.sobre, r.x + r.largura / 2, r.y + r.altura - 8, u.nivel, 4);
    }

    // Loja (enquanto arrasta um personagem, ela dá lugar à zona de venda).
    (this.arrasto ? [] : eu.loja).forEach((carta, i) => {
      const r = this.retDaCarta(i);
      if (carta === null) {
        g.lineStyle(2, 0x2c384f, 1);
        g.strokeRoundedRect(r.x, r.y, r.largura, r.altura, 12);
        this.rotulo(
          `vendida${i}`,
          r.x + r.largura / 2,
          r.y + r.altura / 2,
          "comprada",
          14,
          0x3f4c63,
        );
        return;
      }
      const def = personagem(carta);
      const podePagar = eu.elixir >= def.custo;
      const funde = [...eu.banco, ...eu.campo.map((c) => c.unidade)].some(
        (u) => u.personagem === carta && u.nivel === 1,
      );
      g.fillStyle(0x0b0f16, 0.6);
      g.fillRoundedRect(r.x, r.y + 4, r.largura, r.altura, 12);
      g.fillStyle(podePagar ? 0x26324a : 0x1a2130, 1);
      g.fillRoundedRect(r.x, r.y, r.largura, r.altura, 12);
      g.lineStyle(3, funde ? 0xffd54a : podePagar ? corDoJogador(meuNumero()) : 0x2c384f, 1);
      g.strokeRoundedRect(r.x, r.y, r.largura, r.altura, 12);
      const cx = r.x + r.largura / 2;
      const apagado = podePagar ? 1 : 0.45;
      this.boneco(`carta${i}`, def, 1, meuNumero(), cx, r.y + 84, 0.82, apagado);
      this.rotulo(`cartaNome${i}`, cx, r.y + 100, def.nome, 15, podePagar ? 0xffffff : 0x7a879c);
      // mundo e papel: são eles que formam as sinergias
      desenharEmblema(g, def.mundo, r.x + 16, r.y + 119, 0.8);
      const mundoEPapel = this.rotulo(
        `cartaMundo${i}`,
        r.x + 28,
        r.y + 119,
        `${NOME_DO_MUNDO[def.mundo]} · ${NOME_DO_PAPEL[def.papel]}`,
        11,
        podePagar ? COR_DO_MUNDO[def.mundo] : 0x7a879c,
        0,
      );
      // nomes compridos encolhem para caber na carta
      mundoEPapel.setScale(Math.min(1, (r.largura - 34) / Math.max(1, mundoEPapel.width)));
      this.rotulo(`cartaHab${i}`, cx, r.y + 136, def.habilidade.nome, 11, 0x9fb0c8);
      this.gota(g, cx - 14, r.y + 156, 7);
      this.rotulo(
        `cartaCusto${i}`,
        cx + 8,
        r.y + 157,
        String(def.custo),
        18,
        podePagar ? COR_ELIXIR : 0xff6b6b,
      );
      if (funde) this.rotulo(`cartaFunde${i}`, cx, r.y + 14, "FUNDE", 12, 0xffd54a);
    });

    // Elixir e botões.
    g.fillStyle(0x1b2333, 1);
    g.fillRoundedRect(COLUNA.x, 476, COLUNA.largura, 60, 10);
    this.gota(g, COLUNA.x + 34, 506, 15);
    this.rotulo("elixir", COLUNA.x + 62, 507, String(eu.elixir), 36, COR_ELIXIR, 0);
    this.rotulo(
      "elixirTeto",
      COLUNA.x + COLUNA.largura - 10,
      516,
      `/${ECONOMIA.tetoElixir}`,
      13,
      0x5b6b82,
      1,
    );
    const podeAtualizar = eu.elixir >= ECONOMIA.custoAtualizar;
    this.botao(
      BOTAO_ATUALIZAR,
      `Atualizar · ${ECONOMIA.custoAtualizar}`,
      "btAtualizar",
      0x2f5c8a,
      podeAtualizar,
    );
    this.botao(BOTAO_LUTAR, "LUTAR", "btLutar", 0x2f9e5b, true);
  }

  /** Sinergias do campo do jogador: as ativas em destaque, e quanto falta para o próximo degrau. */
  private desenharSinergias(): void {
    const g = this.painel;
    const lista = sinergiasDoJogador(this.eu, CONTEXTO).sort(
      (a, b) => Number(b.nivel !== null) - Number(a.nivel !== null) || b.quantidade - a.quantidade,
    );
    const x0 = 14;
    this.rotulo("sinTitulo", x0, 96, "SINERGIAS", 13, 0x9fb0c8, 0);
    if (lista.length === 0) {
      this.rotulo("sinVazio", x0, 118, "ponha personagens em campo", 12, 0x5b6b82, 0);
      return;
    }
    lista.slice(0, 7).forEach((s, i) => {
      const y = 118 + i * 44;
      const ativa = s.nivel !== null;
      g.fillStyle(0x0b0f16, ativa ? 0.78 : 0.45);
      g.fillRoundedRect(x0, y - 4, 246, 40, 8);
      if (ativa) {
        g.lineStyle(2, 0xffd54a, 0.9);
        g.strokeRoundedRect(x0, y - 4, 246, 40, 8);
      }
      const alvo = s.proximo?.minimo ?? s.nivel?.minimo ?? 0;
      this.rotulo(
        `sinNome${i}`,
        x0 + 10,
        y + 7,
        `${s.nome}  ${s.quantidade}/${alvo}`,
        14,
        ativa ? 0xffd54a : 0xcfd8e3,
        0,
      );
      const descricao =
        s.nivel?.descricao ?? `com ${s.proximo?.minimo}: ${s.proximo?.descricao ?? ""}`;
      const t = this.rotulo(
        `sinDesc${i}`,
        x0 + 10,
        y + 25,
        descricao,
        11,
        ativa ? 0xffffff : 0x7a879c,
        0,
      );
      // descrições longas encolhem para caber no painel
      t.setScale(Math.min(1, 228 / Math.max(1, t.width)));
    });
  }

  private desenharTopo(): void {
    const segundos = jogo.online
      ? Math.max(0, Math.ceil((jogo.prazo - performance.now()) / 1000))
      : Math.ceil(this.estado.ticksRestantes / TICKS_POR_SEGUNDO);
    const modo = jogo.modo === "duplas" ? "2x2" : "Todos contra todos";
    this.rotulo("rodada", 24, 30, `Rodada ${this.estado.rodada}`, 24, 0xe8eef7, 0);
    this.rotulo("modo", 24, 56, modo, 13, 0x9fb0c8, 0);
    this.rotulo(
      "tempo",
      LARGURA / 2,
      32,
      String(segundos),
      36,
      segundos <= 5 ? 0xff6b6b : 0xe8eef7,
    );
    const eu = partidaAtual().jogadores[meuNumero()];
    const legenda =
      eu && !estaVivo(eu)
        ? "você foi eliminado · assistindo"
        : jogo.online && this.eu.pronto
          ? "aguardando os outros jogadores…"
          : jogo.tutorial
            ? "tutorial · sem relógio"
            : "preparação";
    this.rotulo("tempoLegenda", LARGURA / 2, 60, legenda, 13, 0x9fb0c8);
    if (this.aviso.ms > 0) {
      const t = this.rotulo(
        "aviso",
        LARGURA / 2,
        420,
        this.aviso.texto,
        26,
        this.aviso.cor,
        0.5,
        7,
      );
      t.setAlpha(Math.min(1, this.aviso.ms / 300));
    }
  }

  private encerrarTutorial(aviso: string): void {
    jogo.tutorial = false;
    opcoes.tutorialVisto = true;
    salvarOpcoes();
    this.avisar(aviso);
  }

  /** Caixa de dica do tutorial e o contorno piscando na parte da tela de que ela fala. */
  private desenharTutorial(ms: number): void {
    if (!jogo.tutorial) return;
    const dica = dicaDoTutorial({
      rodada: this.estado.rodada,
      noBanco: this.eu.banco.length,
      emCampo: this.eu.campo.length,
      pronto: this.eu.pronto,
    });
    if (!dica) return this.encerrarTutorial("Tutorial concluído! Agora é com você.");
    this.pisca = (this.pisca + ms) % 900;
    const g = this.sobre;
    const c = CAIXA_DO_TUTORIAL;
    g.fillStyle(0x0b0f16, 0.92);
    g.fillRoundedRect(c.x, c.y, c.largura, c.altura, 12);
    g.lineStyle(3, 0xffd54a, 1);
    g.strokeRoundedRect(c.x, c.y, c.largura, c.altura, 12);
    this.rotulo("tutTitulo", c.x + 18, c.y + 20, dica.titulo, 19, 0xffd54a, 0, 6);
    const texto = this.rotulo("tutTexto", c.x + 18, c.y + 58, dica.texto, 14, 0xffffff, 0, 6);
    texto.setWordWrapWidth(c.largura - 36);
    g.fillStyle(0x26324a, 1);
    g.fillRoundedRect(
      PULAR_TUTORIAL.x,
      PULAR_TUTORIAL.y,
      PULAR_TUTORIAL.largura,
      PULAR_TUTORIAL.altura,
      8,
    );
    this.rotulo(
      "tutPular",
      PULAR_TUTORIAL.x + PULAR_TUTORIAL.largura / 2,
      PULAR_TUTORIAL.y + PULAR_TUTORIAL.altura / 2,
      "pular tutorial",
      12,
      0x9fb0c8,
      0.5,
      6,
    );
    const alvos = {
      loja: this.areaDaLoja(),
      banco: this.areaDoBanco(),
      lutar: BOTAO_LUTAR,
      sinergias: { x: 8, y: 84, largura: 258, altura: 120 },
    };
    const alvo = dica.alvo ? alvos[dica.alvo] : null;
    if (!alvo || this.arrasto) return;
    g.lineStyle(5, 0xffd54a, 0.35 + 0.65 * Math.abs(Math.sin((this.pisca / 900) * Math.PI)));
    g.strokeRoundedRect(alvo.x - 5, alvo.y - 5, alvo.largura + 10, alvo.altura + 10, 14);
  }

  /** Lista dos quatro jogadores, com vida e elixir, no canto direito. */
  private desenharJogadores(): void {
    const p = partidaAtual();
    const g = this.painel;
    const confronto = p.confrontos[confrontoDoJogador(p, meuNumero())];
    const x0 = LARGURA - 214;
    p.jogadores.forEach((j, i) => {
      const y = 100 + i * 56;
      const vivo = estaVivo(j);
      const rival = confronto?.ladoB.includes(i) && !confronto.fantasma;
      g.fillStyle(0x0b0f16, vivo ? 0.72 : 0.4);
      g.fillRoundedRect(x0, y, 200, 48, 10);
      if (rival) {
        g.lineStyle(2, 0xffd54a, 0.9);
        g.strokeRoundedRect(x0, y, 200, 48, 10);
      }
      g.fillStyle(vivo ? corDoJogador(i) : 0x3a4558, 1);
      g.fillRoundedRect(x0, y, 7, 48, 3);
      const nome = j.bot ? `${j.nome}` : j.nome;
      this.rotulo(`jNome${i}`, x0 + 18, y + 15, nome, 15, vivo ? 0xffffff : 0x6b7890, 0);
      if (!vivo) {
        this.rotulo(`jFora${i}`, x0 + 18, y + 35, "eliminado", 12, 0x6b7890, 0);
        return;
      }
      // barra de vida
      const fracao = Math.max(0, j.vida / PARTIDA.vidaInicial);
      g.fillStyle(0x1b2333, 1);
      g.fillRoundedRect(x0 + 18, y + 29, 96, 9, 4);
      g.fillStyle(fracao > 0.5 ? 0x5fd67a : fracao > 0.25 ? 0xffd54a : 0xff6b6b, 1);
      g.fillRoundedRect(x0 + 18, y + 29, Math.max(4, 96 * fracao), 9, 4);
      this.rotulo(`jVida${i}`, x0 + 122, y + 33, `♥ ${j.vida}`, 13, 0xffffff, 0);
      this.gota(g, x0 + 172, y + 16, 5);
      this.rotulo(
        `jElixir${i}`,
        x0 + 180,
        y + 16,
        String(p.economia.jogadores[i]?.elixir ?? 0),
        13,
        COR_ELIXIR,
        0,
      );
      if (rival) this.rotulo(`jRival${i}`, x0 + 192, y + 36, "rival", 11, 0xffd54a, 1);
    });
  }

  private desenharArrasto(): void {
    const a = this.arrasto;
    if (!a) return;
    // Zona de venda por cima da loja.
    const loja = this.areaDaLoja();
    const sobreLoja = dentro(loja, a.x, a.y);
    const g = this.sobre;
    g.fillStyle(0x4a1f2a, sobreLoja ? 0.96 : 0.86);
    g.fillRoundedRect(loja.x, loja.y, loja.largura, loja.altura, 14);
    g.lineStyle(sobreLoja ? 5 : 3, 0xff6b6b, 1);
    g.strokeRoundedRect(loja.x, loja.y, loja.largura, loja.altura, 14);
    const cx = loja.x + loja.largura / 2;
    this.rotulo(
      "vender",
      cx,
      loja.y + loja.altura / 2 - 16,
      "SOLTE AQUI PARA VENDER",
      20,
      0xffffff,
      0.5,
      6,
    );
    this.rotulo(
      "venderValor",
      cx,
      loja.y + loja.altura / 2 + 18,
      `+${valorDeVenda(CONTEXTO, a.unidade)} de elixir`,
      22,
      COR_ELIXIR,
      0.5,
      6,
    );
    this.boneco(
      "arrasto",
      personagem(a.unidade.personagem),
      a.unidade.nivel,
      meuNumero(),
      a.x,
      a.y + 30,
      0.95,
      0.95,
      8,
    );
  }
}
