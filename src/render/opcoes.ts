/** Opções do jogador, guardadas no navegador. Só dados: quem lê e grava é `jogo.ts` e as cenas. */
export interface Opcoes {
  /** Volume dos efeitos, de 0 a 1. */
  efeitos: number;
  /** Volume da música, de 0 a 1. */
  musica: number;
  /** Velocidade com que o combate começa. */
  velocidade: 1 | 2 | 4;
  /** O tutorial já foi visto (ou pulado). */
  tutorialVisto: boolean;
}

export const OPCOES_PADRAO: Opcoes = {
  efeitos: 0.8,
  musica: 0.5,
  velocidade: 1,
  tutorialVisto: false,
};
export const CHAVE_DAS_OPCOES = "arena:opcoes";
/** Degraus dos controles de volume na tela de opções. */
export const DEGRAUS_DE_VOLUME = [0, 0.25, 0.5, 0.75, 1] as const;

const volume = (v: unknown, padrao: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : padrao;

/** Lê as opções do texto guardado. Qualquer coisa inválida ou ausente volta ao padrão. */
export function lerOpcoes(texto: string | null): Opcoes {
  let bruto: unknown;
  try {
    bruto = texto ? JSON.parse(texto) : null;
  } catch {
    bruto = null;
  }
  if (typeof bruto !== "object" || bruto === null) return { ...OPCOES_PADRAO };
  const o = bruto as Record<string, unknown>;
  const velocidade = o["velocidade"];
  return {
    efeitos: volume(o["efeitos"], OPCOES_PADRAO.efeitos),
    musica: volume(o["musica"], OPCOES_PADRAO.musica),
    velocidade: velocidade === 2 || velocidade === 4 ? velocidade : 1,
    tutorialVisto: o["tutorialVisto"] === true,
  };
}

export const gravarOpcoes = (o: Opcoes): string => JSON.stringify(o);
