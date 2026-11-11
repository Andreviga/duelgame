import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173, strictPort: true },
  // O Phaser sozinho passa de 1 MB minificado; o aviso padrão de 500 kB não ajuda.
  build: { chunkSizeWarningLimit: 2000 },
});
