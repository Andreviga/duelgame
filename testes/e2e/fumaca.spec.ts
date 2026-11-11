import { expect, test } from "@playwright/test";

test("abre o jogo e mostra o canvas", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto("/");
  await expect(page.locator("#jogo canvas")).toBeVisible();
  await page.waitForTimeout(500);
  expect(erros).toEqual([]);
});
