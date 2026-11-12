# ESTADO.md

## Fase atual

**Fase 7B — os outros 11 personagens, por mundo: Dojo e Piratas aprovados; Futebol pronto (Maestro, Paredão e Ponta), aguardando a aprovação visual do André.**

Fase 7A aprovada em 2026-11-12 (Lâmina). Na 7B a aprovação é por mundo, na ordem Dojo, Piratas, Futebol, Monstros. Feitos: 9 de 12 (Dojo, Piratas e Futebol).

Fases 0 a 6 aprovadas em 2026-11-11. Repositório: https://github.com/Andreviga/duelgame (branch `main`).

Pendências herdadas:
- Fase 6: publicar o servidor e jogar com 4 pessoas em redes diferentes (`PUBLICAR.md`).

## Definição de 100% (seção 9 do plano)

- [ ] `npm run test`, `lint` e `build` passam sem aviso. *Hoje: passam (186 testes); o build não emite aviso.*
- [x] Determinismo: 1.000 combates repetidos com a mesma semente dão resultado idêntico. *`npm run lote` com `LOTE_DETERMINISMO=1000`: 0 divergiram (2026-11-11, `relatorios/lote-fase5.md`).*
- [x] 10.000 combates simulados terminam sem personagem preso e sem estourar o tempo. *`LOTE_COMBATES=10000`: 0 por tempo, 0 quedas sem arremesso (2026-11-11, `relatorios/lote-fase5.md`).*
- [ ] Nenhum personagem, mundo ou papel passa de 55% de vitória. *Personagens: sim. Trios: perto de 55% depois do ajuste de 2026-11-12; o Dojo (perto de 57%) ainda passa. Ver "Números do lote".*
- [ ] Partida completa contra 3 bots nos dois modos, do menu à tela de resultado, sem erro no console. *Automatizado em `npm run test:e2e`; falta o André jogar.*
- [ ] Partida online completa com 4 pessoas em redes diferentes, com uma reconexão no meio. *Automatizado na mesma máquina: 4 clientes de rede jogam a partida inteira (`testes/servidor.test.ts`) e duas abas com reconexão (`npm run test:e2e`). Falta publicar e jogar com 4 pessoas.*
- [ ] Os 12 personagens com todas as animações. *Pipeline pronto (Fase 7A); 9 de 12 modelados (Dojo e Piratas aprovados; Futebol aguardando aprovação).*
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

### Fase 5
- **Elenco:** os 12 personagens do `ELENCO.md` em `personagens.json` (3 por mundo, 3 por papel; custos 2, 2, 3×5, 4×3, 5×2). Os quatro provisórios saíram.
- **Habilidades** (11 tipos na simulação, cada uma com teste): bola que persegue e quica (Maestro), devolver projétil (Paredão), carrinho (Ponta), gancho (Capitã Maré), tiro de canhão (Canhoneiro), área (Âncora e Brasa), cadeia (Faísca), casco (Rochedo), investida (Lâmina), teleporte (Sombra) e tufão (Mestre Vento).
- **Sinergias** em `sinergias.json`: mundo e papel, com degraus em 2 e em 3 personagens diferentes em campo. Cópias do mesmo personagem contam uma vez.
- **Mecânicas novas:** primeiro golpe com bônus (crítico), invisibilidade (não pode ser alvo), projétil que atravessa, proteção de quem está perto de um tanque aliado, explosão ao sair da arena e elixir extra ao vencer.
- **Arenas:** três (`arena-basica`, `arena-larga`, `arena-torre`), uma sorteada por partida. As três têm o mesmo número de pontos de posicionamento.
- **Telas:** carta com mundo, papel e nome da habilidade; painel de sinergias na preparação (ativas e quanto falta); sinergias de cada lado no combate; emblema do mundo no corpo do personagem; efeitos para as habilidades novas.
- **Bots** preferem cartas que fazem sinergia com o que já têm.
- **Ferramenta de lote** (`npm run lote`, em `ferramentas/lote.ts`): taxa de vitória por personagem, característica e arena, com times de mesmo orçamento; medição pareada de cada sinergia (mesmos combates com e sem o bônus); conferência de determinismo. `ferramentas/ajustar.py` edita números dos JSON pela linha de comando.
- **Testes** (149): cada habilidade, cada sinergia nos dois degraus (lendo os valores do JSON), mecânicas novas, elixir de Piratas na partida.

