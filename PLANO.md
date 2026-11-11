# PLANO.md — Auto-battler para 4 jogadores em arena de plataforma

Este arquivo é a fonte da verdade do projeto. Claude Code: leia inteiro antes de qualquer ação e siga as "Regras de trabalho" à risca.

## 1. Conceito

Jogo de **estratégia com combate automático** para **4 jogadores**, em 2D visto de lado.

O jogador **não controla os personagens na luta**. Ele monta o esquadrão; os personagens lutam sozinhos.

Cada partida é uma sequência de rodadas, e cada rodada tem duas fases:

1. **Preparação (com tempo limitado).** O jogador recebe elixir, compra personagens em uma loja de 3 cartas, vende, posiciona o esquadrão na arena e faz fusões: dois personagens iguais viram um de nível maior.
2. **Combate automático.** Os esquadrões se enfrentam em uma **arena de plataformas**, com as regras de um jogo de luta de plataforma: dano acumulado em **porcentagem**, arremesso que cresce com a porcentagem, e quem é jogado para fora dos limites da arena sai da rodada.

Quem perde a rodada perde vida de jogador, proporcional ao número de personagens inimigos que sobraram. Jogador com vida zerada é eliminado. Vence o último de pé (ou o último time, no modo 2x2).

**Modos:**
- **Todos contra todos (4 jogadores):** a cada rodada os jogadores são pareados em duelos.
- **2x2:** os dois esquadrões de cada time entram juntos na mesma arena; vida compartilhada pelo time.

O que torna o jogo diferente de outros auto-battlers: o combate é físico. Posição, peso, altura das plataformas e direção do arremesso importam tanto quanto os atributos.

## 2. Decisões já tomadas (não rediscutir sem pedido do André)

| Tema | Decisão |
|---|---|
| Plataforma | Navegador (desktop primeiro, celular depois) |
| Controle | Mouse e toque (arrastar e soltar). Sem teclado de luta, sem controle |
| Linguagem | TypeScript em modo estrito |
| Motor | Phaser (versão estável atual) apenas para render, áudio e entrada |
| Build | Vite |
| Testes | Vitest para a simulação; Playwright para teste de fumaça no navegador |
| Online (fase 6) | Servidor Node autoritativo com Colyseus |
| Hospedagem | Cliente na Vercel; servidor de jogo em host com WebSocket persistente (não Vercel) |
| Arte | Formas geométricas e cores por jogador até a fase 7 |

Antes de instalar qualquer dependência, confira a versão estável atual e a documentação oficial. Não confie em versões de memória.

## 3. Propriedade intelectual

Nada de nomes, personagens, sprites, sons, cartas ou textos de Clash Royale, Super Smash Bros. ou qualquer outro jogo. Tudo original. Assets de terceiros só com licença livre (CC0 ou equivalente), registrados em `CREDITOS.md`.

## 4. Arquitetura (regras que valem para todas as fases)

1. **Simulação separada do render.** `src/sim/` não importa Phaser, DOM nem nada de navegador. O render só lê o estado e desenha.
2. **Passo fixo de 60 ticks por segundo.** O combate avança por `step(estado) -> estado`. Nada de `Date.now()` ou `Math.random()` dentro dele: use o contador de ticks e um gerador de números aleatórios com semente guardado no estado.
3. **Determinismo total.** Mesma semente + mesmos esquadrões = mesmo combate, quadro a quadro. Isso é testado. É o que permite o online simples: basta enviar os esquadrões e a semente.
4. **O combate roda sem render.** Deve ser possível simular uma rodada inteira em milissegundos, para testes, bots e balanceamento.
5. **Ações do jogador como dados.** Comprar, vender, posicionar e fundir são comandos validados (`Comando -> novo estado ou erro`). Jogador humano, bot e rede usam os mesmos comandos.
6. **Conteúdo em dados.** Personagens, habilidades, sinergias e arenas ficam em JSON validados por schema em `src/dados/`. Balancear é editar número, não código.
7. **IA de personagem por máquina de estados** (procurar alvo, aproximar, atacar, usar habilidade, recuperar-se, voltar para a arena), com transições explícitas.
8. **Colisão própria e simples** (retângulos alinhados aos eixos). Não usar o motor de física do Phaser na simulação.

Estrutura de pastas:

```
src/
  sim/
    combate/    física, IA dos personagens, dano e arremesso
    economia/   elixir, loja, fusão, banco, comandos
    partida/    rodadas, pareamento, vida dos jogadores, eliminação
  dados/        JSON de personagens, sinergias, arenas + schemas
  bots/         bots que jogam a fase de preparação
  render/       cenas Phaser, câmera, HUD, loja, efeitos
  rede/         cliente de rede (fase 6)
servidor/       servidor de jogo (fase 6)
ferramentas/    simulação em lote para balanceamento
testes/
```

## 5. Regras de trabalho para o Claude Code

1. **Uma fase por vez.** Não comece a fase seguinte sem o André dizer "aprovado".
2. No início de cada fase, escreva um plano curto (até 10 linhas) do que vai criar e espere o ok.
3. Ao terminar a fase: rode testes, lint e build; todos precisam passar. Depois **pare** e entregue: como rodar, o que testar jogando (até 5 itens) e o que ficou pendente.
4. Um commit por unidade de trabalho, mensagem em português, sem commits gigantes.
5. Toda regra de jogo nova na simulação vem com teste.
6. Não adicione dependência fora da seção 2 sem perguntar.
7. Não antecipe funcionalidades de fases futuras. Não refatore o que não foi pedido.
8. Mantenha `ESTADO.md` atualizado: fase atual, o que está pronto, próximo passo, decisões novas. É o que permite retomar depois de dias parado.
9. Se uma decisão deste plano parecer errada, pare e explique em 3 linhas antes de mudar.
10. Respostas ao André: curtas, o essencial primeiro, um passo por vez.

