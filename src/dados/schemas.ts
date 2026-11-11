import type {
  Arena,
  Arquetipo,
  DefAtaque,
  DefHabilidade,
  DefImpacto,
  DefPersonagem,
  DefProjetil,
  Esquadrao,
  Plataforma,
  Ret,
  TipoHabilidade,
} from "../sim/combate/tipos";

const ARQUETIPOS: readonly Arquetipo[] = ["corpo", "distancia", "tanque", "assassino"];
const HABILIDADES: readonly TipoHabilidade[] = ["investida", "rajada", "pisao", "salto"];

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

function umDe<T extends string>(o: Obj, campo: string, caminho: string, opcoes: readonly T[]): T {
  const v = o[campo];
  const achado = opcoes.find((op) => op === v);
  if (achado === undefined) {
    throw new ErroDeDados(`${caminho}.${campo}: deve ser um de ${opcoes.join(", ")}`);
  }
  return achado;
}

function impacto(o: Obj, caminho: string, danoZeroPermitido: boolean): DefImpacto {
  return {
    dano: num(o, "dano", caminho, danoZeroPermitido ? "naoNegativo" : "positivo"),
    arremessoBase: num(o, "arremessoBase", caminho, "naoNegativo"),
    arremessoCrescimento: num(o, "arremessoCrescimento", caminho, "naoNegativo"),
    anguloGraus: num(o, "anguloGraus", caminho, "qualquer"),
  };
}

export function validarPersonagem(json: unknown, caminho = "personagem"): DefPersonagem {
  const o = obj(json, caminho);
  const ca = `${caminho}.ataque`;
  const a = obj(o["ataque"], ca);
  let projetil: DefProjetil | undefined;
  if (a["projetil"] !== undefined) {
    const cp = `${ca}.projetil`;
    const p = obj(a["projetil"], cp);
    projetil = {
      velocidade: num(p, "velocidade", cp, "positivo"),
      largura: num(p, "largura", cp, "positivo"),
      altura: num(p, "altura", cp, "positivo"),
      vida: inteiro(p, "vida", cp),
    };
  }
  const ataque: DefAtaque = {
    ...impacto(a, ca, false),
    alcance: num(a, "alcance", ca, "positivo"),
    inicio: inteiro(a, "inicio", ca),
    ativo: inteiro(a, "ativo", ca),
    recuperacao: inteiro(a, "recuperacao", ca),
    recarga: inteiro(a, "recarga", ca),
    ...(projetil ? { projetil } : {}),
  };
  const arquetipo = umDe(o, "arquetipo", caminho, ARQUETIPOS);
  if (arquetipo === "distancia" && !projetil) {
    throw new ErroDeDados(`${ca}.projetil: personagem à distância precisa de projétil`);
  }
  const ch = `${caminho}.habilidade`;
  const h = obj(o["habilidade"], ch);
  const habilidade: DefHabilidade = {
    ...impacto(h, ch, true),
    tipo: umDe(h, "tipo", ch, HABILIDADES),
    recarga: inteiro(h, "recarga", ch),
    alcance: num(h, "alcance", ch, "positivo"),
    velocidade: num(h, "velocidade", ch, "naoNegativo"),
    duracao: inteiro(h, "duracao", ch),
    quantidade: inteiro(h, "quantidade", ch),
  };
  return {
    id: texto(o, "id", caminho),
    nome: texto(o, "nome", caminho),
    arquetipo,
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
    habilidade,
  };
}

export function validarPersonagens(json: unknown): DefPersonagem[] {
  return lista(json, "personagens", 1).map((p, i) => validarPersonagem(p, `personagens[${i}]`));
}

export interface Formacao {
  readonly id: string;
  readonly nome: string;
  /** Posições do lado esquerdo; o lado direito usa o espelho. */
  readonly vagas: Esquadrao;
}

export function validarFormacoes(
  json: unknown,
  personagens: readonly DefPersonagem[],
  arena: Arena,
): Formacao[] {
  const meio = arena.chao.x + arena.chao.largura / 2;
  return lista(json, "formacoes", 1).map((f, i) => {
    const c = `formacoes[${i}]`;
    const o = obj(f, c);
    const vagas = lista(o["vagas"], `${c}.vagas`, 1).map((v, j) => {
      const cv = `${c}.vagas[${j}]`;
      const vo = obj(v, cv);
      const id = texto(vo, "personagem", cv);
      const def = personagens.find((p) => p.id === id);
      if (!def) throw new ErroDeDados(`${cv}.personagem: personagem desconhecido "${id}"`);
      const x = num(vo, "x", cv, "qualquer");
      if (x < arena.chao.x || x > meio) {
        throw new ErroDeDados(`${cv}.x: deve ficar na metade esquerda do chão`);
      }
      return { def, x, y: num(vo, "y", cv, "qualquer") };
    });
    return { id: texto(o, "id", c), nome: texto(o, "nome", c), vagas };
  });
}