### Fase 6
- **Dependências novas** (Colyseus 0.18, conferido em 2026-11-11): `@colyseus/core` 0.18.28 e `@colyseus/ws-transport` 0.18.5 no servidor; `@colyseus/sdk` 0.18.10 no cliente.
- **Mesa** (`servidor/mesa.ts`): toda a lógica da sala online, sem rede. Quem está sentado, a partida, os relógios, quem vê o quê. Usa a mesma simulação do jogo local (`src/sim`) e os mesmos bots.
- **Servidor autoritativo:** o cliente só manda comandos, sem dizer de quem são; o servidor usa a vaga de quem mandou e valida com o mesmo `aplicar`. Comando inválido volta como erro.
- **Visão por jogador:** cada um recebe a própria loja e o próprio banco; dos outros, só o campo (que é público). O baralho e os geradores aleatórios não saem do servidor.
- **Combate:** ao fim da preparação o servidor simula todos os combates e manda os resultados; cada cliente simula o próprio com a mesma semente e avisa o que viu. Divergência fica registrada no servidor e vale o resultado dele.
- **Sala** (`servidor/SalaDeJogo.ts`): sala privada com código de 4 letras; até 4 jogadores; o primeiro é o anfitrião e começa a partida; vagas vazias viram bots.
- **Reconexão:** quem cai é jogado por um bot e tem 60 s para voltar à mesma vaga (o cliente tenta sozinho; recarregar a página também volta). Depois do prazo, ou se sair de propósito, o bot fica até o fim.
- **Cliente** (`src/rede/`): "Criar sala online" e "Entrar com código" no menu, sala de espera, aviso de conexão perdida. As telas de preparação, combate e resultado são as mesmas do jogo contra bots, lendo o estado que vem do servidor.
- **Online, você pode lutar do lado direito** da arena (quem tem o número maior no duelo). A preparação mostra seus pontos do lado em que você vai lutar.
- **Publicação:** `Dockerfile` do servidor e `PUBLICAR.md` com o passo a passo (servidor em host com WebSocket, cliente na Vercel com `VITE_SERVIDOR`).
- **Testes** (169): mesa (sala, comandos, visões, relógios, partida inteira nos dois modos com conferência do combate, queda e reconexão) e integração com o servidor Colyseus de verdade (4 clientes de rede, sala cheia, saída no meio). No navegador (5): mais o fluxo online com duas abas e recarga.

### Fase 7A
- **`npm run arte`** gera do zero os sprites de cada personagem de `arte/personagens.json`: Blender → quadros → validação → atlas → lista em `src/dados/sprites.json`.
- **`ferramentas/arte/render_sprites.py`** (Blender 5.3): câmera lateral ortográfica, mesma luz e enquadramento para todos, pés na mesma linha de base, fundo transparente, quadros de 256×256. Usa o Cycles na CPU com semente fixa, então roda sem placa de vídeo e gera sempre os mesmos arquivos.
- **`ferramentas/arte/rodar_blender.py`** usa o programa `blender` se existir, ou o módulo Python `bpy`.
- **`src/dados/animacoes.json`**: as 9 animações, quantos quadros e se é laço. Lido pelo Blender, pela ferramenta de atlas e pelo jogo.
- **`ferramentas/arte/montar_atlas.ts`** com PNG lido e escrito à mão (`png.ts`, sem dependência) e a validação (`atlas.ts`): animação ausente, número de quadros errado, quadro sobrando, tamanho errado, quadro vazio, quadro repetido em `andar`.
- **No jogo** (`src/render/animacao.ts` e `CenaCombate`): personagem com atlas aparece como sprite, espelhado quando vira para a esquerda; a animação é escolhida pelo estado da simulação (arremessado > atingido > habilidade > atacar > pular/cair > andar > parado); nocaute por meio segundo depois de sair da arena. A cor do jogador vai no contorno e em um anel no chão. A simulação não mudou.
- **Modelos por script** (`ferramentas/arte/modelos/`): `humanoide.py` monta esqueleto, corpo e as 7 ações comuns; `lamina.py` define o Lâmina (quimono vermelho, espada nas costas) e as ações `atacar` e `habilidade`.
- **Testes** (186): PNG, cada regra da validação com quadros defeituosos de propósito, formato do atlas, e a escolha de animação a partir do estado.

## Números do lote

Relatório completo: `relatorios/lote-fase5.md` (gerado em 2026-11-11 com `LOTE_COMBATES=10000 LOTE_SINERGIAS=1000 LOTE_DETERMINISMO=1000 npm run lote`).

**10.000 combates** (times sorteados com 14 de elixir, até 4 em campo, nas três arenas):
- 0 por tempo, 0 quedas sem arremesso, 1 empate. Duração mediana 24,5 s; máxima 82 s.
- **Personagens: todos entre 47,8% e 53,6%.** Do mais forte ao mais fraco: Maestro 53,6 · Canhoneiro 53,2 · Faísca 52,8 · Brasa 51,3 · Rochedo 51,0 · Paredão 50,5 · Âncora 50,0 · Ponta 49,2 · Lâmina 49,0 · Sombra 48,6 · Capitã Maré 48,0 · Mestre Vento 47,8.
- Arenas (vitória do lado esquerdo): 49,9% a 51,7%.
- Determinismo: 1.000 combates rodados duas vezes, 0 divergiram.

