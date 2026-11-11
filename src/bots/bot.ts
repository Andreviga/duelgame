import { proximo, type EstadoAleatorio } from "../sim/aleatorio";
import type { Arena, Papel, DefPersonagem } from "../sim/combate/tipos";
import { aplicar, copiasDoNivel, limiteDeCampo } from "../sim/economia/economia";
import type {
  Comando,
  Contexto,
  EstadoEconomia,
  EstadoJogador,
  Unidade,
} from "../sim/economia/tipos";
import type { NivelBot } from "../sim/partida/tipos";

/**
 * Bots da fase de preparação. Usam os mesmos comandos do jogador humano (`aplicar`).
 *  - fácil:   compra ao acaso, não atualiza a loja e posiciona em pontos sorteados;
 *  - médio:   prioriza cartas que fundem, atualiza a loja uma vez e põe o tanque na frente;
 *  - difícil: além disso, atualiza mais, vende o que sobra no banco e testa formações
 *             contra o adversário da rodada antes de escolher (`avaliar`).
 */
export interface VisaoDoBot {
  readonly jogador: number;
  readonly nivel: NivelBot;
  /** Nota de um estado da economia contra o adversário da rodada (maior é melhor). Só o difícil usa. */
  readonly avaliar?: (economia: EstadoEconomia) => number;
}

export interface JogadaDoBot {
  readonly economia: EstadoEconomia;
  readonly rng: EstadoAleatorio;
  readonly comandos: readonly Comando[];
  /** Comandos que a simulação recusou. Deve ser sempre zero. */
  readonly recusados: number;
}

const ORDEM_TANQUE_NA_FRENTE: readonly Papel[] = ["tanque", "corpo", "assassino", "distancia"];
const ORDEM_ATIRADOR_PROTEGIDO: readonly Papel[] = ["tanque", "distancia", "corpo", "assassino"];

function unidadesDe(j: EstadoJogador): Unidade[] {
  return [...j.campo.map((c) => c.unidade), ...j.banco];
}

