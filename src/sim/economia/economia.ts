import { criarAleatorio, proximo, type EstadoAleatorio } from "../aleatorio";
import { TICKS_POR_SEGUNDO } from "../constantes";
import type { Arena, DefPersonagem, Esquadrao } from "../combate/tipos";
import type {
  Comando,
  ConfigEconomia,
  Contexto,
  EmCampo,
  Erro,
  EstadoEconomia,
  EstadoJogador,
  Fusao,
  Resultado,
  Unidade,
} from "./tipos";

/** Quantas cartas de nível 1 formam uma unidade deste nível. */
export function copiasDoNivel(nivel: number): number {
  return 2 ** (nivel - 1);
}

export function limiteDeCampo(config: ConfigEconomia, rodada: number): number {
  const i = Math.min(Math.max(rodada, 1), config.limiteCampo.length) - 1;
  return config.limiteCampo[i] ?? 1;
}

export function ganhoDeElixir(config: ConfigEconomia, rodada: number): number {
  return Math.min(config.ganhoMaximo, config.elixirBase + config.elixirPorRodada * rodada);
}

function definicao(ctx: Contexto, id: string): DefPersonagem | undefined {
  return ctx.personagens.find((p) => p.id === id);
}

/** Elixir devolvido ao vender a unidade. */
export function valorDeVenda(ctx: Contexto, unidade: Unidade): number {
  const custo = definicao(ctx, unidade.personagem)?.custo ?? 0;
  const investido = custo * copiasDoNivel(unidade.nivel);
  const fracao =
    unidade.nivel === 1 ? ctx.config.reembolsoNivel1 : ctx.config.reembolsoNiveisMaiores;
  return Math.floor(investido * fracao);
}

/** Sorteia cartas do baralho (sem reposição), com chance proporcional às cópias que restam. */
function sortearLoja(
  baralho: Record<string, number>,
  ctx: Contexto,
  rng: EstadoAleatorio,
): { loja: (string | null)[]; rng: EstadoAleatorio } {
  const loja: (string | null)[] = [];
  let atual = rng;
  for (let i = 0; i < ctx.config.tamanhoLoja; i++) {
    const total = ctx.personagens.reduce((s, p) => s + (baralho[p.id] ?? 0), 0);
    if (total <= 0) {
      loja.push(null);
      continue;
    }
    const r = proximo(atual);
    atual = r.rng;
    let alvo = Math.floor(r.valor * total);
    for (const p of ctx.personagens) {
      const n = baralho[p.id] ?? 0;
      if (alvo < n) {
        loja.push(p.id);
        baralho[p.id] = n - 1;
        break;
      }
      alvo -= n;
    }
  }
  return { loja, rng: atual };
}

function devolverLoja(baralho: Record<string, number>, loja: readonly (string | null)[]): void {
  for (const carta of loja) if (carta !== null) baralho[carta] = (baralho[carta] ?? 0) + 1;
}

/** Cria a economia da partida, ainda antes da primeira rodada (use `iniciarRodada`). */
export function criarEconomia(ctx: Contexto, jogadores: number, semente: number): EstadoEconomia {
  const baralho: Record<string, number> = {};
  for (const p of ctx.personagens) baralho[p.id] = ctx.config.copiasPorPersonagem;
  const vazio: EstadoJogador = { elixir: 0, loja: [], banco: [], campo: [], pronto: true };
  return {
    rodada: 0,
    rng: criarAleatorio(semente),
    baralho,
    jogadores: Array.from({ length: jogadores }, () => vazio),
    proximoId: 1,
    ticksRestantes: 0,
  };
}

/** Começa a preparação da rodada seguinte: elixir novo (com teto), loja nova e cronômetro cheio. */
export function iniciarRodada(e: EstadoEconomia, ctx: Contexto): EstadoEconomia {
  const rodada = e.rodada + 1;
  const baralho = { ...e.baralho };
  let rng = e.rng;
  for (const j of e.jogadores) devolverLoja(baralho, j.loja);
  const jogadores = e.jogadores.map((j) => {
    const sorteio = sortearLoja(baralho, ctx, rng);
    rng = sorteio.rng;
    return {
      ...j,
      elixir: Math.min(ctx.config.tetoElixir, j.elixir + ganhoDeElixir(ctx.config, rodada)),
      loja: sorteio.loja,
      pronto: false,
    };
  });
  return {
    ...e,
    rodada,
    rng,
    baralho,
    jogadores,
    ticksRestantes: Math.round(ctx.config.segundosPreparacao * TICKS_POR_SEGUNDO),
  };
}

