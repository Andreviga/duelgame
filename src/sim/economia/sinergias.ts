import { SEM_BONUS } from "../combate/tipos";
import type { BonusDeCombate, DefPersonagem, Mundo, Papel } from "../combate/tipos";

/** O que um degrau de sinergia faz. Campos ausentes não mudam nada. */
export interface EfeitosDeSinergia {
  /** Multiplicadores de atributos. */
  readonly velocidade?: number;
  readonly peso?: number;
  readonly dano?: number;
  readonly alcance?: number;
  /** 1.15 = golpes 15% mais rápidos. */
  readonly velocidadeDeAtaque?: number;
  /** 1.3 = a habilidade carrega 30% mais rápido. */
  readonly recargaHabilidade?: number;
  readonly arremessoHorizontal?: number;
  /** Multiplicador de dano do primeiro golpe da rodada. */
  readonly primeiroGolpe?: number;
  /** O primeiro golpe da rodada é crítico (usa `multiplicadorCritico`). */
  readonly primeiroCritico?: boolean;
  readonly perfura?: boolean;
  readonly protecaoVizinhos?: number;
  readonly explosaoAoSair?: boolean;
  readonly invisivel?: boolean;
  /** Elixir extra para o jogador ao vencer a rodada. */
  readonly elixirAoVencer?: number;
}

export interface NivelDeSinergia {
  /** Quantos personagens diferentes da característica precisam estar em campo. */
  readonly minimo: number;
  readonly descricao: string;
  readonly efeitos: EfeitosDeSinergia;
}

export interface DefSinergia {
  readonly nome: string;
  readonly niveis: readonly NivelDeSinergia[];
}

export interface ConfigSinergias {
  readonly mundos: Readonly<Record<Mundo, DefSinergia>>;
  readonly papeis: Readonly<Record<Papel, DefSinergia>>;
  readonly raioVizinho: number;
  readonly ticksInvisivel: number;
  readonly multiplicadorCritico: number;
  readonly explosao: { readonly raio: number; readonly dano: number };
}

export interface SinergiaAtiva {
  readonly tipo: "mundo" | "papel";
  readonly chave: Mundo | Papel;
  readonly nome: string;
  /** Personagens diferentes dessa característica em campo. */
  readonly quantidade: number;
  /** Degrau alcançado, ou null se ainda não chegou ao primeiro. */
  readonly nivel: NivelDeSinergia | null;
  /** Próximo degrau a alcançar, ou null se já está no último. */
  readonly proximo: NivelDeSinergia | null;
}

/**
 * Conta as características em campo. Cópias do mesmo personagem contam uma vez só.
 * Devolve todas as características presentes, com o degrau alcançado.
 */
export function sinergiasEmCampo(
  emCampo: readonly DefPersonagem[],
  cfg: ConfigSinergias,
): SinergiaAtiva[] {
  const unicos = [...new Map(emCampo.map((d) => [d.id, d])).values()];
  const lista: SinergiaAtiva[] = [];
  const somar = (tipo: "mundo" | "papel", chave: Mundo | Papel, def: DefSinergia): void => {
    const quantidade = unicos.filter(
      (d) => (tipo === "mundo" ? d.mundo : d.papel) === chave,
    ).length;
    if (quantidade === 0) return;
    const alcancados = def.niveis.filter((n) => quantidade >= n.minimo);
    lista.push({
      tipo,
      chave,
      nome: def.nome,
      quantidade,
      nivel: alcancados.at(-1) ?? null,
      proximo: def.niveis.find((n) => quantidade < n.minimo) ?? null,
    });
  };
  for (const [chave, def] of Object.entries(cfg.mundos)) somar("mundo", chave as Mundo, def);
  for (const [chave, def] of Object.entries(cfg.papeis)) somar("papel", chave as Papel, def);
  return lista;
}

/** Efeitos que valem para um personagem: os do mundo dele e os do papel dele. */
function efeitosPara(def: DefPersonagem, ativas: readonly SinergiaAtiva[]): EfeitosDeSinergia[] {
  return ativas
    .filter((s) => s.nivel && s.chave === (s.tipo === "mundo" ? def.mundo : def.papel))
    .flatMap((s) => (s.nivel ? [s.nivel.efeitos] : []));
}

const ticks = (valor: number, velocidade: number): number =>
  Math.max(1, Math.round(valor / velocidade));

/**
 * Aplica as sinergias ativas a um personagem. Os bônus valem para quem tem a característica;
 * a proteção do tanque vale para o time todo (são os vizinhos dele que se beneficiam).
 */
export function aplicarSinergias(
  def: DefPersonagem,
  ativas: readonly SinergiaAtiva[],
  cfg: ConfigSinergias,
): { def: DefPersonagem; bonus: BonusDeCombate } {
  const meus = efeitosPara(def, ativas);
  const produto = (campo: keyof EfeitosDeSinergia): number =>
    meus.reduce((m, e) => m * (typeof e[campo] === "number" ? (e[campo] as number) : 1), 1);
  const algum = (campo: keyof EfeitosDeSinergia): boolean => meus.some((e) => e[campo] === true);

  const ataque = produto("velocidadeDeAtaque");
  const novo: DefPersonagem = {
    ...def,
    velocidade: def.velocidade * produto("velocidade"),
    peso: def.peso * produto("peso"),
    ataque: {
      ...def.ataque,
      dano: def.ataque.dano * produto("dano"),
      alcance: def.ataque.alcance * produto("alcance"),
      inicio: ticks(def.ataque.inicio, ataque),
      recuperacao: ticks(def.ataque.recuperacao, ataque),
      recarga: ticks(def.ataque.recarga, ataque),
    },
    habilidade: {
      ...def.habilidade,
      dano: def.habilidade.dano * produto("dano"),
      recarga: ticks(def.habilidade.recarga, produto("recargaHabilidade")),
    },
  };

  const protecao = ativas.reduce((m, s) => Math.max(m, s.nivel?.efeitos.protecaoVizinhos ?? 0), 0);
  const explode = algum("explosaoAoSair");
  const bonus: BonusDeCombate = {
    ...SEM_BONUS,
    arremessoHorizontal: produto("arremessoHorizontal"),
    primeiroGolpe:
      produto("primeiroGolpe") * (algum("primeiroCritico") ? cfg.multiplicadorCritico : 1),
    perfura: algum("perfura"),
    protecaoVizinhos: protecao,
    raioVizinho: protecao > 0 ? cfg.raioVizinho : 0,
    danoExplosao: explode ? cfg.explosao.dano : 0,
    raioExplosao: explode ? cfg.explosao.raio : 0,
    ticksInvisivel: algum("invisivel") ? cfg.ticksInvisivel : 0,
  };
  return { def: novo, bonus };
}

/** Elixir extra que o jogador ganha ao vencer a rodada com estas sinergias. */
export function elixirAoVencer(ativas: readonly SinergiaAtiva[]): number {
  return ativas.reduce((s, a) => s + (a.nivel?.efeitos.elixirAoVencer ?? 0), 0);
}
