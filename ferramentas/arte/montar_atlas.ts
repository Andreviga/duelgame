import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import especJson from "../../src/dados/animacoes.json";
import { montarAtlas, validarQuadros, type EspecDeAnimacoes } from "./atlas";
import { codificarPng, decodificarPng, type Imagem } from "./png";

/**
 * `npm run arte`: gera do zero os sprites de cada personagem listado em `arte/personagens.json`.
 *   1. (se houver) roda o script que gera o .blend;
 *   2. renderiza os quadros com o Blender (`render_sprites.py`);
 *   3. valida os quadros e monta `public/sprites/<id>.png` e `<id>.json`;
 *   4. atualiza `src/dados/sprites.json`, a lista de personagens que já têm sprite.
 * Com `--so-atlas`, pula o Blender e usa os quadros que já estão em `arte/quadros/`.
 * O Python usado é o da variável PYTHON (padrão: python3).
 */
interface Entrada {
  id: string;
  /** Arquivo .blend do personagem. */
  fonte: string;
  /** Script que gera o .blend (só para o boneco de teste). */
  gerador?: string;
}

const espec: EspecDeAnimacoes = especJson;
const python = process.env["PYTHON"] ?? "python3";
const soAtlas = process.argv.includes("--so-atlas");
const blender = (argumentos: string[]): void => {
  execFileSync(python, ["ferramentas/arte/rodar_blender.py", ...argumentos], { stdio: "inherit" });
};

const entradas = JSON.parse(readFileSync("arte/personagens.json", "utf8")) as Entrada[];
const prontos: string[] = [];
let falhou = false;

for (const { id, fonte, gerador } of entradas) {
  const pasta = `arte/quadros/${id}`;
  if (!soAtlas) {
    if (gerador) blender([gerador, "--", "--saida", fonte]);
    if (!existsSync(fonte)) {
      console.error(`✗ ${id}: não achei ${fonte}`);
      falhou = true;
      continue;
    }
    blender([fonte, "ferramentas/arte/render_sprites.py", "--", "--id", id, "--saida", pasta]);
  }

  const quadros = new Map<string, Imagem>();
  for (const arquivo of existsSync(pasta) ? readdirSync(pasta) : []) {
    if (!arquivo.endsWith(".png")) continue;
    quadros.set(arquivo.slice(0, -4), decodificarPng(readFileSync(`${pasta}/${arquivo}`), inflateSync));
  }
  const erros = validarQuadros(quadros, espec);
  if (erros.length > 0) {
    console.error(`✗ ${id}: ${erros.length} problema(s)`);
    for (const erro of erros) console.error(`    ${erro}`);
    falhou = true;
    continue;
  }
  const { imagem, json } = montarAtlas(id, quadros, espec);
  mkdirSync("public/sprites", { recursive: true });
  writeFileSync(`public/sprites/${id}.png`, codificarPng(imagem, (d) => deflateSync(d, { level: 9 })));
  writeFileSync(`public/sprites/${id}.json`, JSON.stringify(json, null, 2) + "\n");
  prontos.push(id);
  console.log(
    `✓ ${id}: ${quadros.size} quadros, atlas ${imagem.largura}x${imagem.altura}, ` +
      `personagem com ${json.meta.alturaDoPersonagem} px de altura`,
  );
}

writeFileSync("src/dados/sprites.json", JSON.stringify(prontos.sort(), null, 2) + "\n");
if (falhou) process.exit(1);
