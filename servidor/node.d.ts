// O mínimo do Node que o servidor usa, para não depender de @types/node.
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  exit(codigo: number): never;
};
