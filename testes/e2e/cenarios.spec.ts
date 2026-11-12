import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1200, height: 675 } });

async function abrirCombate(page: Page, arena: string): Promise<string[]> {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  await page.goto(`/?auto&semente=5&velocidade=2&arena=${arena}`);
  await page.waitForSelector('body[data-cena="combate"]', { timeout: 15_000 });
  await page.waitForTimeout(2500);
  return erros;
}

test("arena com cenário em imagens: o combate usa as camadas, sem erro", async ({ page }) => {
  const pedidos: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/cenarios/") && r.ok()) pedidos.push(r.url().split("/").pop() ?? "");
  });
  const erros = await abrirCombate(page, "arena-basica");
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "imagens");
  expect(pedidos.sort()).toEqual(
    [
      "cenario.json",
      "ceu.png",
      "chao.png",
      "frente.png",
      "longe.png",
      "perto.png",
      "plataforma.png",
    ].sort(),
  );
  expect(erros).toEqual([]);
});

test("arena sem cenário em imagens: o combate usa o desenho por código, sem erro", async ({
  page,
}) => {
  const erros = await abrirCombate(page, "arena-torre");
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "codigo");
  expect(erros).toEqual([]);
});

test("se uma imagem do cenário falha, a arena cai no desenho por código e o jogo segue", async ({
  page,
}) => {
  await page.route("**/cenarios/arena-basica/perto.png", (rota) => rota.abort());
  await page.goto("/?auto&semente=5&velocidade=2&arena=arena-basica");
  await page.waitForSelector('body[data-cena="combate"]', { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "codigo");
  await expect(page.locator("#falha")).toBeHidden();
});
