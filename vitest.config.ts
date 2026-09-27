import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**", "convex/extensionProjects.ts"],
      exclude: ["src/main.tsx"], // bootstrap React
      /**
       * [S7-5] CA 2 — cobertura ≥ 80% nas REGRAS do módulo de extensão
       * (regras puras em src/lib/extension* e funções do servidor em
       * convex/extensionProjects.ts): critério da issue #38 travado de
       * forma durável — qualquer queda quebra a suíte.
       */
      "src/lib/extension*.ts": {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      "convex/extensionProjects.ts": {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
