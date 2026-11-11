import type { Imagem } from "./png";

/** Especificação das animações (`src/dados/animacoes.json`), a mesma que o Blender usa. */
export interface EspecDeAnimacoes {
  readonly quadro: number;
  readonly quadrosPorSegundo: number;
  /** Fração da altura do quadro, a partir de cima, onde ficam os pés. */
  readonly linhaDeBase: number;
  readonly animacoes: readonly { readonly nome: string; readonly quadros: number; readonly laco: boolean }[];
}

/** Mínimo de pixels visíveis para um quadro não contar como vazio. */
export const MINIMO_DE_PIXELS = 200;
/** Animação cujos quadros precisam ser todos diferentes entre si. */
const SEM_REPETICAO = "andar";

export const nomeDoQuadro = (animacao: string, i: number): string => `${animacao}_${i}`;

function pixelsVisiveis(img: Imagem): number {
  let n = 0;
  for (let i = 3; i < img.rgba.length; i += 4) if ((img.rgba[i] ?? 0) > 16) n++;
  return n;
}

function iguais(a: Imagem, b: Imagem): boolean {
  if (a.rgba.length !== b.rgba.length) return false;
  for (let i = 0; i < a.rgba.length; i++) if (a.rgba[i] !== b.rgba[i]) return false;
  return true;
}

/**
 * Confere os quadros de um personagem. Devolve a lista de problemas (vazia = tudo certo):
 * animação ou quadro faltando, quadro sobrando, tamanho errado, quadro vazio e
 * quadro repetido dentro de `andar`.
 */
export function validarQuadros(quadros: ReadonlyMap<string, Imagem>, espec: EspecDeAnimacoes): string[] {
  const erros: string[] = [];
  const esperados = new Set<string>();
  for (const anim of espec.animacoes) {
    const presentes: Imagem[] = [];
    for (let i = 0; i < anim.quadros; i++) {
      const nome = nomeDoQuadro(anim.nome, i);
      esperados.add(nome);
      const img = quadros.get(nome);
      if (!img) continue;
      presentes.push(img);
      if (img.largura !== espec.quadro || img.altura !== espec.quadro) {
        erros.push(`${nome}: tamanho ${img.largura}x${img.altura}, esperado ${espec.quadro}x${espec.quadro}`);
      } else if (pixelsVisiveis(img) < MINIMO_DE_PIXELS) {
        erros.push(`${nome}: quadro vazio`);
      }
    }
    if (presentes.length === 0) {
      erros.push(`animação "${anim.nome}" ausente`);
    } else if (presentes.length !== anim.quadros) {
      erros.push(`animação "${anim.nome}": ${presentes.length} quadros, esperado ${anim.quadros}`);
    }
    if (anim.nome === SEM_REPETICAO) {
      for (let i = 0; i < presentes.length; i++) {
        for (let k = i + 1; k < presentes.length; k++) {
          const a = presentes[i];
          const b = presentes[k];
          if (a && b && iguais(a, b)) erros.push(`animação "${anim.nome}": os quadros ${i} e ${k} são iguais`);
        }
      }
    }
  }
  for (const nome of quadros.keys()) {
    if (!esperados.has(nome)) erros.push(`${nome}: quadro que não está na especificação`);
  }
  return erros;
}

/** Altura do personagem, em pixels, medida no primeiro quadro de `parado` (dos pés ao topo). */
export function alturaDoPersonagem(quadros: ReadonlyMap<string, Imagem>, espec: EspecDeAnimacoes): number {
  const img = quadros.get(nomeDoQuadro("parado", 0));
  if (!img) return 0;
  for (let y = 0; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      if ((img.rgba[(y * img.largura + x) * 4 + 3] ?? 0) > 16) {
        return Math.round(espec.linhaDeBase * img.altura) - y;
      }
    }
  }
  return 0;
}

/** Arquivo de atlas no formato "JSON Hash" que o Phaser lê, com os dados das animações em `meta`. */
export interface AtlasJson {
  frames: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number };
      rotated: false;
      trimmed: false;
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
    }
  >;
  meta: {
    image: string;
    format: "RGBA8888";
    size: { w: number; h: number };
    scale: "1";
    personagem: string;
    quadrosPorSegundo: number;
    linhaDeBase: number;
    alturaDoPersonagem: number;
    animacoes: Record<string, { quadros: number; laco: boolean }>;
  };
}

/** Junta os quadros em uma imagem só, uma animação por linha, e monta o JSON do atlas. */
export function montarAtlas(
  id: string,
  quadros: ReadonlyMap<string, Imagem>,
  espec: EspecDeAnimacoes,
): { imagem: Imagem; json: AtlasJson } {
  const q = espec.quadro;
  const colunas = Math.max(...espec.animacoes.map((a) => a.quadros));
  const largura = colunas * q;
  const altura = espec.animacoes.length * q;
  const rgba = new Uint8Array(largura * altura * 4);
  const frames: AtlasJson["frames"] = {};
  espec.animacoes.forEach((anim, linha) => {
    for (let i = 0; i < anim.quadros; i++) {
      const nome = nomeDoQuadro(anim.nome, i);
      const img = quadros.get(nome);
      if (!img) throw new Error(`quadro ausente: ${nome}`);
      for (let y = 0; y < q; y++) {
        const origem = img.rgba.subarray(y * q * 4, (y + 1) * q * 4);
        rgba.set(origem, ((linha * q + y) * largura + i * q) * 4);
      }
      frames[nome] = {
        frame: { x: i * q, y: linha * q, w: q, h: q },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: q, h: q },
        sourceSize: { w: q, h: q },
      };
    }
  });
  return {
    imagem: { largura, altura, rgba },
    json: {
      frames,
      meta: {
        image: `${id}.png`,
        format: "RGBA8888",
        size: { w: largura, h: altura },
        scale: "1",
        personagem: id,
        quadrosPorSegundo: espec.quadrosPorSegundo,
        linhaDeBase: espec.linhaDeBase,
        alturaDoPersonagem: alturaDoPersonagem(quadros, espec),
        animacoes: Object.fromEntries(
          espec.animacoes.map((a) => [a.nome, { quadros: a.quadros, laco: a.laco }]),
        ),
      },
    },
  };
}