## 6. Fases

### Fase 0 — Fundação
- Projeto Vite + TypeScript + Phaser, lint, formatador, Vitest, Playwright.
- Laço de simulação com passo fixo e render desacoplado, mostrando um retângulo parado.
- Scripts: `dev`, `test`, `lint`, `build`. `ESTADO.md` criado.

**Pronto quando:** `npm run dev` abre o jogo; os quatro scripts passam; existe um teste provando que duas execuções com a mesma semente dão o mesmo estado.

### Fase 1 — Arena e duelo automático
- Arena com chão sólido, plataformas atravessáveis e limites laterais, superior e inferior.
- Personagem com movimento por IA: andar, pular, pulo duplo, subir e descer de plataformas, voltar para a arena quando arremessado.
- Um ataque corpo a corpo. Dano em porcentagem, arremesso que cresce com a porcentagem e com o peso do alvo, atordoamento.
- Dois personagens, um de cada lado, lutando sozinhos até um sair da arena.

**Pronto quando:** dá para assistir a um duelo que termina sozinho e parece uma luta, não dois blocos se empurrando; fórmula de arremesso testada.

### Fase 2 — Combate de esquadrões
- Vários personagens por lado, com escolha de alvo.
- Quatro arquétipos: corpo a corpo, à distância (projéteis), tanque (pesado, difícil de arremessar) e assassino (rápido, pula para a retaguarda).
- Uma habilidade por personagem, com carga ou tempo de recarga.
- Fim da rodada: um lado sem personagens, ou tempo esgotado (vence quem tem mais sobreviventes; desempate por menor porcentagem somada).
- Controle de velocidade (1x, 2x) e modo de depuração mostrando caixas de acerto e alvos.

**Pronto quando:** combates 4x4 terminam sempre, sem personagem preso ou parado; a posição inicial muda o resultado de forma perceptível.

### Fase 3 — Preparação: loja, elixir e fusão
- Elixir por rodada, com teto e sobra acumulada.
- Loja com 3 cartas sorteadas de um baralho comum; comprar, vender, atualizar a loja pagando elixir.
- Banco de reservas e limite de personagens em campo, que cresce com as rodadas.
- Posicionamento arrastando para pontos válidos da arena, no próprio lado.
- Fusão: dois iguais do mesmo nível viram um de nível maior (níveis 1 a 4), com atributos melhores.
- Cronômetro da fase.

**Pronto quando:** dá para jogar preparação e combate em sequência contra um esquadrão fixo; todos os comandos têm teste, incluindo os inválidos.

### Fase 4 — Partida completa para 4 jogadores
- Laço de rodadas, pareamento no modo todos contra todos, vida dos jogadores, eliminação e classificação final.
- Modo 2x2 com vida compartilhada e os quatro esquadrões na mesma arena.
- Bots para a fase de preparação, em três níveis de dificuldade.
- Tela inicial, escolha de modo, HUD com vida e elixir de todos, tela de resultado.

**Pronto quando:** o André joga uma partida inteira contra 3 bots, nos dois modos, do início à tela de resultado.

**Marco: jogo jogável sozinho.**

### Fase 5 — Conteúdo e balanceamento
- 12 a 16 personagens, com custos de 2 a 5 de elixir.
- Sinergias: cada personagem tem duas características; reunir personagens da mesma característica dá bônus ao esquadrão.
- 2 ou 3 arenas com formatos diferentes de plataforma.
- Ferramenta de simulação em lote: milhares de partidas entre bots, com relatório de taxa de vitória por personagem, sinergia e arena.

**Pronto quando:** nenhum personagem ou sinergia passa muito de 55% de vitória na simulação em lote, e há mais de uma estratégia vencedora.

### Fase 6 — Online
- Servidor autoritativo para tudo o que é economia: elixir, loja, compras, fusões, posições.
- O servidor define a semente e os esquadrões de cada rodada; o combate é a mesma simulação determinística, com conferência do resultado.
- Salas privadas por código para 4 jogadores; vagas vazias viram bots.
- Reconexão; jogador que sai é substituído por bot.
- Sem ranking, sem contas, sem pareamento público nesta fase.

**Pronto quando:** quatro pessoas em redes diferentes jogam uma partida inteira e todos veem o mesmo combate.

### Fase 7 — Acabamento
- Arte original, animações, efeitos, som e música.
- Ajuste de tela e toque para celular.
- Tutorial curto, menu, opções.

## 7. Fora de escopo (até o André pedir)

Controle direto dos personagens em combate, loja de dinheiro real, moedas, progressão entre partidas, ranking, contas de usuário, pareamento público, replay, chat, 3D, versão para lojas de aplicativo.

## 8. Riscos conhecidos

- **IA em arena de plataforma:** personagens presos, pulando sem parar ou caindo sozinhos estragam o jogo. É o risco técnico principal; por isso as fases 1 e 2 vêm antes de qualquer economia.
- **Combate ilegível:** com 8 a 16 personagens se arremessando, o jogador precisa entender por que ganhou ou perdeu. Cores por jogador, câmera e efeitos claros desde cedo.
- **Aleatoriedade demais:** o arremesso amplifica pequenas diferenças. Se o resultado parecer sorte, reduzir variação antes de criar conteúdo.
- **Arte:** é o maior gargalo fora do código. Fica para o fim de propósito.
