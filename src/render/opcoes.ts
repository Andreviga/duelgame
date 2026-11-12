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
  /** Cenário em imagens, desenhado por código (mais leve), ou escolhido pelo jogo conforme o aparelho. */
  cenario: "auto" | "imagens" | "codigo";
  /** No modo automático: este aparelho já se mostrou lento com o cenário em imagens. */
  cenarioLento: boolean;
}

export const OPCOES_PADRAO: Opcoes = {
  efeitos: 0.75,
  musica: 0.5,
  velocidade: 1,
  tutorialVisto: false,
  cenario: "auto",
  cenarioLento: false,
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
  const cenario = o["cenario"];
  return {
    efeitos: volume(o["efeitos"], OPCOES_PADRAO.efeitos),
    musica: volume(o["musica"], OPCOES_PADRAO.musica),
    velocidade: velocidade === 2 || velocidade === 4 ? velocidade : 1,
    tutorialVisto: o["tutorialVisto"] === true,
    cenario: cenario === "imagens" || cenario === "codigo" ? cenario : "auto",
    cenarioLento: o["cenarioLento"] === true,
  };
}

export const gravarOpcoes = (o: Opcoes): string => JSON.stringify(o);

/** Abaixo desta média de quadros por segundo, o cenário em imagens está pesado para o aparelho. */
export const QUADROS_MINIMOS = 24;
/** Tempo de combate observado antes de decidir. */
export const JANELA_DE_MEDIDA_MS = 4000;

/**
 * O jogo deve usar o cenário em imagens? `pedido` é o parâmetro `?cenario=` do endereço, que
 * manda em tudo (serve para testar). Sem ele, vale a opção do jogador; no automático, usa as
 * imagens até o aparelho se mostrar lento.
 */
export function usarImagensDeCenario(o: Opcoes, pedido: string | null): boolean {
  if (pedido === "codigo") return false;
  if (pedido === "imagens") return true;
  if (o.cenario === "auto") return !o.cenarioLento;
  return o.cenario === "imagens";
}

/**
 * Medidor da fluidez do combate. Some o tempo de cada quadro com `medir`; quando a janela fecha,
 * ele responde uma vez se o aparelho está lento (média abaixo de `QUADROS_MINIMOS`).
 */
export function criarMedidor(): { medir: (ms: number) => "lento" | "ok" | null } {
  let tempo = 0;
  let quadros = 0;
  let decidido = false;
  return {
    medir(ms) {
      if (decidido) return null;
      tempo += ms;
      quadros++;
      if (tempo < JANELA_DE_MEDIDA_MS) return null;
      decidido = true;
      return (quadros * 1000) / tempo < QUADROS_MINIMOS ? "lento" : "ok";
    },
  };
}