**Sinergias** (1.000 combates por degrau; taxa de vitória do time que tem a característica, com o bônus e com o bônus desligado):

| Característica | Em campo | Com o bônus | Sem o bônus |
|---|---|---|---|
| Futebol | 2 / 3 | 51,6% / 59,2% | 45,4% / 53,1% |
| Piratas | 2 / 3 | 48,3% / 61,6% | 48,3% / 59,8% |
| Monstros | 2 / 3 | 53,5% / 51,8% | 40,9% / 30,5% |
| Dojo | 2 / 3 | 47,9% / 61,2% | 45,7% / 54,5% |
| Corpo a corpo | 2 / 3 | 51,1% / 52,6% | 45,3% / 41,5% |
| À distância | 2 / 3 | 48,4% / 56,7% | 48,9% / 49,0% |
| Tanque | 2 / 3 | 51,1% / 57,0% | 42,9% / 45,9% |
| Assassino | 2 / 3 | 47,8% / 52,5% | 44,3% / 32,5% |

**Ajuste dos trios (2026-11-12, decisão do André: enfraquecer até 55%).** Números novos em `relatorios/lote-ajuste-trios.md`; a tabela acima é a anterior ao ajuste. Trios completos agora: Futebol 54,5%, Piratas 55,5%, Dojo perto de 57% (56,7% na medição de 3.000 combates; chegou a 60% em um lote menor, então ainda é o trio a vigiar) (eram 59,2%, 61,6% e 61,2%). Personagens entre 46,4% e 54,6%. Os bônus desses três mundos ficaram pequenos (2% a 6%): o que sobra de vantagem vem da combinação dos três personagens, não do bônus. O Mestre Vento ficou no piso (46% a 47%) porque o Tufão é o que deixa o trio do Dojo forte. Outros trios no teto: Corpo a corpo 56,1% e Monstros 56,0%.

**Mais de uma estratégia vencedora:** sim. Sete dos oito trios ficam entre 51% e 62%, com composições bem diferentes (três baratos de Monstros ou de Assassino empatam com trios caros).

## Comandos

- `npm run dev`: abre o jogo em http://localhost:5173. Parâmetros no endereço: `?semente=N`, `&debug`, `&velocidade=2` (ou 4), `&demo` (combate 4x4 solto), `&auto` (o seu jogador também é um bot: a partida anda sozinha), `&modo=duplas`, `&arena=arena-basica` (fixa a arena).
- `npm test`: Vitest (simulação)
- `npm run lint`: tipos + ESLint + Prettier (checagem)
- `npm run build`: checagem de tipos + build de produção
- `npm run test:e2e`: testes no navegador (Playwright), cerca de 4 minutos. Sobe o jogo e o servidor sozinho.
- `npm run servidor`: empacota e sobe o servidor de jogo na porta 2567 (`npm run servidor:build` só empacota, em `dist-servidor/`).
- `npm run arte`: gera os sprites do zero (precisa do Blender; ver `arte/LEIA-ME.md`). `npm run arte:atlas` refaz só a validação e o atlas.
- `npm run lote`: simulação em lote para balanceamento. Variáveis: `LOTE_COMBATES` (padrão 4000), `LOTE_SINERGIAS` (por degrau, padrão 400), `LOTE_DETERMINISMO` (padrão 200), `LOTE_SEMENTE`. O relatório da fase está em `relatorios/lote-fase5.md`. Na primeira vez, rode `npx playwright install chromium`. Para usar outro Chromium: `CHROMIUM_PATH=/caminho npm run test:e2e`.
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

### Fase 5
- **Os bônus de sinergia valem para quem tem a característica**, não para o esquadrão inteiro. A exceção é o Tanque, cujo bônus é justamente para os vizinhos.
- **Sinergia conta personagens diferentes.** Três cópias do mesmo personagem contam como um.
- **No 2x2, cada jogador tem as próprias sinergias** (as do aliado não somam com as suas).
- **Números mudados em relação ao `ELENCO.md` por causa do balanceamento** (o elenco diz que o balanceamento manda):
  - Futebol: velocidade +12% (era +15%); arremesso horizontal +6% (era +20%).
  - Piratas 3: primeiro golpe +15% (era dano dobrado). O trio já é forte sem bônus.
  - Monstros 2: peso +20% (era +15%).
  - Dojo: velocidade de ataque +6% (era +15%); habilidades 5% mais rápidas (era 30%).
  - Corpo a corpo 3: dano +15% (era +25%).
  - À distância 3: o projétil atravessa, mas depois do primeiro alvo só causa 25% do dano e não arremessa. O degrau 3 não soma o alcance do degrau 2.
  - Tanque 3: vizinhos recebem 12% menos arremesso (era 25%).
  - Assassino: crítico = dano em dobro; invisibilidade de 3 segundos no começo da rodada e depois de cada nocaute.
