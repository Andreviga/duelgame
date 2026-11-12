/** O que o tutorial precisa saber do jogador para escolher a dica. */
export interface SituacaoDoTutorial {
  rodada: number;
  noBanco: number;
  emCampo: number;
  pronto: boolean;
}

export type AlvoDoTutorial = "loja" | "banco" | "lutar" | "sinergias" | null;

export interface Dica {
  titulo: string;
  texto: string;
  /** Parte da tela que pisca para chamar a atenção. */
  alvo: AlvoDoTutorial;
}

/** O tutorial dura três rodadas guiadas; depois a partida segue normalmente. */
export const RODADAS_DO_TUTORIAL = 3;

/**
 * Dica do tutorial para a situação atual, ou null quando ele acabou.
 * Rodada 1: comprar, posicionar e lutar. Rodada 2: elixir e fusão. Rodada 3: sinergias.
 */
export function dicaDoTutorial(s: SituacaoDoTutorial): Dica | null {
  if (s.rodada > RODADAS_DO_TUTORIAL) return null;
  if (s.pronto) {
    return { titulo: "Pronto!", texto: "Agora é só assistir: eles lutam sozinhos.", alvo: null };
  }
  if (s.rodada === 1) {
    if (s.noBanco + s.emCampo === 0) {
      return {
        titulo: "1 · Compre um personagem",
        texto: "Toque em uma carta da loja. O número ao lado da gota é o preço em elixir.",
        alvo: "loja",
      };
    }
    if (s.emCampo === 0) {
      return {
        titulo: "2 · Ponha em campo",
        texto: "Arraste o personagem do banco até um dos pontos azuis da arena.",
        alvo: "banco",
      };
    }
    return {
      titulo: "3 · Lute",
      texto:
        "Toque em LUTAR. Ninguém tem vida: cada golpe aumenta a % e arremessa mais longe. Vence quem jogar os rivais para fora.",
      alvo: "lutar",
    };
  }
  if (s.rodada === 2) {
    return {
      titulo: "Elixir e fusão",
      texto:
        "Você ganha elixir a cada rodada. Três personagens iguais se fundem em um mais forte: a carta mostra FUNDE quando falta pouco. Compre, posicione e toque em LUTAR.",
      alvo: s.noBanco > 0 ? "banco" : "loja",
    };
  }
  return {
    titulo: "Sinergias",
    texto:
      "Personagens do mesmo mundo ou do mesmo papel ganham bônus juntos. O painel à esquerda mostra quantos faltam. Monte o time e toque em LUTAR.",
    alvo: "sinergias",
  };
}
