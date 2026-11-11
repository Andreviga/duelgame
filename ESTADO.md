# ESTADO.md

## Fase atual

**Fase 4 — Partida completa para 4 jogadores: concluída, aguardando "aprovado" do André.**

Fases 0 a 3 aprovadas em 2026-11-11. Repositório: https://github.com/Andreviga/duelgame (branch `main`).

O André enviou em 2026-11-11 um `PLANO.md` novo (fases 7 a 9 refeitas, seção 9 "Definição de 100%") e o `ELENCO.md` (12 personagens, mundos e papéis). Os dois estão no repositório. O elenco é o conteúdo da Fase 5; os quatro personagens atuais (lutador, atirador, tanque, assassino) são provisórios e saem nessa fase.

## Definição de 100% (seção 9 do plano)

- [ ] `npm run test`, `lint` e `build` passam sem aviso. *Hoje: passam (115 testes); o build não emite aviso.*
- [ ] Determinismo: 1.000 combates repetidos com a mesma semente dão resultado idêntico. *Hoje: testado quadro a quadro em 1x1 e 4x4 e em partida inteira; falta o lote de 1.000.*
- [ ] 10.000 combates simulados terminam sem personagem preso e sem estourar o tempo. *Hoje: 1.800 combates 4x4, 0 por tempo, 0 quedas sozinhas.*
- [ ] Nenhum personagem, mundo ou papel passa de 55% de vitória. *Fase 5.*
- [ ] Partida completa contra 3 bots nos dois modos, do menu à tela de resultado, sem erro no console. *Automatizado em `npm run test:e2e` (2026-11-11); falta o André jogar.*
- [ ] Partida online completa com 4 pessoas. *Fase 6.*
- [ ] Os 12 personagens com todas as animações. *Fase 7.*
- [ ] Som e efeitos em todos os eventos da Fase 8. *Efeitos visuais já existem; som não.*
- [ ] Jogável no celular por toque, a 60 quadros por segundo. *Fase 9.*
- [ ] Tutorial concluído por uma pessoa de fora sem ajuda. *Fase 8.*
- [ ] `CREDITOS.md` lista cada asset de terceiros. *Hoje não há nenhum asset de terceiros.*

## Pronto

### Fase 0
- Vite + TypeScript estrito + Phaser 4, com ESLint, Prettier, Vitest e Playwright.
- Laço de passo fixo (`src/sim/laco.ts`), 60 ticks por segundo, gerador com semente no estado.
- O lint bloqueia, dentro de `src/sim/`: import de Phaser ou render, `Math.random`, `Date.now`, `new Date`, `window`, `document`, timers.

### Fase 1
- **Dados** (`src/dados/`): `arena-basica.json` e `personagens.json`, validados por schema escrito à mão (`schemas.ts`), com erro que diz o campo.
- **Física** (`src/sim/combate/fisica.ts`): gravidade, chão sólido (bloqueia por todos os lados), plataformas atravessáveis (só seguram quem cai; dá para descer), pulo e pulo duplo, limites da arena.
- **Arremesso** (`arremesso.ts`): `força = (base + crescimento × %) × (100 / peso)`; atordoamento `6 + 1,8 × força` ticks.
- **IA** (`ia.ts`): máquina de estados `procurar → aproximar → atacar → recuar`, mais `recuperar` (atordoado) e `voltar` (fora do chão: anda para o centro e guarda o pulo). Nunca anda para fora da beirada. Tempo de reação sorteado antes de cada golpe.
- **Combate** (`combate.ts`): golpe com início, janela de acerto e recuperação; dano e ângulo com pequena variação (±10% e ±7°); eventos por tick para o render.
- **Render** (`src/render/`): câmera que enquadra os lutadores, placar com % por jogador, cronômetro, faixa de vencedor e reinício automático com a semente seguinte. Efeitos só de render: pausa no golpe, tremor, faíscas, rastro, esticar e achatar, giro no arremesso, explosão e câmera lenta na eliminação.
- **Testes** (34): fórmula de arremesso, física, golpe, determinismo quadro a quadro, regras de fim, schemas e um lote de 300 duelos.

