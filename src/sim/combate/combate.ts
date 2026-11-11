import { criarAleatorio, proximo, type EstadoAleatorio } from "../aleatorio";
import { TICKS_POR_SEGUNDO } from "../constantes";
import { forcaArremesso, ticksDeAtordoamento, velocidadeDeArremesso } from "./arremesso";
import { foraDosLimites, moverLutador } from "./fisica";
import { alvoDaHabilidade, decidir } from "./ia";
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
import { SEM_BONUS, type BonusDeCombate } from "./tipos";

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
/** Distância atrás do alvo em que o teleporte reaparece. */
const FOLGA_DO_TELEPORTE = 45;
/** O projétil do canhão é maior que o tiro normal. */
const ESCALA_DO_CANHAO = 1.8;
/** Dentro do casco, o dano recebido é reduzido por este fator. */
export const DANO_NO_CASCO = 0.5;
/** Aliados mantêm pelo menos esta fração da largura média entre si, andando até este tanto por tick. */
const ESPACO_ENTRE_ALIADOS = 1.15;
const EMPURRAO_MAXIMO = 1;

export function criarLutador(
  def: DefPersonagem,
  id: number,
  lado: Lado,
  x: number,
  y: number,
  nivel = 1,
  dono: number = lado,
  bonus: BonusDeCombate = SEM_BONUS,
): Lutador {
  return {
    id,
    lado,
    def,
    nivel,
    dono,
    bonus,
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
    hab: { ticks: 0, atingidos: [], restante: 0, alvo: null },
    habRecarga: Math.round(def.habilidade.recarga * RECARGA_INICIAL),
    golpes: 0,
    invisivel: bonus.ticksInvisivel,
    ultimoAtacante: null,
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
      lutadores.push(
        criarLutador(
          vaga.def,
          lutadores.length,
          lado,
          vaga.x,
          vaga.y,
          vaga.nivel ?? 1,
          vaga.dono ?? lado,
          vaga.bonus ?? SEM_BONUS,
        ),
      );
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
  const chao = arena.chao;
  const esq = chao.x;
  const dir = chao.x + chao.largura;
  const eventos: Evento[] = [];
  const ls: Lutador[] = e.lutadores.map((l) => ({
    ...l,
    ataque: { ...l.ataque },
    hab: { ...l.hab },
  }));
  let projeteis: Projetil[] = e.projeteis.map((p) => ({ ...p }));
  let proximoProjetil = e.proximoProjetil;
  const semHabilidade = () => ({ ticks: 0, atingidos: [], restante: 0, alvo: null });

  const noCasco = (l: Lutador): boolean => l.def.habilidade.tipo === "casco" && l.hab.ticks > 0;

  /**
   * Um acerto: soma dano e arremessa. `golpe` diz se conta como golpe do atacante
   * (para o bônus de primeiro golpe); `multiplicador` escala o arremesso.
   */
  const aplicarImpacto = (
    atacante: Lutador,
    alvo: Lutador,
    imp: DefImpacto,
    direcao: -1 | 1,
    multiplicador = 1,
  ): void => {
    const critico = atacante.golpes === 0 && atacante.bonus.primeiroGolpe > 1;
    const bonusDano = atacante.golpes === 0 ? atacante.bonus.primeiroGolpe : 1;
    atacante.golpes++;
    const dano = imp.dano * bonusDano * (1 + (sortear() * 2 - 1) * VARIACAO_DANO);
    const angulo = imp.anguloGraus + (sortear() * 2 - 1) * VARIACAO_ANGULO;
    alvo.ultimoAtacante = atacante.id;
    const x = alvo.x;
    const y = alvo.y - alvo.def.altura / 2;

    if (noCasco(alvo)) {
      // Imune a arremesso: só leva parte do dano e continua onde está.
      alvo.dano += dano * DANO_NO_CASCO;
      eventos.push({
        tipo: "golpe",
        atacante: atacante.id,
        alvo: alvo.id,
        x,
        y,
        forca: 0,
        direcao,
        critico,
      });
      return;
    }

    alvo.dano += dano;
    let forca = forcaArremesso(imp, alvo.dano, alvo.def.peso) * multiplicador;
    // Tanque aliado por perto amortece o arremesso.
    const b = alvo.bonus;
    if (b.protecaoVizinhos > 0) {
      const protegido = ls.some(
        (o) =>
          o.vivo &&
          o.id !== alvo.id &&
          o.lado === alvo.lado &&
          o.def.papel === "tanque" &&
          Math.hypot(o.x - alvo.x, o.y - alvo.y) <= b.raioVizinho,
      );
      if (protegido) forca *= 1 - b.protecaoVizinhos;
    }
    const v = velocidadeDeArremesso(forca, angulo, direcao);
    alvo.vx = v.vx * atacante.bonus.arremessoHorizontal;
    alvo.vy = v.vy;
    alvo.atordoado = ticksDeAtordoamento(forca);
    alvo.noChao = false;
    alvo.emPlataforma = false;
    alvo.lancado = true;
    alvo.impulso = 0;
    alvo.pulosRestantes = Math.max(alvo.pulosRestantes, 1);
    alvo.ataque = { fase: "nenhum", ticks: 0, acertou: false };
    alvo.hab = semHabilidade();
    alvo.ia = "recuperar";
    eventos.push({
      tipo: "golpe",
      atacante: atacante.id,
      alvo: alvo.id,
      x,
      y,
      forca,
      direcao,
      critico,
    });
  };

  const disparar = (
    l: Lutador,
    imp: DefImpacto,
    velocidade: number,
    opcoes: { alvo?: number; quiques?: number; raioDeBusca?: number; escala?: number } = {},
  ): void => {
    const proj = l.def.ataque.projetil;
    if (!proj) return;
    const escala = opcoes.escala ?? 1;
    const largura = proj.largura * escala;
    const x = l.x + l.direcao * (l.def.largura / 2 + largura / 2);
    const y = l.y - l.def.altura * 0.55;
    projeteis.push({
      id: proximoProjetil++,
      lado: l.lado,
      dono: l.id,
      x,
      y,
      vx: velocidade * l.direcao,
      vy: 0,
      velocidade,
      largura,
      altura: proj.altura * escala,
      vida: Math.round(proj.vida * (opcoes.alvo === undefined ? 1 : 3)),
      alvo: opcoes.alvo ?? null,
      quiques: opcoes.quiques ?? 0,
      raioDeBusca: opcoes.raioDeBusca ?? 0,
      perfura: l.bonus.perfura ? 1 : 0,
      atingidos: [],
      multiplicador: 1,
      dano: imp.dano,
      arremessoBase: imp.arremessoBase,
      arremessoCrescimento: imp.arremessoCrescimento,
      anguloGraus: imp.anguloGraus,
    });
    eventos.push({ tipo: "tiro", id: l.id, x, y });
  };

  /** Leva `l` instantaneamente para (x, y), limitado ao chão da arena, e avisa o render. */
  const teleportar = (l: Lutador, x: number, y: number): void => {
    const deX = l.x;
    const deY = l.y;
    l.x = Math.min(dir - 25, Math.max(esq + 25, x));
    l.y = y;
    l.vx = 0;
    l.vy = 0;
    l.noChao = false;
    l.emPlataforma = false;
    l.impulso = 0;
    eventos.push({ tipo: "teleporte", id: l.id, deX, deY, x: l.x, y: l.y });
  };

  // Acertos corpo a corpo e de habilidade são juntados e aplicados depois,
  // para golpes simultâneos valerem para os dois lados.
  const acertos: { atacante: Lutador; alvo: Lutador; imp: DefImpacto; direcao: -1 | 1 }[] = [];

  const iniciarHabilidade = (l: Lutador): void => {
    const hab = l.def.habilidade;
    const uso = alvoDaHabilidade(l, ls, arena, projeteis);
    if (!uso) return;
    const alvo = uso.alvo ? ls.find((o) => o.id === uso.alvo?.id) : undefined;
    l.habRecarga = hab.recarga;
    l.hab = { ticks: 1, atingidos: [], restante: 0, alvo: alvo?.id ?? null };
    eventos.push({ tipo: "habilidade", id: l.id, habilidade: hab.tipo, x: l.x, y: l.y });
    if (alvo) l.direcao = alvo.x >= l.x ? 1 : -1;

    switch (hab.tipo) {
      case "investida":
        l.hab.ticks = hab.duracao;
        l.impulso = hab.duracao;
        l.vx = l.direcao * hab.velocidade;
        break;
      case "carrinho": {
        if (!alvo) break;
        const ticks = Math.min(hab.duracao, Math.ceil(Math.abs(alvo.x - l.x) / hab.velocidade) + 4);
        l.hab.ticks = ticks;
        l.impulso = ticks;
        l.vx = l.direcao * hab.velocidade;
        break;
      }
      case "area":
      case "devolver":
      case "casco":
        l.hab.ticks = hab.duracao;
        if (hab.tipo === "casco") l.vx = 0;
        break;
      case "bola":
        if (alvo) {
          disparar(l, hab, hab.velocidade, {
            alvo: alvo.id,
            quiques: hab.quantidade - 1,
            raioDeBusca: hab.alcance,
          });
        }
        break;
      case "canhao":
        disparar(l, hab, hab.velocidade, { escala: ESCALA_DO_CANHAO });
        break;
      case "cadeia":
        l.hab.ticks = hab.duracao * hab.quantidade;
        l.hab.restante = hab.quantidade;
        break;
      case "gancho": {
        if (!alvo) break;
        // Puxa o alvo para a frente de quem usou; ele chega atordoado e leva o golpe em seguida.
        const deX = alvo.x;
        const deY = alvo.y - alvo.def.altura / 2;
        const folga = l.def.largura / 2 + alvo.def.largura / 2 + 16;
        alvo.x = Math.min(dir - 20, Math.max(esq + 20, l.x + l.direcao * folga));
        alvo.y = l.y;
        alvo.vx = 0;
        alvo.vy = 0;
        alvo.noChao = false;
        alvo.emPlataforma = false;
        alvo.impulso = 0;
        alvo.dano += hab.dano;
        alvo.atordoado = Math.max(alvo.atordoado, hab.duracao);
        alvo.ataque = { fase: "nenhum", ticks: 0, acertou: false };
        if (!noCasco(alvo)) alvo.hab = semHabilidade();
        alvo.ultimoAtacante = l.id;
        l.recarga = 0;
        l.alvo = alvo.id;
        eventos.push({ tipo: "gancho", id: l.id, alvo: alvo.id, deX, deY });
        break;
      }
      case "teleporte": {
        if (!alvo) break;
        // Reaparece nas costas do alvo, virado para ele, com o golpe pronto.
        teleportar(l, alvo.x - alvo.direcao * FOLGA_DO_TELEPORTE, alvo.y);
        l.direcao = alvo.x >= l.x ? 1 : -1;
        l.recarga = 0;
        l.alvo = alvo.id;
        break;
      }
      case "tufao": {
        const centro = (esq + dir) / 2;
        for (const o of ls) {
          if (!o.vivo || o.lado === l.lado || Math.abs(o.x - l.x) > hab.alcance) continue;
          acertos.push({ atacante: l, alvo: o, imp: hab, direcao: o.x >= centro ? 1 : -1 });
        }
        eventos.push({ tipo: "area", id: l.id, x: l.x, y: l.y, raio: hab.alcance });
        break;
      }
    }
  };

  // 1 a 3: cada lutador decide olhando o estado do tick anterior, depois age e se move.
  for (const [i, l] of ls.entries()) {
    if (!l.vivo) continue;
    const anterior = e.lutadores[i];
    if (!anterior) continue;
    const decisao = decidir(anterior, e.lutadores, arena, sortear(), e.projeteis);
    l.ia = decisao.ia;
    l.alvo = decisao.alvo;
    if (l.atordoado > 0) l.atordoado--;
    if (l.habRecarga > 0) l.habRecarga--;
    if (l.invisivel > 0) l.invisivel--;

    if (l.ia === "voltar") {
      // Voltar para a arena tem prioridade: larga o golpe ou a habilidade em andamento.
      if (l.ataque.fase !== "nenhum") l.ataque = { fase: "nenhum", ticks: 0, acertou: false };
      if (l.hab.ticks > 0) l.hab = semHabilidade();
      l.impulso = 0;
    }
    avancarAtaque(l);
    const ent = decisao.entrada;
    const livre = l.ataque.fase === "nenhum" && l.atordoado === 0 && l.hab.ticks === 0;
    let usouHabilidade = false;
    if (ent.habilidade && livre && l.habRecarga === 0) {
      if (ent.encarar !== 0) l.direcao = ent.encarar;
      iniciarHabilidade(l);
      usouHabilidade = l.hab.ticks > 0;
    } else if (ent.atacar && livre && l.recarga === 0) {
      l.ataque = { fase: "inicio", ticks: l.def.ataque.inicio, acertou: false };
      l.recuarDepois = sortear() < CHANCE_RECUAR;
      eventos.push({ tipo: "ataque", id: l.id });
    }
    // No tick em que a habilidade começa, é ela que decide posição e direção (teleporte, investida).
    moverLutador(l, usouHabilidade ? { ...ent, mover: 0, encarar: 0 } : ent, arena, eventos);

    // Ataque à distância: dispara uma vez, no começo da parte ativa.
    if (l.ataque.fase === "ativo" && !l.ataque.acertou && l.def.ataque.projetil) {
      l.ataque.acertou = true;
      disparar(l, l.def.ataque, l.def.ataque.projetil.velocidade);
    }

    // Habilidade em andamento.
    if (l.hab.ticks > 0) {
      const hab = l.def.habilidade;
      if (hab.tipo === "cadeia" && l.hab.ticks % hab.duracao === 0 && l.hab.restante > 0) {
        // Próximo salto: o inimigo mais perto que ainda não levou a descarga.
        let proximoAlvo: Lutador | null = null;
        let melhor = hab.alcance;
        for (const o of ls) {
          if (!o.vivo || o.lado === l.lado || l.hab.atingidos.includes(o.id)) continue;
          if (o.x <= esq || o.x >= dir || o.y > chao.y + 1) continue;
          const d = Math.abs(o.x - l.x) + Math.abs(o.y - l.y);
          if (d <= melhor) {
            proximoAlvo = o;
            melhor = d;
          }
        }
        if (proximoAlvo) {
          const sentido = proximoAlvo.x >= l.x ? 1 : -1;
          teleportar(l, proximoAlvo.x - sentido * 30, proximoAlvo.y);
          l.direcao = sentido;
          l.hab.restante--;
          l.hab.atingidos = [...l.hab.atingidos, proximoAlvo.id];
          acertos.push({ atacante: l, alvo: proximoAlvo, imp: hab, direcao: sentido });
        } else {
          l.hab.ticks = 1; // ninguém ao alcance: a cadeia acaba
        }
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
      } else if (hab.tipo === "carrinho") {
        const b = ls.find((o) => o.id === l.hab.alvo && o.vivo);
        if (b && corpoEncosta(l, b, 12)) {
          acertos.push({ atacante: l, alvo: b, imp: hab, direcao: l.direcao });
          l.hab.ticks = 0;
          l.impulso = 0;
          l.vx *= 0.3;
        }
      } else if (hab.tipo === "area" && l.hab.ticks === 0) {
        eventos.push({ tipo: "area", id: l.id, x: l.x, y: l.y, raio: hab.alcance });
        for (const b of ls) {
          if (!b.vivo || b.lado === l.lado) continue;
          if (Math.abs(b.x - l.x) <= hab.alcance && Math.abs(b.y - l.y) <= 90) {
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
      a.x = Math.min(dir - 15, Math.max(esq + 15, a.x - sentido * empurrao));
      b.x = Math.min(dir - 15, Math.max(esq + 15, b.x + sentido * empurrao));
    }
  }

  // 4: projéteis. Andam em linha reta ou perseguem o alvo; somem ao acertar (a não ser que
  // quiquem ou atravessem), ao bater no chão sólido, ao sair da arena ou quando a vida acaba.
  const sobram: Projetil[] = [];
  for (const p of projeteis) {
    if (p.alvo !== null) {
      const perseguido = ls.find((o) => o.id === p.alvo && o.vivo);
      if (perseguido) {
        const ax = perseguido.x - p.x;
        const ay = perseguido.y - perseguido.def.altura / 2 - p.y;
        const d = Math.hypot(ax, ay) || 1;
        p.vx = (ax / d) * p.velocidade;
        p.vy = (ay / d) * p.velocidade;
      } else {
        p.alvo = null;
      }
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vida--;
    const dono = ls.find((l) => l.id === p.dono);
    const alvo = ls.find(
      (b) => b.vivo && b.lado !== p.lado && !p.atingidos.includes(b.id) && projetilAcerta(p, b),
    );
    let some = false;
    if (alvo && dono) {
      const defesa = alvo.def.habilidade;
      if (defesa.tipo === "devolver" && alvo.hab.ticks > 0) {
        // Agarra e devolve: o projétil muda de dono e volta mais forte para quem atirou.
        eventos.push({ tipo: "devolveu", id: alvo.id, x: p.x, y: p.y });
        alvo.hab = semHabilidade();
        p.alvo = p.dono;
        p.lado = alvo.lado;
        p.dono = alvo.id;
        p.vx = -p.vx;
        p.vy = -p.vy;
        p.vida = 180;
        p.quiques = 0;
        p.perfura = 0;
        p.atingidos = [];
        p.multiplicador = defesa.quantidade;
      } else {
        const sentido = p.vx !== 0 ? (p.vx > 0 ? 1 : -1) : alvo.x >= dono.x ? 1 : -1;
        aplicarImpacto(dono, alvo, p, sentido, p.multiplicador);
        p.atingidos = [...p.atingidos, alvo.id];
        if (p.quiques > 0) {
          // Quica para o inimigo mais próximo que ainda não foi atingido.
          let proximoAlvo: Lutador | null = null;
          let melhor = p.raioDeBusca;
          for (const o of ls) {
            if (!o.vivo || o.lado === p.lado || p.atingidos.includes(o.id)) continue;
            const d = Math.hypot(o.x - p.x, o.y - o.def.altura / 2 - p.y);
            if (d <= melhor) {
              proximoAlvo = o;
              melhor = d;
            }
          }
          p.quiques--;
          if (proximoAlvo) p.alvo = proximoAlvo.id;
          else some = true;
        } else if (p.perfura > 0) {
          p.perfura--;
          p.alvo = null;
        } else {
          some = true;
        }
      }
    }
    // O projétil que persegue (bola) passa por cima do chão; os outros param nele.
    const noChaoSolido =
      p.alvo === null &&
      sobrepoe(
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
    const dentro = p.x > lim.esquerda && p.x < lim.direita && p.y > lim.topo && p.y < lim.fundo;
    if (!some && p.vida > 0 && !noChaoSolido && dentro) sobram.push(p);
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
    if (!l.vivo || !foraDosLimites(l, arena)) continue;
    l.vivo = false;
    eventos.push({ tipo: "saida", id: l.id, x: l.x, y: l.y, porGolpe: l.lancado });
    // Quem deu o último golpe leva o crédito do nocaute.
    const autor = ls.find((o) => o.id === l.ultimoAtacante && o.vivo && o.lado !== l.lado);
    if (autor && autor.bonus.ticksInvisivel > 0) autor.invisivel = autor.bonus.ticksInvisivel;
    // Sinergia: explode ao sair, ferindo os inimigos que estiverem por perto da saída.
    if (l.bonus.danoExplosao > 0) {
      const lim = arena.limites;
      const x = Math.min(lim.direita, Math.max(lim.esquerda, l.x));
      const y = Math.min(lim.fundo, Math.max(lim.topo, l.y));
      eventos.push({ tipo: "explosao", id: l.id, x, y, raio: l.bonus.raioExplosao });
      for (const o of ls) {
        if (!o.vivo || o.lado === l.lado) continue;
        if (Math.hypot(o.x - x, o.y - y) <= l.bonus.raioExplosao) o.dano += l.bonus.danoExplosao;
      }
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
