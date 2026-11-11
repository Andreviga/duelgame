// O mínimo do Node que o servidor e as ferramentas usam, para não depender de @types/node.
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly argv: readonly string[];
  exit(codigo: number): never;
};

declare module "node:fs" {
  export function readFileSync(caminho: string): Uint8Array;
  export function readFileSync(caminho: string, codificacao: "utf8"): string;
  export function writeFileSync(caminho: string, dados: Uint8Array | string): void;
  export function readdirSync(caminho: string): string[];
  export function mkdirSync(caminho: string, opcoes: { recursive: boolean }): void;
  export function existsSync(caminho: string): boolean;
}

declare module "node:zlib" {
  export function inflateSync(dados: Uint8Array): Uint8Array;
  export function deflateSync(dados: Uint8Array, opcoes?: { level?: number }): Uint8Array;
}

declare module "node:child_process" {
  export function execFileSync(
    comando: string,
    argumentos: readonly string[],
    opcoes?: { stdio?: "inherit" | "pipe" },
  ): Uint8Array;
}
