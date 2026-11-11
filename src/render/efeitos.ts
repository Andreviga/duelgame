/**
 * Efeitos visuais do render: partículas, anéis e tremor de câmera.
 * Nada aqui influencia a simulação. A aleatoriedade é só cosmética, então usa Math.random.
 */
export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  cor: number;
  tamanho: number;
  gravidade: number;
  /** Risco alongado na direção do movimento (faísca) em vez de quadradinho. */
  risco: boolean;
}

export interface Anel {
  x: number;
  y: number;
  raio: number;
  raioMax: number;
  vida: number;
  vidaMax: number;
  cor: number;
  espessura: number;
}

export interface Raio {
  x: number;
  y: number;
  angulo: number;
  comprimento: number;
  largura: number;
  vida: number;
  vidaMax: number;
  cor: number;
}

export class Efeitos {
  particulas: Particula[] = [];
  aneis: Anel[] = [];
  raios: Raio[] = [];
  tremor = 0;
  clarao = 0;
  claraoCor = 0xffffff;

  limpar(): void {
    this.particulas = [];
    this.aneis = [];
    this.raios = [];
    this.tremor = 0;
    this.clarao = 0;
  }

  /** Faíscas de um golpe, em leque na direção do arremesso. */
  faiscas(x: number, y: number, direcao: number, forca: number, cor: number): void {
    const n = Math.min(34, Math.round(6 + forca * 1.4));
    for (let i = 0; i < n; i++) {
      const ang = -0.6 + (Math.random() - 0.5) * 1.9;
      const vel = (2 + Math.random() * 7) * (0.6 + forca / 14);
      this.particulas.push({
        x,
        y,
        vx: Math.cos(ang) * vel * direcao,
        vy: Math.sin(ang) * vel,
        vida: 0,
        vidaMax: 180 + Math.random() * 260,
        cor: Math.random() < 0.45 ? 0xffffff : cor,
        tamanho: 2 + Math.random() * 3,
        gravidade: 0.25,
        risco: true,
      });
    }
    this.aneis.push({
      x,
      y,
      raio: 6,
      raioMax: 40 + forca * 5,
      vida: 0,
      vidaMax: 220,
      cor: 0xffffff,
      espessura: 5,
    });
  }

  poeira(x: number, y: number, quantidade: number, espalhar: number): void {
    for (let i = 0; i < quantidade; i++) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      this.particulas.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 2,
        vx: lado * (0.5 + Math.random() * espalhar),
        vy: -Math.random() * 1.2,
        vida: 0,
        vidaMax: 260 + Math.random() * 200,
        cor: 0x9fb0c8,
        tamanho: 3 + Math.random() * 4,
        gravidade: -0.01,
        risco: false,
      });
    }
  }

  rastro(x: number, y: number, cor: number): void {
    this.particulas.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 24,
      vx: 0,
      vy: 0,
      vida: 0,
      vidaMax: 320,
      cor,
      tamanho: 9 + Math.random() * 7,
      gravidade: 0,
      risco: false,
    });
  }

  /** Explosão de eliminação: raios saindo do ponto de saída, voltados para dentro da arena. */
  explosao(x: number, y: number, anguloParaDentro: number, cor: number): void {
    for (let i = 0; i < 16; i++) {
      this.raios.push({
        x,
        y,
        angulo: anguloParaDentro + (Math.random() - 0.5) * 1.3,
        comprimento: 380 + Math.random() * 620,
        largura: 8 + Math.random() * 30,
        vida: 0,
        vidaMax: 420 + Math.random() * 380,
        cor: i % 3 === 0 ? 0xffffff : cor,
      });
    }
    for (let i = 0; i < 60; i++) {
      const ang = anguloParaDentro + (Math.random() - 0.5) * 1.6;
      const vel = 5 + Math.random() * 22;
      this.particulas.push({
        x,
        y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        vida: 0,
        vidaMax: 500 + Math.random() * 700,
        cor: Math.random() < 0.4 ? 0xffffff : cor,
        tamanho: 3 + Math.random() * 6,
        gravidade: 0.12,
        risco: true,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.aneis.push({
        x,
        y,
        raio: 10,
        raioMax: 260 + i * 170,
        vida: -i * 70,
        vidaMax: 520,
        cor: i === 0 ? 0xffffff : cor,
        espessura: 12 - i * 3,
      });
    }
    this.tremor = Math.max(this.tremor, 26);
    this.clarao = 1;
    this.claraoCor = cor;
  }

  /** `ms` é tempo real; `escala` acompanha a câmera lenta. */
  atualizar(ms: number, escala: number): void {
    const passo = (ms / 16.667) * escala;
    for (const p of this.particulas) {
      p.vida += ms * escala;
      p.vy += p.gravidade * passo;
      p.x += p.vx * passo;
      p.y += p.vy * passo;
      p.vx *= Math.pow(0.96, passo);
    }
    this.particulas = this.particulas.filter((p) => p.vida < p.vidaMax);
    for (const a of this.aneis) {
      a.vida += ms * escala;
      if (a.vida > 0) a.raio = a.raioMax * (1 - Math.pow(1 - a.vida / a.vidaMax, 3));
    }
    this.aneis = this.aneis.filter((a) => a.vida < a.vidaMax);
    for (const r of this.raios) r.vida += ms * escala;
    this.raios = this.raios.filter((r) => r.vida < r.vidaMax);
    this.tremor *= Math.pow(0.86, ms / 16.667);
    if (this.tremor < 0.3) this.tremor = 0;
    this.clarao = Math.max(0, this.clarao - ms / 260);
  }
}

export function misturar(corA: number, corB: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const r = ((corA >> 16) & 255) + (((corB >> 16) & 255) - ((corA >> 16) & 255)) * k;
  const g = ((corA >> 8) & 255) + (((corB >> 8) & 255) - ((corA >> 8) & 255)) * k;
  const b = (corA & 255) + ((corB & 255) - (corA & 255)) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function corParaCss(cor: number): string {
  return `#${cor.toString(16).padStart(6, "0")}`;
}
