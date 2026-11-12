# Prompt: levar a arte do jogo a qualidade premium

Cole o texto da seção "Prompt" em uma IA que tenha o Blender 5.3 (ou o módulo `bpy` 5.3) e acesso ao
repositório. Antes dele, um resumo honesto do que separa a arte de hoje de um jogo com cara de produto.

## Onde a arte está hoje e o que falta

| Parte | Hoje | O que falta para "premium" |
|---|---|---|
| Personagens | Formas simples presas a ossos, uma cor por peça, 49 quadros de 256×256 | Malha com volume e silhueta própria, deformação nas juntas, luz de recorte, contorno, sombra no chão, mais quadros |
| Animação | Poses interpoladas direto, 4 a 8 quadros por ação | Antecipação, impacto, recuperação, tecido e cabelo com atraso, `parado` com vida |
| Retratos | O corpo inteiro parado, pequeno | Busto de 256×256 em pose de personalidade, um por personagem |
| Cenários | 3 arenas em camadas, cor chapada com degradê | Textura procedural discreta, luz mais rica, elementos que se mexem (bandeira, água, chuva, lanterna) |
| Efeitos | Círculos, riscos e faíscas desenhados por código | Folhas de sprites de impacto, poeira, rastro e explosão no mesmo estilo dos personagens |
| Interface | Retângulos arredondados e a fonte do aparelho | Molduras, ícones de mundo e de papel, botões e uma fonte própria (com licença livre) |

O maior ganho por esforço está nesta ordem: **contorno e luz de recorte nos personagens → sombra no chão →
retratos de busto → animações com antecipação e impacto → efeitos em sprite → textura nos cenários → interface.**

## Limites que a IA precisa respeitar

1. **Tudo original e por script.** Nada de modelo, textura, HDRI, fonte ou animação baixados. Se algo de
   terceiros for indispensável (uma fonte, por exemplo), só com licença livre conferida na página oficial e
   registrada em `CREDITOS.md` antes de entrar.
2. **Nada que lembre personagem, obra, clube ou pessoa real.** Cada personagem homenageia um tipo, não alguém.
3. **Não mexer em `src/sim`, `src/bots` nem nos JSON de personagens e arenas.** Arte não muda regra.
4. **Formato dos sprites não muda sem combinar:** 9 animações com os nomes e contagens de
   `src/dados/animacoes.json`, câmera lateral ortográfica, personagem olhando para a direita, pés na linha
   de base (86% da altura), fundo transparente.
5. **Render reproduzível:** Cycles na CPU, semente fixa, sem denoise, sem pontilhado. Rodar duas vezes tem de
   dar os mesmos arquivos.
6. **Peso:** `public/sprites` hoje soma 4,3 MB e cada arena até 1,5 MB. Qualquer aumento precisa ser pedido
   antes, com o número medido.
7. **Um item por vez, um commit por item, com imagem de antes e depois.** O André aprova cada um.

## Prompt

