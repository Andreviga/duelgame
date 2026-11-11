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
  /** Pontos onde o jogador pode posicionar personagens, no lado esquerdo; o direito usa o espelho. */
  readonly pontos: readonly { readonly x: number; readonly y: number }[];
}

/** Dano e arremesso de um acerto (golpe, projétil ou habilidade). */
export interface DefImpacto {
  /** Dano em pontos de porcentagem. */
  readonly dano: number;
  readonly arremessoBase: number;
  readonly arremessoCrescimento: number;
  readonly anguloGraus: number;
}

export interface DefProjetil {
  /** Velocidade em px por tick. */
  readonly velocidade: number;
  readonly largura: number;
  readonly altura: number;
  /** Tempo de vida em ticks. */
  readonly vida: number;
}

export interface DefAtaque extends DefImpacto {
  /** Corpo a corpo: tamanho da caixa de acerto. À distância: distância máxima para atirar. */
  readonly alcance: number;
  /** Duração de cada parte do golpe, em ticks. */
  readonly inicio: number;
  readonly ativo: number;
  readonly recuperacao: number;
  readonly recarga: number;
  /** Se presente, o ataque dispara um projétil em vez de bater. */
  readonly projetil?: DefProjetil;
}

export type TipoHabilidade = "investida" | "rajada" | "pisao" | "salto";

/**
 * Habilidade com tempo de recarga. O sentido de cada campo depende do tipo:
 *  - investida: corre `duracao` ticks a `velocidade`, acertando quem estiver no caminho; `alcance` é a distância máxima para usar.
 *  - rajada:    dispara `quantidade` projéteis, um a cada `duracao` ticks, a `velocidade`; `alcance` é a distância máxima.
 *  - pisao:     prepara por `duracao` ticks e arremessa todos os inimigos a até `alcance` de distância.
 *  - salto:     pula com velocidade vertical `velocidade` e cai atrás do alvo; `alcance` é a distância máxima.
 */
export interface DefHabilidade extends DefImpacto {
  readonly tipo: TipoHabilidade;
  readonly recarga: number;
  readonly alcance: number;
  readonly velocidade: number;
  readonly duracao: number;
  readonly quantidade: number;
}

export type Arquetipo = "corpo" | "distancia" | "tanque" | "assassino";

export interface DefPersonagem {
  readonly id: string;
  readonly nome: string;
  readonly arquetipo: Arquetipo;
  /** Preço na loja, em elixir. */
  readonly custo: number;
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
  readonly habilidade: DefHabilidade;
}

export type EstadoIA =
  "procurar" | "aproximar" | "atacar" | "habilidade" | "recuar" | "recuperar" | "voltar";
export type FaseAtaque = "nenhum" | "inicio" | "ativo" | "recuperacao";
export type Lado = 0 | 1;

export interface Lutador {
  readonly id: number;
  readonly lado: Lado;
  readonly def: DefPersonagem;
  /** Nível de fusão (1 a 4). Os atributos de `def` já vêm ajustados; isto é só para mostrar. */
  readonly nivel: number;
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
  /** Ticks em que a velocidade horizontal não obedece à entrada (investida, salto). */
  impulso: number;
  /** Dano acumulado, em porcentagem. */
  dano: number;
  /** Ticks de atordoamento restantes (sem controle). */
  atordoado: number;
  /** Foi arremessado e ainda não voltou a pisar em algo. */
  lancado: boolean;
  ataque: { fase: FaseAtaque; ticks: number; acertou: boolean };
  recarga: number;
  recuarDepois: boolean;
  /** Habilidade em andamento: ticks restantes, quem já foi atingido e disparos que faltam. */
  hab: { ticks: number; atingidos: readonly number[]; restante: number };
  habRecarga: number;
  /** Id do alvo atual, ou null. */
  alvo: number | null;
  ia: EstadoIA;
  vivo: boolean;
}

export interface Projetil extends DefImpacto {
  readonly id: number;
  readonly lado: Lado;
  readonly dono: number;
  /** Centro do projétil. */
  x: number;
  y: number;
  readonly vx: number;
  readonly largura: number;
  readonly altura: number;
  vida: number;
}

/** O que a IA quer fazer neste tick. A física decide o que acontece. */
export interface Entrada {
  readonly mover: -1 | 0 | 1;
  readonly pular: boolean;
  readonly descer: boolean;
  readonly atacar: boolean;
  readonly habilidade: boolean;
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
      readonly direcao: -1 | 1;
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
  | { readonly tipo: "ataque"; readonly id: number }
  | { readonly tipo: "tiro"; readonly id: number; readonly x: number; readonly y: number }
  | {
      readonly tipo: "habilidade";
      readonly id: number;
      readonly habilidade: TipoHabilidade;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly tipo: "pisao";
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly raio: number;
    };

export interface FimCombate {
  /** Lado vencedor, ou `null` em caso de empate. */
  readonly vencedor: Lado | null;
  readonly motivo: "eliminacao" | "tempo";
  readonly tick: number;
}

/** Um personagem e onde ele começa a rodada. */
export interface Vaga {
  readonly def: DefPersonagem;
  readonly x: number;
  readonly y: number;
  readonly nivel?: number;
}
export type Esquadrao = readonly Vaga[];

export interface EstadoCombate {
  readonly tick: number;
  readonly rng: EstadoAleatorio;
  readonly arena: Arena;
  readonly lutadores: readonly Readonly<Lutador>[];
  readonly projeteis: readonly Readonly<Projetil>[];
  readonly proximoProjetil: number;
  readonly eventos: readonly Evento[];
  readonly fim: FimCombate | null;
}
