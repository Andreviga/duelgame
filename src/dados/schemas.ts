import type { Arena, DefAtaque, DefPersonagem, Plataforma, Ret } from "../sim/combate/tipos";

/** Validação simples dos JSON de conteúdo. Erros dizem o caminho do campo com problema. */
export class ErroDeDados extends Error {}

type Obj = Record<string, unknown>;

function obj(v: unknown, caminho: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ErroDeDados(`${caminho}: esperava um objeto`);
  }
  return v as Obj;
}

function lista(v: unknown, caminho: string, minimo = 0): unknown[] {
  if (!Array.isArray(v)) throw new ErroDeDados(`${caminho}: esperava uma lista`);
  if (v.length < minimo) throw new ErroDeDados(`${caminho}: esperava pelo menos ${minimo} itens`);
  return v;
}

function texto(o: Obj, campo: string, caminho: string): string {
  const v = o[campo];
  if (typeof v !== "string" || v.length === 0) {
    throw new ErroDeDados(`${caminho}.${campo}: esperava um texto`);
  }
  return v;
}

function num(
  o: Obj,
  campo: string,
  caminho: string,
  regra: "qualquer" | "positivo" | "naoNegativo",
): number {
  const v = o[campo];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ErroDeDados(`${caminho}.${campo}: esperava um número`);
  }
  if (regra === "positivo" && v <= 0)
    throw new ErroDeDados(`${caminho}.${campo}: deve ser maior que zero`);
  if (regra === "naoNegativo" && v < 0)
    throw new ErroDeDados(`${caminho}.${campo}: não pode ser negativo`);
  return v;
}

function inteiro(o: Obj, campo: string, caminho: string): number {
  const v = num(o, campo, caminho, "positivo");
  if (!Number.isInteger(v)) throw new ErroDeDados(`${caminho}.${campo}: deve ser inteiro (ticks)`);
  return v;
}

export function validarArena(json: unknown): Arena {
  const c = "arena";
  const o = obj(json, c);
  const ch = obj(o["chao"], `${c}.chao`);
  const chao: Ret = {
    x: num(ch, "x", `${c}.chao`, "qualquer"),
    y: num(ch, "y", `${c}.chao`, "qualquer"),
    largura: num(ch, "largura", `${c}.chao`, "positivo"),
    altura: num(ch, "altura", `${c}.chao`, "positivo"),
  };
  const plataformas: Plataforma[] = lista(o["plataformas"], `${c}.plataformas`).map((p, i) => {
    const cp = `${c}.plataformas[${i}]`;
    const po = obj(p, cp);
    return {
      x: num(po, "x", cp, "qualquer"),
      y: num(po, "y", cp, "qualquer"),
      largura: num(po, "largura", cp, "positivo"),
    };
  });
  const lo = obj(o["limites"], `${c}.limites`);
  const limites = {
    esquerda: num(lo, "esquerda", `${c}.limites`, "qualquer"),
    direita: num(lo, "direita", `${c}.limites`, "qualquer"),
    topo: num(lo, "topo", `${c}.limites`, "qualquer"),
    fundo: num(lo, "fundo", `${c}.limites`, "qualquer"),
  };
  if (limites.esquerda >= chao.x || limites.direita <= chao.x + chao.largura) {
    throw new ErroDeDados(`${c}.limites: os limites laterais devem ficar fora do chão`);
  }
  if (limites.topo >= chao.y || limites.fundo <= chao.y + chao.altura) {
    throw new ErroDeDados(`${c}.limites: topo e fundo devem ficar acima e abaixo do chão`);
  }
  const nascimentos = lista(o["nascimentos"], `${c}.nascimentos`, 2).map((n, i) => {
    const cn = `${c}.nascimentos[${i}]`;
    const no = obj(n, cn);
    return { x: num(no, "x", cn, "qualquer"), y: num(no, "y", cn, "qualquer") };
  });
  return {
    id: texto(o, "id", c),
    nome: texto(o, "nome", c),
    gravidade: num(o, "gravidade", c, "positivo"),
    chao,
    plataformas,
    limites,
    nascimentos,
  };
}

export function validarPersonagem(json: unknown, caminho = "personagem"): DefPersonagem {
  const o = obj(json, caminho);
  const ca = `${caminho}.ataque`;
  const a = obj(o["ataque"], ca);
  const ataque: DefAtaque = {
    dano: num(a, "dano", ca, "positivo"),
    alcance: num(a, "alcance", ca, "positivo"),
    inicio: inteiro(a, "inicio", ca),
    ativo: inteiro(a, "ativo", ca),
    recuperacao: inteiro(a, "recuperacao", ca),
    recarga: inteiro(a, "recarga", ca),
    arremessoBase: num(a, "arremessoBase", ca, "naoNegativo"),
    arremessoCrescimento: num(a, "arremessoCrescimento", ca, "naoNegativo"),
    anguloGraus: num(a, "anguloGraus", ca, "qualquer"),
  };
  return {
    id: texto(o, "id", caminho),
    nome: texto(o, "nome", caminho),
    largura: num(o, "largura", caminho, "positivo"),
    altura: num(o, "altura", caminho, "positivo"),
    peso: num(o, "peso", caminho, "positivo"),
    velocidade: num(o, "velocidade", caminho, "positivo"),
    aceleracao: num(o, "aceleracao", caminho, "positivo"),
    aceleracaoAr: num(o, "aceleracaoAr", caminho, "positivo"),
    pulo: num(o, "pulo", caminho, "positivo"),
    puloDuplo: num(o, "puloDuplo", caminho, "positivo"),
    quedaMaxima: num(o, "quedaMaxima", caminho, "positivo"),
    ataque,
  };
}

export function validarPersonagens(json: unknown): DefPersonagem[] {
  return lista(json, "personagens", 1).map((p, i) => validarPersonagem(p, `personagens[${i}]`));
}
