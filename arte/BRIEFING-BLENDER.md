# Briefing para melhorar a arte no Blender

Para quem (pessoa ou IA) for trabalhar na arte deste jogo usando o Blender 5.3. Leia também `arte/LEIA-ME.md`.

## O jogo em duas frases

Auto-battler 2D de arena com plataformas, visto de lado: o jogador monta um esquadrão e os personagens lutam
sozinhos, jogando os rivais para fora da tela. O jogo roda no navegador e **só mostra imagens 2D**: o Blender
entra antes, para gerar essas imagens.

## Regras que não podem ser quebradas

1. **Tudo original.** Nada de modelos, texturas, HDRIs ou animações de terceiros, e nada que lembre personagem,
   clube, obra ou pessoa real. Se algo de terceiros for indispensável, só com licença livre e registrado em
   `CREDITOS.md` antes de entrar.
2. **Feito por script.** Cada peça de arte é um arquivo Python que constrói a cena do zero e pode ser rodado de novo
   (`blender -b -P arquivo.py`). Não entregue `.blend` editado à mão: ele não entra no repositório.
3. **Não mexer na simulação** (`src/sim`, `src/dados/*.json` de arenas e personagens). Tamanho de chão, plataformas
   e caixas de colisão são regra de jogo, não arte.
4. **Render reproduzível:** Cycles na CPU, semente fixa, sem denoise que mude entre máquinas.

## Parte 1 — Arenas (a prioridade)

### Como está hoje

As três arenas são **desenhadas por código**, com formas simples, em `src/render/desenho.ts`
(`desenharFundo` e `desenharArena`). Não existe nenhuma imagem de cenário. Os temas atuais:

| Arena (`id`) | Tema | Chão (mundo) | Plataformas |
|---|---|---|---|
| `arena-basica` | Pátio de dojo à noite: lua, montanhas, portal, lanternas | x 200–1000, y 520, altura 40 | 3 |
| `arena-larga` | Convés de navio ao pôr do sol: sol, mar, nuvens, navios ao longe | ver `src/dados/arena-larga.json` | ver o JSON |
| `arena-torre` | Torre de pedra na tempestade: nuvens, raio, picos, cristais | ver `src/dados/arena-torre.json` | ver o JSON |

A tela tem 1200×675. O mundo usa as mesmas unidades (1 unidade = 1 pixel com zoom 1), com Y para baixo.
A câmera do combate se move e dá zoom entre 0,42 e 1,0.

### O que entregar para cada arena

Um script `ferramentas/arte/cenarios/<id>.py` que renderiza estas imagens PNG em `public/cenarios/<id>/`:

| Arquivo | Conteúdo | Tamanho | Transparência |
|---|---|---|---|
| `ceu.png` | Céu e o que está no infinito (sol, lua, nuvens altas) | 1600×900 | não |
| `longe.png` | Camada distante (montanhas, mar, navios, picos) | 2000×900 | sim |
| `perto.png` | Camada próxima, atrás da luta (portal, mastros, pilares, cristais) | 2400×900 | sim |
| `chao.png` | A peça do chão sólido, de frente | proporção exata do chão no JSON, 2 px por unidade | sim |
| `plataforma.png` | Uma plataforma, de frente; o jogo estica na largura | 380×40 | sim |
| `frente.png` (opcional) | Elementos na frente da luta, nas bordas (cordas, galhos, névoa) | 2400×900 | sim |

As camadas largas existem para a paralaxe: quanto mais perto, mais a camada desliza quando a câmera anda.

### Cuidados

- **A luta precisa ser legível.** Atrás da área de jogo (o retângulo do chão e uns 350 px acima), o cenário deve
  ser mais escuro e menos saturado que os personagens, e sem detalhe fino. Brilho e contraste fortes só nas bordas.
- **Os quatro times têm cor:** azul `#4fa3ff`, laranja `#ff8a3d`, verde `#5fd67a` e roxo `#b98bff`. Evite essas
  cores em áreas grandes atrás da luta.
- **Chão e plataformas mostram onde se pisa:** a borda de cima tem de ser uma linha clara e reta, na altura exata.
  Nada de enfeite que pareça chão onde não há colisão.
- **As bordas da tela são a zona de nocaute.** Não ponha nada que pareça parede ou chão perto dos limites.
- **Luz coerente com os personagens:** eles são renderizados com um sol principal e uma luz de recorte mais
  fraca (veja `ferramentas/arte/render_sprites.py`). Use a mesma direção de luz no cenário.
- **Peso:** cada arena deve somar no máximo 1,5 MB. Prefira formas grandes e degradês a textura com ruído.
- **Estilo:** low-poly de faces lisas, como os personagens. Sem fotorrealismo.

### O que falta no código para usar essas imagens

O jogo ainda não carrega imagens de cenário. Quando as imagens existirem, é preciso trocar `desenharFundo` e
`desenharArena` por camadas de imagem com paralaxe (mudança só em `src/render`). Avise quando o primeiro
cenário estiver pronto: a troca é feita junto, com o desenho por código servindo de reserva.

## Parte 2 — Personagens (o que pode melhorar)

Os 12 já existem, em `ferramentas/arte/modelos/<id>.py`, sobre a biblioteca `humanoide.py`. Cada um gera 49 quadros
de 256×256 (9 animações). Problemas conhecidos, por ordem de ganho visual:

1. **Peças rígidas.** Cada parte do corpo é um objeto preso a um osso, sem deformação: cotovelos e joelhos são
   esferas, capas e cachecóis não balançam. Melhorar: malha única com pesos, ou ossos extras para tecido e cabelo
   (cachecol do Sombra, casaco da Capitã Maré, barba do Mestre Vento, rabo do Rochedo).
2. **Animações duras.** As poses são interpoladas direto, com poucos quadros-chave. Faltam antecipação, atraso das
   pontas e um quadro de "esmagar e esticar" nos golpes. O `parado` quase não se mexe.
3. **Materiais chapados.** Uma cor por peça. Dá para ganhar muito com um degradê simples por peça (mais escuro
   embaixo), luz de recorte por trás e contorno escuro fino, sem sair do low-poly.
4. **Pontos fracos por personagem:**
   - Canhoneiro: parece magro e a barba some atrás do braço.
   - Paredão: não parece enorme; a faixa da testa lembra óculos escuros.
   - Rochedo: casco liso e claro, pouco "de pedra"; cristais quase brancos.
   - Brasa: rachaduras de lava são traços retos; deveriam ser irregulares e pulsar.
   - Faísca: mais azul-médio que azul-escuro; chifre grande demais para o corpo.
   - Sombra: escuro sobre fundo escuro; precisa de recorte de luz.
   - Capitã Maré: a corrente do gancho não estica no lançamento.
5. **Retratos.** As cartas usam o corpo inteiro parado. Um render só do busto, 256×256, em pose de personalidade,
   ficaria melhor (`retrato_0` como quadro extra do atlas).

### O que não pode mudar nos personagens

- Nomes e contagem de quadros das 9 animações (`src/dados/animacoes.json`).
- Quadro de 256×256, câmera lateral ortográfica, personagem olhando para a direita, pés na linha de base (86% da
  altura do quadro), fundo transparente.
- O personagem inteiro, com arma e gesto, precisa caber no quadro (3 unidades de altura, 1,5 para cada lado).
- Depois de mudar um modelo: `ARTE_SO=<id> npm run arte` e conferir se a validação passa.

## Como entregar

- Um personagem ou uma arena por vez, em commits separados, com uma imagem de antes e depois.
- O André aprova o visual de cada entrega antes da próxima.
- Atualize `arte/LEIA-ME.md` se o processo mudar.
