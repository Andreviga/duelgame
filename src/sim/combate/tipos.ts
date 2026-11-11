import type { EstadoAleatorio } from "../aleatorio";

export interface Ret {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

/** Plataforma atravessável: só segura quem cai sobre ela. `y` é o topo. */
export interface Plataforma {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
}

export interface Arena {
  readonly id: string;
  readonly nome: string;
  readonly gravidade: number;
  /** Chão sólido (não dá para atravessar por nenhum lado). */
  readonly chao: Ret;
  readonly plataformas: readonly Plataforma[];
  /** Quem passa destes limites sai da rodada. */
  readonly limites: {
    readonly esquerda: number;
    readonly direita: number;
    readonly topo: number;
    readonly fundo: number;
  };
  readonly nascimentos: readonly { readonly x: number; readonly y: number }[];
}

export interface DefAtaque {
  /** Dano em pontos de porcentagem. */
  readonly dano: number;
  readonly alcance: number;
  /** Duração de cada parte do golpe, em ticks. */
  readonly inicio: number;
  readonly ativo: number;
  readonly recuperacao: number;
  readonly recarga: number;
  readonly arremessoBase: number;
  readonly arremessoCrescimento: number;
  readonly anguloGraus: number;
}

export interface DefPersonagem {
  readonly id: string;
  readonly nome: string;
  readonly largura: number;
  readonly altura: number;
  readonly peso: number;
  readonly velocidade: number;
  readonly aceleracao: number;
  readonly aceleracaoAr: number;
  readonly pulo: number;
  readonly puloDuplo: number;
  readonly quedaMaxima: number;
  readonly ataque: DefAtaque;
}

export type EstadoIA = "procurar" | "aproximar" | "atacar" | "recuar" | "recuperar" | "voltar";
export type FaseAtaque = "nenhum" | "inicio" | "ativo" | "recuperacao";
export type Lado = 0 | 1;

export interface Lutador {
  readonly id: number;
  readonly lado: Lado;
  readonly def: DefPersonagem;
  /** Posição: `x` é o centro, `y` é a base (os pés). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  direcao: -1 | 1;
  noChao: boolean;
  /** Está apoiado em uma plataforma atravessável (e não no chão sólido). */
  emPlataforma: boolean;
  /** Ticks em que ignora plataformas, para descer por elas. */
  ignorarPlataforma: number;
  pulosRestantes: number;
  /** Dano acumulado, em porcentagem. */
  dano: number;
  /** Ticks de atordoamento restantes (sem controle). */
  atordoado: number;
  /** Foi arremessado e ainda não voltou a pisar em algo. */
  lancado: boolean;
  ataque: { fase: FaseAtaque; ticks: number; acertou: boolean };
  recarga: number;
  recuarDepois: boolean;
  ia: EstadoIA;
  vivo: boolean;
}

/** O que a IA quer fazer neste tick. A física decide o que acontece. */
export interface Entrada {
  readonly mover: -1 | 0 | 1;
  readonly pular: boolean;
  readonly descer: boolean;
  readonly atacar: boolean;
  readonly encarar: -1 | 0 | 1;
}

/** Acontecimentos do tick, só para o render (efeitos). Não influenciam a simulação. */
export type Evento =
  | {
      readonly tipo: "golpe";
      readonly atacante: number;
      readonly alvo: number;
      readonly x: number;
      readonly y: number;
      readonly forca: number;
    }
  | {
      readonly tipo: "saida";
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly porGolpe: boolean;
    }
  | {
      readonly tipo: "pulo";
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly duplo: boolean;
    }
  | {
      readonly tipo: "pouso";
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly impacto: number;
    }
  | { readonly tipo: "ataque"; readonly id: number };

export interface FimCombate {
  /** Lado vencedor, ou `null` em caso de empate. */
  readonly vencedor: Lado | null;
  readonly motivo: "eliminacao" | "tempo";
  readonly tick: number;
}

export interface EstadoCombate {
  readonly tick: number;
  readonly rng: EstadoAleatorio;
  readonly arena: Arena;
  readonly lutadores: readonly Readonly<Lutador>[];
  readonly eventos: readonly Evento[];
  readonly fim: FimCombate | null;
}
