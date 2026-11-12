import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Configuração dos testes de performance (loading + stress).
 *
 * Ambiente `node` (sem jsdom) e sem `setup.ts`: o alvo é o backend Convex
 * executado pelo mock oficial (convex-test), não a renderização da UI.
 * Medir com jsdom adicionaria custo de DOM não relacionado ao gargalo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    env: { TZ: "UTC" },
    environment: "node",
    globals: true,
    include: ["tests/perf/**/*.perf.test.ts"],
    exclude: [...configDefaults.exclude],
    css: false,
    // Seed de 10.500 currículos + vários estágios de carga.
    testTimeout: 900_000,
    hookTimeout: 900_000,
    fileParallelism: false,
    reporters: ["verbose"],
  },
});