import type { ConfigSinergias, DefSinergia, EfeitosDeSinergia } from "../sim/economia/sinergias";
import type { ConfigEconomia } from "../sim/economia/tipos";
import type { ConfigPartida } from "../sim/partida/tipos";
import type {
  Arena,
  DefAtaque,
  DefHabilidade,
  DefImpacto,
  DefPersonagem,
  DefProjetil,
  Esquadrao,
  Mundo,
  Papel,
  Plataforma,
  Ret,
  TipoHabilidade,
} from "../sim/combate/tipos";

const PAPEIS: readonly Papel[] = ["corpo", "distancia", "tanque", "assassino"];
const MUNDOS: readonly Mundo[] = ["futebol", "piratas", "monstros", "dojo"];
const HABILIDADES: readonly TipoHabilidade[] = [
  "investida",
  "area",
  "bola",
  "devolver",
  "carrinho",
  "gancho",
  "canhao",
  "cadeia",
  "casco",
  "teleporte",
  "tufao",
  "cartao",
  "bumerangue",
  "leque",
];
/** Habilidades que disparam projétil: o personagem precisa ter um projétil definido. */
const HABILIDADES_DE_TIRO: readonly TipoHabilidade[] = ["bola", "canhao", "leque"];

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
  const meio = chao.x + chao.largura / 2;
  const lerPontos = (campo: string) =>
    lista(o[campo], `${c}.${campo}`, 1).map((n, i) => {
      const cn = `${c}.${campo}[${i}]`;
      const no = obj(n, cn);
      const ponto = { x: num(no, "x", cn, "qualquer"), y: num(no, "y", cn, "qualquer") };
      if (ponto.x <= chao.x || ponto.x > meio) {
        throw new ErroDeDados(`${cn}.x: deve ficar na metade esquerda do chão`);
      }
      const noChao = ponto.y === chao.y;
      const emPlataforma = plataformas.some(
        (p) => p.y === ponto.y && ponto.x >= p.x && ponto.x <= p.x + p.largura,
      );
      if (!noChao && !emPlataforma) {
        throw new ErroDeDados(`${cn}: o ponto deve ficar em cima do chão ou de uma plataforma`);
      }
      return ponto;
    });
  const pontos = lerPontos("pontos");
  const pontosAliado = lerPontos("pontosAliado");
  if (pontosAliado.length !== pontos.length) {
    throw new ErroDeDados(`${c}.pontosAliado: deve ter a mesma quantidade de ${c}.pontos`);
  }
  return {
    id: texto(o, "id", c),
    nome: texto(o, "nome", c),
    gravidade: num(o, "gravidade", c, "positivo"),
    chao,
    plataformas,
    limites,
    nascimentos,
    pontos,
    pontosAliado,
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
  const papel = umDe(o, "papel", caminho, PAPEIS);
  if (papel === "distancia" && !projetil) {
    throw new ErroDeDados(`${ca}.projetil: personagem à distância precisa de projétil`);
  }
  const ch = `${caminho}.habilidade`;
  const h = obj(o["habilidade"], ch);
  const habilidade: DefHabilidade = {
    ...impacto(h, ch, true),
    tipo: umDe(h, "tipo", ch, HABILIDADES),
    nome: texto(h, "nome", ch),
    recarga: inteiro(h, "recarga", ch),
    alcance: num(h, "alcance", ch, "positivo"),
    velocidade: num(h, "velocidade", ch, "naoNegativo"),
    duracao: inteiro(h, "duracao", ch),
    quantidade: inteiro(h, "quantidade", ch),
  };
  if (HABILIDADES_DE_TIRO.includes(habilidade.tipo) && !projetil) {
    throw new ErroDeDados(
      `${ch}.tipo: a habilidade "${habilidade.tipo}" precisa de ${ca}.projetil`,
    );
  }
  return {
    id: texto(o, "id", caminho),
    nome: texto(o, "nome", caminho),
    mundo: umDe(o, "mundo", caminho, MUNDOS),
    papel,
    custo: inteiro(o, "custo", caminho),
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
      const nivel = vo["nivel"] === undefined ? 1 : inteiro(vo, "nivel", cv);
      return { def, x, y: num(vo, "y", cv, "qualquer"), nivel };
    });
    const id = o["id"] === undefined ? `${i}` : texto(o, "id", c);
    const nome = o["nome"] === undefined ? id : texto(o, "nome", c);
    return { id, nome, vagas };
  });
}

function listaDeNumeros(o: Obj, campo: string, caminho: string, tamanho?: number): number[] {
  const itens = lista(o[campo], `${caminho}.${campo}`, 1).map((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      throw new ErroDeDados(`${caminho}.${campo}[${i}]: esperava um número maior que zero`);
    }
    return v;
  });
  if (tamanho !== undefined && itens.length !== tamanho) {
    throw new ErroDeDados(`${caminho}.${campo}: esperava ${tamanho} valores, um por nível`);
  }
  return itens;
}

