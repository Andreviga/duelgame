/**
 * Leitura e escrita de PNG RGBA de 8 bits, sem dependências.
 * A compressão (zlib) vem de fora, para este arquivo não depender do Node.
 */
export interface Imagem {
  readonly largura: number;
  readonly altura: number;
  /** 4 bytes por pixel (R, G, B, A), linha por linha. */
  readonly rgba: Uint8Array;
}

const ASSINATURA = [137, 80, 78, 71, 13, 10, 26, 10];

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of dados) c = (TABELA_CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (d: Uint8Array, i: number): number =>
  (((d[i] ?? 0) << 24) | ((d[i + 1] ?? 0) << 16) | ((d[i + 2] ?? 0) << 8) | (d[i + 3] ?? 0)) >>> 0;

export function decodificarPng(dados: Uint8Array, inflar: (d: Uint8Array) => Uint8Array): Imagem {
  if (ASSINATURA.some((b, i) => dados[i] !== b)) throw new Error("não é um arquivo PNG");
  let largura = 0;
  let altura = 0;
  let canais = 0;
  const partes: Uint8Array[] = [];
  for (let i = 8; i < dados.length; ) {
    const tamanho = u32(dados, i);
    const tipo = String.fromCharCode(...dados.subarray(i + 4, i + 8));
    const corpo = dados.subarray(i + 8, i + 8 + tamanho);
    if (tipo === "IHDR") {
      largura = u32(corpo, 0);
      altura = u32(corpo, 4);
      const profundidade = corpo[8];
      const cor = corpo[9];
      if (profundidade !== 8 || (cor !== 6 && cor !== 2) || corpo[12] !== 0) {
        throw new Error("PNG não suportado: precisa ser RGB ou RGBA de 8 bits, sem entrelaçamento");
      }
      canais = cor === 6 ? 4 : 3;
    } else if (tipo === "IDAT") {
      partes.push(corpo);
    } else if (tipo === "IEND") {
      break;
    }
    i += 12 + tamanho;
  }
  const junto = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    junto.set(p, pos);
    pos += p.length;
  }
  const bruto = inflar(junto);
  const passo = largura * canais;
  const linhas = new Uint8Array(altura * passo);
  // Desfaz o filtro de cada linha (tipos 0 a 4 da especificação).
  for (let y = 0; y < altura; y++) {
    const filtro = bruto[y * (passo + 1)] ?? 0;
    for (let x = 0; x < passo; x++) {
      const valor = bruto[y * (passo + 1) + 1 + x] ?? 0;
      const a = x >= canais ? (linhas[y * passo + x - canais] ?? 0) : 0;
      const b = y > 0 ? (linhas[(y - 1) * passo + x] ?? 0) : 0;
      const c = x >= canais && y > 0 ? (linhas[(y - 1) * passo + x - canais] ?? 0) : 0;
      let previsto = 0;
      if (filtro === 1) previsto = a;
      else if (filtro === 2) previsto = b;
      else if (filtro === 3) previsto = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        previsto = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linhas[y * passo + x] = (valor + previsto) & 0xff;
    }
  }
  if (canais === 4) return { largura, altura, rgba: linhas };
  const rgba = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    rgba[i * 4] = linhas[i * 3] ?? 0;
    rgba[i * 4 + 1] = linhas[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = linhas[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { largura, altura, rgba };
}

export function codificarPng(imagem: Imagem, comprimir: (d: Uint8Array) => Uint8Array): Uint8Array {
  const { largura, altura, rgba } = imagem;
  const passo = largura * 4;
  const bruto = new Uint8Array(altura * (passo + 1));
  for (let y = 0; y < altura; y++) {
    bruto.set(rgba.subarray(y * passo, (y + 1) * passo), y * (passo + 1) + 1); // filtro 0
  }
  const pedaco = (tipo: string, corpo: Uint8Array): Uint8Array => {
    const saida = new Uint8Array(12 + corpo.length);
    const vista = new DataView(saida.buffer);
    vista.setUint32(0, corpo.length);
    for (let i = 0; i < 4; i++) saida[4 + i] = tipo.charCodeAt(i);
    saida.set(corpo, 8);
    vista.setUint32(8 + corpo.length, crc32(saida.subarray(4, 8 + corpo.length)));
    return saida;
  };
  const cabecalho = new Uint8Array(13);
  const vista = new DataView(cabecalho.buffer);
  vista.setUint32(0, largura);
  vista.setUint32(4, altura);
  cabecalho.set([8, 6, 0, 0, 0], 8);
  const partes = [
    new Uint8Array(ASSINATURA),
    pedaco("IHDR", cabecalho),
    pedaco("IDAT", comprimir(bruto)),
    pedaco("IEND", new Uint8Array(0)),
  ];
  const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}
