import { it } from "vitest";
import { formatarRelatorio, rodarLote } from "./lote";

// Ferramenta, não teste: `npm run lote` (ou LOTE_COMBATES=20000 npm run lote).
it("lote de balanceamento", () => {
  const combates = Number(process.env["LOTE_COMBATES"] ?? 4000);
  const semente = Number(process.env["LOTE_SEMENTE"] ?? 1);
  const inicio = performance.now();
  const rel = rodarLote({ combates, semente, orcamento: 14, maximoEmCampo: 4 });
  console.log(formatarRelatorio(rel));
  console.log(`\n${combates} combates em ${((performance.now() - inicio) / 1000).toFixed(1)} s`);
});
