import type { Arena, Entrada, EstadoIA, Lutador } from "./tipos";

export interface Decisao {
  readonly ia: EstadoIA;
  readonly entrada: Entrada;
}

/** Distância da beirada do chão em que o personagem para de andar. */
const MARGEM_BEIRADA = 30;
/** Chance, por tick, de soltar o golpe quando o inimigo está ao alcance (tempo de reação). */
export const CHANCE_DE_REAGIR = 0.22;

function sinal(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function entrada(parcial: Partial<Entrada>): Entrada {
  return { mover: 0, pular: false, descer: false, atacar: false, encarar: 0, ...parcial };
}

function alvoMaisProximo(l: Readonly<Lutador>, todos: readonly Readonly<Lutador>[]) {
  let melhor: Readonly<Lutador> | null = null;
  let melhorDist = Infinity;
  for (const o of todos) {
    if (!o.vivo || o.lado === l.lado) continue;
    const d = Math.abs(o.x - l.x) + Math.abs(o.y - l.y);
    if (d < melhorDist) {
      melhor = o;
      melhorDist = d;
    }
  }
  return melhor;
}

/**
 * Máquina de estados da IA. Transições, por ordem de prioridade:
 *  - atordoado                      -> recuperar (sem controle)
 *  - no ar e fora do chão da arena  -> voltar (anda para o centro e guarda o pulo para a hora certa)
 *  - sem inimigo vivo               -> procurar
 *  - golpe em andamento             -> atacar
 *  - em recarga e decidiu recuar    -> recuar
 *  - inimigo ao alcance             -> atacar (começa o golpe depois de um tempo de reação sorteado)
 *  - caso contrário                 -> aproximar (anda, pula, desce de plataforma)
 * `sorteio` é um número em [0, 1) vindo do gerador com semente.
 */
export function decidir(
  l: Readonly<Lutador>,
  todos: readonly Readonly<Lutador>[],
  arena: Arena,
  sorteio: number,
): Decisao {
  if (l.atordoado > 0) return { ia: "recuperar", entrada: entrada({}) };

  const chao = arena.chao;
  const esq = chao.x;
  const dir = chao.x + chao.largura;
  const centro = (esq + dir) / 2;

  const fora = !l.noChao && (l.x < esq || l.x > dir || l.y > chao.y + 1);
  if (fora) {
    const embaixoDoChao = l.x > esq && l.x < dir;
    const paraCentro = l.x < centro ? 1 : -1;
    const mover = embaixoDoChao ? (-paraCentro as -1 | 1) : paraCentro;
    const pular = l.vy > 0 && l.pulosRestantes > 0 && l.y > chao.y - 20;
    return { ia: "voltar", entrada: entrada({ mover, pular }) };
  }

  const alvo = alvoMaisProximo(l, todos);
  if (!alvo) {
    // Sem inimigos: comemora com pulinhos.
    return { ia: "procurar", entrada: entrada({ pular: l.noChao && sorteio < 0.03 }) };
  }

  const dx = alvo.x - l.x;
  const dy = alvo.y - l.y;
  const dist = Math.abs(dx);
  const sentido: -1 | 1 = dx >= 0 ? 1 : -1;
  // Nunca persegue além da beirada: o destino fica sempre sobre o chão.
  const destinoX = Math.min(dir - MARGEM_BEIRADA, Math.max(esq + MARGEM_BEIRADA, alvo.x));
  const dxMover = destinoX - l.x;
  const alcance = l.def.largura / 2 + l.def.ataque.alcance + alvo.def.largura / 2 - 10;

  let ia: EstadoIA;
  let mover: -1 | 0 | 1 = 0;
  let pular = false;
  let descer = false;
  let atacar = false;
  let encarar: -1 | 0 | 1 = 0;

  if (l.ataque.fase !== "nenhum") {
    ia = "atacar";
    if (!l.noChao && Math.abs(dxMover) > 10) mover = sinal(dxMover);
  } else if (l.recarga > 0 && l.recuarDepois) {
    ia = "recuar";
    mover = sentido === 1 ? -1 : 1;
  } else if (dist <= alcance && Math.abs(dy) < l.def.altura * 0.9 && l.recarga === 0) {
    // Tempo de reação: não ataca no primeiro tick possível, para os dois não baterem sempre juntos.
    ia = "atacar";
    atacar = sorteio < CHANCE_DE_REAGIR;
    encarar = sentido;
  } else {
    ia = "aproximar";
    if (Math.abs(dxMover) > alcance * 0.7) mover = sinal(dxMover);
    else if (dist < 18) mover = sentido === 1 ? -1 : 1;
    else encarar = sentido;

    const alvoSobreChao = alvo.x > esq && alvo.x < dir;
    if (alvoSobreChao && dy < -45 && dist < 150) {
      if (l.noChao) pular = true;
      else if (l.vy > -1 && l.pulosRestantes > 0 && sorteio < 0.5) pular = true;
    } else if (dy > 45 && l.noChao && l.emPlataforma) {
      descer = true;
    } else if (l.noChao && Math.abs(dy) < 45 && dist > 110 && dist < 200 && sorteio < 0.015) {
      pular = true; // ataque pulando, de vez em quando
    }
  }

  // Proteção de beirada: no chão não anda para fora; no ar corrige para dentro.
  if (l.noChao && !l.emPlataforma) {
    if (mover < 0 && l.x <= esq + MARGEM_BEIRADA) mover = 0;
    if (mover > 0 && l.x >= dir - MARGEM_BEIRADA) mover = 0;
  } else if (!l.noChao) {
    const previsto = l.x + l.vx * 12;
    if (previsto < esq + 10) mover = 1;
    else if (previsto > dir - 10) mover = -1;
  }

  return { ia, entrada: { mover, pular, descer, atacar, encarar } };
}
