# ESTADO.md

## Fase atual

**Fase 1 — Arena e duelo automático: concluída, aguardando "aprovado" do André.**

Fase 0 aprovada em 2026-11-11.

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

## Números do lote (2.000 duelos, personagens iguais)

- 0 empates por tempo, 0 quedas sem ter sido arremessado, 1 empate por queda dupla.
- Vitórias: 991 a 1008. Duração: 7 s a 49 s, mediana 21 s. Dano final mediano: 93%.

## Comandos

- `npm run dev`: abre o jogo em http://localhost:5173. `?semente=N` escolhe a semente do primeiro duelo.
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

## Próximo passo

Fase 2 — Combate de esquadrões (depois do "aprovado" e do ok no plano da fase).
