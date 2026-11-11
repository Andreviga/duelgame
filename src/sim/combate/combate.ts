import { criarAleatorio, proximo, type EstadoAleatorio } from "../aleatorio";
import { TICKS_POR_SEGUNDO } from "../constantes";
import { forcaArremesso, ticksDeAtordoamento, velocidadeDeArremesso } from "./arremesso";
import { foraDosLimites, moverLutador } from "./fisica";
import { decidir } from "./ia";
import type {
  Arena,
  DefImpacto,
  DefPersonagem,
  Esquadrao,
  EstadoCombate,
  Evento,
  FimCombate,
  Lado,
  Lutador,
  Projetil,
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
/** A habilidade começa a rodada com esta fração da recarga já por cumprir. */
export const RECARGA_INICIAL = 0.4;
/** Distância atrás do alvo em que o salto do assassino cai. */
const FOLGA_DO_SALTO = 55;
/** Aliados mantêm pelo menos esta fração da largura média entre si, andando até este tanto por tick. */
const ESPACO_ENTRE_ALIADOS = 1.15;
const EMPURRAO_MAXIMO = 1;

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
    impulso: 0,
    dano: 0,
    atordoado: 0,
    lancado: false,
    ataque: { fase: "nenhum", ticks: 0, acertou: false },
    recarga: 0,
    recuarDepois: false,
    hab: { ticks: 0, atingidos: [], restante: 0 },
    habRecarga: Math.round(def.habilidade.recarga * RECARGA_INICIAL),
    alvo: null,
    ia: "procurar",
    vivo: true,
  };
}

/** Cria um combate entre dois esquadrões. Cada vaga diz o personagem e onde ele começa. */
export function criarCombate(
  arena: Arena,
  esquadroes: readonly [Esquadrao, Esquadrao],
  semente: number,
): EstadoCombate {
  const lutadores: Lutador[] = [];
  esquadroes.forEach((esquadrao, i) => {
    const lado: Lado = i === 0 ? 0 : 1;
    for (const vaga of esquadrao) {
      lutadores.push(criarLutador(vaga.def, lutadores.length, lado, vaga.x, vaga.y));
    }
  });
  return {
    tick: 0,
    rng: criarAleatorio(semente),
    arena,
    lutadores,
    projeteis: [],
    proximoProjetil: 0,
    eventos: [],
    fim: null,
  };
}

