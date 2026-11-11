import Phaser from "phaser";
import { ARENA_BASICA, espelhar, FORMACOES } from "../dados";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";
import { criarCombate, stepCombate, TICKS_MAXIMOS } from "../sim/combate/combate";
import type { EstadoCombate, Lado } from "../sim/combate/tipos";
import { avancarLaco, type Laco } from "../sim/laco";
import { CORES, desenharCorpo, desenharIcone, NOMES } from "./desenho";
import { Efeitos, misturar } from "./efeitos";

const LARGURA = 1200;
const ALTURA = 675;
const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const MS_ENTRE_RODADAS = 3800;
const LADOS: readonly Lado[] = [0, 1];

/** Estado só visual de cada lutador (não existe na simulação). */
interface Visual {
  corpo: Phaser.GameObjects.Graphics;
  dano: Phaser.GameObjects.Text;
  debug: Phaser.GameObjects.Text;
  placar: Phaser.GameObjects.Text;
  /** Esticar (+) ou achatar (-) no eixo vertical; volta a zero sozinho. */
  elastico: number;
  brilho: number;
  giro: number;
  tremer: number;
  pulso: number;
}

function corDoDano(dano: number): number {
  const t = dano / 160;
  return t < 0.5
    ? misturar(0xffffff, 0xffd54a, t * 2)
    : misturar(0xffd54a, 0xff3b3b, (t - 0.5) * 2);
}

/**
 * Cena do combate de esquadrões. Só lê o estado da simulação e desenha; os efeitos
 * (pausa no golpe, câmera lenta, tremor, partículas) são todos do render.
 */
export class CenaCombate extends Phaser.Scene {
  private semente = 1;
  private laco!: Laco<EstadoCombate>;
  private ultimoTick = -1;
  private efeitos = new Efeitos();

  private fundo!: Phaser.GameObjects.Graphics;
  private mundo!: Phaser.GameObjects.Container;
  private cenario!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private marcas!: Phaser.GameObjects.Graphics;
  private tela!: Phaser.GameObjects.Graphics;
  private visuais: Visual[] = [];

  private textoTempo!: Phaser.GameObjects.Text;
  private textoPlacar!: Phaser.GameObjects.Text;
  private textoFaixa!: Phaser.GameObjects.Text;
  private textoSub!: Phaser.GameObjects.Text;
  private textoSemente!: Phaser.GameObjects.Text;
  private textoFormacao: Phaser.GameObjects.Text[] = [];
  private botaoVelocidade!: Phaser.GameObjects.Text;
  private botaoDebug!: Phaser.GameObjects.Text;

  private placar = [0, 0];
  private formacoes = ["", ""];
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

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const param = Number(params.get("semente"));
    this.semente = Number.isFinite(param) && param > 0 ? Math.floor(param) : 1;
    this.debug = params.has("debug");
    this.velocidade = params.get("velocidade") === "2" ? 2 : 1;

    this.fundo = this.add.graphics();
    this.cenario = this.add.graphics();
    this.fx = this.add.graphics();
    this.marcas = this.add.graphics();
    this.mundo = this.add.container(0, 0, [this.cenario]);
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
      this.textoFormacao.push(
        this.add
          .text(lado === 0 ? 24 : LARGURA - 24, ALTURA - 108, "", {
            fontFamily: FONTE,
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(lado === 0 ? 0 : 1, 0.5)
          .setTint(CORES[lado]),
      );
    }
    this.textoFaixa = this.add
      .text(LARGURA / 2, ALTURA / 2 - 50, "", estilo(88))
      .setOrigin(0.5)
      .setVisible(false);
    this.textoSub = this.add
      .text(LARGURA / 2, ALTURA / 2 + 26, "", {
        fontFamily: FONTE,
        fontSize: "20px",
        color: "#cfd8e3",
      })
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
      t.on("pointerdown", aoClicar);
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
    this.velocidade = this.velocidade === 1 ? 2 : 1;
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
    this.botaoVelocidade.setBackgroundColor(this.velocidade === 2 ? "#2f5c8a" : "#243049");
  }

