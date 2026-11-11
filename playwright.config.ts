import { defineConfig } from "@playwright/test";

// Se CHROMIUM_PATH estiver definido, usa esse navegador em vez do baixado pelo Playwright.
const executablePath = process.env["CHROMIUM_PATH"];

export default defineConfig({
  testDir: "testes/e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
