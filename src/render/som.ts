import { CHAVE_DAS_OPCOES, gravarOpcoes, lerOpcoes, type Opcoes } from "./opcoes";

/**
 * Todo o som do jogo, gerado por síntese no navegador (Web Audio): não há arquivo de áudio.
 * Efeitos são osciladores e ruído com envelopes curtos; a música é um sequenciador de passos.
 * O navegador só libera áudio depois de um gesto do jogador: `destravar` é chamado no primeiro toque.
 */
export type Efeito =
  | "golpe"
  | "golpeForte"
  | "habilidade"
  | "tiro"
  | "nocaute"
  | "compra"
  | "venda"
  | "fusao"
  | "erro"
  | "clique"
  | "pronto"
  | "vitoria"
  | "derrota";
export type Musica = "preparacao" | "combate" | null;

let ctx: AudioContext | null = null;
let saidaEfeitos: GainNode | null = null;
let saidaMusica: GainNode | null = null;
let ruido: AudioBuffer | null = null;
let musicaAtual: Musica = null;
let relogio: number | null = null;
let proximoPasso = 0;
let passo = 0;
const ultimoToque = new Map<Efeito, number>();

export const opcoes: Opcoes = lerOpcoes(
  typeof window === "undefined" ? null : window.localStorage.getItem(CHAVE_DAS_OPCOES),
);

/** Grava as opções e aplica os volumes na hora. */
export function salvarOpcoes(): void {
  window.localStorage.setItem(CHAVE_DAS_OPCOES, gravarOpcoes(opcoes));
  if (ctx && saidaEfeitos && saidaMusica) {
    saidaEfeitos.gain.setTargetAtTime(opcoes.efeitos * 0.5, ctx.currentTime, 0.03);
    saidaMusica.gain.setTargetAtTime(opcoes.musica * 0.22, ctx.currentTime, 0.03);
  }
}

/** Cria (ou retoma) o contexto de áudio. Chamar a partir de um gesto do jogador. */
export function destravar(): void {
  if (!ctx) {
    const Classe =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return;
    ctx = new Classe();
    saidaEfeitos = ctx.createGain();
    saidaMusica = ctx.createGain();
    saidaEfeitos.connect(ctx.destination);
    saidaMusica.connect(ctx.destination);
    saidaEfeitos.gain.value = opcoes.efeitos * 0.5;
    saidaMusica.gain.value = opcoes.musica * 0.22;
    ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  if (musicaAtual && relogio === null) iniciarRelogio();
}

interface Nota {
  /** Frequência inicial e final (Hz); o tom desliza de uma para a outra. */
  de: number;
  ate?: number;
  duracao: number;
  onda?: OscillatorType;
  volume?: number;
  atraso?: number;
}

function nota(saida: GainNode, quando: number, n: Nota): void {
  if (!ctx) return;
  const inicio = quando + (n.atraso ?? 0);
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = n.onda ?? "square";
  osc.frequency.setValueAtTime(n.de, inicio);
  if (n.ate) osc.frequency.exponentialRampToValueAtTime(Math.max(20, n.ate), inicio + n.duracao);
  const volume = n.volume ?? 0.5;
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.008);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + n.duracao);
  osc.connect(ganho).connect(saida);
  osc.start(inicio);
  osc.stop(inicio + n.duracao + 0.02);
}

function chiado(
  saida: GainNode,
  quando: number,
  duracao: number,
  volume: number,
  corte: number,
  tipo: BiquadFilterType = "lowpass",
): void {
  if (!ctx || !ruido) return;
  const fonte = ctx.createBufferSource();
  fonte.buffer = ruido;
  fonte.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.setValueAtTime(corte, quando);
  if (tipo === "lowpass") filtro.frequency.exponentialRampToValueAtTime(80, quando + duracao);
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(volume, quando);
  ganho.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);
  fonte.connect(filtro).connect(ganho).connect(saida);
  fonte.start(quando, Math.random() * 0.5);
  fonte.stop(quando + duracao + 0.02);
}