### Fase 2
- **Esquadrões:** `criarCombate(arena, [esquadrãoA, esquadrãoB], semente)`; cada vaga tem personagem e posição inicial. `criarDuelo` é o atalho 1x1.
- **Quatro arquétipos** em `personagens.json`: lutador (corpo a corpo), atirador (à distância, projéteis), tanque (pesado, golpe forte) e assassino (leve e rápido).
- **Escolha de alvo** (`escolherAlvo`): o mais próximo; o assassino caça atiradores; o atirador mira a maior porcentagem ao alcance. Quem está fora do chão conta como mais longe. O alvo atual é mantido se o outro só estiver um pouco mais perto.
- **Projéteis:** retângulos em linha reta, com tempo de vida; acertam o primeiro inimigo, não acertam aliados, somem no chão sólido.
- **Habilidades** com recarga, em JSON: investida (lutador), rajada (atirador), pisão (tanque) e salto para trás do alvo (assassino). Ser atingido cancela.
- **Fim por tempo:** mais sobreviventes vence; no empate, a menor porcentagem somada.
- **Formações** em `formacoes.json` (3), validadas contra a arena e os personagens.
- **Render:** silhueta por arquétipo, cor por time, porcentagem e barra de recarga da habilidade acima de cada personagem, placar por time, botões de velocidade (1x/2x, tecla V) e depuração (tecla D): caixas do corpo, do golpe e dos projéteis, linha até o alvo e estado da IA.
- **Testes** (59): alvo, projéteis, cada habilidade, espaço entre aliados, regras de fim, determinismo 4x4, lote 4x4 e efeito da posição inicial.

### Fase 3
- **Economia por comandos** (`src/sim/economia/`): `aplicar(estado, contexto, comando)` devolve o estado novo ou um erro com código. Comandos: `comprar`, `vender`, `atualizar`, `posicionar`, `recolher`, `pronto`. Já aceita vários jogadores (o comando leva o número do jogador) e um baralho comum.
- **Elixir:** ganho por rodada que cresce (4 + rodada, até 10), sobra acumulada, teto de 20.
- **Loja:** 3 cartas sorteadas do baralho comum com o gerador com semente; a carta comprada sai, a vendida volta; atualizar custa 1.
- **Banco** de 6 e **limite de campo** por rodada (2, 2, 3, 3, 4, 4, 5, 5, 6).
- **Fusão automática:** dois iguais do mesmo nível viram um de nível maior (1 a 4), em cadeia; fica quem está em campo. Banco cheio não impede a compra que funde.
- **Níveis:** multiplicadores de dano, peso e tamanho em `economia.json`, aplicados ao montar o esquadrão.
- **Pontos de posicionamento** no JSON da arena (5 no chão, 3 em plataformas), validados; o lado direito usa o espelho.
- **Cronômetro** da preparação em ticks, na simulação (40 s). Ao zerar, o combate começa com o que estiver em campo.
- **Tela de preparação** (`CenaPreparacao`): clicar na carta compra; arrastar do banco para um ponto posiciona; arrastar para a loja vende; arrastar do campo para o banco recolhe. Mostra o adversário da rodada, o limite de campo, o elixir, avisos de erro e de fusão.
- **Laço preparação → combate → preparação** contra um esquadrão fixo por rodada (`adversarios.json`, 8 rodadas, cada vez mais forte).
- **Testes** (90): 29 da economia (todos os comandos e seus inválidos, conservação de cartas em 400 comandos sorteados), mais schemas novos.

