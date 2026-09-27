import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade UNICAP — CEREBRO.md §5 / DESIGN.md
        primary: "#6B1426", // Bordô
        "primary-hover": "#520F1D",
        secondary: "#C89D3C", // Dourado
        canvas: "#F8F9FA",
        success: "#047857", // esmeralda escuro — AA com branco (auditoria S0-4)
        warning: "#B45309", // âmbar escuro — AA com branco (auditoria S0-4)
        danger: "#DC2626",
        // [S8-2] Variantes AA — texto sobre fundo claro (WCAG 1.4.3 ≥ 4.5:1).
        // Use SEMPRE o prefixo a11y:* para texto; os tons puros continuam
        // reservados a fundos/decoração (dourado puro nunca é texto).
        "a11y-secondary": "#7A5A16", // dourado escurecido — 6,2:1 com branco
        "a11y-slate-500": "#64748B",
        "a11y-slate-600": "#475569",
        "a11y-slate-700": "#334155",
        "a11y-success": "#047857",
        "a11y-danger": "#DC2626",
        "a11y-primary": "#6B1426",
      },
      fontFamily: {
        serif: ["Merriweather", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        level1:
          "0 1px 3px 0 rgba(30, 41, 59, 0.05), 0 1px 2px -1px rgba(30, 41, 59, 0.03)",
        level2:
          "0 4px 6px -1px rgba(30, 41, 59, 0.08), 0 2px 4px -2px rgba(30, 41, 59, 0.04)",
        level3:
          "0 20px 25px -5px rgba(107, 20, 38, 0.08), 0 8px 10px -6px rgba(30, 41, 59, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