/** Avança o cronômetro da preparação em um tick. */
export function tickPreparacao(e: EstadoEconomia): EstadoEconomia {
  if (e.ticksRestantes <= 0) return e;
  return { ...e, ticksRestantes: e.ticksRestantes - 1 };
}

/** A preparação acaba quando o tempo zera ou quando todos estão prontos. */
export function preparacaoEncerrada(e: EstadoEconomia): boolean {
  return e.ticksRestantes <= 0 || e.jogadores.every((j) => j.pronto);
}

/**
 * Funde pares iguais (mesmo personagem e nível) até não sobrar nenhum.
 * A unidade que fica é a que está em campo, se houver; senão, a mais antiga.
 */
function fundir(
  banco: Unidade[],
  campo: EmCampo[],
  nivelMaximo: number,
): { banco: Unidade[]; campo: EmCampo[]; fusoes: Fusao[] } {
  const fusoes: Fusao[] = [];
  for (;;) {
    const todas = [...campo.map((c) => c.unidade), ...banco];
    let par: [Unidade, Unidade] | null = null;
    for (const a of todas) {
      if (a.nivel >= nivelMaximo) continue;
      const b = todas.find(
        (o) => o.id !== a.id && o.personagem === a.personagem && o.nivel === a.nivel,
      );
      if (b && (!par || a.nivel < par[0].nivel)) par = [a, b];
    }
    if (!par) return { banco, campo, fusoes };
    const [fica, sai] = par;
    const nova: Unidade = { ...fica, nivel: fica.nivel + 1 };
    banco = banco.filter((u) => u.id !== sai.id).map((u) => (u.id === fica.id ? nova : u));
    campo = campo
      .filter((c) => c.unidade.id !== sai.id)
      .map((c) => (c.unidade.id === fica.id ? { ...c, unidade: nova } : c));
    fusoes.push({ personagem: nova.personagem, nivel: nova.nivel, unidade: nova.id });
  }
}

const falha = (erro: Erro): Resultado => ({ ok: false, erro });

/**
 * Aplica um comando do jogador. Devolve o estado novo ou um erro; nunca altera o estado recebido.
 * Jogador humano, bot e rede usam esta mesma função.
 */
