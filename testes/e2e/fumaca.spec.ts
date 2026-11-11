import { expect, test, type Page } from "@playwright/test";

// O jogo tem 1200x675; com a janela neste tamanho, as coordenadas da tela são as do jogo.
test.use({ viewport: { width: 1200, height: 675 } });

const paraTela = (x: number, y: number) => ({
  x: (x - 600) * 0.8 + 600,
  y: (y - 410) * 0.8 + 262 - 26,
});

async function abrir(page: Page, caminho: string): Promise<string[]> {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  await page.goto(caminho);
  await expect(page.locator("#jogo canvas")).toBeVisible();
  await page.waitForTimeout(800);
  return erros;
}

test("preparação: compra, posiciona, vende e luta sem erros", async ({ page }) => {
  const erros = await abrir(page, "/?semente=3");
  await page.mouse.click(646, 560); // compra a primeira carta
  await page.mouse.click(788, 560); // compra a segunda
  // arrasta o primeiro do banco para um ponto da arena
  const ponto = paraTela(520, 520);
  await page.mouse.move(68, 570);
  await page.mouse.down();
  await page.mouse.move(ponto.x, ponto.y, { steps: 5 });
  await page.mouse.up();
  // arrasta o outro do banco para a zona de venda
  await page.mouse.move(68, 570);
  await page.mouse.down();
  await page.mouse.move(780, 560, { steps: 5 });
  await page.mouse.up();
  await page.mouse.click(1095, 572); // atualizar a loja
  await page.mouse.click(1095, 626); // lutar
  await page.waitForTimeout(4000); // tempo para o combate começar e os primeiros golpes
  expect(erros).toEqual([]);
});

test("demonstração 4x4 roda sem erros", async ({ page }) => {
  const erros = await abrir(page, "/?demo&semente=7&velocidade=2");
  await page.waitForTimeout(4000);
  expect(erros).toEqual([]);
});
