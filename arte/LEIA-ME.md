# Arte dos personagens (Fase 7)

O jogo é 2D. O 3D existe só como origem dos sprites: cada personagem é um arquivo `.blend`
que o Blender renderiza de lado, quadro a quadro.

## Gerar os sprites

```bash
npm run arte
```

Para cada personagem de `arte/personagens.json`, o comando:

1. renderiza os quadros com o Blender (`ferramentas/arte/render_sprites.py`) em `arte/quadros/<id>/`;
2. valida os quadros (todas as animações, número de quadros certo, nenhum vazio, nenhum repetido em `andar`);
3. monta `public/sprites/<id>.png` e `<id>.json` (atlas no formato do Phaser);
4. atualiza `src/dados/sprites.json`, a lista de personagens que já têm sprite.

O Blender precisa estar instalado, com o comando `blender` no PATH. Os scripts foram escritos e
testados com a API do Blender 5.3.

`npm run arte:atlas` refaz só os passos 2 a 4, com os quadros que já estão em `arte/quadros/`.

## O que cada `.blend` precisa ter

- O personagem **virado para +X** (a direita da tela), **em pé no chão (Z = 0)**, com a origem entre os pés.
- **Até 2 unidades de altura.** O quadro mostra de −0,42 a 2,58 na vertical e 1,5 para cada lado,
  com folga para armas e saltos. O que passar disso é cortado.
- **Um esqueleto (armature)** e **uma ação por animação**, com exatamente estes nomes:

| Ação | Quadros | Em laço | O que mostra |
|---|---|---|---|
| `parado` | 8 | sim | respirando, em guarda |
| `andar` | 8 | sim | um ciclo de passos, 8 poses diferentes |
| `pular` | 4 | não | do impulso ao ponto mais alto |
| `cair` | 2 | sim | caindo |
| `atacar` | 6 | não | o golpe normal, do preparo à recuperação |
| `habilidade` | 8 | não | a habilidade do personagem |
| `atingido` | 3 | não | levando o golpe, no chão |
| `arremessado` | 4 | sim | voando, girando |
| `nocaute` | 6 | não | saindo da arena |

- As animações acontecem **no lugar**: o personagem não sai andando; quem move é o jogo.
- Câmeras e luzes do arquivo são ignoradas. O script usa sempre a mesma câmera lateral ortográfica,
  a mesma luz, o mesmo enquadramento e fundo transparente, em quadros de 256×256 a 12 por segundo.
- A roupa não leva a cor do jogador: no jogo, a cor aparece no contorno e em um anel no chão.

A lista de animações e o tamanho do quadro ficam em `src/dados/animacoes.json`, lido pelo Blender,
pela ferramenta de atlas e pelo jogo.

## De onde vêm os modelos

Os personagens são **modelados por script**, com formas simples (decisão do André em 2026-11-12).
Não há modelos, texturas nem animações de terceiros.

- `ferramentas/arte/modelos/humanoide.py`: biblioteca para humanoides. Monta o esqueleto (com cotovelos
  e joelhos), o corpo padrão e as sete ações comuns (`parado`, `andar`, `pular`, `cair`, `atingido`,
  `arremessado`, `nocaute`). As convenções dos ângulos das poses estão no começo do arquivo.
- Os Monstros usam a mesma biblioteca com outro esqueleto: cada um troca o método `ossos()` (gorila, tartaruga
  quadrúpede, besouro), mantendo os nomes de osso. A tartaruga define todas as suas ações.
- `ferramentas/arte/modelos/<id>.py`: um arquivo por personagem. Define cores, roupas, acessórios e arma,
  e as duas ações próprias: `atacar` e `habilidade`. Ao rodar, salva `arte/fontes/<id>.blend`.
- `arte/personagens.json`: lista quem entra no `npm run arte`, com o script gerador de cada um.

Os `.blend` em `arte/fontes/` são gerados e não vão para o repositório; os atlas em `public/sprites/` vão.

## Estado atual

- Dojo, Piratas e Futebol (9 humanoides): aprovados pelo André.
- Monstros (`brasa`, `rochedo`, `faisca`): modelados, aguardando a aprovação visual do André.
- Os 12 personagens têm sprite; nenhum usa mais a forma geométrica no combate.

Para refazer só alguns: `ARTE_SO=sombra,vento npm run arte`.

## Cenários das arenas

Cada arena tem um script em `ferramentas/arte/cenarios/<id>.py`, que monta a cena do zero no Blender
e renderiza as camadas em `public/cenarios/<id>/`. A biblioteca comum é `cenarios/cenario.py`
(formas low-poly, materiais e o render).

```bash
python3 ferramentas/arte/rodar_blender.py ferramentas/arte/cenarios/arena-basica.py
# prévia rápida, em outra pasta:  ... arena-basica.py -- --saida /tmp/previa --escala 0.5
# só algumas camadas:             ... arena-basica.py -- --so perto,frente
```

| Arquivo | Conteúdo | Tamanho |
|---|---|---|
| `ceu.png` | céu, lua, estrelas e nuvens altas (sem transparência) | 1600×900 |
| `longe.png` | serras e o que está distante | 2000×900 |
| `perto.png` | o que fica logo atrás da luta | 2400×900 |
| `chao.png` | o chão sólido, de frente, na proporção exata do JSON da arena (2 px por unidade) | varia |
| `plataforma.png` | uma plataforma; metade de cima é a tábua, metade de baixo a sombra | 380×40 |
| `frente.png` | o que passa na frente da luta, só nas bordas | 2400×900 |
| `cenario.json` | tamanhos, encaixe e paralaxe sugerida, para o jogo ler | — |

- **Encaixe:** nas camadas largas, o centro fica atrás de x = 600 do mundo e a linha y = 600 da
  camada fica na altura do chão da arena.
- **Leitura da luta:** atrás da área de jogo o cenário é escuro, pouco saturado e sem detalhe fino;
  brilho quente só nas bordas. Nada no fundo tem linha clara na altura do chão.
- **Reproduzível:** Cycles na CPU, semente fixa, sem denoise, só luz direta (sem ruído), sem
  pontilhado e sem data gravada no arquivo. Rodar duas vezes dá os mesmos arquivos, byte a byte.
- **Luz:** as mesmas duas direções dos personagens (`render_sprites.py`). Lanternas e janelas usam
  `lampada()`: a luz é calculada dentro dos materiais da camada (distância e ângulo), sem luz do
  Blender, para não haver ruído. Brilhos suaves (lua, lanternas, névoa) usam `halo()`.
- **Peso:** no máximo 1,5 MB por arena.

Estado: `arena-basica` (pátio de dojo à noite) renderizada, 1,4 MB, aguardando a aprovação do André.
**O jogo ainda não carrega essas imagens**: `desenharFundo` e `desenharArena` continuam desenhando
por código. A troca por camadas com paralaxe é o próximo passo, só em `src/render`.

## Licenças

Hoje não há nada de terceiros na arte. Se um dia entrar algum pack, confira a licença na página
oficial e registre em `CREDITOS.md` antes de usar.