/** Intervalo mínimo entre dois toques do mesmo efeito, para o combate 4x4 não virar uma parede de som. */
const INTERVALO_MINIMO: Partial<Record<Efeito, number>> = {
  golpe: 0.05,
  golpeForte: 0.08,
  tiro: 0.06,
  habilidade: 0.08,
  nocaute: 0.1,
};

export function tocar(efeito: Efeito): void {
  if (!ctx || !saidaEfeitos || opcoes.efeitos <= 0) return;
  const t = ctx.currentTime;
  const minimo = INTERVALO_MINIMO[efeito] ?? 0;
  if (t - (ultimoToque.get(efeito) ?? -1) < minimo) return;
  ultimoToque.set(efeito, t);
  const s = saidaEfeitos;
  switch (efeito) {
    case "golpe":
      chiado(s, t, 0.07, 0.5, 2400);
      nota(s, t, { de: 220, ate: 90, duracao: 0.08, onda: "triangle", volume: 0.5 });
      break;
    case "golpeForte":
      chiado(s, t, 0.16, 0.8, 1800);
      nota(s, t, { de: 160, ate: 45, duracao: 0.22, onda: "sine", volume: 0.9 });
      nota(s, t, { de: 520, ate: 130, duracao: 0.09, onda: "square", volume: 0.25 });
      break;
    case "tiro":
      nota(s, t, { de: 880, ate: 300, duracao: 0.09, onda: "square", volume: 0.22 });
      chiado(s, t, 0.05, 0.25, 5000, "highpass");
      break;
    case "habilidade":
      nota(s, t, { de: 330, ate: 990, duracao: 0.18, onda: "sawtooth", volume: 0.28 });
      nota(s, t, {
        de: 495,
        ate: 1480,
        duracao: 0.18,
        onda: "triangle",
        volume: 0.22,
        atraso: 0.03,
      });
      break;
    case "nocaute":
      chiado(s, t, 0.5, 0.9, 3200);
      nota(s, t, { de: 300, ate: 40, duracao: 0.5, onda: "sawtooth", volume: 0.5 });
      nota(s, t, { de: 90, ate: 30, duracao: 0.6, onda: "sine", volume: 0.9 });
      break;
    case "compra":
      nota(s, t, { de: 660, duracao: 0.07, onda: "triangle", volume: 0.4 });
      nota(s, t, { de: 990, duracao: 0.12, onda: "triangle", volume: 0.4, atraso: 0.06 });
      break;
    case "venda":
      nota(s, t, { de: 880, duracao: 0.06, onda: "triangle", volume: 0.35 });
      nota(s, t, { de: 587, duracao: 0.12, onda: "triangle", volume: 0.35, atraso: 0.06 });
      break;
    case "fusao":
      [523, 659, 784, 1047].forEach((f, i) =>
        nota(s, t, { de: f, duracao: 0.16, onda: "square", volume: 0.3, atraso: i * 0.07 }),
      );
      nota(s, t, { de: 1568, duracao: 0.4, onda: "triangle", volume: 0.3, atraso: 0.28 });
      break;
    case "erro":
      nota(s, t, { de: 196, duracao: 0.1, onda: "square", volume: 0.3 });
      nota(s, t, { de: 147, duracao: 0.16, onda: "square", volume: 0.3, atraso: 0.09 });
      break;
    case "clique":
      nota(s, t, { de: 740, duracao: 0.04, onda: "triangle", volume: 0.3 });
      break;
    case "pronto":
      nota(s, t, { de: 392, duracao: 0.1, onda: "square", volume: 0.3 });
      nota(s, t, { de: 587, duracao: 0.2, onda: "square", volume: 0.3, atraso: 0.1 });
      break;
    case "vitoria":
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        nota(s, t, { de: f, duracao: 0.22, onda: "square", volume: 0.3, atraso: i * 0.11 }),
      );
      break;
    case "derrota":
      [392, 349, 294, 220].forEach((f, i) =>
        nota(s, t, { de: f, duracao: 0.3, onda: "triangle", volume: 0.4, atraso: i * 0.17 }),
      );
      break;
  }
}

