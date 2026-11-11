import { criarAleatorio, proximo, type EstadoAleatorio } from "../aleatorio";
import { TICKS_POR_SEGUNDO } from "../constantes";
import { forcaArremesso, ticksDeAtordoamento, velocidadeDeArremesso } from "./arremesso";
import { foraDosLimites, moverLutador } from "./fisica";
import { decidir } from "./ia";
import type {
  Arena,
  DefPersonagem,
  EstadoCombate,
  Evento,
  FimCombate,
  Lado,
  Lutador,
} from "./tipos";

/** Duração máxima de uma rodada. */
export const TICKS_MAXIMOS = 99 * TICKS_POR_SEGUNDO;
/** Depois da eliminação, a simulação ainda roda um pouco (o vencedor comemora). */
export const TICKS_APOS_FIM = 4 * TICKS_POR_SEGUNDO;
/** Variação do dano (±) e do ângulo (± graus) de cada golpe. */
export const VARIACAO_DANO = 0.1;
export const VARIACAO_ANGULO = 7;
/** Chance de recuar um passo depois de um golpe. */
export const CHANCE_RECUAR = 0.4;

export function criarLutador(
  def: DefPersonagem,
  id: number,
  lado: Lado,
  x: number,
  y: number,
): Lutador {
  return {
    id,
    lado,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    direcao: lado === 0 ? 1 : -1,
    noChao: false,
    emPlataforma: false,
    ignorarPlataforma: 0,
    pulosRestantes: 1,
    dano: 0,
    atordoado: 0,
    lancado: false,
    ataque: { fase: "nenhum", ticks: 0, acertou: false },
    recarga: 0,
    recuarDepois: false,
    ia: "procurar",
    vivo: true,
  };
}

/** Cria um duelo: um personagem de cada lado, nos pontos de nascimento da arena. */
export function criarCombate(
  arena: Arena,
  defs: readonly [DefPersonagem, DefPersonagem],
  semente: number,
): EstadoCombate {
  const lutadores = defs.map((def, i) => {
    const n = arena.nascimentos[i] ?? { x: 0, y: 0 };
    return criarLutador(def, i, i === 0 ? 0 : 1, n.x, n.y);
  });
  return { tick: 0, rng: criarAleatorio(semente), arena, lutadores, eventos: [], fim: null };
}

function sobrepoe(
  ax: number,
  ay: number,
  al: number,
  aa: number,
  bx: number,
  by: number,
  bl: number,
  ba: number,
): boolean {
  return ax < bx + bl && ax + al > bx && ay < by + ba && ay + aa > by;
}

/** A caixa de acerto do golpe de `a` encosta em `b`? */
export function golpeAcerta(a: Readonly<Lutador>, b: Readonly<Lutador>): boolean {
  const largura = a.def.largura / 2 + a.def.ataque.alcance;
  const x = a.direcao === 1 ? a.x : a.x - largura;
  return sobrepoe(
    x,
    a.y - a.def.altura,
    largura,
    a.def.altura,
    b.x - b.def.largura / 2,
    b.y - b.def.altura,
    b.def.largura,
    b.def.altura,
  );
}

function avancarAtaque(l: Lutador): void {
  const a = l.ataque;
  if (a.fase === "nenhum") {
    if (l.recarga > 0) l.recarga--;
    return;
  }
  a.ticks--;
  if (a.ticks > 0) return;
  const def = l.def.ataque;
  if (a.fase === "inicio") {
    a.fase = "ativo";
    a.ticks = def.ativo;
  } else if (a.fase === "ativo") {
    a.fase = "recuperacao";
    a.ticks = def.recuperacao;
  } else {
    a.fase = "nenhum";
    l.recarga = def.recarga;
  }
}

/**
 * Avança o combate em um tick. Função pura: devolve um estado novo e não altera o recebido.
 * Ordem: IA -> golpes em andamento -> física -> acertos -> saídas da arena -> fim.
 */
