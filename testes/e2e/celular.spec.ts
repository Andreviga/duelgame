import { expect, test, type Page } from "@playwright/test";

// Celular deitado: 844x390. O jogo (1200x675) encolhe para caber na altura e fica centralizado.
const TELA = { width: 844, height: 390 };
const ESCALA = TELA.height / 675;
const MARGEM_X = (TELA.width - 1200 * ESCALA) / 2;
const naTela = (x: number, y: number): [number, number] => [MARGEM_X + x * ESCALA, y * ESCALA];

test.use({ viewport: TELA, hasTouch: true });

const cena = (page: Page, nome: string, timeout = 15_000) =>
  page.waitForSelector(`body[data-cena="${nome}"]`, { timeout });

async function abrir(page: Page, caminho: string): Promise<string[]> {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  await page.goto(caminho);
  await expect(page.locator("#jogo canvas")).toBeVisible();
  await cena(page, "inicial");
  await page.waitForTimeout(600);
  return erros;
}

const tocar = (page: Page, x: number, y: number) => page.touchscreen.tap(...naTela(x, y));

test("celular deitado: joga uma rodada só com toques, acertando a folga dos botões", async ({
  page,
}) => {
  const erros = await abrir(page, "/?semente=3&arena=arena-basica");
  await tocar(page, 450, 440); // dificuldade "fácil", tocando acima do desenho do botão (y 452 a 502)
  await tocar(page, 600, 559); // jogar
  await cena(page, "preparacao");
  await page.waitForTimeout(400);
  await tocar(page, 646, 560); // compra a primeira carta
  // arrasta do banco para um ponto da arena
  const de = naTela(68, 570);
  const ate = naTela(536, 500);
  await page.mouse.move(...de);
  await page.mouse.down();
  await page.mouse.move(...ate, { steps: 6 });
  await page.mouse.up();
  await tocar(page, 1095, 660); // "LUTAR", tocando abaixo do desenho do botão (y 602 a 650)
  await cena(page, "combate");
  await page.waitForTimeout(2500);
  expect(erros).toEqual([]);
});

test("celular deitado: créditos e opções abrem pelo menu, e as opções ficam guardadas", async ({
  page,
}) => {
  const erros = await abrir(page, "/");
  await tocar(page, 92, 40);
  await cena(page, "creditos");
  await tocar(page, 92, 40); // voltar
  await cena(page, "inicial");
  await tocar(page, 1108, 40);
  await cena(page, "opcoes");
  await tocar(page, 596, 277); // música: mudo
  await page.waitForTimeout(200);
  await page.reload();
  await cena(page, "inicial");
  const guardado = await page.evaluate(() => window.localStorage.getItem("arena:opcoes"));
  expect(JSON.parse(guardado ?? "{}")).toMatchObject({ musica: 0 });
  expect(erros).toEqual([]);
});

test("celular em pé: pede para girar o aparelho", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#girar")).toBeVisible();
  await page.setViewportSize(TELA);
  await expect(page.locator("#girar")).toBeHidden();
});

test("se os arquivos do jogo não carregam, aparece a tela de falha com o botão de tentar de novo", async ({
  page,
}) => {
  await page.route("**/sprites/*.png", (rota) => rota.abort());
  await page.goto("/");
  await expect(page.locator("#falha")).toBeVisible();
  await expect(page.locator("#falha-texto")).toContainText("Não deu para carregar");
  await expect(page.locator("#falha-botao")).toBeVisible();
});
