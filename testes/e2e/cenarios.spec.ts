import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1200, height: 675 } });

async function abrirCombate(page: Page, arena: string): Promise<string[]> {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  // `cenario=imagens` no endereço: sem isso, o ambiente de teste (lento, sem placa de vídeo)
  // faria o jogo trocar sozinho para o cenário leve.
  const cenario = arena.includes("cenario=") ? "" : "&cenario=imagens";
  await page.goto(`/?auto&semente=5&velocidade=2&arena=${arena}${cenario}`);
  await page.waitForSelector('body[data-cena="combate"]', { timeout: 15_000 });
  await page.waitForTimeout(2500);
  return erros;
}

test("arena com cenário em imagens: o combate usa as camadas, sem erro", async ({ page }) => {
  const pedidos: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/cenarios/arena-basica/") && r.ok())
      pedidos.push(r.url().split("/").pop() ?? "");
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

test("cada partida carrega só o cenário da sua arena (e o do menu)", async ({ page }) => {
  const arenas = new Set<string>();
  page.on("response", (r) => {
    const achou = /\/cenarios\/([^/]+)\//.exec(r.url());
    if (achou?.[1]) arenas.add(achou[1]);
  });
  const erros = await abrirCombate(page, "arena-torre");
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "imagens");
  // O menu mostra a arena básica; a partida, a torre. A larga não entra nesta sessão.
  expect([...arenas].sort()).toEqual(["arena-basica", "arena-torre"]);
  expect(erros).toEqual([]);
});

test("com ?cenario=codigo o jogo não baixa imagens de cenário e desenha a arena por código", async ({
  page,
}) => {
  const pedidos: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/cenarios/")) pedidos.push(r.url());
  });
  const erros = await abrirCombate(page, "arena-torre&cenario=codigo");
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "codigo");
  expect(pedidos).toEqual([]);
  expect(erros).toEqual([]);
});

test("se uma imagem do cenário falha, a arena cai no desenho por código e o jogo segue", async ({
  page,
}) => {
  await page.route("**/cenarios/arena-basica/perto.png", (rota) => rota.abort());
  await page.goto("/?auto&semente=5&velocidade=2&arena=arena-basica&cenario=imagens");
  await page.waitForSelector('body[data-cena="combate"]', { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toHaveAttribute("data-cenario", "codigo");
  await expect(page.locator("#falha")).toBeHidden();
});
