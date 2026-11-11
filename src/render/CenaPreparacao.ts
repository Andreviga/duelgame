import Phaser from "phaser";
import { ARENA_BASICA, CONTEXTO, ECONOMIA, personagem } from "../dados";
import { criarLutador } from "../sim/combate/combate";
import type { DefPersonagem, Lado, Lutador } from "../sim/combate/tipos";
import {
  aplicar,
  aplicarNivel,
  limiteDeCampo,
  preparacaoEncerrada,
  tickPreparacao,
  valorDeVenda,
} from "../sim/economia/economia";
import { MENSAGENS, type Comando, type EstadoEconomia, type Unidade } from "../sim/economia/tipos";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";
import { avancarLaco, type Laco } from "../sim/laco";
import { CORES, desenharArena, desenharCorpo, desenharFundo, desenharPinos } from "./desenho";
import { adversarioDaRodada, jogo, novaSessao, type Sessao } from "./sessao";

const LARGURA = 1200;
const ALTURA = 675;
const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const COR_ELIXIR = 0x7ef0d0;

// Enquadramento fixo da arena na parte de cima da tela.
const ZOOM = 0.8;
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
  private sessao!: Sessao;
  private laco!: Laco<EstadoEconomia>;
  private fundo!: Phaser.GameObjects.Graphics;
  private painel!: Phaser.GameObjects.Graphics;
  private sobre!: Phaser.GameObjects.Graphics;
  private bonecos = new Map<string, Phaser.GameObjects.Graphics>();
  private rotulos = new Map<string, Phaser.GameObjects.Text>();
  private usados = new Set<string>();
  private modelos = new Map<string, Lutador>();
  private arrasto: Arrasto | null = null;
  private aviso = { texto: "", ms: 0, cor: 0xffffff };

  constructor() {
    super("preparacao");
  }

  create(): void {
    this.bonecos = new Map();
    this.rotulos = new Map();
    this.arrasto = null;

    const param = Number(new URLSearchParams(window.location.search).get("semente"));
    const semente = Number.isFinite(param) && param > 0 ? Math.floor(param) : 1;
    this.sessao = jogo.sessao ?? novaSessao(semente);
    this.laco = { estado: this.sessao.economia, acumulado: 0 };

    this.fundo = this.add.graphics().setDepth(0);
    desenharFundo(this.fundo, MUNDO_X, 380);
    const cenario = this.add.graphics();
    desenharArena(cenario, ARENA_BASICA);
    this.add
      .container(LARGURA / 2 - MUNDO_X * ZOOM, TELA_Y - MUNDO_Y * ZOOM, [cenario])
      .setScale(ZOOM)
      .setDepth(1);
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

    const ultimo = this.sessao.ultimo;
    if (ultimo === 0) this.avisar("Vitória!", CORES[0]);
    else if (ultimo === 1) this.avisar("Derrota", CORES[1]);
    else if (ultimo === null) this.avisar("Empate", 0xffffff);
  }

  private get estado(): EstadoEconomia {
    return this.laco.estado;
  }

  private get eu() {
    const j = this.estado.jogadores[0];
    if (!j) throw new Error("sem jogador");
    return j;
  }

  private avisar(texto: string, cor = 0xffd54a): void {
    this.aviso = { texto, ms: 1900, cor };
  }

  /** Envia um comando para a simulação e mostra o erro ou a fusão, se houver. */
  private comando(c: Comando): void {
    const r = aplicar(this.estado, CONTEXTO, c);
    if (!r.ok) {
      this.avisar(MENSAGENS[r.erro], 0xff6b6b);
      return;
    }
    this.laco = { ...this.laco, estado: r.estado };
    this.sessao.economia = r.estado;
    const fusao = r.fusoes.at(-1);
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
    ARENA_BASICA.pontos.forEach((p, i) => {
      const d = Math.hypot(paraTelaX(p.x) - x, paraTelaY(p.y) - 26 - y);
      if (d < melhorDist) {
        melhor = i;
        melhorDist = d;
      }
    });
    return melhor;
  }

  private aoApertar(x: number, y: number): void {
    if (this.eu.pronto) return;
    if (dentro(BOTAO_ATUALIZAR, x, y)) return this.comando({ tipo: "atualizar", jogador: 0 });
    if (dentro(BOTAO_LUTAR, x, y)) return this.comando({ tipo: "pronto", jogador: 0 });
    for (let i = 0; i < this.eu.loja.length; i++) {
      if (this.eu.loja[i] !== null && dentro(this.retDaCarta(i), x, y)) {
        return this.comando({ tipo: "comprar", jogador: 0, carta: i });
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
      if (!jaLa) this.comando({ tipo: "posicionar", jogador: 0, unidade: id, ponto });
    } else if (dentro(this.areaDaLoja(), x, y)) {
      const valor = valorDeVenda(CONTEXTO, a.unidade);
      this.comando({ tipo: "vender", jogador: 0, unidade: id });
      this.avisar(`Vendido por ${valor} de elixir`, COR_ELIXIR);
    } else if (dentro(this.areaDoBanco(), x, y) && a.origem === "campo") {
      this.comando({ tipo: "recolher", jogador: 0, unidade: id });
    }
  }

  // ---------- desenho ----------

  /** Graphics reaproveitado para desenhar um personagem; some sozinho se não for usado no quadro. */
  private boneco(
    chave: string,
    def: DefPersonagem,
    nivel: number,
    lado: Lado,
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
    const idModelo = `${def.id}:${nivel}:${lado}`;
    let modelo = this.modelos.get(idModelo);
    if (!modelo) {
      modelo = criarLutador(aplicarNivel(def, nivel, ECONOMIA), 0, lado, 0, 0, nivel);
      this.modelos.set(idModelo, modelo);
    }
    this.usados.add(`b:${chave}`);
    g.clear();
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
    this.laco = avancarLaco(this.laco, ms, tickPreparacao);
    this.sessao.economia = this.laco.estado;
    if (preparacaoEncerrada(this.estado)) {
      this.scene.start("combate");
      return;
    }
    this.aviso.ms = Math.max(0, this.aviso.ms - ms);

    this.usados.clear();
    this.painel.clear();
    this.sobre.clear();
    this.desenharArenaEUnidades();
    this.desenharPainel();
    this.desenharTopo();
    this.desenharArrasto();

    for (const [chave, g] of this.bonecos) if (!this.usados.has(`b:${chave}`)) g.setVisible(false);
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
    ARENA_BASICA.pontos.forEach((p, i) => {
      const x = paraTelaX(p.x);
      const y = paraTelaY(p.y);
      const ocupante = eu.campo.find((c) => c.ponto === i);
      const destaque = alvo === i;
      const bloqueado = !ocupante && campoCheio && arrastando?.origem === "banco";
      const cor = bloqueado ? 0xff6b6b : CORES[0];
      const alfa = arrastando ? (destaque ? 1 : 0.7) : ocupante ? 0.35 : 0.5;
      g.lineStyle(destaque ? 5 : 3, cor, alfa);
      g.strokeEllipse(x, y - 2, destaque ? 62 : 52, destaque ? 20 : 16);
      if (!ocupante) {
        g.fillStyle(cor, alfa * 0.25);
        g.fillEllipse(x, y - 2, 52, 16);
      }
      if (ocupante && arrastando?.unidade.id !== ocupante.unidade.id) {
        const def = personagem(ocupante.unidade.personagem);
        this.boneco(`campo${ocupante.unidade.id}`, def, ocupante.unidade.nivel, 0, x, y, ZOOM);
        const altura = aplicarNivel(def, ocupante.unidade.nivel, ECONOMIA).altura * ZOOM;
        desenharPinos(g, x, y - altura - 12, ocupante.unidade.nivel, 4);
      }
    });

    // Prévia do adversário desta rodada, no lado direito.
    const soma = ARENA_BASICA.chao.x * 2 + ARENA_BASICA.chao.largura;
    adversarioDaRodada(this.estado.rodada).forEach((v, i) => {
      const x = paraTelaX(soma - v.x);
      const y = paraTelaY(v.y);
      const nivel = v.nivel ?? 1;
      this.boneco(`adv${i}`, personagem(v.def.id), nivel, 1, x, y, ZOOM, 0.8);
      desenharPinos(g, x, y - v.def.altura * ZOOM - 12, nivel, 4);
    });
    this.rotulo("advTitulo", paraTelaX(820), 86, "ADVERSÁRIO DESTA RODADA", 14, CORES[1]);
    this.rotulo(
      "meuTitulo",
      paraTelaX(380),
      86,
      `SEU CAMPO  ${eu.campo.length}/${limite}`,
      14,
      campoCheio ? 0xffd54a : CORES[0],
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
        0,
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
      g.lineStyle(3, funde ? 0xffd54a : podePagar ? CORES[0] : 0x2c384f, 1);
      g.strokeRoundedRect(r.x, r.y, r.largura, r.altura, 12);
      const cx = r.x + r.largura / 2;
      this.boneco(`carta${i}`, def, 1, 0, cx, r.y + 104, 1, podePagar ? 1 : 0.45);
      this.rotulo(`cartaNome${i}`, cx, r.y + 124, def.nome, 17, podePagar ? 0xffffff : 0x7a879c);
      this.gota(g, cx - 14, r.y + 150, 8);
      this.rotulo(
        `cartaCusto${i}`,
        cx + 8,
        r.y + 151,
        String(def.custo),
        20,
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

  private desenharTopo(): void {
    const s = this.sessao;
    const segundos = Math.ceil(this.estado.ticksRestantes / TICKS_POR_SEGUNDO);
    this.rotulo("rodada", 24, 30, `Rodada ${this.estado.rodada}`, 24, 0xe8eef7, 0);
    this.rotulo(
      "tempo",
      LARGURA / 2,
      32,
      String(segundos),
      36,
      segundos <= 5 ? 0xff6b6b : 0xe8eef7,
    );
    this.rotulo("tempoLegenda", LARGURA / 2, 60, "preparação", 13, 0x9fb0c8);
    this.rotulo(
      "placar",
      LARGURA - 24,
      30,
      `${s.vitorias} ${s.vitorias === 1 ? "vitória" : "vitórias"} · ${s.derrotas} ${s.derrotas === 1 ? "derrota" : "derrotas"}`,
      16,
      0x9fb0c8,
      1,
    );
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
      0,
      a.x,
      a.y + 30,
      0.95,
      0.95,
      8,
    );
  }
}
