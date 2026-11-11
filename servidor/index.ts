import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { NOME_DA_SALA } from "../src/rede/protocolo";
import { SalaDeJogo } from "./SalaDeJogo";

/**
 * Servidor de jogo. Usa a mesma simulação do cliente (`src/sim`), então o combate que o
 * servidor calcula é o mesmo que cada jogador assiste.
 * Porta: variável PORT (os serviços de hospedagem definem), ou 2567.
 */
export async function iniciarServidor(porta: number): Promise<Server> {
  const servidor = new Server({ transport: new WebSocketTransport() });
  servidor.define(NOME_DA_SALA, SalaDeJogo);
  await servidor.listen(porta);
  return servidor;
}

if (process.env["SERVIDOR_EM_TESTE"] !== "1") {
  const porta = Number(process.env["PORT"] ?? 2567);
  iniciarServidor(porta)
    .then(() => console.log(`servidor de jogo ouvindo na porta ${porta}`))
    .catch((erro: unknown) => {
      console.error("o servidor não subiu:", erro);
      process.exit(1);
    });
}
