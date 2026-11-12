/**
 * Tela de falha por cima do jogo, para o jogador nunca ficar preso em uma tela quebrada.
 * Os elementos estão no `index.html` (`#falha`); o botão recarrega a página.
 */
export const MENSAGENS_DE_FALHA = {
  carga: "Não deu para carregar o jogo. Confira a internet e tente de novo.",
  erro: "Algo deu errado no jogo. Recarregue para continuar.",
} as const;

let mostrando = false;

export function mostrarFalha(tipo: keyof typeof MENSAGENS_DE_FALHA): void {
  if (mostrando) return;
  mostrando = true;
  const caixa = document.getElementById("falha");
  const texto = document.getElementById("falha-texto");
  if (texto) texto.textContent = MENSAGENS_DE_FALHA[tipo];
  caixa?.classList.add("visivel");
  document.body.dataset["falha"] = tipo;
}

/** Liga a tela de falha aos erros que ninguém tratou e ao botão de tentar de novo. */
export function vigiarFalhas(): void {
  window.addEventListener("error", () => mostrarFalha("erro"));
  window.addEventListener("unhandledrejection", () => mostrarFalha("erro"));
  document.getElementById("falha-botao")?.addEventListener("click", () => window.location.reload());
}
