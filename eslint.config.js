import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "playwright-report"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // A simulação é pura: sem Phaser, sem navegador, sem relógio, sem aleatoriedade global.
    files: ["src/sim/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["phaser", "phaser/*", "**/render/**"],
              message: "src/sim não pode depender de render.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "performance",
        "requestAnimationFrame",
        "setTimeout",
        "setInterval",
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use o gerador com semente do estado." },
        { object: "Date", property: "now", message: "Use o contador de ticks." },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date']", message: "Use o contador de ticks." },
      ],
    },
  },
  prettier,
);