export function validarEconomia(json: unknown): ConfigEconomia {
  const c = "economia";
  const o = obj(json, c);
  const nivelMaximo = inteiro(o, "nivelMaximo", c);
  const m = obj(o["multiplicadores"], `${c}.multiplicadores`);
  const cm = `${c}.multiplicadores`;
  const fracao = (campo: string): number => {
    const v = num(o, campo, c, "naoNegativo");
    if (v > 1) throw new ErroDeDados(`${c}.${campo}: deve ficar entre 0 e 1`);
    return v;
  };
  return {
    elixirBase: num(o, "elixirBase", c, "naoNegativo"),
    elixirPorRodada: num(o, "elixirPorRodada", c, "naoNegativo"),
    ganhoMaximo: num(o, "ganhoMaximo", c, "positivo"),
    tetoElixir: num(o, "tetoElixir", c, "positivo"),
    custoAtualizar: num(o, "custoAtualizar", c, "naoNegativo"),
    tamanhoLoja: inteiro(o, "tamanhoLoja", c),
    tamanhoBanco: inteiro(o, "tamanhoBanco", c),
    limiteCampo: listaDeNumeros(o, "limiteCampo", c),
    copiasPorPersonagem: inteiro(o, "copiasPorPersonagem", c),
    nivelMaximo,
    reembolsoNivel1: fracao("reembolsoNivel1"),
    reembolsoNiveisMaiores: fracao("reembolsoNiveisMaiores"),
    segundosPreparacao: num(o, "segundosPreparacao", c, "positivo"),
    multiplicadores: {
      dano: listaDeNumeros(m, "dano", cm, nivelMaximo),
      peso: listaDeNumeros(m, "peso", cm, nivelMaximo),
      tamanho: listaDeNumeros(m, "tamanho", cm, nivelMaximo),
    },
  };
}

export function validarPartida(json: unknown): ConfigPartida {
  const c = "partida";
  const o = obj(json, c);
  return {
    vidaInicial: inteiro(o, "vidaInicial", c),
    danoBase: num(o, "danoBase", c, "naoNegativo"),
    danoPorSobrevivente: num(o, "danoPorSobrevivente", c, "naoNegativo"),
    rodadasPorDanoExtra: inteiro(o, "rodadasPorDanoExtra", c),
  };
}

const EFEITOS_NUMERICOS = [
  "velocidade",
  "peso",
  "dano",
  "alcance",
  "velocidadeDeAtaque",
  "recargaHabilidade",
  "arremessoHorizontal",
  "primeiroGolpe",
  "protecaoVizinhos",
  "elixirAoVencer",
] as const;
const EFEITOS_LOGICOS = ["primeiroCritico", "perfura", "explosaoAoSair", "invisivel"] as const;

function validarEfeitos(json: unknown, caminho: string): EfeitosDeSinergia {
  const o = obj(json, caminho);
  const efeitos: Record<string, number | boolean> = {};
  for (const [chave, valor] of Object.entries(o)) {
    if ((EFEITOS_NUMERICOS as readonly string[]).includes(chave)) {
      efeitos[chave] = num(o, chave, caminho, "positivo");
    } else if ((EFEITOS_LOGICOS as readonly string[]).includes(chave)) {
      if (typeof valor !== "boolean") {
        throw new ErroDeDados(`${caminho}.${chave}: esperava true ou false`);
      }
      efeitos[chave] = valor;
    } else {
      throw new ErroDeDados(`${caminho}.${chave}: efeito desconhecido`);
    }
  }
  return efeitos;
}

function validarSinergia(json: unknown, caminho: string): DefSinergia {
  const o = obj(json, caminho);
  let anterior = 0;
  const niveis = lista(o["niveis"], `${caminho}.niveis`, 1).map((n, i) => {
    const cn = `${caminho}.niveis[${i}]`;
    const no = obj(n, cn);
    const minimo = inteiro(no, "minimo", cn);
    if (minimo <= anterior) throw new ErroDeDados(`${cn}.minimo: os degraus devem crescer`);
    anterior = minimo;
    return {
      minimo,
      descricao: texto(no, "descricao", cn),
      efeitos: validarEfeitos(no["efeitos"], `${cn}.efeitos`),
    };
  });
  return { nome: texto(o, "nome", caminho), niveis };
}

export function validarSinergias(json: unknown): ConfigSinergias {
  const c = "sinergias";
  const o = obj(json, c);
  const mundos = obj(o["mundos"], `${c}.mundos`);
  const papeis = obj(o["papeis"], `${c}.papeis`);
  const ex = obj(o["explosao"], `${c}.explosao`);
  const grupo = <T extends string>(origem: Obj, chaves: readonly T[], caminho: string) =>
    Object.fromEntries(
      chaves.map((k) => [k, validarSinergia(origem[k], `${caminho}.${k}`)]),
    ) as Record<T, DefSinergia>;
  return {
    mundos: grupo(mundos, MUNDOS, `${c}.mundos`),
    papeis: grupo(papeis, PAPEIS, `${c}.papeis`),
    raioVizinho: num(o, "raioVizinho", c, "positivo"),
    ticksInvisivel: inteiro(o, "ticksInvisivel", c),
    multiplicadorCritico: num(o, "multiplicadorCritico", c, "positivo"),
    explosao: {
      raio: num(ex, "raio", `${c}.explosao`, "positivo"),
      dano: num(ex, "dano", `${c}.explosao`, "positivo"),
    },
  };
}
