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
    // Sem as imagens de cenário: aqui o que se testa é a partida, e sem placa de vídeo as camadas
    // deixam o jogo lento demais para caber no tempo do teste.
    const erros = await abrir(page, `/?auto&modo=${modo}&semente=8&velocidade=4&cenario=codigo`);
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

test("online: uma aba cria a sala, outra entra pelo código, jogam uma rodada e uma delas recarrega", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const erros: string[] = [];
  const abrirAba = async (caminho: string) => {
    const contexto = await browser.newContext({ viewport: { width: 1200, height: 675 } });
    const page = await contexto.newPage();
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") erros.push(m.text());
    });
    await page.goto(caminho);
    await cena(page, "inicial");
    await page.waitForTimeout(600);
    return page;
  };

  const ana = await abrirAba("/?nome=Ana");
  await ana.mouse.click(470, 629); // criar sala online
  await cena(ana, "sala");
  await ana.waitForFunction(() => Boolean(document.body.dataset["sala"]));
  const codigo = await ana.evaluate(() => document.body.dataset["sala"] ?? "");
  expect(codigo).toMatch(/^[A-Z]{4}$/);

  const bia = await abrirAba(`/?nome=Bia&codigo=${codigo}`);
  await bia.mouse.click(730, 629); // entrar com código
  await cena(bia, "sala");

  await ana.mouse.click(600, 580); // começar (só o anfitrião)
  await cena(ana, "preparacao");
  await cena(bia, "preparacao");
  await ana.waitForTimeout(500);
  await ana.mouse.click(646, 560); // cada uma compra uma carta
  await bia.mouse.click(646, 560);
  await ana.waitForTimeout(300);
  await ana.mouse.click(1095, 626); // lutar
  await bia.mouse.click(1095, 626);
  await cena(ana, "combate");
  await cena(bia, "combate");

  // a Bia recarrega a página no meio da partida e volta sozinha para a sala
  await bia.reload();
  await bia.waitForSelector('body[data-cena="combate"], body[data-cena="preparacao"]', {
    timeout: 15_000,
  });

  // o servidor abre a rodada seguinte para as duas
  await cena(ana, "preparacao", 60_000);
  await cena(bia, "preparacao", 60_000);
  expect(erros).toEqual([]);
});
