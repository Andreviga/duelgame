# Como publicar o jogo online

São duas partes: o **servidor de jogo** (Node + Colyseus, precisa de WebSocket ligado o tempo todo)
e o **cliente** (o site, arquivos estáticos).

## 1. Servidor de jogo (Render)

O repositório já tem o `Dockerfile` e o `render.yaml`.

1. Em https://render.com, entre com a conta do GitHub.
2. **New > Blueprint**, escolha o repositório `duelgame` e confirme. O Render lê o `render.yaml`
   e cria o serviço `duelgame-servidor`.
3. Espere o primeiro deploy terminar. Os registros devem mostrar `servidor de jogo ouvindo na porta ...`.
4. Anote o endereço público, algo como `https://duelgame-servidor.onrender.com`.

Limites do plano gratuito do Render: o serviço **dorme depois de uns 15 minutos sem uso** e leva
cerca de um minuto para acordar. Na prática, quem cria a primeira sala do dia espera esse minuto
(o jogo mostra "criando a sala…"). Uma partida em andamento não dorme. Para ficar sempre ligado,
troque `plan: free` por um plano pago no `render.yaml`.

Use **uma instância só**: as salas ficam na memória do processo.

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
