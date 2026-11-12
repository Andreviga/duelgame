/** Um personagem que saiu da arena e quem levou o crédito (null = caiu sem ninguém bater). */
export interface Nocaute {
  vitima: string;
  autor: string | null;
  /** O autor é do mesmo lado de quem está lendo o resumo. */
  autorDoMeuLado: boolean;
}

/**
 * Uma linha que explica o resultado da rodada: quem mais nocauteou de cada lado e quantos caíram sozinhos.
 * Ex.: "Seu Âncora nocauteou 2 · Lâmina rival nocauteou 3 · 1 caiu sozinho".
 */
export function resumoDosNocautes(nocautes: readonly Nocaute[]): string {
  const contagem = new Map<string, { nome: string; meu: boolean; total: number }>();
  let sozinhos = 0;
  for (const n of nocautes) {
    if (n.autor === null) {
      sozinhos++;
      continue;
    }
    const chave = `${n.autorDoMeuLado ? "m" : "r"}:${n.autor}`;
    const atual = contagem.get(chave) ?? { nome: n.autor, meu: n.autorDoMeuLado, total: 0 };
    atual.total++;
    contagem.set(chave, atual);
  }
  const partes: string[] = [];
  for (const meu of [true, false]) {
    const melhor = [...contagem.values()]
      .filter((c) => c.meu === meu)
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))[0];
    if (!melhor) continue;
    const quem = meu ? `Seu ${melhor.nome}` : `${melhor.nome} rival`;
    partes.push(`${quem} nocauteou ${melhor.total}`);
  }
  if (sozinhos > 0)
    partes.push(`${sozinhos} ${sozinhos === 1 ? "caiu sozinho" : "caíram sozinhos"}`);
  return partes.join("  ·  ");
}
