import { Client, type Room } from "@colyseus/sdk";
import {
  MSG,
  NOME_DA_SALA,
  type ComandoDoCliente,
  type OpcoesDeEntrada,
  type Visao,
} from "./protocolo";

/** Onde guardar o token de reconexão: sobrevive a recarregar a página, mas não a fechar a aba. */
const CHAVE_DO_TOKEN = "arena:reconexao";

export interface Ouvintes {
  aoVisao: (visao: Visao) => void;
  aoErro: (erro: string) => void;
  /** A conexão caiu e o cliente está tentando voltar sozinho. */
  aoCair: () => void;
  aoVoltar: () => void;
  /** Saiu de vez da sala (por vontade própria, ou porque não conseguiu reconectar). */
  aoSair: () => void;
}

/** Endereço do servidor de jogo: variável VITE_SERVIDOR no build, ou a porta 2567 desta máquina. */
export function enderecoDoServidor(): string {
  const configurado: unknown = import.meta.env["VITE_SERVIDOR"];
  if (typeof configurado === "string" && configurado.length > 0) return configurado;
  const seguro = window.location.protocol === "https:";
  return `${seguro ? "wss" : "ws"}://${window.location.hostname}:2567`;
}

/** Uma conexão com uma sala do servidor. Só transporta mensagens; não tem regra de jogo. */
export class ConexaoOnline {
  private constructor(
    private readonly sala: Room,
    ouvintes: Ouvintes,
  ) {
    sala.onMessage(MSG.visao, (v: Visao) => ouvintes.aoVisao(v));
    sala.onMessage(MSG.erro, (m: { erro: string }) => ouvintes.aoErro(m.erro));
    sala.onDrop(() => ouvintes.aoCair());
    sala.onReconnect(() => {
      this.guardarToken();
      ouvintes.aoVoltar();
    });
    sala.onLeave(() => {
      window.sessionStorage.removeItem(CHAVE_DO_TOKEN);
      ouvintes.aoSair();
    });
    this.guardarToken();
  }

  get codigo(): string {
    return this.sala.roomId;
  }

  private guardarToken(): void {
    window.sessionStorage.setItem(CHAVE_DO_TOKEN, this.sala.reconnectionToken);
  }

  static async criar(opcoes: OpcoesDeEntrada, ouvintes: Ouvintes): Promise<ConexaoOnline> {
    const sala = await new Client(enderecoDoServidor()).create(NOME_DA_SALA, opcoes);
    return new ConexaoOnline(sala, ouvintes);
  }

  static async entrar(codigo: string, nome: string, ouvintes: Ouvintes): Promise<ConexaoOnline> {
    const sala = await new Client(enderecoDoServidor()).joinById(codigo.trim().toUpperCase(), {
      nome,
    });
    return new ConexaoOnline(sala, ouvintes);
  }

  /** Depois de recarregar a página: tenta voltar para a sala em que estava. */
  static async retomar(ouvintes: Ouvintes): Promise<ConexaoOnline | null> {
    const token = window.sessionStorage.getItem(CHAVE_DO_TOKEN);
    if (!token) return null;
    try {
      const sala = await new Client(enderecoDoServidor()).reconnect(token);
      return new ConexaoOnline(sala, ouvintes);
    } catch {
      window.sessionStorage.removeItem(CHAVE_DO_TOKEN);
      return null;
    }
  }

  comando(comando: ComandoDoCliente): void {
    this.sala.send(MSG.comando, comando);
  }

  comecar(): void {
    this.sala.send(MSG.comecar);
  }

  conferir(rodada: number, vencedor: number | null): void {
    this.sala.send("conferir", { rodada, vencedor });
  }

  async sair(): Promise<void> {
    window.sessionStorage.removeItem(CHAVE_DO_TOKEN);
    await this.sala.leave(true);
  }
}
