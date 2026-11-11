import { matchMaker, Room, type Client } from "@colyseus/core";
import {
  MAXIMO_DE_JOGADORES,
  MSG,
  type ComandoDoCliente,
  type OpcoesDeEntrada,
} from "../src/rede/protocolo";
import { gerarCodigo, Mesa } from "./mesa";

/** A cada quanto tempo a mesa confere os relógios (fim da preparação, fim do combate, reconexão). */
const MS_DO_PASSO = 200;
const SEGUNDOS_DE_RECONEXAO = 60;

/**
 * Sala do Colyseus. É só a ponte de rede: toda regra está na `Mesa`.
 * Não usa o estado sincronizado do Colyseus; cada jogador recebe por mensagem a sua visão,
 * já sem a loja e o banco dos outros.
 */
export class SalaDeJogo extends Room {
  override maxClients = MAXIMO_DE_JOGADORES;
  private mesa!: Mesa;

  override async onCreate(opcoes: OpcoesDeEntrada & { escalaDeTempo?: number }): Promise<void> {
    // Código curto no lugar do id padrão, para os amigos entrarem digitando.
    let codigo = gerarCodigo(Math.random);
    for (let i = 0; i < 20 && (await matchMaker.query({ roomId: codigo })).length > 0; i++) {
      codigo = gerarCodigo(Math.random);
    }
    this.roomId = codigo;
    await this.setPrivate(true);

    const escala = Number(process.env["ESCALA_DE_TEMPO"] ?? opcoes.escalaDeTempo ?? 1);
    this.mesa = new Mesa({
      codigo,
      modo: opcoes.modo === "duplas" ? "duplas" : "todos",
      dificuldade:
        opcoes.dificuldade === "facil" || opcoes.dificuldade === "dificil"
          ? opcoes.dificuldade
          : "medio",
      semente: Math.floor(Math.random() * 2 ** 31) + 1,
      segundosDeReconexao: SEGUNDOS_DE_RECONEXAO,
      escalaDeTempo: Number.isFinite(escala) && escala > 0 ? escala : 1,
    });

    this.onMessage(MSG.comando, (cliente: Client, comando: ComandoDoCliente) => {
      const erro = this.mesa.comando(cliente.sessionId, comando);
      if (erro) cliente.send(MSG.erro, { erro });
      else this.enviarVisoes();
    });
    this.onMessage(MSG.comecar, (cliente: Client) => {
      const erro = this.mesa.comecar(cliente.sessionId, Date.now());
      if (erro) {
        cliente.send(MSG.erro, { erro });
        return;
      }
      void this.lock();
      this.enviarVisoes();
    });
    this.onMessage(
      "conferir",
      (cliente: Client, m: { rodada: number; vencedor: number | null }) => {
        if (!this.mesa.conferir(cliente.sessionId, m.rodada, m.vencedor)) {
          console.warn(`[${codigo}] combate divergente:`, this.mesa.divergencias.at(-1));
        }
      },
    );

    this.clock.setInterval(() => {
      if (this.mesa.avancar(Date.now())) this.enviarVisoes();
    }, MS_DO_PASSO);
  }

  override onJoin(cliente: Client, opcoes: OpcoesDeEntrada): void {
    const erro = this.mesa.entrar(cliente.sessionId, String(opcoes?.nome ?? ""));
    if (erro) throw new Error(erro);
    this.enviarVisoes();
  }

  /** A conexão caiu sem o jogador pedir: um bot assume e a vaga fica reservada por um tempo. */
  override onDrop(cliente: Client): void {
    this.mesa.sair(cliente.sessionId, Date.now(), false);
    this.enviarVisoes();
    if (this.mesa.iniciada && !this.mesa.encerrada) {
      // Se o prazo vencer, o Colyseus chama onLeave e a vaga fica de vez com o bot.
      this.allowReconnection(cliente, SEGUNDOS_DE_RECONEXAO).catch(() => undefined);
    }
  }

  override onReconnect(cliente: Client): void {
    this.mesa.voltar(cliente.sessionId);
    this.enviarVisoes();
  }

  override onLeave(cliente: Client): void {
    this.mesa.sair(cliente.sessionId, Date.now(), true);
    this.enviarVisoes();
  }

  private enviarVisoes(): void {
    for (const cliente of this.clients) {
      const visao = this.mesa.visaoDe(cliente.sessionId);
      if (visao) cliente.send(MSG.visao, visao);
    }
  }
}
