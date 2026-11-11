import type { Arena, Entrada, Evento, Lutador } from "./tipos";

/** Ticks em que o personagem ignora plataformas depois de pedir para descer. */
export const TICKS_DESCENDO = 14;
const ATRITO_ATORDOADO_CHAO = 0.9;
const ARRASTO_ATORDOADO_AR = 0.985;

function aproximar(valor: number, alvo: number, passo: number): number {
  if (valor < alvo) return Math.min(alvo, valor + passo);
  return Math.max(alvo, valor - passo);
}

/**
 * Aplica a entrada e avança a física de um lutador em um tick.
 * Altera o lutador recebido (o chamador passa uma cópia) e registra eventos.
 */
export function moverLutador(l: Lutador, entrada: Entrada, arena: Arena, eventos: Evento[]): void {
  const def = l.def;
  const controlavel = l.atordoado === 0;

  if (controlavel) {
    const aceleracao = l.noChao ? def.aceleracao : def.aceleracaoAr;
    l.vx = aproximar(l.vx, entrada.mover * def.velocidade, aceleracao);
    if (entrada.encarar !== 0) l.direcao = entrada.encarar;
    else if (entrada.mover !== 0 && l.ataque.fase === "nenhum") l.direcao = entrada.mover;

    if (entrada.pular) {
      if (l.noChao) {
        l.vy = -def.pulo;
        l.pulosRestantes = 1;
        l.noChao = false;
        l.emPlataforma = false;
        eventos.push({ tipo: "pulo", id: l.id, x: l.x, y: l.y, duplo: false });
      } else if (l.pulosRestantes > 0) {
        l.vy = -def.puloDuplo;
        l.pulosRestantes--;
        if (entrada.mover !== 0) l.vx = entrada.mover * def.velocidade;
        eventos.push({ tipo: "pulo", id: l.id, x: l.x, y: l.y, duplo: true });
      }
    } else if (entrada.descer && l.noChao && l.emPlataforma) {
      l.ignorarPlataforma = TICKS_DESCENDO;
      l.noChao = false;
      l.emPlataforma = false;
    }
  } else {
    l.vx *= l.noChao ? ATRITO_ATORDOADO_CHAO : ARRASTO_ATORDOADO_AR;
  }

  if (l.ignorarPlataforma > 0) l.ignorarPlataforma--;

  l.vy += arena.gravidade;
  if (controlavel && l.vy > def.quedaMaxima) l.vy = def.quedaMaxima;

  const meia = def.largura / 2;
  const chao = arena.chao;
  const chaoDir = chao.x + chao.largura;
  const chaoBase = chao.y + chao.altura;

  // Eixo X: o chão sólido bloqueia pelos lados.
  l.x += l.vx;
  if (l.x + meia > chao.x && l.x - meia < chaoDir && l.y > chao.y && l.y - def.altura < chaoBase) {
    if (l.vx > 0) l.x = chao.x - meia;
    else if (l.vx < 0) l.x = chaoDir + meia;
    l.vx = 0;
  }

  // Eixo Y.
  const yAntes = l.y;
  const estavaNoChao = l.noChao;
  const vyImpacto = l.vy;
  l.y += l.vy;
  let apoiado = false;
  let emPlataforma = false;
  const sobreChaoX = l.x + meia > chao.x && l.x - meia < chaoDir;

  if (sobreChaoX && l.y > chao.y && l.y - def.altura < chaoBase) {
    if (l.vy >= 0 && yAntes <= chao.y) {
      l.y = chao.y;
      apoiado = true;
    } else {
      // Bateu a cabeça por baixo do chão.
      l.y = chaoBase + def.altura;
    }
    l.vy = 0;
  } else if (sobreChaoX && l.vy >= 0 && l.y === chao.y) {
    apoiado = true;
    l.vy = 0;
  }

  if (!apoiado && l.vy >= 0 && l.ignorarPlataforma === 0) {
    for (const p of arena.plataformas) {
      const sobreX = l.x + meia > p.x && l.x - meia < p.x + p.largura;
      if (sobreX && yAntes <= p.y && l.y >= p.y) {
        l.y = p.y;
        l.vy = 0;
        apoiado = true;
        emPlataforma = true;
        break;
      }
    }
  }

  if (apoiado) {
    if (!estavaNoChao) {
      eventos.push({ tipo: "pouso", id: l.id, x: l.x, y: l.y, impacto: vyImpacto });
    }
    l.noChao = true;
    l.emPlataforma = emPlataforma;
    l.pulosRestantes = 2;
    if (l.atordoado === 0) l.lancado = false;
  } else {
    // Saiu do apoio sem pular: sobra só o pulo no ar.
    if (estavaNoChao && l.pulosRestantes > 1) l.pulosRestantes = 1;
    l.noChao = false;
    l.emPlataforma = false;
  }
}

/** O lutador passou dos limites da arena? */
export function foraDosLimites(l: Lutador, arena: Arena): boolean {
  const lim = arena.limites;
  return (
    l.x < lim.esquerda || l.x > lim.direita || l.y - l.def.altura > lim.fundo || l.y < lim.topo
  );
}
