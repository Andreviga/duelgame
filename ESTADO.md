# ESTADO.md

## Fase atual

**Fase 2 — Combate de esquadrões: concluída, aguardando "aprovado" do André.**

Fases 0 e 1 aprovadas em 2026-11-11. Repositório: https://github.com/Andreviga/duelgame (branch `main`).

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

## Números do lote

**4x4 (1.800 combates, 9 confrontos de formação, mesmos personagens dos dois lados):**
- 0 por tempo, 0 quedas sem ter sido arremessado, 1 empate.
- Duração: 10 s a 54 s, mediana 24 s. Os 1.800 combates rodam em 12 s (menos de 7 ms cada).
- A posição muda o resultado: "tanque na frente" vence "atirador na frente" em 65% (130 a 70) de um lado e 58,5% (117 a 83) do outro. Formações iguais ficam em 50%.

**1x1 (2.000 duelos, Fase 1):** 0 por tempo, 0 quedas sozinhas; 7 s a 49 s, mediana 21 s.

## Comandos

- `npm run dev`: abre o jogo em http://localhost:5173. Parâmetros no endereço: `?semente=N`, `&debug`, `&velocidade=2`.
- `npm test`: Vitest (simulação)
- `npm run lint`: tipos + ESLint + Prettier (checagem)
- `npm run build`: checagem de tipos + build de produção
- `npm run test:e2e`: teste de fumaça no navegador (Playwright). Na primeira vez, rode `npx playwright install chromium`. Para usar outro Chromium: `CHROMIUM_PATH=/caminho npm run test:e2e`.
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

## Próximo passo

Fase 3 — Preparação: loja, elixir e fusão (depois do "aprovado" e do ok no plano da fase).
