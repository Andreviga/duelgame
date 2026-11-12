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
      /** Onde o recorte está na imagem do atlas. */
      frame: { x: number; y: number; w: number; h: number };
      rotated: false;
      trimmed: boolean;
      /** Onde o recorte fica dentro do quadro original (que tem `sourceSize`). */
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

/**
 * Arredonda cada canal de cor para `bits` bits (a transparência só nas bordas) e zera a cor dos pixels
 * invisíveis. O ruído fino do render some, e o PNG comprime bem mais, sem mudar o desenho.
 */
export function reduzirCores(img: Imagem, bits: number): Imagem {
  const passo = 2 ** (8 - bits);
  const maximo = 255 - (255 % passo);
  const rgba = new Uint8Array(img.rgba.length);
  for (let i = 0; i < img.rgba.length; i += 4) {
    const alfa = img.rgba[i + 3] ?? 0;
    if (alfa === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = Math.min(maximo, Math.round((img.rgba[i + c] ?? 0) / passo) * passo);
      // espalha o valor arredondado de volta para a faixa 0..255
      rgba[i + c] = Math.round((v / maximo) * 255);
    }
    rgba[i + 3] = alfa >= 250 ? 255 : Math.round(alfa / 17) * 17;
  }
  return { largura: img.largura, altura: img.altura, rgba };
}

/** Largura máxima do atlas. Com os quadros recortados, um personagem cabe folgado em 1024. */
export const LARGURA_MAXIMA_DO_ATLAS = 1024;
/** Pixels transparentes em volta de cada recorte, para um quadro não vazar no vizinho ao escalar. */
const MARGEM = 1;

interface Recorte {
  nome: string;
  img: Imagem;
  /** Caixa dos pixels visíveis dentro do quadro original. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Menor retângulo que contém os pixels não transparentes (1x1 no canto se o quadro for vazio). */
function caixaVisivel(img: Imagem): { x: number; y: number; w: number; h: number } {
  let x0 = img.largura;
  let y0 = img.altura;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      if ((img.rgba[(y * img.largura + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Junta os quadros em uma imagem só e monta o JSON do atlas.
 * Cada quadro é recortado na caixa dos pixels visíveis e os recortes são arrumados em prateleiras,
 * do mais alto para o mais baixo. O JSON guarda onde o recorte ficava no quadro original, então
 * o jogo desenha como se o quadro estivesse inteiro (a linha dos pés não muda).
 */
export function montarAtlas(
  id: string,
  quadros: ReadonlyMap<string, Imagem>,
  espec: EspecDeAnimacoes,
  larguraMaxima = LARGURA_MAXIMA_DO_ATLAS,
): { imagem: Imagem; json: AtlasJson } {
  const recortes: Recorte[] = [];
  for (const anim of espec.animacoes) {
    for (let i = 0; i < anim.quadros; i++) {
      const nome = nomeDoQuadro(anim.nome, i);
      const img = quadros.get(nome);
      if (!img) throw new Error(`quadro ausente: ${nome}`);
      recortes.push({ nome, img, ...caixaVisivel(img) });
    }
  }
  // Prateleiras: do mais alto para o mais baixo; o nome desempata para o resultado ser sempre igual.
  const ordenados = [...recortes].sort((a, b) => b.h - a.h || a.nome.localeCompare(b.nome));
  const posicoes = new Map<string, { x: number; y: number }>();
  let x = MARGEM;
  let y = MARGEM;
  let alturaDaPrateleira = 0;
  let largura = 0;
  for (const r of ordenados) {
    if (x + r.w + MARGEM > larguraMaxima && x > MARGEM) {
      x = MARGEM;
      y += alturaDaPrateleira + MARGEM;
      alturaDaPrateleira = 0;
    }
    posicoes.set(r.nome, { x, y });
    x += r.w + MARGEM;
    largura = Math.max(largura, x);
    alturaDaPrateleira = Math.max(alturaDaPrateleira, r.h);
  }
  const altura = y + alturaDaPrateleira + MARGEM;

  const rgba = new Uint8Array(largura * altura * 4);
  const frames: AtlasJson["frames"] = {};
  // O JSON segue a ordem da especificação, não a das prateleiras.
  for (const r of recortes) {
    const pos = posicoes.get(r.nome);
    if (!pos) throw new Error(`sem posição: ${r.nome}`);
    for (let linha = 0; linha < r.h; linha++) {
      const inicio = ((r.y + linha) * r.img.largura + r.x) * 4;
      rgba.set(r.img.rgba.subarray(inicio, inicio + r.w * 4), ((pos.y + linha) * largura + pos.x) * 4);
    }
    frames[r.nome] = {
      frame: { x: pos.x, y: pos.y, w: r.w, h: r.h },
      rotated: false,
      trimmed: r.w !== r.img.largura || r.h !== r.img.altura,
      spriteSourceSize: { x: r.x, y: r.y, w: r.w, h: r.h },
      sourceSize: { w: r.img.largura, h: r.img.altura },
    };
  }
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
