import Phaser from "phaser";
import { ARENAS, CONTEXTO, espelhar, FORMACOES, ITENS } from "../dados";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";
import { criarCombate, stepCombate, TICKS_MAXIMOS } from "../sim/combate/combate";
import type { Arena, EstadoCombate, Lado } from "../sim/combate/tipos";
import { sinergiasDoJogador } from "../sim/economia/economia";
import { avancarLaco, type Laco } from "../sim/laco";
import { esquadroesDoConfronto } from "../sim/partida/partida";
import type { Confronto, EstadoPartida, ResultadoConfronto } from "../sim/partida/tipos";
import {
  corDoJogador,
  desenharArena,
  desenharCorpo,
  desenharFundo,
  desenharIcone,
  desenharPinos,
} from "./desenho";
import { CamadasDoCenario, carregarCenarios, podeSimplificarSozinho } from "./cenarios";
import { criarMedidor } from "./opcoes";
import { criarRelogio } from "./relogio";
import { carregarSprites, escalaDoSprite } from "./sprites";
import { musica, opcoes, salvarOpcoes, tocar } from "./som";
import { COR_DO_ITEM, desenharItem } from "./itens";
import { resumoDosNocautes } from "./resumo";
import { ALVO_MINIMO } from "./toque";
import {
  animacaoDoLutador,
  ESPEC,
  nomeDoQuadro,
  quadroDeNocaute,
  TICKS_DE_NOCAUTE,
} from "./animacao";
import { Efeitos, misturar } from "./efeitos";
import { arenaAtual, avancarRodada, confrontoParaAssistir, meuNumero, jogo } from "./jogo";

const LARGURA = 1200;
const ALTURA = 675;
const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const MS_ENTRE_RODADAS = 3800;
const LADOS: readonly Lado[] = [0, 1];
const VELOCIDADES = [1, 2, 4];

/** Estado só visual de cada lutador (não existe na simulação). */
interface Visual {
  corpo: Phaser.GameObjects.Graphics;
  /** Sprite do personagem (quando ele tem atlas) e as quatro cópias que formam o contorno. */
  sprite: Phaser.GameObjects.Image | null;
  contorno: Phaser.GameObjects.Image[];
  /** Onde e quando saiu da arena, para mostrar o nocaute. */
  saida: { x: number; y: number; tick: number } | null;
  dano: Phaser.GameObjects.Text;
  debug: Phaser.GameObjects.Text;
  /** Esticar (+) ou achatar (-) no eixo vertical; volta a zero sozinho. */
  elastico: number;
  brilho: number;
  giro: number;
  tremer: number;
  pulso: number;
}

/** O que a tela precisa saber da partida para mostrar este combate. */
interface Contexto {
  partida: EstadoPartida;
  confronto: Confronto;
  resultado: ResultadoConfronto | undefined;
}

function corDoDano(dano: number): number {
  const t = dano / 160;
  return t < 0.5
    ? misturar(0xffffff, 0xffd54a, t * 2)
    : misturar(0xffd54a, 0xff3b3b, (t - 0.5) * 2);
}

/**
 * Cena do combate. Só lê o estado da simulação e desenha; os efeitos (pausa no golpe,
 * câmera lenta, tremor, partículas) são todos do render.
 * Dentro de uma partida mostra um confronto da rodada; com `?demo`, roda combates 4x4 soltos.
 */
export class CenaCombate extends Phaser.Scene {
  private semente = 1;
  private ctx: Contexto | null = null;
  private laco!: Laco<EstadoCombate>;
  private ultimoTick = -1;
  private efeitos = new Efeitos();

  private fundo!: Phaser.GameObjects.Graphics;
  private mundo!: Phaser.GameObjects.Container;
  private cenario!: Phaser.GameObjects.Graphics;
  private fundoDesenhado = "";
  /** Cenário em imagens da arena atual, ou null quando ela é desenhada por código. */
  private camadas: CamadasDoCenario | null = null;
  private arenaDasCamadas = "";
  private medidor = criarMedidor();
  private relogio = criarRelogio(() => performance.now());
  /** Tempo real do último quadro, para medir a fluidez. */
  private tempoReal = 16;
  private pecasDoCenario: Phaser.GameObjects.GameObject[] = [];
  private camadaDeFundo!: Phaser.GameObjects.Container;
  private camadaDaFrente!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Graphics;
  private marcas!: Phaser.GameObjects.Graphics;
  private tela!: Phaser.GameObjects.Graphics;
  private visuais: Visual[] = [];

  private textoTempo!: Phaser.GameObjects.Text;
  private textoPlacar!: Phaser.GameObjects.Text;
  private textoFaixa!: Phaser.GameObjects.Text;
  private textoSub!: Phaser.GameObjects.Text;
  private textoResumo!: Phaser.GameObjects.Text;
  /** Quem saiu da arena nesta rodada e quem levou o crédito, para o resumo do fim. */
  private nocautes: { vitima: number; autor: number | null }[] = [];
  private textoSemente!: Phaser.GameObjects.Text;
  private textoLado: Phaser.GameObjects.Text[] = [];
  private textoSinergia: Phaser.GameObjects.Text[] = [];
  /** Linhas passageiras (corrente do gancho, rastro do teleporte). */
  private linhas: { x1: number; y1: number; x2: number; y2: number; vida: number; cor: number }[] =
    [];
  private botaoVelocidade!: Phaser.GameObjects.Text;
  private botaoDebug!: Phaser.GameObjects.Text;

  private placar = [0, 0];
  private titulos = ["", ""];
  private velocidade = 1;
  private debug = false;
  private pausaGolpe = 0;
  private cameraLenta = 0;
  private msDesdeFim = 0;
  private fimContado = false;
  private cam = { x: 600, y: 380, zoom: 0.9 };

  constructor() {
    super("combate");
  }

  preload(): void {
    carregarSprites(this);
    // Em partida, a arena sorteada; na demonstração, a arena básica.
    carregarCenarios(this, [jogo.partida ? arenaAtual().id : this.arenaDaDemo().id]);
  }

