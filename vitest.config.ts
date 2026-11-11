import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["testes/**/*.test.ts"],
    environment: "node",
    // Os lotes de partidas inteiras e o bot difícil (que simula combates) passam de 5 s.
    testTimeout: 120_000,
  },
});
