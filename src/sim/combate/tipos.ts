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
  /** Pontos do segundo jogador do mesmo lado, no modo 2x2 (mesma quantidade de `pontos`). */
  readonly pontosAliado: readonly { readonly x: number; readonly y: number }[];
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

export type TipoHabilidade =
  | "investida"
  | "area"
  | "bola"
  | "devolver"
  | "carrinho"
  | "gancho"
  | "canhao"
  | "cadeia"
  | "casco"
  | "teleporte"
  | "tufao";

/**
 * Habilidade com tempo de recarga. O sentido de cada campo depende do tipo:
 *  - investida: corre `duracao` ticks a `velocidade`, acertando quem estiver no caminho; `alcance` é a distância máxima para usar.
 *  - area:      prepara por `duracao` ticks e arremessa todos os inimigos a até `alcance` de distância.
 *  - bola:      dispara, a `velocidade`, um projétil que persegue o alvo e quica entre até `quantidade` inimigos a até `alcance` um do outro.
 *  - devolver:  por `duracao` ticks, agarra o próximo projétil inimigo e o devolve com `quantidade` vezes o arremesso.
 *  - carrinho:  desliza a `velocidade`, por até `duracao` ticks, até o inimigo mais distante (a até `alcance`) e o arremessa.
 *  - gancho:    puxa para perto o inimigo mais distante (a até `alcance`), que fica atordoado por `duracao` ticks.
 *  - canhao:    dispara, a `velocidade`, um projétil grande e lento com arremesso alto; `alcance` é a distância máxima.
 *  - cadeia:    salta entre até `quantidade` inimigos (a até `alcance`), um a cada `duracao` ticks, acertando cada um.
 *  - casco:     fica imóvel e imune a arremesso por `duracao` ticks.
 *  - teleporte: reaparece atrás do inimigo de menor peso (a até `alcance`).
 *  - tufao:     empurra todos os inimigos a até `alcance` para a borda mais próxima.
 */
export interface DefHabilidade extends DefImpacto {
  readonly tipo: TipoHabilidade;
  readonly nome: string;
  readonly recarga: number;
  readonly alcance: number;
  readonly velocidade: number;
  readonly duracao: number;
  readonly quantidade: number;
}

export type Papel = "corpo" | "distancia" | "tanque" | "assassino";
export type Mundo = "futebol" | "piratas" | "monstros" | "dojo";

export interface DefPersonagem {
  readonly id: string;
  readonly nome: string;
  readonly mundo: Mundo;
  readonly papel: Papel;
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

/**
 * Efeitos de sinergia que agem durante o combate. Os que só mudam atributos
 * (velocidade, peso, dano, alcance, recargas) já vêm aplicados em `def`.
 */
export interface BonusDeCombate {
  /** Multiplicador da parte horizontal do arremesso que este personagem causa. */
  readonly arremessoHorizontal: number;
  /** Multiplicador de dano do primeiro golpe da rodada (1 = sem bônus). */
  readonly primeiroGolpe: number;
  /** Os projéteis atravessam o primeiro alvo. */
  readonly perfura: boolean;
  /** Fração de arremesso a menos para quem está a até `raioVizinho` de um tanque aliado. */
  readonly protecaoVizinhos: number;
  readonly raioVizinho: number;
  /** Ao sair da arena, causa este dano aos inimigos a até `raioExplosao` (0 = não explode). */
  readonly danoExplosao: number;
  readonly raioExplosao: number;
  /** Ticks de invisibilidade no começo da rodada e depois de cada nocaute (0 = nunca). */
  readonly ticksInvisivel: number;
}

export const SEM_BONUS: BonusDeCombate = {
  arremessoHorizontal: 1,
  primeiroGolpe: 1,
  perfura: false,
  protecaoVizinhos: 0,
  raioVizinho: 0,
  danoExplosao: 0,
  raioExplosao: 0,
  ticksInvisivel: 0,
};

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
  /** Jogador dono do personagem (para cores e placar). Sem partida, é igual ao lado. */
  readonly dono: number;
  readonly bonus: BonusDeCombate;
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
  /** Ticks em que a velocidade horizontal não obedece à entrada (investida, carrinho). */
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
  /** Habilidade em andamento: ticks restantes, quem já foi atingido, usos que faltam e o alvo. */
  hab: { ticks: number; atingidos: readonly number[]; restante: number; alvo: number | null };
  habRecarga: number;
  /** Golpes acertados nesta rodada (o primeiro pode ter bônus de sinergia). */
  golpes: number;
  /** Ticks em que não pode ser escolhido como alvo. */
  invisivel: number;
  /** Quem acertou por último (leva o crédito se este personagem sair da arena). */
  ultimoAtacante: number | null;
  /** Id do alvo atual, ou null. */
  alvo: number | null;
  ia: EstadoIA;
  vivo: boolean;
}

export interface Projetil extends DefImpacto {
  readonly id: number;
  lado: Lado;
  dono: number;
  /** Centro do projétil. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly velocidade: number;
  readonly largura: number;
  readonly altura: number;
  vida: number;
  /** Persegue este lutador (bola que quica, projétil devolvido); null anda em linha reta. */
  alvo: number | null;
  /** Quantas vezes ainda pula para outro inimigo depois de acertar. */
  quiques: number;
  /** Distância máxima para achar o próximo inimigo ao quicar. */
  readonly raioDeBusca: number;
  /** Quantos alvos ainda atravessa. */
  perfura: number;
  atingidos: readonly number[];
  /** Multiplicador de arremesso (o projétil devolvido volta mais forte). */
  multiplicador: number;
  /** Já atravessou um alvo: daqui em diante só causa parte do dano, sem arremessar. */
  enfraquecido: boolean;
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
      /** O golpe teve bônus de primeiro golpe (crítico). */
      readonly critico: boolean;
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
      readonly tipo: "area";
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly raio: number;
    }
  | {
      readonly tipo: "teleporte";
      readonly id: number;
      readonly deX: number;
      readonly deY: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly tipo: "gancho";
      readonly id: number;
      readonly alvo: number;
      readonly deX: number;
      readonly deY: number;
    }
  | { readonly tipo: "devolveu"; readonly id: number; readonly x: number; readonly y: number }
  | {
      readonly tipo: "explosao";
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
  readonly dono?: number;
  readonly bonus?: BonusDeCombate;
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
