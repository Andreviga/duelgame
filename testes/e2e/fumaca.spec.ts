import { expect, test } from "@playwright/test";

test("abre o jogo e o duelo roda sem erros", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto("/?semente=7");
  await expect(page.locator("#jogo canvas")).toBeVisible();
  await page.waitForTimeout(4000); // tempo para os primeiros golpes e efeitos
  expect(erros).toEqual([]);
});