// ---------- música ----------

/** Frequência de uma nota MIDI. */
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

interface Faixa {
  /** Passos (semicolcheias) por minuto dividido por 4 = batidas por minuto. */
  bpm: number;
  /** 32 passos de baixo e de melodia (nota MIDI, ou 0 para silêncio). */
  baixo: readonly number[];
  melodia: readonly number[];
  /** Passos em que tocam o bumbo e o prato. */
  bumbo: readonly number[];
  prato: readonly number[];
  ondaDaMelodia: OscillatorType;
}

const FAIXAS: Record<Exclude<Musica, null>, Faixa> = {
  // Calma, para pensar: lá menor, arpejos espaçados.
  preparacao: {
    bpm: 92,
    baixo: [
      45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0, 40,
      0, 43, 0,
    ],
    melodia: [
      69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 72, 0, 77, 0, 72, 0, 67, 0, 71, 0, 74, 0, 71, 0, 76, 0, 71,
      0, 68, 0, 0, 0,
    ],
    bumbo: [0, 16],
    prato: [4, 12, 20, 28],
    ondaDaMelodia: "triangle",
  },
  // Agitada, para a luta: ré menor, baixo em colcheias.
  combate: {
    bpm: 138,
    baixo: [
      38, 0, 38, 0, 38, 0, 38, 41, 38, 0, 38, 0, 36, 0, 36, 0, 34, 0, 34, 0, 34, 0, 34, 38, 36, 0,
      36, 0, 33, 0, 33, 36,
    ],
    melodia: [
      62, 0, 65, 0, 69, 0, 0, 67, 65, 0, 62, 0, 0, 0, 60, 0, 58, 0, 62, 0, 65, 0, 0, 64, 60, 0, 64,
      0, 67, 0, 69, 0,
    ],
    bumbo: [0, 4, 8, 12, 16, 20, 24, 28],
    prato: [2, 6, 10, 14, 18, 22, 26, 30],
    ondaDaMelodia: "square",
  },
};

function agendarPasso(faixa: Faixa, i: number, quando: number): void {
  if (!saidaMusica) return;
  const s = saidaMusica;
  const semicolcheia = 60 / faixa.bpm / 4;
  const baixo = faixa.baixo[i] ?? 0;
  const melodia = faixa.melodia[i] ?? 0;
  if (baixo)
    nota(s, quando, { de: hz(baixo), duracao: semicolcheia * 1.8, onda: "triangle", volume: 0.9 });
  if (melodia)
    nota(s, quando, {
      de: hz(melodia),
      duracao: semicolcheia * 1.6,
      onda: faixa.ondaDaMelodia,
      volume: 0.32,
    });
  if (faixa.bumbo.includes(i))
    nota(s, quando, { de: 130, ate: 40, duracao: 0.12, onda: "sine", volume: 1 });
  if (faixa.prato.includes(i)) chiado(s, quando, 0.04, 0.25, 6000, "highpass");
}

function iniciarRelogio(): void {
  if (!ctx) return;
  proximoPasso = ctx.currentTime + 0.05;
  passo = 0;
  // Agenda um pouco à frente do relógio do áudio, para o ritmo não depender do quadro da tela.
  relogio = window.setInterval(() => {
    const faixa = musicaAtual ? FAIXAS[musicaAtual] : null;
    if (!ctx || !faixa) return;
    while (proximoPasso < ctx.currentTime + 0.2) {
      if (opcoes.musica > 0) agendarPasso(faixa, passo % 32, proximoPasso);
      proximoPasso += 60 / faixa.bpm / 4;
      passo++;
    }
  }, 50);
}

/** Troca a música de fundo (ou para, com `null`). Pode ser chamada antes do áudio ser destravado. */
export function musica(qual: Musica): void {
  if (qual === musicaAtual) return;
  musicaAtual = qual;
  if (relogio !== null) {
    window.clearInterval(relogio);
    relogio = null;
  }
  if (qual && ctx) iniciarRelogio();
}
