import Phaser from "phaser";
import creditos from "../../CREDITOS.md?raw";
import { desenharFundo } from "./desenho";
import { ALTURA, criarTexto, desenharBotao, dentro, FONTE, LARGURA, type Ret } from "./interface";
import { tocar } from "./som";
import { areaDeToque } from "./toque";

// No canto, para não ficar por cima do texto.
const VOLTAR: Ret = { x: 20, y: 18, largura: 144, altura: 44 };

/** Tira a marcação do Markdown: títulos viram linhas em maiúsculas e tabelas viram "nome — uso (licença)". */
export function creditosEmTexto(markdown: string): string {
  const linhas: string[] = [];
  for (const bruta of markdown.split("\n")) {
    const linha = bruta.trim();
    if (linha.startsWith("# ")) continue;
    if (/^\|[-| ]+\|$/.test(linha) || linha.startsWith("| Nome")) continue;
    if (linha.startsWith("## ")) {
      linhas.push("", linha.slice(3).toUpperCase());
    } else if (linha.startsWith("|")) {
      const [nome, uso, licenca] = linha
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      linhas.push(`${nome} — ${uso} (${licenca})`);
    } else {
      linhas.push(linha);
    }
  }
  return linhas
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Página de créditos: mostra o conteúdo do `CREDITOS.md`. */
export class CenaCreditos extends Phaser.Scene {
  constructor() {
    super("creditos");
  }

  create(): void {
    document.body.dataset["cena"] = "creditos";
    desenharFundo(this.add.graphics(), 600, 380);
    this.add.graphics().fillStyle(0x0b0f16, 0.72).fillRect(0, 0, LARGURA, ALTURA);
    criarTexto(this, LARGURA / 2, 50, "CRÉDITOS", 40);
    this.add
      .text(LARGURA / 2, 92, creditosEmTexto(creditos), {
        fontFamily: FONTE,
        fontSize: "14px",
        color: "#dfe7f2",
        align: "center",
        lineSpacing: 3,
        wordWrap: { width: 980 },
      })
      .setOrigin(0.5, 0);
    desenharBotao(this.add.graphics(), VOLTAR, 0x2f5c8a);
    criarTexto(this, VOLTAR.x + VOLTAR.largura / 2, VOLTAR.y + VOLTAR.altura / 2, "Voltar", 18);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!dentro(areaDeToque(VOLTAR), p.x, p.y)) return;
      tocar("clique");
      this.scene.start("inicial");
    });
  }
}