### Fase 4
- **Partida** (`src/sim/partida/`): `criarPartida`, `combater` (simula todos os confrontos da rodada sem tela) e `concluirRodada` (vida, eliminação, classificação, próxima rodada). Substitui a sessão provisória da Fase 3.
- **Todos contra todos:** duelos sorteados a cada rodada, evitando repetir o último adversário. Com três vivos, quem sobra enfrenta uma cópia ("fantasma") do esquadrão de outro jogador, que não perde vida por isso.
- **Vida:** 20 por jogador; a derrota custa 2 + 1 por inimigo que sobrou, mais 1 a cada 5 rodadas (`partida.json`). Vida zerada elimina e devolve as cartas ao baralho.
- **2x2:** jogadores 0 e 1 contra 2 e 3, todos na mesma arena, com vida do time. O segundo de cada lado usa `pontosAliado` da arena. Cada personagem guarda o dono.
- **Bots** (`src/bots/`) em três níveis, usando os mesmos comandos do jogador: fácil (compra ao acaso, posição sorteada), médio (busca fusões, atualiza a loja uma vez, tanque na frente) e difícil (atualiza mais, vende sobras e ensaia três formações contra o adversário da rodada antes de escolher).
- **Telas:** inicial (modo e dificuldade), preparação (lista dos quatro jogadores com vida e elixir, campo real do adversário da rodada e do aliado), combate (uma cor por jogador, placar por lado, vidas no topo, velocidade 1x/2x/4x) e resultado (classificação e "jogar de novo").
- **Jogador eliminado** continua assistindo: os combates seguem direto, e dá para acelerar em 4x.
- **Conferência de determinismo na tela:** o combate assistido é comparado com o que foi simulado sem tela; divergência vira erro no console.
- **Testes** (115): pareamento, vida, eliminação, fantasma, classificação, 2x2, cada nível de bot só emite comandos válidos, partidas inteiras entre bots nos dois modos, e bots melhores terminam em posições melhores.
- **Teste de navegador** (4): do menu ao combate à mão; partida inteira nos dois modos até a tela de resultado (com `?auto`); demonstração.

## Números do lote

**4x4 (1.800 combates, 9 confrontos de formação, mesmos personagens dos dois lados):**
- 0 por tempo, 0 quedas sem ter sido arremessado, 1 empate.
- Duração: 10 s a 54 s, mediana 24 s. Os 1.800 combates rodam em 12 s (menos de 7 ms cada).
- A posição muda o resultado: "tanque na frente" vence "atirador na frente" em 65% (130 a 70) de um lado e 58,5% (117 a 83) do outro. Formações iguais ficam em 50%.

**1x1 (2.000 duelos, Fase 1):** 0 por tempo, 0 quedas sozinhas; 7 s a 49 s, mediana 21 s.

## Comandos

- `npm run dev`: abre o jogo em http://localhost:5173. Parâmetros no endereço: `?semente=N`, `&debug`, `&velocidade=2` (ou 4), `&demo` (combate 4x4 solto), `&auto` (o seu jogador também é um bot: a partida anda sozinha), `&modo=duplas`.
- `npm test`: Vitest (simulação)
- `npm run lint`: tipos + ESLint + Prettier (checagem)
- `npm run build`: checagem de tipos + build de produção
- `npm run test:e2e`: testes no navegador (Playwright), cerca de 3 minutos. Na primeira vez, rode `npx playwright install chromium`. Para usar outro Chromium: `CHROMIUM_PATH=/caminho npm run test:e2e`.
- `npm run format`: formata tudo

## Versões (conferidas em 2026-11-11)

phaser 4.2.1 · vite 8.3.8 · typescript 6.0.3 · vitest 5.1.0 · @playwright/test 1.65.0 · eslint 10.14.0 · typescript-eslint 8.72.2 · prettier 3.10.0

## Decisões novas

### Fase 0
- **TypeScript 6.0.3, e não o 7.0.2:** o typescript-eslint 8.72 só aceita TypeScript abaixo de 6.1. Rever quando o typescript-eslint suportar o 7.
- Os arquivos de config da raiz (`*.config.ts`) ficam fora do `tsc`, para não precisar de `@types/node`.
- O `npm test` roda só o Vitest. O Playwright fica em `npm run test:e2e`.
- `PLANO.md` e `ESTADO.md` ficam fora do Prettier.
- O `npm audit` aponta um aviso moderado (minimatch) dentro do ESLint e do typescript-eslint. Só ferramentas de desenvolvimento.