export function stepCombate(e: EstadoCombate): EstadoCombate {
  if (e.fim && (e.fim.motivo === "tempo" || e.tick >= e.fim.tick + TICKS_APOS_FIM)) return e;

  let rng: EstadoAleatorio = e.rng;
  const sortear = (): number => {
    const r = proximo(rng);
    rng = r.rng;
    return r.valor;
  };

  const tick = e.tick + 1;
  const eventos: Evento[] = [];
  const ls: Lutador[] = e.lutadores.map((l) => ({ ...l, ataque: { ...l.ataque } }));

  // 1 a 3: cada lutador decide olhando o estado do tick anterior, depois age e se move.
  for (const [i, l] of ls.entries()) {
    if (!l.vivo) continue;
    const anterior = e.lutadores[i];
    if (!anterior) continue;
    const decisao = decidir(anterior, e.lutadores, e.arena, sortear());
    l.ia = decisao.ia;
    if (l.atordoado > 0) l.atordoado--;

    avancarAtaque(l);
    const ent = decisao.entrada;
    if (ent.pular && l.ataque.fase !== "nenhum" && l.ia === "voltar") {
      l.ataque = { fase: "nenhum", ticks: 0, acertou: false }; // pulo de volta cancela o golpe
    }
    if (ent.atacar && l.ataque.fase === "nenhum" && l.recarga === 0 && l.atordoado === 0) {
      l.ataque = { fase: "inicio", ticks: l.def.ataque.inicio, acertou: false };
      l.recuarDepois = sortear() < CHANCE_RECUAR;
      eventos.push({ tipo: "ataque", id: l.id });
    }
    moverLutador(l, ent, e.arena, eventos);
  }

  // 4: acertos. Primeiro junta todos, depois aplica, para golpes simultâneos valerem para os dois.
  const acertos: { atacante: Lutador; alvo: Lutador }[] = [];
  for (const a of ls) {
    if (!a.vivo || a.ataque.fase !== "ativo" || a.ataque.acertou) continue;
    for (const b of ls) {
      if (b.vivo && b.lado !== a.lado && golpeAcerta(a, b)) acertos.push({ atacante: a, alvo: b });
    }
  }
  for (const { atacante, alvo } of acertos) {
    const def = atacante.def.ataque;
    atacante.ataque.acertou = true;
    alvo.dano += def.dano * (1 + (sortear() * 2 - 1) * VARIACAO_DANO);
    const forca = forcaArremesso(def, alvo.dano, alvo.def.peso);
    const angulo = def.anguloGraus + (sortear() * 2 - 1) * VARIACAO_ANGULO;
    const v = velocidadeDeArremesso(forca, angulo, atacante.direcao);
    alvo.vx = v.vx;
    alvo.vy = v.vy;
    alvo.atordoado = ticksDeAtordoamento(forca);
    alvo.noChao = false;
    alvo.emPlataforma = false;
    alvo.lancado = true;
    alvo.pulosRestantes = Math.max(alvo.pulosRestantes, 1);
    alvo.ataque = { fase: "nenhum", ticks: 0, acertou: false };
    alvo.ia = "recuperar";
    eventos.push({
      tipo: "golpe",
      atacante: atacante.id,
      alvo: alvo.id,
      x: alvo.x,
      y: alvo.y - alvo.def.altura / 2,
      forca,
    });
  }

  // 5: quem passou dos limites sai da rodada.
  for (const l of ls) {
    if (l.vivo && foraDosLimites(l, e.arena)) {
      l.vivo = false;
      eventos.push({ tipo: "saida", id: l.id, x: l.x, y: l.y, porGolpe: l.lancado });
    }
  }

  // 6: fim da rodada.
  let fim: FimCombate | null = e.fim;
  if (!fim) {
    const vivos0 = ls.some((l) => l.vivo && l.lado === 0);
    const vivos1 = ls.some((l) => l.vivo && l.lado === 1);
    // Um lado ficou sem ninguém. Só decide quando os sobreviventes estão a salvo:
    // quem ainda está voando de um arremesso pode cair também, e aí é empate.
    const sobreviventes = ls.filter((l) => l.vivo);
    if ((!vivos0 || !vivos1) && sobreviventes.every((l) => !l.lancado)) {
      const vencedor: Lado | null = vivos0 ? 0 : vivos1 ? 1 : null;
      fim = { vencedor, motivo: "eliminacao", tick };
    } else if (tick >= TICKS_MAXIMOS) {
      const dano = (lado: Lado) =>
        ls.filter((l) => l.lado === lado).reduce((s, l) => s + l.dano, 0);
      const d0 = dano(0);
      const d1 = dano(1);
      fim = { vencedor: d0 < d1 ? 0 : d1 < d0 ? 1 : null, motivo: "tempo", tick };
    }
  }

  return { tick, rng, arena: e.arena, lutadores: ls, eventos, fim };
}

/** Roda o combate até acabar (sem render). */
export function simularCombate(inicial: EstadoCombate): EstadoCombate {
  let e = inicial;
  while (!e.fim) e = stepCombate(e);
  return e;
}