export function jogarBot(
  inicial: EstadoEconomia,
  ctx: Contexto,
  arena: Arena,
  visao: VisaoDoBot,
  rngInicial: EstadoAleatorio,
): JogadaDoBot {
  let e = inicial;
  let rng = rngInicial;
  let recusados = 0;
  const comandos: Comando[] = [];
  const eu = visao.jogador;
  const cfg = ctx.config;
  const sortear = (): number => {
    const r = proximo(rng);
    rng = r.rng;
    return r.valor;
  };
  const jog = (estado: EstadoEconomia = e): EstadoJogador => {
    const j = estado.jogadores[eu];
    if (!j) throw new Error("bot sem jogador");
    return j;
  };
  const def = (id: string): DefPersonagem | undefined => ctx.personagens.find((p) => p.id === id);
  const poder = (u: Unidade): number => (def(u.personagem)?.custo ?? 0) * copiasDoNivel(u.nivel);
  /** Aplica um comando ao estado do bot e o registra. Devolve false se a simulação recusou. */
  const enviar = (c: Comando): boolean => {
    const r = aplicar(e, ctx, c);
    if (!r.ok) {
      recusados++;
      return false;
    }
    comandos.push(c);
    e = r.estado;
    return true;
  };

  if (jog().pronto) return { economia: e, rng, comandos, recusados };

  // ---------- compras ----------
  const podeComprar = (carta: string | null): carta is string => {
    if (carta === null) return false;
    const d = def(carta);
    if (!d || jog().elixir < d.custo) return false;
    const funde = unidadesDe(jog()).some((u) => u.personagem === carta && u.nivel === 1);
    return funde || jog().banco.length < cfg.tamanhoBanco;
  };
  const limite = limiteDeCampo(cfg, e.rodada);
  const maximoDeAtualizacoes = visao.nivel === "dificil" ? 4 : visao.nivel === "medio" ? 1 : 0;
  let atualizacoes = 0;

  for (let passo = 0; passo < 60; passo++) {
    const j = jog();
    const cartas = j.loja.flatMap((c, i) => (podeComprar(c) ? [{ carta: c, i }] : []));

    if (visao.nivel === "facil") {
      if (cartas.length === 0 || sortear() < 0.3) break;
      const escolha = cartas[Math.floor(sortear() * cartas.length)];
      if (!escolha) break;
      if (!enviar({ tipo: "comprar", jogador: eu, carta: escolha.i })) break;
      continue;
    }

    const minhas = unidadesDe(j);
    const tenho = (id: string): boolean => minhas.some((u) => u.personagem === id);
    const queFunde = cartas.find((c) => tenho(c.carta));
    const folga = visao.nivel === "dificil" ? 3 : 2;
    if (queFunde) {
      if (!enviar({ tipo: "comprar", jogador: eu, carta: queFunde.i })) break;
      continue;
    }
    if (cartas.length > 0 && minhas.length < limite + folga) {
      // Prefere a carta que faz mais sinergia com o que já tem (mesmo mundo ou mesmo papel,
      // personagem diferente); depois um papel que ainda falta; depois a mais cara.
      const diferentes = [
        ...new Map(minhas.map((u) => [u.personagem, def(u.personagem)])).values(),
      ];
      const afinidade = (carta: string): number => {
        const d = def(carta);
        if (!d) return 0;
        return diferentes.filter(
          (o) => o && o.id !== d.id && (o.mundo === d.mundo || o.papel === d.papel),
        ).length;
      };
      const papeis = new Set(minhas.map((u) => def(u.personagem)?.papel));
      const ordenadas = [...cartas].sort((a, b) => {
        const da = def(a.carta);
        const db = def(b.carta);
        const novoA = da && !papeis.has(da.papel) ? 1 : 0;
        const novoB = db && !papeis.has(db.papel) ? 1 : 0;
        return (
          afinidade(b.carta) - afinidade(a.carta) ||
          novoB - novoA ||
          (db?.custo ?? 0) - (da?.custo ?? 0) ||
          a.i - b.i
        );
      });
      const escolha = ordenadas[0];
      if (escolha) {
        if (!enviar({ tipo: "comprar", jogador: eu, carta: escolha.i })) break;
        continue;
      }
    }
    // Difícil: banco cheio de peças sem par vira elixir.
    if (visao.nivel === "dificil" && j.banco.length >= cfg.tamanhoBanco) {
      const semPar = j.banco
        .filter((u) => !minhas.some((o) => o.id !== u.id && o.personagem === u.personagem))
        .sort((a, b) => poder(a) - poder(b))[0];
      if (semPar) {
        if (!enviar({ tipo: "vender", jogador: eu, unidade: semPar.id })) break;
        continue;
      }
    }
    const restam = ctx.personagens.reduce((s, p) => s + (e.baralho[p.id] ?? 0), 0);
    if (atualizacoes < maximoDeAtualizacoes && j.elixir >= cfg.custoAtualizar + 2 && restam > 0) {
      atualizacoes++;
      if (!enviar({ tipo: "atualizar", jogador: eu })) break;
      continue;
    }
    break;
  }

  // ---------- posicionamento ----------
  const indices = arena.pontos.map((_, i) => i);
  const yChao = arena.chao.y;
  const noChao = indices.filter((i) => arena.pontos[i]?.y === yChao);
  const altos = indices.filter((i) => arena.pontos[i]?.y !== yChao);
  const porFrente = (lista: number[]): number[] =>
    [...lista].sort((a, b) => (arena.pontos[b]?.x ?? 0) - (arena.pontos[a]?.x ?? 0));
  const porAltura = (lista: number[]): number[] =>
    [...lista].sort((a, b) => (arena.pontos[a]?.y ?? 0) - (arena.pontos[b]?.y ?? 0));

  /** Quem vai a campo: os mais fortes, até o limite da rodada. */
  const titulares = (): Unidade[] =>
    unidadesDe(jog())
      .sort((a, b) => poder(b) - poder(a) || a.id - b.id)
      .slice(0, limite);

  type Plano = Map<number, number>; // unidade -> ponto

  const planoPorOrdem = (ordem: readonly Papel[]): Plano => {
    const pontos = [...porFrente(noChao), ...porFrente(altos)];
    const fila = titulares().sort((a, b) => {
      const ra = ordem.indexOf(def(a.personagem)?.papel ?? "corpo");
      const rb = ordem.indexOf(def(b.personagem)?.papel ?? "corpo");
      return ra - rb || poder(b) - poder(a) || a.id - b.id;
    });
    return new Map(fila.flatMap((u, i) => (pontos[i] === undefined ? [] : [[u.id, pontos[i]]])));
  };

  const planoNosAltos = (): Plano => {
    // Atiradores e assassinos nas plataformas; quem luta de perto no chão, na frente.
    const livresAltos = porAltura(altos);
    const livresChao = porFrente(noChao);
    const plano: Plano = new Map();
    const fila = titulares().sort((a, b) => poder(b) - poder(a) || a.id - b.id);
    for (const u of fila) {
      const arq = def(u.personagem)?.papel;
      const querAlto = arq === "distancia" || arq === "assassino";
      const ponto =
        (querAlto ? livresAltos.shift() : undefined) ?? livresChao.shift() ?? livresAltos.shift();
      if (ponto !== undefined) plano.set(u.id, ponto);
    }
    return plano;
  };

  const planoSorteado = (): Plano => {
    const pontos = [...indices];
    for (let i = pontos.length - 1; i > 0; i--) {
      const k = Math.floor(sortear() * (i + 1));
      const a = pontos[i];
      const b = pontos[k];
      if (a !== undefined && b !== undefined) [pontos[i], pontos[k]] = [b, a];
    }
    return new Map(
      titulares().flatMap((u, i) => (pontos[i] === undefined ? [] : [[u.id, pontos[i]]])),
    );
  };

  /** Próximo comando para levar o campo até o plano, ou null se já chegou. Sempre um comando válido. */
  const passoDoPlano = (plano: Plano, estado: EstadoEconomia): Comando | null => {
    const j = jog(estado);
    const intruso = j.campo.find((c) => !plano.has(c.unidade.id));
    const reserva = j.banco.find((u) => plano.has(u.id));
    if (intruso && reserva) {
      // Troca direto: o titular entra no ponto de quem não devia estar em campo.
      return { tipo: "posicionar", jogador: eu, unidade: reserva.id, ponto: intruso.ponto };
    }
    if (intruso && j.banco.length < cfg.tamanhoBanco) {
      return { tipo: "recolher", jogador: eu, unidade: intruso.unidade.id };
    }
    const fora = j.campo.find(
      (c) => plano.has(c.unidade.id) && plano.get(c.unidade.id) !== c.ponto,
    );
    const destino = fora ? plano.get(fora.unidade.id) : undefined;
    if (fora && destino !== undefined) {
      return { tipo: "posicionar", jogador: eu, unidade: fora.unidade.id, ponto: destino };
    }
    const ponto = reserva ? plano.get(reserva.id) : undefined;
    if (reserva && ponto !== undefined && j.campo.length < limite) {
      return { tipo: "posicionar", jogador: eu, unidade: reserva.id, ponto };
    }
    return null;
  };

  /** Simula o plano sem registrar nada: serve para o difícil comparar formações. */
  const ensaiar = (plano: Plano): EstadoEconomia => {
    let estado = e;
    for (let passo = 0; passo < 40; passo++) {
      const c = passoDoPlano(plano, estado);
      const r = c ? aplicar(estado, ctx, c) : null;
      if (!r || !r.ok) break;
      estado = r.estado;
    }
    return estado;
  };

  const executar = (plano: Plano): void => {
    for (let passo = 0; passo < 40; passo++) {
      const c = passoDoPlano(plano, e);
      if (!c || !enviar(c)) break;
    }
  };

  let plano: Plano;
  if (visao.nivel === "facil") {
    plano = planoSorteado();
  } else {
    plano = planoPorOrdem(ORDEM_TANQUE_NA_FRENTE);
    if (visao.nivel === "dificil" && visao.avaliar) {
      let melhorNota = visao.avaliar(ensaiar(plano));
      for (const candidato of [planoPorOrdem(ORDEM_ATIRADOR_PROTEGIDO), planoNosAltos()]) {
        const nota = visao.avaliar(ensaiar(candidato));
        if (nota > melhorNota) {
          plano = candidato;
          melhorNota = nota;
        }
      }
    }
  }
  executar(plano);
  enviar({ tipo: "pronto", jogador: eu });
  return { economia: e, rng, comandos, recusados };
}
