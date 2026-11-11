import { defineConfig } from "vite";

// Empacota a ferramenta de arte (Node) em dist-ferramentas/. Usado por `npm run arte`.
export default defineConfig({
  build: {
    ssr: "ferramentas/arte/montar_atlas.ts",
    outDir: "dist-ferramentas",
    emptyOutDir: true,
    target: "node22",
  },
});