  create(): void {
    document.body.dataset["cena"] = "combate";
    this.relogio = criarRelogio(() => performance.now());
    this.medidor = criarMedidor();
    this.fundoDesenhado = "";
    // A cena é reaberta a cada rodada: os objetos antigos já foram destruídos pelo Phaser.
    this.visuais = [];
    this.textoLado = [];
    this.textoSinergia = [];
    this.linhas = [];
    this.placar = [0, 0];
    const params = new URLSearchParams(window.location.search);
    const param = Number(params.get("semente"));
    this.semente = Number.isFinite(param) && param > 0 ? Math.floor(param) : 1;
    this.debug = params.has("debug");
    this.velocidade = opcoes.velocidade;
    musica("combate");
    const v = Number(params.get("velocidade"));
    if (VELOCIDADES.includes(v)) this.velocidade = v;
    if (jogo.online) this.velocidade = 1;

    const partida = params.has("demo") ? null : jogo.partida;
    if (partida) {
      const i = confrontoParaAssistir();
      const confronto = partida.confrontos[i];
      this.ctx = confronto ? { partida, confronto, resultado: partida.resultados[i] } : null;
    } else {
      this.ctx = null;
    }

    this.fundo = this.add.graphics();
    // Ordem de desenho: fundo (céu, longe, perto) → mundo → frente → interface.
    this.camadaDeFundo = this.add.container(0, 0);
    this.arenaDasCamadas = "";
    this.camadas = null;
    this.pecasDoCenario = [];
    this.cenario = this.add.graphics();
    this.fx = this.add.graphics();
    this.marcas = this.add.graphics();
    this.mundo = this.add.container(0, 0, [this.cenario]);
    this.camadaDaFrente = this.add.container(0, 0);
    this.tela = this.add.graphics();

    const estilo = (tamanho: number, cor = "#ffffff") => ({
      fontFamily: FONTE,
      fontSize: `${tamanho}px`,
      color: cor,
      fontStyle: "bold",
      stroke: "#0b0f16",
      strokeThickness: Math.max(3, Math.round(tamanho / 6)),
    });

    this.textoTempo = this.add.text(LARGURA / 2, 32, "", estilo(34, "#e8eef7")).setOrigin(0.5);
    this.textoPlacar = this.add
      .text(LARGURA / 2, 66, "", { fontFamily: FONTE, fontSize: "16px", color: "#9fb0c8" })
      .setOrigin(0.5);
    for (const lado of LADOS) {
      this.textoLado.push(
        this.add
          .text(lado === 0 ? 24 : LARGURA - 24, ALTURA - 76, "", estilo(17))
          .setOrigin(lado === 0 ? 0 : 1, 0.5),
      );
      this.textoSinergia.push(
        this.add
          .text(lado === 0 ? 20 : LARGURA - 20, ALTURA - 114, "", estilo(13, "#ffd54a"))
          .setOrigin(lado === 0 ? 0 : 1, 0.5),
      );
    }
    this.textoFaixa = this.add
      .text(LARGURA / 2, ALTURA / 2 - 50, "", estilo(80))
      .setOrigin(0.5)
      .setVisible(false);
    this.textoSub = this.add
      .text(LARGURA / 2, ALTURA / 2 + 26, "", estilo(20, "#cfd8e3"))
      .setOrigin(0.5)
      .setVisible(false);
    this.textoResumo = this.add
      .text(LARGURA / 2, ALTURA / 2 + 60, "", estilo(17, "#ffd54a"))
      .setOrigin(0.5)
      .setVisible(false);
    this.textoSemente = this.add
      .text(LARGURA - 12, 12, "", { fontFamily: "monospace", fontSize: "12px", color: "#5b6b82" })
      .setOrigin(1, 0);

    const botao = (x: number, aoClicar: () => void) => {
      const t = this.add
        .text(x, 14, "", {
          fontFamily: FONTE,
          fontSize: "15px",
          color: "#e8eef7",
          fontStyle: "bold",
          backgroundColor: "#243049",
          padding: { x: 12, y: 8 },
        })
        .setInteractive({ useHandCursor: true });
      // A área de toque desce além do desenho, para o dedo acertar no celular.
      t.on("pointerdown", aoClicar);
      const area = t.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      if (area) area.height = Math.max(area.height, ALVO_MINIMO - 14);
      return t;
    };
    this.botaoVelocidade = botao(14, () => this.trocarVelocidade());
    this.botaoDebug = botao(150, () => this.trocarDebug());
    this.input.keyboard?.on("keydown-D", () => this.trocarDebug());
    this.input.keyboard?.on("keydown-V", () => this.trocarVelocidade());
    this.atualizarBotoes();

    this.iniciarRodada();
  }

  private trocarVelocidade(): void {
    if (jogo.online) return; // online todos assistem no mesmo passo
    const i = VELOCIDADES.indexOf(this.velocidade);
    this.velocidade = VELOCIDADES[(i + 1) % VELOCIDADES.length] ?? 1;
    this.atualizarBotoes();
  }

  private trocarDebug(): void {
    this.debug = !this.debug;
    this.atualizarBotoes();
  }

  private atualizarBotoes(): void {
    this.botaoVelocidade.setText(`Velocidade ${this.velocidade}x`);
    this.botaoDebug.setText(this.debug ? "Depuração: ligada" : "Depuração: desligada");
    this.botaoDebug.setBackgroundColor(this.debug ? "#7a2f3a" : "#243049");
    this.botaoVelocidade.setBackgroundColor(this.velocidade > 1 ? "#2f5c8a" : "#243049");
  }

  /** Na demonstração as formações são da arena básica (a única em que os pontos delas valem). */
  private arenaDaDemo(): Arena {
    const basica = ARENAS[0];
    if (!basica) throw new Error("sem arenas");
    return basica;
  }

  private nomesDoLado(lado: Lado): string {
    if (!this.ctx) return this.titulos[lado] ?? "";
    const { partida, confronto } = this.ctx;
    const ids = lado === 0 ? confronto.ladoA : confronto.ladoB;
    const nomes = ids.map((id) => partida.jogadores[id]?.nome ?? "?").join(" + ");
    return lado === 1 && confronto.fantasma ? `Cópia de ${nomes}` : nomes;
  }

