import Phaser from "phaser";
import { ARENA_BASICA, personagem } from "../dados";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";
import { criarCombate, stepCombate, TICKS_MAXIMOS } from "../sim/combate/combate";
import type { EstadoCombate } from "../sim/combate/tipos";
import { avancarLaco, type Laco } from "../sim/laco";
import { corParaCss, Efeitos, misturar } from "./efeitos";

const LARGURA = 1200;
const ALTURA = 675;
const CORES = [0x4fa3ff, 0xff8a3d] as const;
const CORES_ESCURAS = [0x1d4f8f, 0x9a4410] as const;
const NOMES = ["AZUL", "LARANJA"] as const;
const FONTE = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const MS_ENTRE_DUELOS = 3600;

/** Estado só visual de cada lutador (não existe na simulação). */
interface Visual {
  corpo: Phaser.GameObjects.Graphics;
  /** Esticar (+) ou achatar (-) no eixo vertical; volta a zero sozinho. */
  elastico: number;
  brilho: number;
  giro: number;
  tremer: number;
}

/**
 * Cena do duelo. Só lê o estado da simulação e desenha; os efeitos
 * (pausa no golpe, câmera lenta, tremor, partículas) são todos do render.
 */
export class CenaDuelo extends Phaser.Scene {
  private semente = 1;
  private laco!: Laco<EstadoCombate>;
  private ultimoTick = -1;
  private efeitos = new Efeitos();

  private fundo!: Phaser.GameObjects.Graphics;
  private mundo!: Phaser.GameObjects.Container;
  private cenario!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private tela!: Phaser.GameObjects.Graphics;
  private visuais: Visual[] = [];

  private textoDano: Phaser.GameObjects.Text[] = [];
  private textoNome: Phaser.GameObjects.Text[] = [];
  private pulsoDano = [0, 0];
  private textoTempo!: Phaser.GameObjects.Text;
  private textoPlacar!: Phaser.GameObjects.Text;
  private textoFaixa!: Phaser.GameObjects.Text;
  private textoSub!: Phaser.GameObjects.Text;
  private textoSemente!: Phaser.GameObjects.Text;

  private placar = [0, 0];
  private pausaGolpe = 0;
  private cameraLenta = 0;
  private msDesdeFim = 0;
  private fimContado = false;
  private cam = { x: 600, y: 380, zoom: 0.9 };

  constructor() {
    super("duelo");
  }

