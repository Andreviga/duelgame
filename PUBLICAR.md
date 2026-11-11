# Como publicar o jogo online

São duas partes: o **servidor de jogo** (Node + Colyseus, precisa de WebSocket ligado o tempo todo)
e o **cliente** (o site, arquivos estáticos).

## 1. Servidor de jogo

Qualquer hospedagem que rode um contêiner Docker com WebSocket serve (Render, Fly.io, Railway).
O repositório já tem o `Dockerfile`.

1. Crie um serviço web apontando para este repositório, usando o `Dockerfile` da raiz.
2. A hospedagem define a variável `PORT`; o servidor escuta nela (sem ela, usa 2567).
3. Use **uma instância só**. As salas ficam na memória do processo; com mais de uma instância,
   quem entra pelo código pode cair na instância errada.
4. Anote o endereço público, por exemplo `https://meu-jogo.onrender.com`.

Para conferir que subiu: os registros devem mostrar `servidor de jogo ouvindo na porta ...`.

## 2. Cliente (Vercel)

1. Importe o repositório na Vercel. Comando de build: `npm run build`. Pasta de saída: `dist`.
2. Crie a variável de ambiente `VITE_SERVIDOR` com o endereço do servidor em WebSocket seguro,
   por exemplo `wss://meu-jogo.onrender.com`.
3. Publique. O modo contra bots funciona mesmo sem servidor; "Criar sala" e "Entrar com código"
   dependem dele.

## 3. Jogar na rede de casa, sem publicar

```bash
npm run servidor
```

```bash
npm run dev -- --host
```

O primeiro comando sobe o servidor na porta 2567; o segundo mostra o endereço da rede local
(algo como `http://192.168.0.10:5173`). Os outros jogadores abrem esse endereço no navegador.
Sem `VITE_SERVIDOR`, o cliente procura o servidor na porta 2567 da mesma máquina que serviu a página.

## Variáveis

| Onde | Variável | Para quê |
|---|---|---|
| Servidor | `PORT` | Porta em que o servidor escuta (padrão 2567). |
| Servidor | `ESCALA_DE_TEMPO` | Acelera os relógios da sala. Só para testes; em produção, não defina. |
| Cliente (build) | `VITE_SERVIDOR` | Endereço do servidor, com `ws://` ou `wss://`. |