  private iniciarRodada(): void {
    let estado: EstadoCombate;
    if (this.ctx) {
      const { partida, confronto } = this.ctx;
      this.semente = confronto.semente;
      estado = criarCombate(
        arenaAtual(),
        esquadroesDoConfronto(partida, CONTEXTO, arenaAtual(), confronto),
        confronto.semente,
        partida.itens,
      );
    } else {
      // Demonstração: a cada rodada muda a formação de um dos lados, para comparar posições.
      const n = this.semente - 1;
      const fa = FORMACOES[n % FORMACOES.length];
      const fb = FORMACOES[Math.floor(n / FORMACOES.length) % FORMACOES.length];
      if (!fa || !fb) throw new Error("sem formações");
      this.titulos = [`Azul · ${fa.nome}`, `Laranja · ${fb.nome}`];
      estado = criarCombate(
        this.arenaDaDemo(),
        [fa.vagas, espelhar(fb.vagas, this.arenaDaDemo())],
        this.semente,
        // `?demo&itens` liga os itens na demonstração.
        new URLSearchParams(window.location.search).has("itens") ? ITENS : null,
      );
    }
    this.laco = { estado, acumulado: 0 };

    for (const v of this.visuais) {
      v.corpo.destroy();
      v.sprite?.destroy();
      for (const c of v.contorno) c.destroy();
      v.dano.destroy();
      v.debug.destroy();
    }
    this.visuais = [];
    this.mundo.remove([this.fx, this.marcas]);
    for (let i = 0; i < estado.lutadores.length; i++) {
      const corpo = this.add.graphics();
      const dano = this.add
        .text(0, 0, "0%", {
          fontFamily: FONTE,
          fontSize: "20px",
          color: "#ffffff",
          fontStyle: "bold",
          stroke: "#0b0f16",
          strokeThickness: 5,
        })
        .setOrigin(0.5);
      const debug = this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffe9a8" })
        .setOrigin(0.5);
      // Personagem com atlas: quatro cópias deslocadas, pintadas com a cor do jogador, fazem o contorno.
      const id = estado.lutadores[i]?.def.id ?? "";
      const temSprite = this.textures.exists(id);
      const contorno = temSprite
        ? [0, 1, 2, 3].map(() =>
            this.add.image(0, 0, id, "parado_0").setTintMode(Phaser.TintModes.FILL),
          )
        : [];
      const sprite = temSprite ? this.add.image(0, 0, id, "parado_0") : null;
      this.mundo.add([...contorno, ...(sprite ? [sprite] : []), corpo, dano, debug]);
      this.visuais.push({
        corpo,
        sprite,
        contorno,
        saida: null,
        dano,
        debug,
        elastico: 0,
        brilho: 0,
        giro: 0,
        tremer: 0,
        pulso: 0,
      });
    }
    this.mundo.add([this.fx, this.marcas]);

    this.ultimoTick = -1;
    this.efeitos.limpar();
    this.pausaGolpe = 0;
    this.cameraLenta = 0;
    this.msDesdeFim = 0;
    this.fimContado = false;
    this.textoFaixa.setVisible(false);
    this.textoSub.setVisible(false);
    this.textoResumo.setVisible(false);
    this.nocautes = [];
    this.escrever(this.textoSemente, `semente ${this.semente}`);
  }

  override update(): void {
    // Tempo real, não o `delta` do Phaser (ver `relogio.ts`).
    const { real, ms } = this.relogio.quadro();
    this.tempoReal = real;
    // Online o servidor dá um tempo fixo para o combate: a câmera lenta e a pausa no golpe
    // esticariam a luta e ela seria cortada antes do fim.
    if (jogo.online) {
      this.cameraLenta = 0;
      this.pausaGolpe = 0;
    }
    const escala = (this.cameraLenta > 0 ? 0.22 : 1) * this.velocidade;
    this.cameraLenta = Math.max(0, this.cameraLenta - ms);

    if (this.pausaGolpe > 0) {
      this.pausaGolpe -= ms * this.velocidade;
    } else {
      this.laco = avancarLaco(this.laco, ms * escala, stepCombate, (e) => this.aoTick(e));
    }
    this.efeitos.atualizar(ms, this.pausaGolpe > 0 ? 0.05 : escala);

    const fim = this.laco.estado.fim;
    if (fim) {
      if (!this.fimContado) {
        this.fimContado = true;
        if (fim.vencedor !== null) {
          this.placar[fim.vencedor] = (this.placar[fim.vencedor] ?? 0) + 1;
        }
        // Conferência: o combate assistido tem de dar o mesmo resultado do que foi simulado sem tela.
        const esperado = this.ctx?.resultado;
        if (esperado && esperado.vencedor !== fim.vencedor) {
          console.error("combate divergiu da simulação", esperado, fim);
        }
        // Online: avisa o servidor do resultado que este cliente viu.
        if (this.ctx) jogo.online?.conferir(this.ctx.partida.economia.rodada, fim.vencedor);
      }
      this.msDesdeFim += ms * this.velocidade;
      if (this.msDesdeFim > MS_ENTRE_RODADAS) {
        if (this.ctx) {
          // Online, é o servidor que abre a rodada seguinte: a tela só espera.
          if (jogo.online) return;
          this.scene.start(avancarRodada());
          return;
        }
        this.semente++;
        this.iniciarRodada();
      }
    }

    this.atualizarCamera(ms);
    // O fundo só é redesenhado quando a câmera andou o bastante para a paralaxe mudar 1 pixel.
    const arena = this.laco.estado.arena;
    this.usarCenarioDa(arena);
    this.vigiarFluidez(this.tempoReal);
    const chaveDoFundo = `${arena.id}:${Math.round(this.cam.x / 8)}:${Math.round(this.cam.y / 12)}`;
    if (this.camadas) {
      this.camadas.atualizar(this.cam);
    } else if (chaveDoFundo !== this.fundoDesenhado) {
      this.fundoDesenhado = chaveDoFundo;
      desenharFundo(this.fundo, this.cam.x, this.cam.y, arena.id);
    }
    // A arena é redesenhada sempre: o mesmo Graphics recebe os anéis no chão, que mudam a cada quadro.
    desenharArena(this.cenario, arena, this.camadas !== null);
    // Anel no chão com a cor do jogador, para os personagens com sprite.
    for (const l of this.laco.estado.lutadores) {
      if (!l.vivo || !this.visuais[l.id]?.sprite) continue;
      const cor = corDoJogador(l.dono);
      this.cenario.fillStyle(cor, l.noChao ? 0.35 : 0.15);
      this.cenario.fillEllipse(l.x, l.y - 1, l.def.largura * 1.5, 12);
      this.cenario.lineStyle(3, cor, l.noChao ? 0.95 : 0.4);
      this.cenario.strokeEllipse(l.x, l.y - 1, l.def.largura * 1.5, 12);
    }
    this.desenharLutadores(ms);
    this.desenharEfeitos();
    this.desenharMarcas();
    this.desenharHud();
  }

