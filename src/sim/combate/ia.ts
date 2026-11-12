import type { Arena, Entrada, EstadoIA, Item, Lutador, Projetil } from "./tipos";

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
/** Itens: a quantos ticks do estouro a IA começa a fugir da bomba, e com que folga além do raio. */
const AVISO_DA_BOMBA = 70;
const FOLGA_DA_BOMBA = 40;
/** Distância máxima que a IA desvia para pegar um item, e a % a partir da qual a fruta interessa. */
const ALCANCE_PARA_ITEM = 230;
const DANO_PARA_FRUTA = 25;
const ALINHADO = 40;
const PENALIDADE_FORA = 500;
/** O tufão só vale a pena quando algum inimigo já acumulou este dano. */
const DANO_PARA_TUFAO = 30;

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
 *  - assassino: caça os inimigos que lutam à distância (a retaguarda); sem eles, o mais próximo;
 *  - à distância: quem tem a maior porcentagem dentro do alcance; ninguém ao alcance, o mais próximo;
 *  - corpo a corpo e tanque: o mais próximo.
 * Quem está invisível não pode ser escolhido. Quem está fora do chão da arena (arremessado) conta como bem mais longe: é melhor
 * bater em quem está ao alcance do que esperar na beirada.
 * O alvo atual é mantido enquanto outro não estiver bem mais perto.
 */