### Fase 1
- **Polimento visual adiantado a pedido do André** ("faz tudo que consegue"): os efeitos de impacto entraram na Fase 1, só no render. Som, arte e música continuam na Fase 7.
- **Regra de fim de rodada:** quando um lado fica sem ninguém, a rodada só é decidida quando os sobreviventes voltam a pisar em algo. Se o último também cair, é empate. Evita o "vencedor" que sai da arena logo depois.
- **Tempo de reação na IA:** sem ele os dois batiam no mesmo tick e a luta ficava espelhada (porcentagens iguais).
- **Sem colisão de corpo entre personagens:** eles podem se sobrepor; a IA mantém distância.
- **Schema à mão** em TypeScript, para não adicionar dependência de validação.
- **Efeitos usam `Math.random`** (só cosmético, em `src/render/`); a simulação continua só com o gerador com semente.
- **Texto girado sai com falhas no Phaser 4.2.1** (pedaços do número somem). O placar treme por posição, sem rotação.
- O `lint` agora também roda `tsc --noEmit`.
- Limite de tempo da rodada: 99 s. No tempo esgotado vence quem tem menos dano.

### Fase 2
- **Aliados se afastam de leve** (até 1 px por tick) quando estão no mesmo piso, para não ficarem empilhados. Inimigos continuam podendo se sobrepor.
- **Voltar para a arena tem prioridade** sobre golpe e habilidade em andamento. Sem isso, quem escorregava da beirada no meio de uma habilidade caía sem reagir.
- **Impulso** (investida, salto) é cortado perto da beirada, e no meio do salto a IA não gasta o pulo do ar.
- **Habilidade começa a rodada com 40% da recarga por cumprir**, para não saírem todas no primeiro segundo.
- **Pausa no golpe só nos golpes fortes** (força 9 ou mais): com oito lutando, pausar em todo golpe travava a luta.
- **A tela de demonstração troca a formação a cada rodada** (semente), para dar para comparar posições. A escolha de formação pelo jogador é da Fase 3.
- Balanceamento entre arquétipos não foi feito (é da Fase 5); só foi garantido que os combates terminam.

### Fase 3
- **Venda:** nível 1 devolve o custo inteiro; níveis maiores devolvem 75% do investido (arredondado para baixo).
- **Ponto ocupado troca:** soltar um personagem do banco sobre um ponto ocupado troca os dois, mesmo com o campo cheio.
- **A sessão de jogo (rodada, vitórias, derrotas) fica em `src/render/sessao.ts`** por enquanto. Na Fase 4 vira `src/sim/partida`, com vida dos jogadores e pareamento.
- **Perder a rodada ainda não tem consequência** (vida de jogador é da Fase 4).
- **Custos provisórios:** lutador 2; atirador, tanque e assassino 3. O plano pede 2 a 5 na Fase 5.
- **Ícone da página embutido no `index.html`**, para o navegador não acusar 404 do favicon.

### Fase 4
- **Bots jogam no começo da preparação**, de uma vez. Por isso a tela mostra o campo que o adversário já montou nesta rodada.
- **Seu combate é assistido; os outros são só simulados.** O resultado de todos é calculado quando a preparação acaba.
- **Empate não tira vida de ninguém.** Para a partida não se arrastar, a derrota fica mais cara a cada 5 rodadas.
- **Classificação:** quem sobrevive primeiro; depois, quem caiu mais tarde; no empate, quem tinha mais vida.
- **"Guardar elixir" do bot difícil ficou de fora:** sem juros sobre elixir guardado, guardar não traz vantagem. No lugar, ele ensaia formações.
- **Limite de tempo dos testes subiu para 120 s** (`vitest.config.ts`): o bot difícil simula combates e passa dos 5 s padrão.
- **Nome provisório na tela inicial:** "Arena de Esquadrões".
- A cópia antiga do projeto em `/home/user` (fora de `duelgame/`) não é mais usada.

## Próximo passo

Fase 5 — Conteúdo e balanceamento, com os 12 personagens e as sinergias do `ELENCO.md` (depois do "aprovado" e do ok no plano da fase).