  /** Transforma os eventos de um tick em efeitos. Devolve false para parar o laço (pausa no golpe). */
  private aoTick(e: EstadoCombate): boolean {
    if (e.tick === this.ultimoTick) return true;
    this.ultimoTick = e.tick;
    let continuar = true;
    const fx = this.efeitos;
    const cor = (id: number): number => corDoJogador(e.lutadores[id]?.dono ?? 0);

    for (const ev of e.eventos) {
      if (ev.tipo === "golpe") {
        const visual = this.visuais[ev.alvo];
        fx.faiscas(ev.x, ev.y, ev.direcao, ev.forca * (ev.critico ? 1.8 : 1), cor(ev.atacante));
        if (ev.critico) this.anel(ev.x, ev.y, 80, 0xffd54a, 8, 300);
        fx.tremor = Math.max(fx.tremor, Math.min(14, 1 + ev.forca * 0.6));
        tocar(ev.forca >= 9 || ev.critico ? "golpeForte" : "golpe");
        if (visual) {
          visual.brilho = 1;
          visual.pulso = 1;
        }
        // Só os golpes fortes param o tempo; com muitos lutando, pausar em todo golpe trava a luta.
        if (ev.forca >= 9) {
          if (visual) visual.tremer = 1;
          this.pausaGolpe = Math.max(this.pausaGolpe, Math.min(120, ev.forca * 5));
          continuar = false;
        }
      } else if (ev.tipo === "saida") {
        const lim = e.arena.limites;
        const x = Math.min(lim.direita, Math.max(lim.esquerda, ev.x));
        const y = Math.min(lim.fundo, Math.max(lim.topo, ev.y));
        const ang = Math.atan2(e.arena.chao.y - 150 - y, 600 - x);
        const visualDaSaida = this.visuais[ev.id];
        if (visualDaSaida) visualDaSaida.saida = { x, y, tick: e.tick };
        const lado = e.lutadores[ev.id]?.lado ?? 0;
        fx.explosao(x, y, ang, cor(ev.id));
        this.nocautes.push({
          vitima: ev.id,
          autor: ev.porGolpe ? (e.lutadores[ev.id]?.ultimoAtacante ?? null) : null,
        });
        tocar("nocaute");
        const acabou = !e.lutadores.some((l) => l.vivo && l.lado === lado);
        this.cameraLenta = acabou ? 750 : 200;
      } else if (ev.tipo === "pulo") {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = 0.3;
        if (ev.duplo) this.anel(ev.x, ev.y, 34, 0xcfe4ff, 3, 200);
        else fx.poeira(ev.x, ev.y, 5, 1.6);
      } else if (ev.tipo === "pouso") {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -Math.min(0.4, 0.1 + ev.impacto * 0.025);
        fx.poeira(ev.x, ev.y, Math.min(12, 3 + Math.round(ev.impacto * 0.6)), 2.6);
      } else if (ev.tipo === "ataque") {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -0.12;
      } else if (ev.tipo === "tiro") {
        fx.faiscas(ev.x, ev.y, e.lutadores[ev.id]?.direcao ?? 1, 2, cor(ev.id));
        tocar("tiro");
      } else if (ev.tipo === "habilidade") {
        const l = e.lutadores[ev.id];
        const visual = this.visuais[ev.id];
        tocar("habilidade");
        this.anel(ev.x, ev.y - (l?.def.altura ?? 60) / 2, 70, 0xffffff, 6, 260);
        this.anel(ev.x, ev.y - (l?.def.altura ?? 60) / 2, 110, cor(ev.id), 4, 340);
        if (visual) {
          visual.brilho = 0.8;
          visual.elastico = ev.habilidade === "area" ? 0.35 : 0.2;
        }
      } else if (ev.tipo === "area") {
        // onda de choque (redemoinho, erupção, tufão)
        this.anel(ev.x, ev.y - 6, ev.raio, 0xffffff, 12, 320);
        this.anel(ev.x, ev.y - 6, ev.raio * 1.25, cor(ev.id), 7, 420);
        fx.poeira(ev.x, ev.y, 22, 6);
        fx.tremor = Math.max(fx.tremor, 14);
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -0.4;
      } else if (ev.tipo === "teleporte") {
        const h = (e.lutadores[ev.id]?.def.altura ?? 60) / 2;
        this.anel(ev.deX, ev.deY - h, 46, cor(ev.id), 5, 260);
        this.anel(ev.x, ev.y - h, 60, 0xffffff, 6, 260);
        this.linhas.push({
          x1: ev.deX,
          y1: ev.deY - h,
          x2: ev.x,
          y2: ev.y - h,
          vida: 1,
          cor: cor(ev.id),
        });
        fx.poeira(ev.deX, ev.deY, 6, 2);
      } else if (ev.tipo === "gancho") {
        const eu = e.lutadores[ev.id];
        const alvo = e.lutadores[ev.alvo];
        if (eu && alvo) {
          const y = eu.y - eu.def.altura / 2;
          this.linhas.push({ x1: eu.x, y1: y, x2: ev.deX, y2: ev.deY, vida: 1, cor: 0xd8dee9 });
          this.anel(alvo.x, alvo.y - alvo.def.altura / 2, 50, 0xffffff, 5, 240);
        }
        fx.tremor = Math.max(fx.tremor, 6);
      } else if (ev.tipo === "devolveu") {
        this.anel(ev.x, ev.y, 60, 0xffffff, 8, 260);
        this.anel(ev.x, ev.y, 90, cor(ev.id), 5, 340);
        fx.faiscas(ev.x, ev.y, e.lutadores[ev.id]?.direcao ?? 1, 8, cor(ev.id));
        fx.tremor = Math.max(fx.tremor, 8);
      } else if (ev.tipo === "cartao") {
        // cartão erguido sobre a cabeça do alvo: um clarão vermelho e o atordoamento
        const visual = this.visuais[ev.alvo];
        if (visual) visual.brilho = 1;
        this.anel(ev.x, ev.y, 46, 0xff4d5e, 8, 320);
        this.anel(ev.x, ev.y, 26, 0xffffff, 5, 220);
        tocar("erro");
      } else if (ev.tipo === "item_caiu") {
        this.anel(ev.x, ev.y, 30, 0xffffff, 4, 260);
      } else if (ev.tipo === "item") {
        // alguém pegou um item: um aro da cor do item e o nome dele subindo
        const visual = this.visuais[ev.id];
        if (visual) visual.pulso = 1;
        this.anel(ev.x, ev.y, 54, COR_DO_ITEM[ev.item], 7, 320);
        this.anel(ev.x, ev.y, 30, 0xffffff, 4, 220);
        tocar(ev.item === "mola" ? "pronto" : "compra");
      } else if (ev.tipo === "bomba") {
        this.anel(ev.x, ev.y, ev.raio, 0xff8a3d, 18, 520);
        this.anel(ev.x, ev.y, ev.raio * 0.55, 0xffffff, 10, 340);
        fx.tremor = Math.max(fx.tremor, 18);
        tocar("nocaute");
      } else {
        // explosão de um monstro ao sair da arena
        this.anel(ev.x, ev.y, ev.raio, 0xf2713d, 16, 520);
        this.anel(ev.x, ev.y, ev.raio * 0.6, 0xffd54a, 10, 380);
        fx.tremor = Math.max(fx.tremor, 16);
      }
    }

    // Rastro de quem voa arremessado, de quem investe e de quem salta.
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      const voando = l.lancado && l.atordoado > 0 && Math.hypot(l.vx, l.vy) > 7;
      if (voando || l.impulso > 0) fx.rastro(l.x, l.y - l.def.altura / 2, corDoJogador(l.dono));
    }
    return continuar;
  }

  private anel(
    x: number,
    y: number,
    raioMax: number,
    cor: number,
    espessura: number,
    vida: number,
  ): void {
    this.efeitos.aneis.push({ x, y, raio: 4, raioMax, vida: 0, vidaMax: vida, cor, espessura });
  }

  private atualizarCamera(ms: number): void {
    const e = this.laco.estado;
    const chao = e.arena.chao;
    let minX = chao.x + 100;
    let maxX = chao.x + chao.largura - 100;
    let minY = chao.y - 280;
    let maxY = chao.y + 40;
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      minX = Math.min(minX, l.x - 170);
      maxX = Math.max(maxX, l.x + 170);
      minY = Math.min(minY, l.y - 230);
      maxY = Math.max(maxY, l.y + 130);
    }
    const zoomAlvo = Math.min(
      1.0,
      Math.max(0.42, Math.min(LARGURA / (maxX - minX), (ALTURA - 150) / (maxY - minY))),
    );
    const k = 1 - Math.pow(0.92, ms / 16.667);
    this.cam.x += ((minX + maxX) / 2 - this.cam.x) * k;
    this.cam.y += ((minY + maxY) / 2 + 40 - this.cam.y) * k;
    this.cam.zoom += (zoomAlvo - this.cam.zoom) * k;

    const t = this.efeitos.tremor;
    const tx = (Math.random() - 0.5) * 2 * t;
    const ty = (Math.random() - 0.5) * 2 * t;
    this.mundo.setScale(this.cam.zoom);
    this.mundo.setPosition(
      LARGURA / 2 - this.cam.x * this.cam.zoom + tx,
      ALTURA / 2 - this.cam.y * this.cam.zoom + ty,
    );
  }

  private desenharLutadores(ms: number): void {
    const e = this.laco.estado;
    const quadros = ms / 16.667;
    const escalaTexto = Math.min(1.7, 0.95 / this.cam.zoom);
    for (const l of e.lutadores) {
      const v = this.visuais[l.id];
      if (!v) continue;
      const g = v.corpo;
      g.clear();
      v.dano.setVisible(l.vivo);
      v.debug.setVisible(l.vivo && this.debug);
      if (v.sprite) this.desenharSprite(l, v, e.tick);
      if (!l.vivo) continue;

      v.elastico *= Math.pow(0.8, quadros);
      v.brilho = Math.max(0, v.brilho - ms / 140);
      v.pulso = Math.max(0, v.pulso - ms / 260);
      if (this.pausaGolpe <= 0) v.tremer = 0;

      const voando = l.atordoado > 0 && !l.noChao;
      if (voando) v.giro += (l.vx >= 0 ? 1 : -1) * 0.02 * Math.hypot(l.vx, l.vy) * quadros;
      else v.giro *= Math.pow(0.6, quadros);

      // Preparando o pisão: vai se achatando até soltar.
      const hab = l.def.habilidade;
      const preparo =
        hab.tipo === "area" && l.hab.ticks > 0 ? -0.25 * (1 - l.hab.ticks / hab.duracao) : 0;
      const investindo = hab.tipo === "investida" && l.hab.ticks > 0 ? -0.18 : 0;
      // No ar, estica conforme a velocidade vertical.
      const ar = l.noChao || voando ? 0 : Math.min(0.22, Math.abs(l.vy) * 0.016);
      const sy = 1 + v.elastico + ar + preparo + investindo;
      const sx = 1 / sy;
      const h = l.def.altura;

      const tremX = v.tremer > 0 ? (Math.random() - 0.5) * 9 : 0;
      const tremY = v.tremer > 0 ? (Math.random() - 0.5) * 9 : 0;
      g.setPosition(l.x + tremX, l.y - (h / 2) * sy + tremY);
      g.setScale(sx, sy);
      g.setRotation(v.giro);
      if (!v.sprite) desenharCorpo(g, l, v.brilho);
      // Invisível: quase transparente (o adversário não consegue mirar nele).
      g.setAlpha(l.invisivel > 0 ? 0.3 : 1);
      if (hab.tipo === "casco" && l.hab.ticks > 0) {
        // casco fechado: cúpula de pedra por cima
        g.fillStyle(0x6b7a90, 0.9);
        g.fillRoundedRect(-l.def.largura / 2 - 6, -h / 2 - 6, l.def.largura + 12, h + 8, 18);
        g.lineStyle(4, 0xd8e4f5, 0.9);
        g.strokeRoundedRect(-l.def.largura / 2 - 6, -h / 2 - 6, l.def.largura + 12, h + 8, 18);
      } else if (hab.tipo === "devolver" && l.hab.ticks > 0) {
        // luvas prontas para agarrar
        g.lineStyle(5, 0xffffff, 0.9);
        g.strokeCircle(l.direcao * (l.def.largura / 2 + 10), -4, 16);
      }

      this.escrever(v.dano, `${Math.round(l.dano)}%`);
      v.dano.setTint(corDoDano(l.dano));
      v.dano.setPosition(l.x, l.y - h - 26 * escalaTexto);
      v.dano.setScale(escalaTexto * (1 + v.pulso * 0.5));

      if (this.debug) {
        const recarga = (l.habRecarga / TICKS_POR_SEGUNDO).toFixed(1);
        this.escrever(v.debug, `${l.ia} · hab ${l.habRecarga === 0 ? "pronta" : recarga + "s"}`);
        v.debug.setPosition(l.x, l.y - h - 52 * escalaTexto);
        v.debug.setScale(escalaTexto);
      }
    }
  }

  /** Mostra o quadro de sprite que corresponde ao estado do lutador (ou o nocaute, depois que ele sai). */
  private desenharSprite(l: EstadoCombate["lutadores"][number], v: Visual, tick: number): void {
    const sprite = v.sprite;
    if (!sprite) return;
    const depoisDaSaida = v.saida ? tick - v.saida.tick : 0;
    const visivel = l.vivo || (v.saida !== null && depoisDaSaida <= TICKS_DE_NOCAUTE);
    sprite.setVisible(visivel);
    for (const c of v.contorno) c.setVisible(visivel);
    if (!visivel) return;

    const quadro = l.vivo ? animacaoDoLutador(l, tick) : quadroDeNocaute(depoisDaSaida);
    const x = l.vivo ? l.x : (v.saida?.x ?? l.x);
    const y = l.vivo ? l.y : (v.saida?.y ?? l.y);
    const escala = escalaDoSprite(this, l.def.id, l.def.altura);
    const esquerda = l.direcao === -1;
    const alfa = l.invisivel > 0 ? 0.3 : 1;
    const posicionar = (img: Phaser.GameObjects.Image, dx: number, dy: number): void => {
      img.setFrame(nomeDoQuadro(quadro));
      // A origem fica na linha dos pés; ao espelhar, o Phaser espelha em torno dela.
      img.setOrigin(0.5, ESPEC.linhaDeBase);
      img.setPosition(x + dx, y + dy);
      img.setScale(escala);
      img.setFlipX(esquerda);
      img.setAlpha(alfa);
    };
    const borda = 2.2;
    const deslocamentos = [
      [-borda, 0],
      [borda, 0],
      [0, -borda],
      [0, borda],
    ] as const;
    v.contorno.forEach((c, i) => {
      const [dx, dy] = deslocamentos[i] ?? [0, 0];
      posicionar(c, dx, dy);
      c.setTint(corDoJogador(l.dono));
    });
    posicionar(sprite, 0, 0);
    // Clarão branco no instante em que leva o golpe.
    if (v.brilho > 0.45) sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private desenharEfeitos(): void {
    const g = this.fx;
    const e = this.laco.estado;
    g.clear();

    // Linhas passageiras: corrente do gancho e rastro do teleporte.
    for (const l of this.linhas) {
      g.lineStyle(6 * l.vida, l.cor, l.vida);
      g.lineBetween(l.x1, l.y1, l.x2, l.y2);
      l.vida -= 0.08;
    }
    this.linhas = this.linhas.filter((l) => l.vida > 0);

    // Itens de arena (só nas partidas com itens).
    if (e.configItens) {
      for (const item of e.itens) desenharItem(g, item, e.configItens.tamanho, e.tick);
    }

    // Projéteis: tiro reto é um traço; bola e bala de canhão são redondas.
    for (const p of e.projeteis) {
      const cor = corDoJogador(e.lutadores[p.dono]?.dono ?? p.lado);
      const v = Math.hypot(p.vx, p.vy) || 1;
      const ux = p.vx / v;
      const uy = p.vy / v;
      const redondo = p.alvo !== null || p.altura >= 16;
      const raio = Math.max(p.largura, p.altura) / 2;
      g.lineStyle(redondo ? raio * 1.4 : p.altura + 2, cor, 0.35);
      g.lineBetween(p.x - ux * 46, p.y - uy * 46, p.x, p.y);
      g.lineStyle(redondo ? raio : Math.max(2, p.altura - 2), cor, 0.7);
      g.lineBetween(p.x - ux * 24, p.y - uy * 24, p.x, p.y);
      g.fillStyle(0xffffff, 1);
      if (redondo) {
        g.fillCircle(p.x, p.y, raio);
        g.fillStyle(cor, 1);
        g.fillCircle(p.x, p.y, raio * 0.5);
      } else {
        g.fillRoundedRect(p.x - p.largura / 2, p.y - p.altura / 2, p.largura, p.altura, 4);
      }
    }

    for (const r of this.efeitos.raios) {
      const t = r.vida / r.vidaMax;
      const larg = r.largura * (1 - t);
      const comp = r.comprimento * Math.min(1, t * 5);
      const nx = Math.cos(r.angulo + Math.PI / 2) * larg;
      const ny = Math.sin(r.angulo + Math.PI / 2) * larg;
      const fx = r.x + Math.cos(r.angulo) * comp;
      const fy = r.y + Math.sin(r.angulo) * comp;
      g.fillStyle(r.cor, 0.85 * (1 - t));
      g.fillTriangle(r.x - nx, r.y - ny, r.x + nx, r.y + ny, fx, fy);
    }
    for (const p of this.efeitos.particulas) {
      const t = p.vida / p.vidaMax;
      if (p.risco) {
        g.lineStyle(p.tamanho * (1 - t * 0.6), p.cor, 1 - t);
        g.lineBetween(p.x, p.y, p.x - p.vx * 2.2, p.y - p.vy * 2.2);
      } else {
        g.fillStyle(p.cor, 0.5 * (1 - t));
        g.fillCircle(p.x, p.y, p.tamanho * (1 - t * 0.5));
      }
    }
    for (const a of this.efeitos.aneis) {
      if (a.vida <= 0) continue;
      const t = a.vida / a.vidaMax;
      g.lineStyle(a.espessura * (1 - t), a.cor, 1 - t);
      g.strokeCircle(a.x, a.y, a.raio);
    }
  }

  /** Marcas por cima dos lutadores: recarga da habilidade, nível e, na depuração, caixas e alvos. */
  private desenharMarcas(): void {
    const g = this.marcas;
    const e = this.laco.estado;
    g.clear();
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      const w = l.def.largura;
      const h = l.def.altura;
      const cor = corDoJogador(l.dono);
      // Barrinha da habilidade: enche conforme a recarga; fica branca quando está pronta.
      const total = l.def.habilidade.recarga;
      const cheio = 1 - l.habRecarga / total;
      const bx = l.x - 20;
      const by = l.y - h - 12;
      g.fillStyle(0x0b0f16, 0.7);
      g.fillRoundedRect(bx - 1, by - 1, 42, 7, 3);
      g.fillStyle(cheio >= 1 ? 0xffffff : cor, 1);
      g.fillRoundedRect(bx, by, Math.max(2, 40 * cheio), 5, 2);
      desenharPinos(g, l.x, by - 8, l.nivel);

      if (!this.debug) continue;
      // Caixa do corpo.
      g.lineStyle(2, 0x4dff88, 0.9);
      g.strokeRect(l.x - w / 2, l.y - h, w, h);
      // Caixa do golpe corpo a corpo, enquanto está ativo.
      if (l.ataque.fase === "ativo" && !l.def.ataque.projetil) {
        const largura = w / 2 + l.def.ataque.alcance;
        g.lineStyle(2, 0xff3b3b, 1);
        g.fillStyle(0xff3b3b, 0.25);
        const x = l.direcao === 1 ? l.x : l.x - largura;
        g.fillRect(x, l.y - h, largura, h);
        g.strokeRect(x, l.y - h, largura, h);
      }
      // Área das habilidades em andamento.
      const hab = l.def.habilidade;
      if (l.hab.ticks > 0 && hab.tipo === "area") {
        g.lineStyle(2, 0xff3b3b, 1);
        g.strokeRect(l.x - hab.alcance, l.y - 80, hab.alcance * 2, 160);
      } else if (l.hab.ticks > 0 && hab.tipo === "investida") {
        g.lineStyle(2, 0xff3b3b, 1);
        g.strokeRect(l.x - w / 2 - 10, l.y - h, w + 20, h);
      }
      // Linha até o alvo.
      const alvo = e.lutadores.find((o) => o.id === l.alvo && o.vivo);
      if (alvo) {
        g.lineStyle(2, cor, 0.55);
        g.lineBetween(l.x, l.y - h / 2, alvo.x, alvo.y - alvo.def.altura / 2);
        g.fillStyle(cor, 0.9);
        g.fillCircle(alvo.x, alvo.y - alvo.def.altura / 2, 5);
      }
    }
    if (!this.debug) return;
    for (const p of e.projeteis) {
      g.lineStyle(2, 0xff3b3b, 1);
      g.strokeRect(p.x - p.largura / 2, p.y - p.altura / 2, p.largura, p.altura);
    }
  }

  private desenharHud(): void {
    const e = this.laco.estado;
    const g = this.tela;
    g.clear();
    if (this.efeitos.clarao > 0) {
      g.fillStyle(misturar(this.efeitos.claraoCor, 0xffffff, 0.6), this.efeitos.clarao * 0.4);
      g.fillRect(0, 0, LARGURA, ALTURA);
    }

    // Placar de baixo: um painel por lado, com o nome de quem luta e um ícone por personagem.
    for (const lado of LADOS) {
      const doLado = e.lutadores.filter((l) => l.lado === lado);
      const largura = Math.max(220, 36 + doLado.length * 32);
      const x0 = lado === 0 ? 14 : LARGURA - 14 - largura;
      g.fillStyle(0x0b0f16, 0.62);
      g.fillRoundedRect(x0, ALTURA - 98, largura, 86, 12);
      doLado.forEach((l, i) => {
        const x = x0 + 26 + i * 32;
        desenharIcone(g, l.def.papel, x, ALTURA - 40, l.vivo ? corDoJogador(l.dono) : 0x2e394c);
        if (l.vivo) {
          // tracinho com a cor do dano
          g.fillStyle(corDoDano(l.dano), 1);
          g.fillRoundedRect(x - 11, ALTURA - 22, 22 * Math.min(1, 0.15 + l.dano / 160), 4, 2);
        }
      });
      const ts = this.textoSinergia[lado];
      if (ts) this.escrever(ts, this.sinergiasDoLado(lado));
      const t = this.textoLado[lado];
      if (t) {
        const vivos = doLado.filter((l) => l.vivo).length;
        this.escrever(t, `${this.nomesDoLado(lado)}  ·  ${vivos}/${doLado.length}`);
        const ids = this.ctx
          ? lado === 0
            ? this.ctx.confronto.ladoA
            : this.ctx.confronto.ladoB
          : [lado];
        t.setTint(corDoJogador(ids[0] ?? lado));
      }
    }

    const restante = Math.max(0, Math.ceil((TICKS_MAXIMOS - e.tick) / TICKS_POR_SEGUNDO));
    this.escrever(this.textoTempo, e.fim ? "" : String(restante));
    if (this.ctx) {
      const { partida } = this.ctx;
      const vidas = partida.jogadores
        .map((j) => `${j.nome} ${j.eliminadoNaRodada === null ? `♥${j.vida}` : "fora"}`)
        .join("   ");
      this.escrever(this.textoPlacar, `Rodada ${partida.economia.rodada}   ·   ${vidas}`);
    } else {
      this.escrever(this.textoPlacar, `Azul  ${this.placar[0]}  ×  ${this.placar[1]}  Laranja`);
    }

    if (e.fim && this.msDesdeFim > 500) {
      const v = e.fim.vencedor;
      const entrada = Math.min(1, (this.msDesdeFim - 500) / 260);
      const escala = 1 + Math.pow(1 - entrada, 2) * 1.6;
      const { titulo, sub, cor } = this.textoDoFim(v);
      this.escrever(this.textoFaixa, titulo);
      this.textoFaixa.setVisible(true).setTint(cor).setScale(escala).setAlpha(entrada);
      this.escrever(this.textoSub, sub);
      this.textoSub.setVisible(true).setAlpha(entrada);
      this.escrever(this.textoResumo, this.resumo());
      this.textoResumo.setVisible(true).setAlpha(entrada);
    }
  }

  /**
   * No modo automático, mede os primeiros segundos de combate com o cenário em imagens. Se o
   * aparelho não der conta, troca para o desenho por código e guarda a escolha para as próximas.
   */
  private vigiarFluidez(ms: number): void {
    if (!this.camadas || !podeSimplificarSozinho()) return;
    if (this.medidor.medir(ms) !== "lento") return;
    opcoes.cenarioLento = true;
    salvarOpcoes();
    this.arenaDasCamadas = ""; // refaz a escolha no próximo quadro: agora cai no desenho por código
  }

  /** Troca as imagens do cenário quando a arena muda; sem imagens, a arena é desenhada por código. */
  private usarCenarioDa(arena: EstadoCombate["arena"]): void {
    if (arena.id === this.arenaDasCamadas) return;
    this.arenaDasCamadas = arena.id;
    for (const peca of this.pecasDoCenario) peca.destroy();
    this.pecasDoCenario = [];
    this.camadas = CamadasDoCenario.para(this, arena);
    this.fundo.setVisible(this.camadas === null);
    // Para os testes de navegador saberem qual dos dois caminhos está valendo.
    document.body.dataset["cenario"] = this.camadas ? "imagens" : "codigo";
    this.fundoDesenhado = "";
    if (!this.camadas) return;
    const fundo = this.camadas.criarFundo();
    const piso = this.camadas.criarPiso();
    const frente = this.camadas.criarFrente();
    this.camadaDeFundo.add(fundo);
    // O piso entra por baixo de tudo no mundo: limites, anéis e personagens ficam por cima.
    piso.forEach((img, i) => this.mundo.addAt(img, i));
    this.camadaDaFrente.add(frente);
    this.pecasDoCenario = [...fundo, ...piso, ...frente];
  }

  /** Linha que explica o resultado: quem nocauteou mais de cada lado. Só nas partidas (não na demonstração). */
  private resumo(): string {
    if (!this.ctx) return "";
    const e = this.laco.estado;
    const { confronto } = this.ctx;
    const meuLado: Lado = confronto.ladoB.includes(meuNumero()) && !confronto.fantasma ? 1 : 0;
    return resumoDosNocautes(
      this.nocautes.map((n) => {
        const autor = n.autor === null ? undefined : e.lutadores[n.autor];
        return {
          vitima: e.lutadores[n.vitima]?.def.nome ?? "?",
          autor: autor?.def.nome ?? null,
          autorDoMeuLado: autor?.lado === meuLado,
        };
      }),
    );
  }

  /** Sinergias ativas dos jogadores de um lado, em uma linha. */
  private sinergiasDoLado(lado: Lado): string {
    if (!this.ctx) return "";
    const { partida, confronto } = this.ctx;
    const ids = lado === 0 ? confronto.ladoA : confronto.ladoB;
    const nomes = new Set<string>();
    for (const id of ids) {
      const j = partida.economia.jogadores[id];
      if (!j) continue;
      for (const s of sinergiasDoJogador(j, CONTEXTO)) {
        if (s.nivel) nomes.add(`${s.nome} ${s.quantidade}`);
      }
    }
    return [...nomes].join("  ·  ");
  }

  private textoDoFim(v: Lado | null): { titulo: string; sub: string; cor: number } {
    const e = this.laco.estado;
    const sobraram = e.lutadores.filter((l) => l.vivo).length;
    const motivo = e.fim?.motivo === "tempo" ? "tempo esgotado · " : "";
    const corDoLado = (lado: Lado): number =>
      corDoJogador(e.lutadores.find((l) => l.lado === lado)?.dono ?? lado);
    if (!this.ctx) {
      const titulo = v === null ? "EMPATE" : v === 0 ? "AZUL VENCE!" : "LARANJA VENCE!";
      return {
        titulo,
        sub: `${motivo}${sobraram} de pé`,
        cor: v === null ? 0xffffff : corDoLado(v),
      };
    }
    const { confronto, resultado } = this.ctx;
    if (v === null) return { titulo: "EMPATE", sub: `${motivo}ninguém perde vida`, cor: 0xffffff };
    const meuLado: Lado | null = confronto.ladoA.includes(meuNumero())
      ? 0
      : confronto.ladoB.includes(meuNumero()) && !confronto.fantasma
        ? 1
        : null;
    const dano = resultado?.dano ?? 0;
    const perdeVida = !(v === 0 && confronto.fantasma);
    const perda = perdeVida
      ? `${this.nomesDoLado(v === 0 ? 1 : 0)}: −${dano} de vida`
      : "a cópia não perde vida";
    if (meuLado === null) {
      return {
        titulo: `${this.nomesDoLado(v)} VENCE`,
        sub: `${motivo}${perda}`,
        cor: corDoLado(v),
      };
    }
    return meuLado === v
      ? { titulo: "VITÓRIA!", sub: `${motivo}${sobraram} de pé · ${perda}`, cor: corDoLado(v) }
      : { titulo: "DERROTA", sub: `${motivo}você perde ${dano} de vida`, cor: corDoLado(v) };
  }

  /** Só regera a textura do texto quando o conteúdo muda de verdade. */
  private escrever(texto: Phaser.GameObjects.Text, conteudo: string): void {
    if (texto.text !== conteudo) texto.setText(conteudo);
  }
}
