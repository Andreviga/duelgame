import { defineConfig } from "vite";

// Empacota o servidor de jogo (Node) em dist-servidor/. Uso: `npm run servidor:build`.
export default defineConfig({
  build: {
    ssr: "servidor/index.ts",
    outDir: "dist-servidor",
    emptyOutDir: true,
    target: "node22",
  },
});