- **Interpretações de habilidades do elenco:**
  - "Folha seca" persegue o alvo em linha reta (o "arco" fica para a arte) e quica até 3 inimigos.
  - "Gancho" traz o inimigo mais distante para a frente da Capitã, atordoado; o golpe dela vem em seguida.
  - "Descarga" teleporta a Faísca de inimigo em inimigo.
  - "Casco" também reduz pela metade o dano recebido enquanto dura.
  - "Tufão" só é usado quando algum inimigo já acumulou 30% de dano.
  - Explosão dos Monstros: fere os inimigos a até 650 px do ponto por onde o monstro saiu.
- **"Arremessado" só zera quando o personagem recupera o controle** (fora do atordoamento e sem deslizar com a velocidade do golpe). Antes, raspar numa plataforma já zerava.
- **A IA só desce de uma plataforma quando vai cair sobre o chão** (a Torre tem plataformas que passam da largura do chão).
- **Cenário de medição do lote:** dois times com 14 de elixir e até 4 em campo; o elixir que sobra vira níveis de fusão. Sem isso, personagem barato parecia fraco só por deixar elixir sem gastar.

### Fase 6
- **Sem o estado sincronizado do Colyseus (Schema):** cada jogador recebe por mensagem um retrato da partida já filtrado. É mais simples que filtrar campo a campo e reaproveita o estado da simulação como está.
- **O servidor não empacota com `tsc` nem usa `tsx`:** `vite build --ssr` gera `dist-servidor/index.js`. Assim não entrou dependência nova além do Colyseus. Os tipos mínimos do Node estão em `servidor/node.d.ts` (sem `@types/node`).
- **Tempo do combate online:** o servidor espera a duração do combate mais longo da rodada mais 6 s e abre a rodada seguinte. Por isso, online, a velocidade fica em 1x e a pausa no golpe e a câmera lenta são desligadas (esticariam a luta além desse tempo).
- **Nome e código são pedidos em caixas simples do navegador** (`prompt`). Uma tela própria fica para a Fase 8 (interface).
- **Uma instância só do servidor:** as salas ficam na memória do processo.
- **O anfitrião escolhe modo e dificuldade no menu, antes de criar a sala**; dentro da sala não dá para trocar.
- **Bots do servidor jogam no nível escolhido pelo anfitrião**, inclusive quando substituem alguém que caiu.

### Fase 7A
- **Modelos feitos pelo Claude por script, sem packs de terceiros** (decisão do André, 2026-11-12). Substitui a base de arte do `ELENCO.md`; não há nada a registrar em `CREDITOS.md`.
- **Servidor de jogo no Render** (decisão do André, 2026-11-12): `render.yaml` na raiz; passos em `PUBLICAR.md`.
- **Quadro com 3 unidades de altura** (era 2,5) e sprite 1,45× a caixa de colisão, para a espada caber e o personagem não ficar pequeno.
- **`npm run lote` consertado:** o relator `basic` saiu do Vitest e o comando falhava.
- **Blender 5.3:** os scripts foram escritos para a API dessa versão e testados com o módulo `bpy` 5.3.0 (o Blender não está instalado no ambiente de desenvolvimento). O André confirmou a 5.3 (2026-11-12).
- **Motor de render: Cycles na CPU**, 24 amostras, sem redução de ruído. É o que roda em qualquer máquina sem placa de vídeo. Os 49 quadros levam uns 10 segundos.
- **Enquadramento fixo:** o quadro mostra 2,5 unidades; os pés ficam a 86% da altura. Personagem de até 2,05 unidades.
- **Tamanho no jogo:** o sprite é escalado para a altura da caixa de colisão do personagem, com 20% de folga para a arma e os gestos.
- **O atlas não recorta os quadros** (cada um ocupa 256×256): mais simples e a linha de base fica igual em todos. O do Lâmina tem 2048×2304 e 830 kB.
- **`public/sprites/` vai para o repositório** (o jogo roda sem Blender). `arte/quadros/` e os `.blend` são gerados e ficam fora.
- **Só o combate usa sprites por enquanto.** Cartas, banco e preparação continuam com as formas geométricas; os retratos nas cartas são da Fase 8.
- **Tipos mínimos do Node** para o servidor e as ferramentas ficam em `node.d.ts` na raiz (sem `@types/node`).

## Próximo passo

1. André: aprovar o visual do Futebol (ou pedir mudanças) e publicar o servidor no Render (`PUBLICAR.md`).
2. Depois: Monstros (Brasa, Rochedo, Faísca), com esqueleto próprio.
2. Fase 7B — os outros 11 personagens, um por vez, com aprovação visual em cada um.
