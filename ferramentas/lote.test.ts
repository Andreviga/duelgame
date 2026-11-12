import { ITENS } from "../src/dados";
import { it } from "vitest";
import {
  conferirDeterminismo,
  formatarRelatorio,
  formatarSinergias,
  medirSinergias,
  rodarLote,
} from "./lote";

// Ferramenta, não teste: `npm run lote`.
// Variáveis: LOTE_COMBATES (padrão 4000), LOTE_SINERGIAS (combates por degrau, padrão 400),
// LOTE_DETERMINISMO (combates repetidos, padrão 200), LOTE_SEMENTE,
// LOTE_SO (só estas sinergias, separadas por vírgula; ex.: mundo:piratas,mundo:dojo).
it("lote de balanceamento", () => {
  const combates = Number(process.env["LOTE_COMBATES"] ?? 4000);
  const porSinergia = Number(process.env["LOTE_SINERGIAS"] ?? 400);
  const semente = Number(process.env["LOTE_SEMENTE"] ?? 1);
  // LOTE_ITENS=1 roda os combates gerais com itens de arena (as sinergias são medidas sem).
  const itens = process.env["LOTE_ITENS"] ? ITENS : null;
  const base = { semente, orcamento: 14, maximoEmCampo: 4 };
  const inicio = performance.now();
  if (combates > 0) console.log(formatarRelatorio(rodarLote({ ...base, combates, itens })));
  if (porSinergia > 0) {
    const so = process.env["LOTE_SO"]?.split(",");
    const opcoes = { ...base, combates: porSinergia, ...(so ? { soSinergias: so } : {}) };
    console.log("\n" + formatarSinergias(medirSinergias(opcoes)));
  }
  const repetidos = Number(process.env["LOTE_DETERMINISMO"] ?? 200);
  if (repetidos > 0) {
    const divergentes = conferirDeterminismo(repetidos, semente);
    console.log(
      `\n## Determinismo\n\n${repetidos} combates rodados duas vezes com a mesma semente: ${divergentes} divergiram.`,
    );
  }
  console.log(`\nfeito em ${((performance.now() - inicio) / 1000).toFixed(1)} s`);
});
