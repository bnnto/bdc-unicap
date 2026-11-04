import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    env: { TZ: "UTC" },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/*.perf.test.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/main.tsx"], // bootstrap React
      // [REFACTOR_GESTOR] Os thresholds do módulo de extensão ([S7-5])
      // foram removidos junto com o módulo (cancelado e deletado).
    },
  },
});