/** Atalho para um duelo 1x1 nos pontos de nascimento da arena. */
export function criarDuelo(
  arena: Arena,
  a: DefPersonagem,
  b: DefPersonagem,
  semente: number,
): EstadoCombate {
  const n0 = arena.nascimentos[0] ?? { x: 0, y: 0 };
  const n1 = arena.nascimentos[1] ?? { x: 0, y: 0 };
  return criarCombate(arena, [[{ def: a, ...n0 }], [{ def: b, ...n1 }]], semente);
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

/** A caixa de acerto do golpe corpo a corpo de `a` encosta em `b`? */
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

/** O corpo de `a` (com uma folga) encosta em `b`? Usado pela investida. */
function corpoEncosta(a: Readonly<Lutador>, b: Readonly<Lutador>, folga: number): boolean {
  return sobrepoe(
    a.x - a.def.largura / 2 - folga,
    a.y - a.def.altura,
    a.def.largura + folga * 2,
    a.def.altura,
    b.x - b.def.largura / 2,
    b.y - b.def.altura,
    b.def.largura,
    b.def.altura,
  );
}

export function projetilAcerta(p: Readonly<Projetil>, b: Readonly<Lutador>): boolean {
  return sobrepoe(
    p.x - p.largura / 2,
    p.y - p.altura / 2,
    p.largura,
    p.altura,
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
 * Ordem: IA -> golpes e habilidades em andamento -> física -> projéteis -> acertos ->
 * saídas da arena -> fim.
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
  const arena = e.arena;
  const eventos: Evento[] = [];
  const ls: Lutador[] = e.lutadores.map((l) => ({
    ...l,
    ataque: { ...l.ataque },
    hab: { ...l.hab },
  }));
  let projeteis: Projetil[] = e.projeteis.map((p) => ({ ...p }));
  let proximoProjetil = e.proximoProjetil;

  const aplicarImpacto = (
    atacante: Lutador,
    alvo: Lutador,
    imp: DefImpacto,
    direcao: -1 | 1,
  ): void => {
    alvo.dano += imp.dano * (1 + (sortear() * 2 - 1) * VARIACAO_DANO);
    const forca = forcaArremesso(imp, alvo.dano, alvo.def.peso);
    const angulo = imp.anguloGraus + (sortear() * 2 - 1) * VARIACAO_ANGULO;
    const v = velocidadeDeArremesso(forca, angulo, direcao);
    alvo.vx = v.vx;
    alvo.vy = v.vy;
    alvo.atordoado = ticksDeAtordoamento(forca);
    alvo.noChao = false;
    alvo.emPlataforma = false;
    alvo.lancado = true;
    alvo.impulso = 0;
    alvo.pulosRestantes = Math.max(alvo.pulosRestantes, 1);
    alvo.ataque = { fase: "nenhum", ticks: 0, acertou: false };
    alvo.hab = { ticks: 0, atingidos: [], restante: 0 };
    alvo.ia = "recuperar";
    eventos.push({
      tipo: "golpe",
      atacante: atacante.id,
      alvo: alvo.id,
      x: alvo.x,
      y: alvo.y - alvo.def.altura / 2,
      forca,
      direcao,
    });
  };

  const disparar = (l: Lutador, imp: DefImpacto, velocidade: number): void => {
    const proj = l.def.ataque.projetil;
    if (!proj) return;
    const x = l.x + l.direcao * (l.def.largura / 2 + proj.largura / 2);
    const y = l.y - l.def.altura * 0.55;
    projeteis.push({
      id: proximoProjetil++,
      lado: l.lado,
      dono: l.id,
      x,
      y,
      vx: velocidade * l.direcao,
      largura: proj.largura,
      altura: proj.altura,
      vida: proj.vida,
      dano: imp.dano,
      arremessoBase: imp.arremessoBase,
      arremessoCrescimento: imp.arremessoCrescimento,
      anguloGraus: imp.anguloGraus,
    });
    eventos.push({ tipo: "tiro", id: l.id, x, y });
  };

  const iniciarHabilidade = (l: Lutador): void => {
    const hab = l.def.habilidade;
    const alvo = ls.find((o) => o.id === l.alvo && o.vivo);
    l.habRecarga = hab.recarga;
    l.hab = { ticks: hab.duracao, atingidos: [], restante: 0 };
    if (hab.tipo === "investida") {
      l.impulso = hab.duracao;
      l.vx = l.direcao * hab.velocidade;
    } else if (hab.tipo === "rajada") {
      l.hab.ticks = hab.duracao * hab.quantidade;
      l.hab.restante = hab.quantidade;
    } else if (hab.tipo === "salto" && alvo) {
      const chao = arena.chao;
      const sentido = alvo.x >= l.x ? 1 : -1;
      const destino = Math.min(
        chao.x + chao.largura - 40,
        Math.max(chao.x + 40, alvo.x + sentido * FOLGA_DO_SALTO),
      );
      const tempoNoAr = Math.max(1, Math.round((2 * hab.velocidade) / arena.gravidade));
      l.vx = (destino - l.x) / tempoNoAr;
      l.vy = -hab.velocidade;
      l.impulso = tempoNoAr;
      l.noChao = false;
      l.emPlataforma = false;
      l.pulosRestantes = 1;
      l.hab.ticks = 1;
    }
    eventos.push({ tipo: "habilidade", id: l.id, habilidade: hab.tipo, x: l.x, y: l.y });
  };

  // Acertos corpo a corpo e de habilidade são juntados e aplicados depois,
  // para golpes simultâneos valerem para os dois lados.
  const acertos: { atacante: Lutador; alvo: Lutador; imp: DefImpacto; direcao: -1 | 1 }[] = [];

  // 1 a 3: cada lutador decide olhando o estado do tick anterior, depois age e se move.
  for (const [i, l] of ls.entries()) {
    if (!l.vivo) continue;
    const anterior = e.lutadores[i];
    if (!anterior) continue;
    const decisao = decidir(anterior, e.lutadores, arena, sortear());
    l.ia = decisao.ia;
    l.alvo = decisao.alvo;
    if (l.atordoado > 0) l.atordoado--;
    if (l.habRecarga > 0) l.habRecarga--;

    if (l.ia === "voltar") {
      // Voltar para a arena tem prioridade: larga o golpe ou a habilidade em andamento.
      if (l.ataque.fase !== "nenhum") l.ataque = { fase: "nenhum", ticks: 0, acertou: false };
      if (l.hab.ticks > 0) l.hab = { ticks: 0, atingidos: [], restante: 0 };
      l.impulso = 0;
    }
    avancarAtaque(l);
    const ent = decisao.entrada;
    const livre = l.ataque.fase === "nenhum" && l.atordoado === 0 && l.hab.ticks === 0;
    if (ent.habilidade && livre && l.habRecarga === 0) {
      if (ent.encarar !== 0) l.direcao = ent.encarar;
      iniciarHabilidade(l);
    } else if (ent.atacar && livre && l.recarga === 0) {
      l.ataque = { fase: "inicio", ticks: l.def.ataque.inicio, acertou: false };
      l.recuarDepois = sortear() < CHANCE_RECUAR;
      eventos.push({ tipo: "ataque", id: l.id });
    }
    moverLutador(l, ent, arena, eventos);

    // Ataque à distância: dispara uma vez, no começo da parte ativa.
    if (l.ataque.fase === "ativo" && !l.ataque.acertou && l.def.ataque.projetil) {
      l.ataque.acertou = true;
      disparar(l, l.def.ataque, l.def.ataque.projetil.velocidade);
    }

    // Habilidade em andamento.
    if (l.hab.ticks > 0) {
      const hab = l.def.habilidade;
      if (hab.tipo === "rajada" && l.hab.ticks % hab.duracao === 0 && l.hab.restante > 0) {
        l.hab.restante--;
        disparar(l, hab, hab.velocidade);
      }
      l.hab.ticks--;
      if (hab.tipo === "investida") {
        for (const b of ls) {
          if (!b.vivo || b.lado === l.lado || l.hab.atingidos.includes(b.id)) continue;
          if (corpoEncosta(l, b, 10)) {
            l.hab.atingidos = [...l.hab.atingidos, b.id];
            acertos.push({ atacante: l, alvo: b, imp: hab, direcao: l.direcao });
          }
        }
      } else if (hab.tipo === "pisao" && l.hab.ticks === 0) {
        eventos.push({ tipo: "pisao", id: l.id, x: l.x, y: l.y, raio: hab.alcance });
        for (const b of ls) {
          if (!b.vivo || b.lado === l.lado) continue;
          if (Math.abs(b.x - l.x) <= hab.alcance && Math.abs(b.y - l.y) <= 80) {
            acertos.push({ atacante: l, alvo: b, imp: hab, direcao: b.x >= l.x ? 1 : -1 });
          }
        }
      }
    }
  }

  // Aliados no mesmo piso se afastam de leve, para não ficarem empilhados no mesmo ponto.
  for (const [i, a] of ls.entries()) {
    for (const b of ls.slice(i + 1)) {
      if (a.lado !== b.lado || !a.vivo || !b.vivo || !a.noChao || !b.noChao) continue;
      if (a.atordoado > 0 || b.atordoado > 0 || Math.abs(a.y - b.y) > 10) continue;
      const minimo = ((a.def.largura + b.def.largura) / 2) * ESPACO_ENTRE_ALIADOS;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= minimo) continue;
      const empurrao = Math.min(EMPURRAO_MAXIMO, (minimo - Math.abs(dx)) / 2);
      const sentido = dx >= 0 ? 1 : -1;
      const esq = arena.chao.x + 15;
      const dir = arena.chao.x + arena.chao.largura - 15;
      a.x = Math.min(dir, Math.max(esq, a.x - sentido * empurrao));
      b.x = Math.min(dir, Math.max(esq, b.x + sentido * empurrao));
    }
  }

  // 4: projéteis andam em linha reta e somem ao acertar, bater no chão sólido ou acabar a vida.
  const chao = arena.chao;
  const sobram: Projetil[] = [];
  for (const p of projeteis) {
    p.x += p.vx;
    p.vida--;
    const dono = ls.find((l) => l.id === p.dono);
    const alvo = ls.find((b) => b.vivo && b.lado !== p.lado && projetilAcerta(p, b));
    if (alvo && dono) {
      aplicarImpacto(dono, alvo, p, p.vx >= 0 ? 1 : -1);
      continue;
    }
    const noChaoSolido = sobrepoe(
      p.x - p.largura / 2,
      p.y - p.altura / 2,
      p.largura,
      p.altura,
      chao.x,
      chao.y,
      chao.largura,
      chao.altura,
    );
    const lim = arena.limites;
    if (p.vida > 0 && !noChaoSolido && p.x > lim.esquerda && p.x < lim.direita) sobram.push(p);
  }
  projeteis = sobram;

  // 5: acertos corpo a corpo e de habilidade.
  for (const a of ls) {
    if (!a.vivo || a.ataque.fase !== "ativo" || a.ataque.acertou || a.def.ataque.projetil) continue;
    for (const b of ls) {
      if (b.vivo && b.lado !== a.lado && golpeAcerta(a, b)) {
        acertos.push({ atacante: a, alvo: b, imp: a.def.ataque, direcao: a.direcao });
      }
    }
  }
  for (const { atacante, alvo, imp, direcao } of acertos) {
    if (imp === atacante.def.ataque) atacante.ataque.acertou = true;
    if (alvo.vivo) aplicarImpacto(atacante, alvo, imp, direcao);
  }

  // 6: quem passou dos limites sai da rodada.
  for (const l of ls) {
    if (l.vivo && foraDosLimites(l, arena)) {
      l.vivo = false;
      eventos.push({ tipo: "saida", id: l.id, x: l.x, y: l.y, porGolpe: l.lancado });
    }
  }

  // 7: fim da rodada.
  let fim: FimCombate | null = e.fim;
  if (!fim) {
    const vivos = (lado: Lado) => ls.filter((l) => l.vivo && l.lado === lado);
    const v0 = vivos(0);
    const v1 = vivos(1);
    // Um lado ficou sem ninguém. Só decide quando os sobreviventes estão a salvo:
    // quem ainda está voando de um arremesso pode cair também, e aí é empate.
    if ((v0.length === 0 || v1.length === 0) && [...v0, ...v1].every((l) => !l.lancado)) {
      const vencedor: Lado | null = v0.length > 0 ? 0 : v1.length > 0 ? 1 : null;
      fim = { vencedor, motivo: "eliminacao", tick };
    } else if (tick >= TICKS_MAXIMOS) {
      // Tempo esgotado: mais sobreviventes vence; no empate, a menor porcentagem somada.
      const dano = (grupo: Lutador[]) => grupo.reduce((s, l) => s + l.dano, 0);
      let vencedor: Lado | null = null;
      if (v0.length !== v1.length) vencedor = v0.length > v1.length ? 0 : 1;
      else if (dano(v0) !== dano(v1)) vencedor = dano(v0) < dano(v1) ? 0 : 1;
      fim = { vencedor, motivo: "tempo", tick };
    }
  }

  return { tick, rng, arena, lutadores: ls, projeteis, proximoProjetil, eventos, fim };
}

/** Roda o combate até acabar (sem render). */
export function simularCombate(inicial: EstadoCombate): EstadoCombate {
  let e = inicial;
  while (!e.fim) e = stepCombate(e);
  return e;
}
