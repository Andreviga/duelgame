# ESTADO.md

## Fase atual

**Fase 0 — Fundação: concluída, aguardando "aprovado" do André.**

## Pronto

- Vite + TypeScript estrito + Phaser 4, com ESLint, Prettier, Vitest e Playwright.
- `src/sim/`: estado com `tick`, gerador com semente (mulberry32) guardado no estado, `step(estado) -> estado` puro, a 60 ticks por segundo.
- `src/sim/laco.ts`: acumulador de passo fixo. O render passa o tempo decorrido e o laço roda ticks inteiros, no máximo 5 por quadro.
- `src/render/CenaArena.ts`: só lê o estado e desenha um retângulo parado e o contador de ticks.
- O lint bloqueia, dentro de `src/sim/`: import de Phaser ou render, `Math.random`, `Date.now`, `new Date`, `window`, `document`, timers.
- Testes: mesma semente dá o mesmo estado (90 s simulados); o fatiamento do tempo real não muda o resultado; `step` não altera a entrada.

## Comandos

- `npm run dev`: abre o jogo em http://localhost:5173
- `npm test`: Vitest (simulação)
- `npm run lint`: ESLint + Prettier (checagem)
- `npm run build`: checagem de tipos + build de produção
- `npm run test:e2e`: teste de fumaça no navegador (Playwright). Na primeira vez, rode `npx playwright install chromium`. Para usar outro Chromium: `CHROMIUM_PATH=/caminho npm run test:e2e`.
- `npm run format`: formata tudo

## Versões (conferidas em 2026-11-11)

phaser 4.2.1 · vite 8.3.8 · typescript 6.0.3 · vitest 5.1.0 · @playwright/test 1.65.0 · eslint 10.14.0 · typescript-eslint 8.72.2 · prettier 3.10.0

## Decisões novas

- **TypeScript 6.0.3, e não o 7.0.2:** o typescript-eslint 8.72 só aceita TypeScript abaixo de 6.1. Rever quando o typescript-eslint suportar o 7.
- Os arquivos de config da raiz (`*.config.ts`) ficam fora do `tsc`, para não precisar de `@types/node`. O ESLint continua checando esses arquivos.
- O `npm test` roda só o Vitest. O Playwright fica em `npm run test:e2e`.
- `PLANO.md` e `ESTADO.md` ficam fora do Prettier, para o texto do plano não ser reformatado.
- O `npm audit` aponta um aviso moderado (minimatch) dentro do ESLint e do typescript-eslint. Afeta só ferramentas de desenvolvimento; não foi feito downgrade.

## Próximo passo

Fase 1 — Arena e duelo automático (depois do "aprovado" e do ok no plano da fase).
