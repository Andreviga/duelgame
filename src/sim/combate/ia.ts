import type { Arena, Entrada, EstadoIA, Lutador } from "./tipos";

export interface Decisao {
  readonly ia: EstadoIA;
  readonly entrada: Entrada;
  readonly alvo: number | null;
}

type L = Readonly<Lutador>;

/** Distância da beirada do chão em que o personagem para de andar. */
const MARGEM_BEIRADA = 30;
/** Chance, por tick, de soltar o golpe quando o inimigo está ao alcance (tempo de reação). */
export const CHANCE_DE_REAGIR = 0.22;
/** Só troca de alvo se o novo estiver pelo menos isto mais perto (evita ficar alternando). */
const VANTAGEM_PARA_TROCAR = 70;
/** Diferença de altura em que um tiro reto ainda acerta. */
const ALINHADO = 40;
const PENALIDADE_FORA = 500;

function sinal(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function entrada(parcial: Partial<Entrada>): Entrada {
  return {
    mover: 0,
    pular: false,
    descer: false,
    atacar: false,
    habilidade: false,
    encarar: 0,
    ...parcial,
  };
}

/** Distância para escolha de alvo; inimigo fora do chão da arena conta como mais longe. */
function distancia(a: L, b: L, arena: Arena): number {
  const fora =
    b.x < arena.chao.x || b.x > arena.chao.x + arena.chao.largura || b.y > arena.chao.y + 1;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + (fora ? PENALIDADE_FORA : 0);
}

/**
 * Escolha de alvo, por arquétipo:
 *  - assassino: caça os atiradores inimigos (a retaguarda); sem atirador, o mais próximo;
 *  - à distância: quem tem a maior porcentagem dentro do alcance; ninguém ao alcance, o mais próximo;
 *  - corpo a corpo e tanque: o mais próximo.
 * Quem está fora do chão da arena (arremessado) conta como bem mais longe: é melhor
 * bater em quem está ao alcance do que esperar na beirada.
 * O alvo atual é mantido enquanto outro não estiver bem mais perto.
 */
export function escolherAlvo(l: L, todos: readonly L[], arena: Arena): L | null {
  const inimigos = todos.filter((o) => o.vivo && o.lado !== l.lado);
  if (inimigos.length === 0) return null;

  let candidatos = inimigos;
  if (l.def.arquetipo === "assassino") {
    const atiradores = inimigos.filter((o) => o.def.arquetipo === "distancia");
    if (atiradores.length > 0) candidatos = atiradores;
  } else if (l.def.arquetipo === "distancia") {
    const aoAlcance = inimigos.filter(
      (o) => distancia(l, o, arena) - Math.abs(o.y - l.y) <= l.def.ataque.alcance,
    );
    if (aoAlcance.length > 0) {
      let melhor = aoAlcance[0] ?? null;
      for (const o of aoAlcance) if (melhor && o.dano > melhor.dano) melhor = o;
      return melhor;
    }
  }

  let melhor: L | null = null;
  let melhorDist = Infinity;
  for (const o of candidatos) {
    const d = distancia(l, o, arena);
    if (d < melhorDist) {
      melhor = o;
      melhorDist = d;
    }
  }
  const atual = candidatos.find((o) => o.id === l.alvo);
  if (atual && melhor && distancia(l, atual, arena) - melhorDist < VANTAGEM_PARA_TROCAR)
    return atual;
  return melhor;
}

/** A habilidade pode ser usada agora contra este alvo? */
export function podeUsarHabilidade(l: L, alvo: L, todos: readonly L[], arena: Arena): boolean {
  const hab = l.def.habilidade;
  if (l.habRecarga > 0 || !l.noChao) return false;
  const esq = arena.chao.x;
  const dir = arena.chao.x + arena.chao.largura;
  const dx = alvo.x - l.x;
  const dy = alvo.y - l.y;
  const dist = Math.abs(dx);
  const sentido = dx >= 0 ? 1 : -1;
  switch (hab.tipo) {
    case "investida": {
      const fim = l.x + sentido * hab.velocidade * hab.duracao;
      return (
        Math.abs(dy) < ALINHADO &&
        dist > 90 &&
        dist <= hab.alcance &&
        fim > esq + MARGEM_BEIRADA &&
        fim < dir - MARGEM_BEIRADA
      );
    }
    case "rajada":
      return Math.abs(dy) < ALINHADO && dist <= hab.alcance && dist > 80;
    case "pisao":
      return todos.some(
        (o) =>
          o.vivo &&
          o.lado !== l.lado &&
          Math.abs(o.x - l.x) < hab.alcance * 0.8 &&
          Math.abs(o.y - l.y) < 70,
      );
    case "salto":
      return alvo.noChao && alvo.x > esq && alvo.x < dir && dist > 110 && dist <= hab.alcance;
  }
}

/**
 * Máquina de estados da IA. Transições, por ordem de prioridade:
 *  - atordoado                      -> recuperar (sem controle)
 *  - no ar e fora do chão da arena  -> voltar (anda para o centro e guarda o pulo para a hora certa;
 *                                      cancela golpe e habilidade em andamento)
 *  - habilidade em andamento        -> habilidade
 *  - sem inimigo vivo               -> procurar
 *  - golpe em andamento             -> atacar
 *  - habilidade pronta e utilizável -> habilidade (depois de um tempo de reação sorteado)
 *  - em recarga e decidiu recuar    -> recuar
 *  - inimigo ao alcance             -> atacar (começa o golpe depois de um tempo de reação sorteado)
 *  - à distância e inimigo colado   -> recuar (abre espaço)
 *  - caso contrário                 -> aproximar (anda, pula, desce de plataforma)
 * `sorteio` é um número em [0, 1) vindo do gerador com semente.
 */
export function decidir(l: L, todos: readonly L[], arena: Arena, sorteio: number): Decisao {
  if (l.atordoado > 0) return { ia: "recuperar", entrada: entrada({}), alvo: l.alvo };
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
    return { ia: "voltar", entrada: entrada({ mover, pular }), alvo: l.alvo };
  }

  if (l.hab.ticks > 0) return { ia: "habilidade", entrada: entrada({}), alvo: l.alvo };

  const alvo = escolherAlvo(l, todos, arena);
  if (!alvo) {
    // Sem inimigos: comemora com pulinhos.
    return {
      ia: "procurar",
      entrada: entrada({ pular: l.noChao && sorteio < 0.03 }),
      alvo: null,
    };
  }

  const dx = alvo.x - l.x;
  const dy = alvo.y - l.y;
  const dist = Math.abs(dx);
  const sentido: -1 | 1 = dx >= 0 ? 1 : -1;
  const contrario: -1 | 1 = sentido === 1 ? -1 : 1;
  // Nunca persegue além da beirada: o destino fica sempre sobre o chão.
  const destinoX = Math.min(dir - MARGEM_BEIRADA, Math.max(esq + MARGEM_BEIRADA, alvo.x));
  const dxMover = destinoX - l.x;
  const atira = l.def.ataque.projetil !== undefined;
  const alcance = atira
    ? l.def.ataque.alcance
    : l.def.largura / 2 + l.def.ataque.alcance + alvo.def.largura / 2 - 10;
  const alturaOk = atira ? Math.abs(dy) < ALINHADO : Math.abs(dy) < l.def.altura * 0.9;

  let ia: EstadoIA;
  let mover: -1 | 0 | 1 = 0;
  let pular = false;
  let descer = false;
  let atacar = false;
  let habilidade = false;
  let encarar: -1 | 0 | 1 = 0;

  // Movimento de quem luta de perto: chega junto, sobe e desce atrás do alvo.
  const aproximarDoAlvo = (): void => {
    const perto = atira ? 120 : alcance * 0.7;
    if (Math.abs(dxMover) > perto) mover = sinal(dxMover);
    else if (dist < 18) mover = contrario;
    else encarar = sentido;

    const alvoSobreChao = alvo.x > esq && alvo.x < dir;
    if (alvoSobreChao && dy < -45 && dist < 150) {
      if (l.noChao) pular = true;
      else if (l.vy > -1 && l.pulosRestantes > 0 && sorteio < 0.5) pular = true;
    } else if (dy > 45 && l.noChao && l.emPlataforma) {
      descer = true;
    } else if (
      !atira &&
      l.noChao &&
      Math.abs(dy) < 45 &&
      dist > 110 &&
      dist < 200 &&
      sorteio < 0.015
    ) {
      pular = true; // ataque pulando, de vez em quando
    }
  };

  if (l.ataque.fase !== "nenhum") {
    ia = "atacar";
    if (!l.noChao && Math.abs(dxMover) > 10) mover = sinal(dxMover);
  } else if (podeUsarHabilidade(l, alvo, todos, arena)) {
    ia = "habilidade";
    habilidade = sorteio < CHANCE_DE_REAGIR;
    encarar = sentido;
  } else if (l.recarga > 0 && l.recuarDepois) {
    ia = "recuar";
    mover = contrario;
  } else if (dist <= alcance && alturaOk && l.recarga === 0) {
    ia = "atacar";
    atacar = sorteio < CHANCE_DE_REAGIR;
    encarar = sentido;
  } else if (atira && alturaOk && dist < alcance * 0.35) {
    ia = "recuar"; // inimigo colado: abre espaço
    mover = contrario;
  } else if (atira && alturaOk && dist <= alcance * 0.85) {
    ia = "aproximar"; // já está em boa posição: espera a recarga virado para o alvo
    encarar = sentido;
  } else {
    ia = "aproximar";
    aproximarDoAlvo();
  }

  // No meio de um salto de habilidade não gasta o pulo do ar.
  if (l.impulso > 0 && !l.noChao) pular = false;

  // Proteção de beirada: no chão não anda para fora; no ar corrige para dentro.
  if (l.noChao && !l.emPlataforma) {
    if (mover < 0 && l.x <= esq + MARGEM_BEIRADA) mover = 0;
    if (mover > 0 && l.x >= dir - MARGEM_BEIRADA) mover = 0;
  } else if (!l.noChao) {
    const previsto = l.x + l.vx * 12;
    if (previsto < esq + 10) mover = 1;
    else if (previsto > dir - 10) mover = -1;
  }

  return { ia, entrada: { mover, pular, descer, atacar, habilidade, encarar }, alvo: alvo.id };
}
