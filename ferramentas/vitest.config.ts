import { defineConfig } from "vitest/config";

// Config só da ferramenta de lote (`npm run lote`); os testes usam o vitest.config.ts da raiz.
export default defineConfig({
  test: {
    include: ["ferramentas/**/*.test.ts"],
    environment: "node",
    testTimeout: 3_600_000,
  },
});