  create(): void {
    const param = Number(new URLSearchParams(window.location.search).get("semente"));
    this.semente = Number.isFinite(param) && param > 0 ? Math.floor(param) : 1;

    this.fundo = this.add.graphics();
    this.cenario = this.add.graphics();
    this.fx = this.add.graphics();
    this.mundo = this.add.container(0, 0, [this.cenario]);
    for (let i = 0; i < 2; i++) {
      const corpo = this.add.graphics();
      this.mundo.add(corpo);
      this.visuais.push({ corpo, elastico: 0, brilho: 0, giro: 0, tremer: 0 });
    }
    this.mundo.add(this.fx);
    this.tela = this.add.graphics();

    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 300 : LARGURA - 300;
      const cor = corParaCss(CORES[i] ?? 0xffffff);
      this.textoNome.push(
        this.add
          .text(x, ALTURA - 104, NOMES[i] ?? "", {
            fontFamily: FONTE,
            fontSize: "18px",
            color: cor,
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      this.textoDano.push(
        this.add
          .text(x, ALTURA - 58, "0%", {
            fontFamily: FONTE,
            fontSize: "58px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#0b0f16",
            strokeThickness: 8,
          })
          .setOrigin(0.5),
      );
    }
    this.textoTempo = this.add
      .text(LARGURA / 2, 34, "", {
        fontFamily: FONTE,
        fontSize: "34px",
        color: "#e8eef7",
        fontStyle: "bold",
        stroke: "#0b0f16",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.textoPlacar = this.add
      .text(LARGURA / 2, 68, "", { fontFamily: FONTE, fontSize: "16px", color: "#9fb0c8" })
      .setOrigin(0.5);
    this.textoFaixa = this.add
      .text(LARGURA / 2, ALTURA / 2 - 40, "", {
        fontFamily: FONTE,
        fontSize: "92px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#0b0f16",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.textoSub = this.add
      .text(LARGURA / 2, ALTURA / 2 + 36, "", {
        fontFamily: FONTE,
        fontSize: "20px",
        color: "#cfd8e3",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.textoSemente = this.add
      .text(LARGURA - 12, 12, "", { fontFamily: "monospace", fontSize: "12px", color: "#5b6b82" })
      .setOrigin(1, 0);

    this.iniciarDuelo();
  }

  private iniciarDuelo(): void {
    const def = personagem("lutador");
    this.laco = { estado: criarCombate(ARENA_BASICA, [def, def], this.semente), acumulado: 0 };
    this.ultimoTick = -1;
    this.efeitos.limpar();
    this.pausaGolpe = 0;
    this.cameraLenta = 0;
    this.msDesdeFim = 0;
    this.fimContado = false;
    this.pulsoDano = [0, 0];
    for (const v of this.visuais) {
      v.elastico = 0;
      v.brilho = 0;
      v.giro = 0;
      v.tremer = 0;
    }
    this.textoFaixa.setVisible(false);
    this.textoSub.setVisible(false);
    this.escrever(this.textoSemente, `semente ${this.semente}`);
  }

  override update(_tempo: number, delta: number): void {
    const ms = Math.min(delta, 50);
    const escala = this.cameraLenta > 0 ? 0.22 : 1;
    this.cameraLenta = Math.max(0, this.cameraLenta - ms);

    if (this.pausaGolpe > 0) {
      this.pausaGolpe -= ms;
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
      this.msDesdeFim += ms;
      if (this.msDesdeFim > MS_ENTRE_DUELOS) {
        this.semente++;
        this.iniciarDuelo();
      }
    }

    this.atualizarCamera(ms);
    this.desenharFundo();
    this.desenharCenario();
    this.desenharLutadores(ms);
    this.desenharEfeitos();
    this.desenharHud(ms);
  }

  /** Transforma os eventos de um tick em efeitos. Devolve false para parar o laço (pausa no golpe). */
  private aoTick(e: EstadoCombate): boolean {
    if (e.tick === this.ultimoTick) return true;
    this.ultimoTick = e.tick;
    let continuar = true;

    for (const ev of e.eventos) {
      if (ev.tipo === "golpe") {
        const atacante = e.lutadores[ev.atacante];
        const visual = this.visuais[ev.alvo];
        const dir = atacante?.direcao ?? 1;
        this.efeitos.faiscas(ev.x, ev.y, dir, ev.forca, CORES[ev.atacante] ?? 0xffffff);
        this.efeitos.tremor = Math.max(this.efeitos.tremor, Math.min(16, 2 + ev.forca * 0.7));
        if (visual) {
          visual.brilho = 1;
          visual.tremer = 1;
        }
        this.pulsoDano[ev.alvo] = 1;
        this.pausaGolpe = Math.min(170, 35 + ev.forca * 6.5);
        continuar = false;
      } else if (ev.tipo === "saida") {
        const lim = e.arena.limites;
        const x = Math.min(lim.direita, Math.max(lim.esquerda, ev.x));
        const y = Math.min(lim.fundo, Math.max(lim.topo, ev.y));
        const ang = Math.atan2(e.arena.chao.y - 150 - y, 600 - x);
        this.efeitos.explosao(x, y, ang, CORES[ev.id] ?? 0xffffff);
        this.cameraLenta = 650;
      } else if (ev.tipo === "pulo") {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = 0.3;
        if (ev.duplo) {
          this.efeitos.aneis.push({
            x: ev.x,
            y: ev.y,
            raio: 4,
            raioMax: 34,
            vida: 0,
            vidaMax: 200,
            cor: 0xcfe4ff,
            espessura: 3,
          });
        } else {
          this.efeitos.poeira(ev.x, ev.y, 5, 1.6);
        }
      } else if (ev.tipo === "pouso") {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -Math.min(0.4, 0.1 + ev.impacto * 0.025);
        this.efeitos.poeira(ev.x, ev.y, Math.min(12, 3 + Math.round(ev.impacto * 0.6)), 2.6);
      } else {
        const visual = this.visuais[ev.id];
        if (visual) visual.elastico = -0.12;
      }
    }

    // Rastro de quem está voando arremessado.
    for (const l of e.lutadores) {
      if (l.vivo && l.lancado && l.atordoado > 0 && Math.hypot(l.vx, l.vy) > 7) {
        this.efeitos.rastro(l.x, l.y - l.def.altura / 2, CORES[l.id] ?? 0xffffff);
      }
    }
    return continuar;
  }

  private atualizarCamera(ms: number): void {
    const e = this.laco.estado;
    const chao = e.arena.chao;
    let minX = chao.x + 150;
    let maxX = chao.x + chao.largura - 150;
    let minY = chao.y - 260;
    let maxY = chao.y + 40;
    for (const l of e.lutadores) {
      if (!l.vivo) continue;
      minX = Math.min(minX, l.x - 190);
      maxX = Math.max(maxX, l.x + 190);
      minY = Math.min(minY, l.y - 230);
      maxY = Math.max(maxY, l.y + 130);
    }
    const zoomAlvo = Math.min(
      1.05,
      Math.max(0.42, Math.min(LARGURA / (maxX - minX), (ALTURA - 90) / (maxY - minY))),
    );
    const k = 1 - Math.pow(0.9, ms / 16.667);
    this.cam.x += ((minX + maxX) / 2 - this.cam.x) * k;
    this.cam.y += ((minY + maxY) / 2 + 30 - this.cam.y) * k;
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
    for (const l of e.lutadores) {
      const v = this.visuais[l.id];
      if (!v) continue;
      const g = v.corpo;
      g.clear();
      if (!l.vivo) continue;

      v.elastico *= Math.pow(0.8, quadros);
      v.brilho = Math.max(0, v.brilho - ms / 140);
      if (this.pausaGolpe <= 0) v.tremer = 0;

      const voando = l.atordoado > 0 && !l.noChao;
      if (voando) v.giro += (l.vx >= 0 ? 1 : -1) * 0.02 * Math.hypot(l.vx, l.vy) * quadros;
      else v.giro *= Math.pow(0.6, quadros);

      // No ar, estica conforme a velocidade vertical.
      const ar = l.noChao || voando ? 0 : Math.min(0.22, Math.abs(l.vy) * 0.016);
      const sy = 1 + v.elastico + ar;
      const sx = 1 / sy;
      const w = l.def.largura;
      const h = l.def.altura;

      const tremX = v.tremer > 0 ? (Math.random() - 0.5) * 9 : 0;
      const tremY = v.tremer > 0 ? (Math.random() - 0.5) * 9 : 0;
      g.setPosition(l.x + tremX, l.y - (h / 2) * sy + tremY);
      g.setScale(sx, sy);
      g.setRotation(v.giro);

      // Pose do golpe: recua no início, avança no acerto.
      const fase = l.ataque.fase;
      const avanco = fase === "inicio" ? -5 : fase === "ativo" ? 9 : fase === "recuperacao" ? 3 : 0;
      const ox = avanco * l.direcao;

      const base = CORES[l.id] ?? 0xffffff;
      const cor =
        v.brilho > 0
          ? misturar(base, 0xffffff, v.brilho)
          : l.atordoado > 0
            ? misturar(base, 0xffffff, 0.25)
            : base;
      g.fillStyle(CORES_ESCURAS[l.id] ?? 0x333333, 1);
      g.fillRoundedRect(-w / 2 + ox - 3, -h / 2 - 3, w + 6, h + 6, 12);
      g.fillStyle(cor, 1);
      g.fillRoundedRect(-w / 2 + ox, -h / 2, w, h, 10);
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(-w / 2 + ox + 4, -h / 2 + 4, w - 8, 12, 6);

      // Olho: mostra para onde está virado; vira um X quando atordoado.
      const olhoX = ox + l.direcao * 9;
      const olhoY = -h / 2 + 20;
      if (l.atordoado > 0) {
        g.lineStyle(3, 0x0b0f16, 1);
        g.lineBetween(olhoX - 5, olhoY - 5, olhoX + 5, olhoY + 5);
        g.lineBetween(olhoX - 5, olhoY + 5, olhoX + 5, olhoY - 5);
      } else {
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(olhoX - 6, olhoY - 6, 12, 13, 4);
        g.fillStyle(0x0b0f16, 1);
        g.fillRect(olhoX - 2 + l.direcao * 2, olhoY - 3, 5, 7);
      }

      // Punho e corte do golpe.
      const alcance = l.def.ataque.alcance;
      if (fase === "inicio") {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(ox - l.direcao * (w / 2 + 2), 4, 8);
      } else if (fase === "ativo" || fase === "recuperacao") {
        const total = fase === "ativo" ? l.def.ataque.ativo : l.def.ataque.recuperacao;
        const alfa = fase === "ativo" ? 1 : Math.max(0, l.ataque.ticks / total) * 0.6;
        const px = ox + l.direcao * (w / 2 + alcance - 8);
        g.fillStyle(0xffffff, alfa);
        g.fillCircle(px, 2, 10);
        g.lineStyle(9, 0xffffff, alfa * 0.9);
        g.beginPath();
        if (l.direcao === 1) g.arc(ox + w / 2 - 6, 2, alcance, -1.0, 1.0, false);
        else g.arc(ox - w / 2 + 6, 2, alcance, Math.PI - 1.0, Math.PI + 1.0, false);
        g.strokePath();
        g.lineStyle(4, CORES[l.id] ?? 0xffffff, alfa * 0.8);
        g.beginPath();
        if (l.direcao === 1) g.arc(ox + w / 2 - 14, 2, alcance, -0.8, 0.8, false);
        else g.arc(ox - w / 2 + 14, 2, alcance, Math.PI - 0.8, Math.PI + 0.8, false);
        g.strokePath();
      }
    }
  }

  private desenharEfeitos(): void {
    const g = this.fx;
    g.clear();
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

    this.tela.clear();
    if (this.efeitos.clarao > 0) {
      this.tela.fillStyle(
        misturar(this.efeitos.claraoCor, 0xffffff, 0.6),
        this.efeitos.clarao * 0.55,
      );
      this.tela.fillRect(0, 0, LARGURA, ALTURA);
    }
    // Painéis do placar.
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 300 : LARGURA - 300;
      this.tela.fillStyle(0x0b0f16, 0.55);
      this.tela.fillRoundedRect(x - 110, ALTURA - 122, 220, 108, 14);
      this.tela.fillStyle(CORES[i] ?? 0xffffff, 1);
      this.tela.fillRoundedRect(x - 110, ALTURA - 20, 220, 6, 3);
    }
  }

  private desenharHud(ms: number): void {
    const e = this.laco.estado;
    for (const l of e.lutadores) {
      const texto = this.textoDano[l.id];
      if (!texto) continue;
      this.pulsoDano[l.id] = Math.max(0, (this.pulsoDano[l.id] ?? 0) - ms / 260);
      const pulso = this.pulsoDano[l.id] ?? 0;
      this.escrever(texto, l.vivo ? `${Math.round(l.dano)}%` : "FORA");
      const t = l.dano / 160;
      const cor =
        t < 0.5 ? misturar(0xffffff, 0xffd54a, t * 2) : misturar(0xffd54a, 0xff3b3b, (t - 0.5) * 2);
      texto.setTint(l.vivo ? cor : 0x6b7890);
      texto.setScale(1 + pulso * 0.35);
      // Tremor por posição: texto girado sai com falhas no Phaser 4.
      const xBase = l.id === 0 ? 300 : LARGURA - 300;
      texto.setPosition(
        xBase + (Math.random() - 0.5) * 10 * pulso,
        ALTURA - 58 + (Math.random() - 0.5) * 10 * pulso,
      );
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
      const falta = Math.max(1, Math.ceil((MS_ENTRE_DUELOS - this.msDesdeFim) / 1000));
      const motivo = e.fim.motivo === "tempo" ? "tempo esgotado · " : "";
      this.escrever(this.textoSub, `${motivo}próximo duelo em ${falta}…`);
      this.textoSub.setVisible(true).setAlpha(entrada);
    }
  }

  /** Só regera a textura do texto quando o conteúdo muda de verdade. */
  private escrever(texto: Phaser.GameObjects.Text, conteudo: string): void {
    if (texto.text !== conteudo) texto.setText(conteudo);
  }
}
