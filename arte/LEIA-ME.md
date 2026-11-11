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
- **Até 2,05 unidades de altura.** O quadro mostra de −0,35 a 2,15 na vertical e 1,25 para cada lado.
  Golpes e armas que passarem disso são cortados.
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

## Estado atual

- `lamina` usa por enquanto o **boneco de teste** (`ferramentas/arte/criar_boneco_teste.py`): formas
  simples com esqueleto, gerado por script, só para provar o pipeline. Não é a arte final.
- Para trocar pelo modelo de verdade: salve `arte/fontes/lamina.blend` seguindo as regras acima e
  mude a entrada em `arte/personagens.json` para
  `{ "id": "lamina", "fonte": "arte/fontes/lamina.blend" }`.
- Personagens sem sprite continuam aparecendo como formas geométricas.

## Licenças

Antes de usar qualquer pack de modelos, confira a licença na página oficial e registre em `CREDITOS.md`.
