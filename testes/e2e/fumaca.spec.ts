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

const cena = (page: Page, nome: string, timeout = 10_000) =>
  page.waitForSelector(`body[data-cena="${nome}"]`, { timeout });

test("do menu ao combate: escolhe o modo, compra, posiciona, vende e luta", async ({ page }) => {
  const erros = await abrir(page, "/?semente=3&arena=arena-basica");
  await cena(page, "inicial");
  await page.mouse.click(450, 477); // dificuldade: fácil
  await page.mouse.click(600, 583); // jogar
  await cena(page, "preparacao");
  await page.waitForTimeout(400);
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
  await cena(page, "combate");
  await page.waitForTimeout(3000);
  expect(erros).toEqual([]);
});

for (const modo of ["todos", "duplas"]) {
  test(`partida inteira (${modo}) contra 3 bots, do menu à tela de resultado`, async ({ page }) => {
    test.setTimeout(300_000);
    // ?auto: o jogador humano também é jogado por um bot, para a partida andar sozinha.
    const erros = await abrir(page, `/?auto&modo=${modo}&semente=8&velocidade=4`);
    await cena(page, "resultado", 280_000);
    await page.mouse.click(600, 592); // jogar de novo
    await cena(page, "inicial");
    expect(erros).toEqual([]);
  });
}

test("demonstração 4x4 roda sem erros", async ({ page }) => {
  const erros = await abrir(page, "/?demo&semente=7&velocidade=2");
  await page.waitForTimeout(4000);
  expect(erros).toEqual([]);
});