export function aplicar(e: EstadoEconomia, ctx: Contexto, comando: Comando): Resultado {
  const j = e.jogadores[comando.jogador];
  if (!j || !Number.isInteger(comando.jogador)) return falha("jogador_invalido");
  if (j.pronto || e.ticksRestantes <= 0) return falha("preparacao_encerrada");

  const config = ctx.config;
  const comJogador = (
    novo: EstadoJogador,
    extra: Partial<EstadoEconomia> = {},
  ): EstadoEconomia => ({
    ...e,
    ...extra,
    jogadores: e.jogadores.map((o, i) => (i === comando.jogador ? novo : o)),
  });
  const sucesso = (estado: EstadoEconomia, fusoes: readonly Fusao[] = []): Resultado => ({
    ok: true,
    estado,
    fusoes,
  });

  switch (comando.tipo) {
    case "comprar": {
      const carta = j.loja[comando.carta];
      if (carta === null || carta === undefined) return falha("carta_invalida");
      const def = definicao(ctx, carta);
      if (!def) return falha("carta_invalida");
      if (j.elixir < def.custo) return falha("elixir_insuficiente");
      const nova: Unidade = { id: e.proximoId, personagem: carta, nivel: 1 };
      const f = fundir([...j.banco, nova], [...j.campo], config.nivelMaximo);
      // Banco cheio só impede a compra se ela não resultar em fusão.
      if (f.banco.length > config.tamanhoBanco) return falha("banco_cheio");
      return sucesso(
        comJogador(
          {
            ...j,
            elixir: j.elixir - def.custo,
            loja: j.loja.map((c, i) => (i === comando.carta ? null : c)),
            banco: f.banco,
            campo: f.campo,
          },
          { proximoId: e.proximoId + 1 },
        ),
        f.fusoes,
      );
    }

    case "vender": {
      const unidade =
        j.banco.find((u) => u.id === comando.unidade) ??
        j.campo.find((c) => c.unidade.id === comando.unidade)?.unidade;
      if (!unidade) return falha("unidade_invalida");
      const baralho = { ...e.baralho };
      baralho[unidade.personagem] =
        (baralho[unidade.personagem] ?? 0) + copiasDoNivel(unidade.nivel);
      return sucesso(
        comJogador(
          {
            ...j,
            elixir: Math.min(config.tetoElixir, j.elixir + valorDeVenda(ctx, unidade)),
            banco: j.banco.filter((u) => u.id !== unidade.id),
            campo: j.campo.filter((c) => c.unidade.id !== unidade.id),
          },
          { baralho },
        ),
      );
    }

    case "atualizar": {
      if (j.elixir < config.custoAtualizar) return falha("elixir_insuficiente");
      const baralho = { ...e.baralho };
      devolverLoja(baralho, j.loja);
      const sorteio = sortearLoja(baralho, ctx, e.rng);
      if (sorteio.loja.every((c) => c === null)) return falha("baralho_vazio");
      return sucesso(
        comJogador(
          { ...j, elixir: j.elixir - config.custoAtualizar, loja: sorteio.loja },
          { baralho, rng: sorteio.rng },
        ),
      );
    }

    case "posicionar": {
      if (!Number.isInteger(comando.ponto) || comando.ponto < 0 || comando.ponto >= ctx.pontos) {
        return falha("ponto_invalido");
      }
      const ocupante = j.campo.find((c) => c.ponto === comando.ponto);
      const doCampo = j.campo.find((c) => c.unidade.id === comando.unidade);
      if (doCampo) {
        // Já está em campo: muda de ponto; se o destino está ocupado, os dois trocam.
        const campo = j.campo.map((c) => {
          if (c.unidade.id === comando.unidade) return { ...c, ponto: comando.ponto };
          if (ocupante && c.unidade.id === ocupante.unidade.id)
            return { ...c, ponto: doCampo.ponto };
          return c;
        });
        return sucesso(comJogador({ ...j, campo }));
      }
      const doBanco = j.banco.find((u) => u.id === comando.unidade);
      if (!doBanco) return falha("unidade_invalida");
      if (ocupante) {
        // Ponto ocupado: quem estava lá volta para o banco, no lugar de quem entrou.
        return sucesso(
          comJogador({
            ...j,
            banco: j.banco.map((u) => (u.id === doBanco.id ? ocupante.unidade : u)),
            campo: j.campo.map((c) => (c.ponto === comando.ponto ? { ...c, unidade: doBanco } : c)),
          }),
        );
      }
      if (j.campo.length >= limiteDeCampo(config, e.rodada)) return falha("campo_cheio");
      return sucesso(
        comJogador({
          ...j,
          banco: j.banco.filter((u) => u.id !== doBanco.id),
          campo: [...j.campo, { unidade: doBanco, ponto: comando.ponto }],
        }),
      );
    }

    case "recolher": {
      const doCampo = j.campo.find((c) => c.unidade.id === comando.unidade);
      if (!doCampo) {
        return falha(
          j.banco.some((u) => u.id === comando.unidade) ? "fora_do_campo" : "unidade_invalida",
        );
      }
      if (j.banco.length >= config.tamanhoBanco) return falha("banco_cheio");
      return sucesso(
        comJogador({
          ...j,
          banco: [...j.banco, doCampo.unidade],
          campo: j.campo.filter((c) => c.unidade.id !== doCampo.unidade.id),
        }),
      );
    }

    case "pronto":
      return sucesso(comJogador({ ...j, pronto: true }));
  }
}

/** Atributos do personagem no nível dado: mais dano, mais peso e um pouco maior. */
export function aplicarNivel(
  def: DefPersonagem,
  nivel: number,
  config: ConfigEconomia,
): DefPersonagem {
  const i = Math.min(Math.max(nivel, 1), config.nivelMaximo) - 1;
  const m = config.multiplicadores;
  const dano = m.dano[i] ?? 1;
  const peso = m.peso[i] ?? 1;
  const tamanho = m.tamanho[i] ?? 1;
  if (i === 0) return def;
  return {
    ...def,
    largura: Math.round(def.largura * tamanho),
    altura: Math.round(def.altura * tamanho),
    peso: def.peso * peso,
    ataque: { ...def.ataque, dano: def.ataque.dano * dano },
    habilidade: { ...def.habilidade, dano: def.habilidade.dano * dano },
  };
}

/** Transforma o campo do jogador em um esquadrão pronto para o combate. */
export function montarEsquadrao(
  jogador: EstadoJogador,
  ctx: Contexto,
  arena: Arena,
  lado: 0 | 1,
): Esquadrao {
  const soma = arena.chao.x * 2 + arena.chao.largura;
  const vagas = [];
  for (const c of [...jogador.campo].sort((a, b) => a.unidade.id - b.unidade.id)) {
    const def = definicao(ctx, c.unidade.personagem);
    const ponto = arena.pontos[c.ponto];
    if (!def || !ponto) continue;
    vagas.push({
      def: aplicarNivel(def, c.unidade.nivel, ctx.config),
      x: lado === 0 ? ponto.x : soma - ponto.x,
      y: ponto.y,
      nivel: c.unidade.nivel,
    });
  }
  return vagas;
}
