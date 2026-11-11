import especJson from "../dados/animacoes.json";
import type { Lutador } from "../sim/combate/tipos";
import { TICKS_POR_SEGUNDO } from "../sim/constantes";

export interface EspecDeAnimacoes {
  readonly quadro: number;
  readonly quadrosPorSegundo: number;
  readonly linhaDeBase: number;
  readonly animacoes: readonly {
    readonly nome: string;
    readonly quadros: number;
    readonly laco: boolean;
  }[];
}

export const ESPEC: EspecDeAnimacoes = especJson;

export type NomeDaAnimacao =
  | "parado"
  | "andar"
  | "pular"
  | "cair"
  | "atacar"
  | "habilidade"
  | "atingido"
  | "arremessado"
  | "nocaute";

export interface Quadro {
  readonly animacao: NomeDaAnimacao;
  readonly indice: number;
}

/** Nome do quadro dentro do atlas (o mesmo que a ferramenta de arte grava). */
export const nomeDoQuadro = (q: Quadro): string => `${q.animacao}_${q.indice}`;

function quadros(animacao: NomeDaAnimacao, espec: EspecDeAnimacoes): number {
  return espec.animacoes.find((a) => a.nome === animacao)?.quadros ?? 1;
}

/** Animação em laço: o quadro depende só do relógio da simulação. */
function emLaco(animacao: NomeDaAnimacao, tick: number, espec: EspecDeAnimacoes): Quadro {
  const ticksPorQuadro = TICKS_POR_SEGUNDO / espec.quadrosPorSegundo;
  return { animacao, indice: Math.floor(tick / ticksPorQuadro) % quadros(animacao, espec) };
}

/** Animação que toca uma vez: o quadro depende de quanto dela já passou (0 a 1). */
function umaVez(animacao: NomeDaAnimacao, fracao: number, espec: EspecDeAnimacoes): Quadro {
  const n = quadros(animacao, espec);
  return { animacao, indice: Math.min(n - 1, Math.max(0, Math.floor(fracao * n))) };
}

/**
 * Escolhe a animação e o quadro a partir do estado da simulação, por ordem de prioridade:
 * arremessado > atingido > habilidade > atacar > pular/cair > andar > parado.
 * É uma função pura do estado: a simulação não sabe que existem animações.
 */
export function animacaoDoLutador(
  l: Readonly<Lutador>,
  tick: number,
  espec: EspecDeAnimacoes = ESPEC,
): Quadro {
  if (l.atordoado > 0) {
    if (!l.noChao) return emLaco("arremessado", tick, espec);
    // No chão: os últimos instantes do atordoamento mostram a recuperação.
    return { animacao: "atingido", indice: l.atordoado > 14 ? 0 : l.atordoado > 6 ? 1 : 2 };
  }
  if (l.hab.ticks > 0) {
    const hab = l.def.habilidade;
    const total = Math.max(1, hab.tipo === "cadeia" ? hab.duracao * hab.quantidade : hab.duracao);
    return umaVez("habilidade", 1 - l.hab.ticks / total, espec);
  }
  if (l.ataque.fase !== "nenhum") {
    const a = l.def.ataque;
    const total = a.inicio + a.ativo + a.recuperacao;
    const passado =
      l.ataque.fase === "inicio"
        ? a.inicio - l.ataque.ticks
        : l.ataque.fase === "ativo"
          ? a.inicio + a.ativo - l.ataque.ticks
          : total - l.ataque.ticks;
    return umaVez("atacar", passado / total, espec);
  }
  if (!l.noChao) {
    if (l.vy < 0) return umaVez("pular", 1 + l.vy / l.def.pulo, espec);
    return emLaco("cair", tick, espec);
  }
  if (Math.abs(l.vx) > 0.6) return emLaco("andar", tick, espec);
  return emLaco("parado", tick, espec);
}

/** Depois de sair da arena, o personagem mostra o nocaute por este tempo. */
export const TICKS_DE_NOCAUTE = 30;

export function quadroDeNocaute(ticksDesdeASaida: number, espec: EspecDeAnimacoes = ESPEC): Quadro {
  return umaVez("nocaute", ticksDesdeASaida / TICKS_DE_NOCAUTE, espec);
}