```text
Você vai melhorar a arte de um jogo 2D de arena (auto-battler, visto de lado) no repositório
Andreviga/duelgame, branch main. Responda em português, curto, um passo por vez.

Leia antes de qualquer coisa, nesta ordem: PLANO.md (seção 5, regras de trabalho, e seção 3,
originalidade), ELENCO.md, arte/LEIA-ME.md, arte/BRIEFING-BLENDER.md e arte/PROMPT-QUALIDADE-PREMIUM.md.
Os limites desse último arquivo valem para tudo o que você fizer.

Como a arte é feita hoje:
- Personagens: ferramentas/arte/modelos/<id>.py sobre a biblioteca humanoide.py. Rodar com
  `ARTE_SO=<id> npm run arte` (precisa de PYTHON apontando para um Python com bpy 5.3, ou do Blender no PATH).
  O render é ferramentas/arte/render_sprites.py; o atlas é montado por ferramentas/arte/atlas.ts.
- Cenários: ferramentas/arte/cenarios/<id>.py sobre cenario.py. Rodar com
  `python3 ferramentas/arte/rodar_blender.py ferramentas/arte/cenarios/<id>.py`.
- O jogo carrega public/sprites/<id>.png|json e public/cenarios/<id>/*.png.

Trabalhe nesta ordem. Para cada etapa: mostre um plano de até 10 linhas e espere o ok; faça só no
personagem piloto (lamina); mostre antes e depois; só depois do "aprovado" aplique aos outros 11.

ETAPA 1 — Contorno e luz de recorte (em render_sprites.py, vale para todos de uma vez)
- Contorno escuro de 2 px em volta da silhueta e nas dobras principais (Freestyle ou casca invertida),
  na cor #14101a, sem serrilhado.
- Luz de recorte mais forte por trás, para o personagem se destacar de fundo escuro e de fundo claro.
- Um degradê sutil por peça (mais escuro embaixo), sem textura.
- Critério: o Sombra (cinza-escuro) tem de ser legível sobre o cenário da arena-basica e sobre o da
  arena-torre. Mostre os dois.

ETAPA 2 — Sombra no chão
- Uma elipse suave sob os pés, no próprio quadro, que encolhe quando o personagem sobe (pular, cair,
  arremessado) e some no nocaute. Não pode passar da linha de base.

ETAPA 3 — Retratos de busto
- Um quadro extra por personagem, `retrato_0`, 256×256, só cabeça e ombros, em pose de personalidade,
  com a mesma luz. Avise o André: o jogo precisa de uma mudança pequena em src/render para usar o
  retrato nas cartas (hoje usa `parado_0`), e src/dados/animacoes.json ganha a entrada nova.

ETAPA 4 — Malha e deformação
- Trocar as peças rígidas por uma malha por personagem, com pesos nas juntas (cotovelo, joelho, ombro,
  quadril). Manter os mesmos nomes de osso, para as poses continuarem valendo.
- Ossos extras para o que deve balançar: cachecol do Sombra, casaco e rabo de cavalo da Capitã Maré,
  barba do Mestre Vento, rabo do Rochedo, asas do Faísca.
- Resolver os pontos fracos listados em arte/BRIEFING-BLENDER.md, parte 2, item 4.

ETAPA 5 — Animação
- Em `atacar` e `habilidade`: um quadro de antecipação, um de impacto com esticão, e a recuperação.
- `parado`: respiração visível e um detalhe próprio (o leque abana, a lava pulsa, a bola quica).
- `andar`: peso e balanço do tronco. Sem quadros repetidos (a validação acusa).
- Se pedir mais quadros por animação, isso muda src/dados/animacoes.json: peça antes e meça o peso.

ETAPA 6 — Efeitos em sprite
- Uma folha de sprites em public/efeitos/ com: impacto leve, impacto forte, poeira de pouso, rastro de
  arremesso e explosão de nocaute, 6 a 10 quadros cada, brancos (o jogo pinta com a cor do time).
- O jogo hoje desenha esses efeitos por código (src/render/efeitos.ts). Avise o André para fazer a troca.

ETAPA 7 — Cenários
- Textura procedural do próprio Blender nos materiais (Noise, Voronoi, Brick, Wave), de baixo contraste e
  escala grande, primeiro só no chão, na plataforma e na camada `perto`.
- Nada de detalhe fino nem brilho forte atrás da área da luta.
- Peça ao André antes de trocar PNG por WebP ou de subir o teto de peso.

ETAPA 8 — Interface
- Ícones dos 4 mundos e dos 4 papéis, moldura das cartas, botões e painéis, no mesmo estilo low-poly,
  em public/interface/. Proponha uma fonte de licença livre e registre em CREDITOS.md antes de usar.

Em cada entrega:
- rode `npm test`, `npm run lint` e `npm run build`; os três têm de passar;
- diga o peso antes e depois de public/sprites e de public/cenarios;
- rode o render duas vezes e confirme que os arquivos saem iguais;
- atualize arte/LEIA-ME.md se o processo mudou, e ESTADO.md com o que ficou pronto e o que ficou pendente;
- aponte você mesmo o que não ficou bom. Não diga que está pronto sem ter olhado a imagem.

Se uma etapa não der para fazer por script com boa qualidade, pare e diga isso em 3 linhas, com a
alternativa (por exemplo: modelagem à mão por um artista, entregue como .blend mais um script de
exportação). Não baixe nada pronto para contornar.
```

## O que nenhum prompt resolve sozinho

- **Direção de arte.** "Premium" depende de alguém escolher e recusar: proporções, paleta, o quanto de
  detalhe. Isso é do André, olhando cada entrega.
- **Modelagem orgânica fina.** Rostos expressivos, mãos e tecido convincentes são difíceis só por script.
  Se a etapa 4 não chegar lá, o caminho é um artista modelar à mão, mantendo o resto do pipeline.
- **Som.** Hoje é síntese por código, e nenhuma IA daqui consegue ouvir o resultado. Para som de produto:
  efeitos e música gravados, com licença registrada em `CREDITOS.md`.
- **Fluidez no celular.** Mais arte custa memória e desenho. Cada etapa precisa ser conferida no aparelho.