  private iniciarRodada(): void {
    // A cada rodada muda a formação de um dos lados, para dar para comparar posições.
    const n = this.semente - 1;
    const fa = FORMACOES[n % FORMACOES.length];
    const fb = FORMACOES[Math.floor(n / FORMACOES.length) % FORMACOES.length];
    if (!fa || !fb) throw new Error("sem formações");
    this.formacoes = [fa.nome, fb.nome];
    const estado = criarCombate(
      ARENA_BASICA,
      [fa.vagas, espelhar(fb.vagas, ARENA_BASICA)],
      this.semente,
    );
    this.laco = { estado, acumulado: 0 };

    for (const v of this.visuais) {
      v.corpo.destroy();
      v.dano.destroy();
      v.debug.destroy();
      v.placar.destroy();
    }
    this.visuais = [];
    this.mundo.remove([this.fx, this.marcas]);
    const porLado = [0, 0];
    for (const l of estado.lutadores) {
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
      this.mundo.add([corpo, dano, debug]);
      const indice = porLado[l.lado] ?? 0;
      porLado[l.lado] = indice + 1;
      const placar = this.add
        .text(this.xDoPlacar(l.lado, indice) + 18, ALTURA - 52, "0%", {
          fontFamily: FONTE,
          fontSize: "24px",
          color: "#ffffff",
          fontStyle: "bold",
          stroke: "#0b0f16",
          strokeThickness: 5,
        })
        .setOrigin(0, 0.5);
      this.visuais.push({
        corpo,
        dano,
        debug,
        placar,
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
    this.escrever(this.textoSemente, `semente ${this.semente}`);
    for (const lado of LADOS) {
      const t = this.textoFormacao[lado];
      if (t) this.escrever(t, `${NOMES[lado]} · ${this.formacoes[lado]}`);
    }
  }

  /** Posição horizontal do espaço de um lutador no placar de baixo. */
  private xDoPlacar(lado: Lado, indice: number): number {
    return lado === 0 ? 34 + indice * 104 : LARGURA - 34 - 3 * 104 - 70 + indice * 104;
  }

  override update(_tempo: number, delta: number): void {
    const ms = Math.min(delta, 50);
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
        if (fim.vencedor !== null) this.placar[fim.vencedor] = (this.placar[fim.vencedor] ?? 0) + 1;
      }
      this.msDesdeFim += ms * this.velocidade;
      if (this.msDesdeFim > MS_ENTRE_RODADAS) {
        this.semente++;
        this.iniciarRodada();
      }
    }

    this.atualizarCamera(ms);
    this.desenharFundo();
    this.desenharCenario();
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

    for (const ev of e.eventos) {
      if (ev.tipo === "golpe") {
        const atacante = e.lutadores[ev.atacante];
        const visual = this.visuais[ev.alvo];
        fx.faiscas(ev.x, ev.y, ev.direcao, ev.forca, CORES[atacante?.lado ?? 0]);
        fx.tremor = Math.max(fx.tremor, Math.min(14, 1 + ev.forca * 0.6));
        if (visual) {
          visual.brilho = 1;
          visual.pulso = 1;
        }
        // Só os golpes fortes param o tempo; com oito lutando, pausar em todo golpe trava a luta.
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
        const lado = e.lutadores[ev.id]?.lado ?? 0;
        fx.explosao(x, y, ang, CORES[lado]);
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
        const l = e.lutadores[ev.id];
        fx.faiscas(ev.x, ev.y, l?.direcao ?? 1, 2, CORES[l?.lado ?? 0]);
      } else if (ev.tipo === "habilidade") {
        const l = e.lutadores[ev.id];
        const visual = this.visuais[ev.id];
        const cor = CORES[l?.lado ?? 0];
        this.anel(ev.x, ev.y - (l?.def.altura ?? 60) / 2, 70, 0xffffff, 6, 260);
        this.anel(ev.x, ev.y - (l?.def.altura ?? 60) / 2, 110, cor, 4, 340);
        if (visual) {
          visual.brilho = 0.8;
          visual.elastico = ev.habilidade === "pisao" ? 0.35 : 0.2;
        }
      } else {
        // pisão: onda de choque no chão
        const cor = CORES[e.lutadores[ev.id]?.lado ?? 0];
        this.anel(ev.x, ev.y - 6, ev.raio, 0xffffff, 12, 320);
        this.anel(ev.x, ev.y - 6, ev.raio * 1.25, cor, 7, 420);
        fx.poeira(ev.x, ev.y, 22, 6);
        fx.tremor = Math.max(fx.tremor, 14);
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -0.4;
      }
    }

    // Rastro de quem voa arremessado, de quem investe e de quem salta.
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      const voando = l.lancado && l.atordoado > 0 && Math.hypot(l.vx, l.vy) > 7;
      if (voando || l.impulso > 0) fx.rastro(l.x, l.y - l.def.altura / 2, CORES[l.lado]);
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

  private desenharFundo(): void {
    const g = this.fundo;
    g.clear();
    const faixas = 14;
    for (let i = 0; i < faixas; i++) {
      g.fillStyle(misturar(0x0c111b, 0x24304a, i / (faixas - 1)), 1);
      g.fillRect(0, (ALTURA / faixas) * i, LARGURA, ALTURA / faixas + 1);
    }
    // Formas distantes, com um pouco de paralaxe.
    const px = (600 - this.cam.x) * 0.06;
    const py = (380 - this.cam.y) * 0.04;
    g.fillStyle(0x2d3b5c, 0.5);
    g.fillCircle(930 + px, 150 + py, 70);
    g.fillStyle(0x1a2338, 0.9);
    g.fillTriangle(-60 + px * 2, ALTURA, 240 + px * 2, 330 + py, 560 + px * 2, ALTURA);
    g.fillTriangle(380 + px * 2, ALTURA, 760 + px * 2, 270 + py, 1120 + px * 2, ALTURA);
    g.fillTriangle(820 + px * 2, ALTURA, 1100 + px * 2, 380 + py, 1340 + px * 2, ALTURA);
  }

  private desenharCenario(): void {
    const g = this.cenario;
    const a = this.laco.estado.arena;
    g.clear();

    // Limites da arena: só aparecem quando a câmera abre.
    const lim = a.limites;
    g.lineStyle(6, 0xff4d5e, 0.35);
    g.strokeRect(lim.esquerda, lim.topo, lim.direita - lim.esquerda, lim.fundo - lim.topo);
    g.lineStyle(26, 0xff4d5e, 0.07);
    g.strokeRect(lim.esquerda, lim.topo, lim.direita - lim.esquerda, lim.fundo - lim.topo);

    // Chão sólido: bloco com base afunilada.
    const c = a.chao;
    g.fillStyle(0x1b2333, 1);
    g.fillTriangle(
      c.x + 40,
      c.y + c.altura,
      c.x + c.largura - 40,
      c.y + c.altura,
      c.x + c.largura / 2,
      c.y + c.altura + 150,
    );
    g.fillStyle(0x2c384f, 1);
    g.fillRoundedRect(c.x, c.y, c.largura, c.altura, 6);
    g.fillStyle(0x8fa6c9, 1);
    g.fillRoundedRect(c.x, c.y, c.largura, 7, 3);
    g.fillStyle(0x3a4863, 1);
    for (let x = c.x + 50; x < c.x + c.largura; x += 100) g.fillRect(x, c.y + 14, 3, c.altura - 20);

    // Plataformas atravessáveis: finas e mais claras.
    for (const p of a.plataformas) {
      g.fillStyle(0x0b0f16, 0.35);
      g.fillRoundedRect(p.x + 3, p.y + 5, p.largura, 10, 5);
      g.fillStyle(0x4d6185, 1);
      g.fillRoundedRect(p.x, p.y, p.largura, 10, 5);
      g.fillStyle(0xb9cbe8, 1);
      g.fillRoundedRect(p.x, p.y, p.largura, 3, 2);
    }
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
        hab.tipo === "pisao" && l.hab.ticks > 0 ? -0.25 * (1 - l.hab.ticks / hab.duracao) : 0;
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
      desenharCorpo(g, l, v.brilho);

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

  private desenharEfeitos(): void {
    const g = this.fx;
    const e = this.laco.estado;
    g.clear();

    // Projéteis: traço claro com rastro na cor do time.
    for (const p of e.projeteis) {
      const cor = CORES[p.lado];
      const d = p.vx >= 0 ? 1 : -1;
      g.lineStyle(p.altura + 2, cor, 0.35);
      g.lineBetween(p.x - d * 46, p.y, p.x, p.y);
      g.lineStyle(p.altura - 2, cor, 0.7);
      g.lineBetween(p.x - d * 24, p.y, p.x, p.y);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(p.x - p.largura / 2, p.y - p.altura / 2, p.largura, p.altura, 4);
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

  /** Marcas por cima dos lutadores: recarga da habilidade e, no modo de depuração, caixas e alvos. */
  private desenharMarcas(): void {
    const g = this.marcas;
    const e = this.laco.estado;
    g.clear();
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      const w = l.def.largura;
      const h = l.def.altura;
      // Barrinha da habilidade: enche conforme a recarga; fica branca quando está pronta.
      const total = l.def.habilidade.recarga;
      const cheio = 1 - l.habRecarga / total;
      const bx = l.x - 20;
      const by = l.y - h - 12;
      g.fillStyle(0x0b0f16, 0.7);
      g.fillRoundedRect(bx - 1, by - 1, 42, 7, 3);
      g.fillStyle(cheio >= 1 ? 0xffffff : CORES[l.lado], 1);
      g.fillRoundedRect(bx, by, Math.max(2, 40 * cheio), 5, 2);

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
      if (l.hab.ticks > 0 && hab.tipo === "pisao") {
        g.lineStyle(2, 0xff3b3b, 1);
        g.strokeRect(l.x - hab.alcance, l.y - 80, hab.alcance * 2, 160);
      } else if (l.hab.ticks > 0 && hab.tipo === "investida") {
        g.lineStyle(2, 0xff3b3b, 1);
        g.strokeRect(l.x - w / 2 - 10, l.y - h, w + 20, h);
      }
      // Linha até o alvo.
      const alvo = e.lutadores.find((o) => o.id === l.alvo && o.vivo);
      if (alvo) {
        g.lineStyle(2, CORES[l.lado], 0.55);
        g.lineBetween(l.x, l.y - h / 2, alvo.x, alvo.y - alvo.def.altura / 2);
        g.fillStyle(CORES[l.lado], 0.9);
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

    // Placar de baixo: um espaço por lutador, com o ícone do arquétipo e a porcentagem.
    const porLado = [0, 0];
    for (const lado of LADOS) {
      const x0 = this.xDoPlacar(lado, 0) - 22;
      g.fillStyle(0x0b0f16, 0.6);
      g.fillRoundedRect(x0, ALTURA - 92, 4 * 104 + 8, 78, 12);
      g.fillStyle(CORES[lado], 1);
      g.fillRoundedRect(x0, ALTURA - 18, 4 * 104 + 8, 5, 2);
    }
    for (const l of e.lutadores) {
      const v = this.visuais[l.id];
      if (!v) continue;
      const indice = porLado[l.lado] ?? 0;
      porLado[l.lado] = indice + 1;
      const x = this.xDoPlacar(l.lado, indice);
      desenharIcone(g, l.def.arquetipo, x, ALTURA - 52, l.vivo ? CORES[l.lado] : 0x3a4558);
      this.escrever(v.placar, l.vivo ? `${Math.round(l.dano)}%` : "fora");
      v.placar.setTint(l.vivo ? corDoDano(l.dano) : 0x5b6b82);
      v.placar.setScale(1 + v.pulso * 0.25);
    }

    const restante = Math.max(0, Math.ceil((TICKS_MAXIMOS - e.tick) / TICKS_POR_SEGUNDO));
    this.escrever(this.textoTempo, e.fim ? "" : String(restante));
    this.escrever(
      this.textoPlacar,
      `${NOMES[0]}  ${this.placar[0]}  ×  ${this.placar[1]}  ${NOMES[1]}`,
    );

    if (e.fim && this.msDesdeFim > 500) {
      const v = e.fim.vencedor;
      const entrada = Math.min(1, (this.msDesdeFim - 500) / 260);
      const escala = 1 + Math.pow(1 - entrada, 2) * 1.6;
      this.escrever(this.textoFaixa, v === null ? "EMPATE" : `${NOMES[v]} VENCE!`);
      this.textoFaixa
        .setVisible(true)
        .setTint(v === null ? 0xffffff : CORES[v])
        .setScale(escala)
        .setAlpha(entrada);
      const sobraram = e.lutadores.filter((l) => l.vivo).length;
      const falta = Math.max(1, Math.ceil((MS_ENTRE_RODADAS - this.msDesdeFim) / 1000));
      const motivo = e.fim.motivo === "tempo" ? "tempo esgotado · " : "";
      const resumo = v === null ? "" : `${sobraram} de pé · `;
      this.escrever(this.textoSub, `${motivo}${resumo}próxima rodada em ${falta}…`);
      this.textoSub.setVisible(true).setAlpha(entrada);
    }
  }

  /** Só regera a textura do texto quando o conteúdo muda de verdade. */
  private escrever(texto: Phaser.GameObjects.Text, conteudo: string): void {
    if (texto.text !== conteudo) texto.setText(conteudo);
  }
}