export function escolherAlvo(l: L, todos: readonly L[], arena: Arena): L | null {
  const inimigos = todos.filter((o) => o.vivo && o.lado !== l.lado && o.invisivel === 0);
  if (inimigos.length === 0) return null;

  let candidatos = inimigos;
  if (l.def.papel === "assassino") {
    const atiradores = inimigos.filter((o) => o.def.papel === "distancia");
    if (atiradores.length > 0) candidatos = atiradores;
  } else if (l.def.papel === "distancia") {
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

/**
 * A habilidade pode ser usada agora? Devolve o alvo dela (ou `alvo: null` para as que não miram
 * em ninguém), ou `null` se não é hora de usar. O combate chama esta mesma função ao executar,
 * para a IA e a execução concordarem sobre quem é o alvo.
 */
export function alvoDaHabilidade(
  l: L,
  todos: readonly L[],
  arena: Arena,
  projeteis: readonly Readonly<Projetil>[],
): { alvo: L | null } | null {
  const hab = l.def.habilidade;
  if (l.habRecarga > 0) return null;
  const esq = arena.chao.x;
  const dir = arena.chao.x + arena.chao.largura;
  const vivos = todos.filter((o) => o.vivo && o.lado !== l.lado);
  const visiveis = vivos.filter((o) => o.invisivel === 0);
  // Em cima da arena: dentro da largura do chão e não caindo por baixo dele.
  const sobreChao = (o: L): boolean => o.x > esq && o.x < dir && o.y <= arena.chao.y + 1;
  const dx = (o: L): number => Math.abs(o.x - l.x);
  const dy = (o: L): number => Math.abs(o.y - l.y);
  const atual = visiveis.find((o) => o.id === l.alvo) ?? null;
  const maisDistante = (lista: L[]): L | null =>
    lista.reduce<L | null>((m, o) => (!m || dx(o) > dx(m) ? o : m), null);

  switch (hab.tipo) {
    case "investida": {
      if (!atual || !l.noChao) return null;
      const sentido = atual.x >= l.x ? 1 : -1;
      const fim = l.x + sentido * hab.velocidade * hab.duracao;
      const ok =
        dy(atual) < ALINHADO &&
        dx(atual) > 90 &&
        dx(atual) <= hab.alcance &&
        fim > esq + MARGEM_BEIRADA &&
        fim < dir - MARGEM_BEIRADA;
      return ok ? { alvo: atual } : null;
    }
    case "area":
      return l.noChao && vivos.some((o) => dx(o) < hab.alcance * 0.8 && dy(o) < 70)
        ? { alvo: null }
        : null;
    case "bola":
      return atual && dx(atual) + dy(atual) <= hab.alcance ? { alvo: atual } : null;
    case "devolver": {
      const meio = l.y - l.def.altura / 2;
      const vindo = projeteis.some(
        (p) =>
          p.lado !== l.lado &&
          Math.abs(p.x - l.x) < 300 &&
          Math.abs(p.y - meio) < 90 &&
          (p.alvo === l.id || Math.sign(p.vx) === Math.sign(l.x - p.x)),
      );
      return vindo ? { alvo: null } : null;
    }
    case "carrinho": {
      if (!l.noChao) return null;
      const alvo = maisDistante(
        visiveis.filter(
          (o) => sobreChao(o) && o.noChao && dy(o) < ALINHADO && dx(o) > 80 && dx(o) <= hab.alcance,
        ),
      );
      return alvo ? { alvo } : null;
    }
    case "gancho": {
      if (!l.noChao) return null;
      const alvo = maisDistante(
        visiveis.filter(
          (o) => o.atordoado === 0 && dy(o) < 220 && dx(o) > 130 && dx(o) <= hab.alcance,
        ),
      );
      return alvo ? { alvo } : null;
    }
    case "canhao":
      return atual && l.noChao && dy(atual) < ALINHADO && dx(atual) > 80 && dx(atual) <= hab.alcance
        ? { alvo: atual }
        : null;
    case "cadeia": {
      const alvo = visiveis
        .filter((o) => sobreChao(o) && dx(o) + dy(o) <= hab.alcance)
        .reduce<L | null>((m, o) => (!m || dx(o) + dy(o) < dx(m) + dy(m) ? o : m), null);
      return alvo ? { alvo } : null;
    }
    case "casco": {
      const ameaca = vivos.some(
        (o) =>
          dx(o) < 120 && dy(o) < 70 && (o.ataque.fase === "inicio" || o.ataque.fase === "ativo"),
      );
      return l.noChao && ameaca ? { alvo: null } : null;
    }
    case "teleporte": {
      if (!l.noChao) return null;
      const alvo = visiveis
        .filter((o) => sobreChao(o) && o.noChao && dx(o) > 90 && dx(o) <= hab.alcance)
        .reduce<L | null>(
          (m, o) =>
            !m || o.def.peso < m.def.peso || (o.def.peso === m.def.peso && o.id < m.id) ? o : m,
          null,
        );
      return alvo ? { alvo } : null;
    }
    case "cartao":
      // Só em quem está de pé no chão: atordoar alguém no ar, voltando para a arena, seria queda certa.
      return atual &&
        atual.noChao &&
        atual.atordoado === 0 &&
        dy(atual) < ALINHADO &&
        dx(atual) <= hab.alcance
        ? { alvo: atual }
        : null;
    case "bumerangue":
      // Vale também no ar: quem a usa chega pulando, e a lâmina sai da altura do corpo.
      return atual && dy(atual) < ALINHADO && dx(atual) > 70 && dx(atual) <= hab.alcance
        ? { alvo: atual }
        : null;
    case "leque":
      // Os projéteis sobem em leque: serve para alvo na mesma altura ou acima.
      return atual && dx(atual) > 60 && dx(atual) <= hab.alcance && atual.y <= l.y + ALINHADO
        ? { alvo: atual }
        : null;
    case "tufao": {
      const emCena = vivos.filter((o) => sobreChao(o) && dx(o) <= hab.alcance);
      return l.noChao && emCena.some((o) => o.dano >= DANO_PARA_TUFAO) ? { alvo: null } : null;
    }
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
export function decidir(
  l: L,
  todos: readonly L[],
  arena: Arena,
  sorteio: number,
  projeteis: readonly Readonly<Projetil>[] = [],
  itens: readonly Readonly<Item>[] = [],
): Decisao {
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
      // Só desce se cair em cima do chão; numa plataforma que passa da beirada, anda para dentro antes.
      if (l.x > esq + MARGEM_BEIRADA && l.x < dir - MARGEM_BEIRADA) descer = true;
      else mover = l.x < centro ? 1 : -1;
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

  // Bomba para estourar por perto: sai de perto dela antes de qualquer outra coisa.
  const bomba = itens.find(
    (i) =>
      i.tipo === "bomba" &&
      i.noChao &&
      i.pavio <= AVISO_DA_BOMBA &&
      Math.hypot(i.x - l.x, i.y - l.y) < i.raio + FOLGA_DA_BOMBA,
  );
  // Item útil no mesmo nível e mais perto que o alvo: vale o desvio.
  const item = itens.find(
    (i) =>
      i.noChao &&
      Math.abs(i.y - l.y) < 30 &&
      Math.abs(i.x - l.x) < Math.min(ALCANCE_PARA_ITEM, dist) &&
      (i.tipo === "escudo" ||
        (i.tipo === "martelo" && l.martelo === 0) ||
        (i.tipo === "fruta" && l.dano >= DANO_PARA_FRUTA)),
  );

  if (l.ataque.fase !== "nenhum") {
    ia = "atacar";
    if (!l.noChao && Math.abs(dxMover) > 10) mover = sinal(dxMover);
  } else if (bomba && l.noChao) {
    ia = "recuar";
    mover = l.x >= bomba.x ? 1 : -1;
  } else if (alvoDaHabilidade(l, todos, arena, projeteis)) {
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
  } else if (item && l.noChao) {
    ia = "item";
    mover = sinal(item.x - l.x);
  } else {
    ia = "aproximar";
    aproximarDoAlvo();
  }

  // No meio de um salto de habilidade não gasta o pulo do ar.
  if (l.impulso > 0 && !l.noChao) pular = false;

  // Proteção de beirada: no chão não anda para fora; no ar corrige para dentro.
  // (Vale também em plataformas que passam da largura do chão: não anda mais para fora.)
  if (l.noChao) {
    if (mover < 0 && l.x <= esq + MARGEM_BEIRADA) mover = 0;
    if (mover > 0 && l.x >= dir - MARGEM_BEIRADA) mover = 0;
  } else if (!l.noChao) {
    const previsto = l.x + l.vx * 12;
    if (previsto < esq + 10) mover = 1;
    else if (previsto > dir - 10) mover = -1;
  }

  return { ia, entrada: { mover, pular, descer, atacar, habilidade, encarar }, alvo: alvo.id };
}
