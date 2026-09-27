import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getContrastRatio,
  meetsWcagAA,
  meetsWcagAALargeText,
} from "../../src/lib/contrast";

/**
 * [S8-2] Auditoria de contraste WCAG AA nos tokens Dourado/Bordô (CA 1).
 *
 * Três camadas:
 * 1. Pares de TEXTO do Design System precisam de 4.5:1 (WCAG 1.4.3);
 * 2. Indicador de FOCO precisa de 3:1 (WCAG 1.4.11, não-textual);
 * 3. Classes utilitárias `a11y:*` do Tailwind resolvem para cores AA
 *    (proibindo dourado puro e slate-400 como texto sobre fundo claro).
 */
const WHITE = "#FFFFFF";
const CANVAS = "#F8F9FA";
const PRIMARY = "#6B1426"; // Bordô
const SECONDARY = "#C89D3C"; // Dourado
const SECONDARY_DARK = "#7A5A16"; // Dourado AA (novo token a11y)
const SLATE_900 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";
const SLATE_400 = "#94A3B8"; // PROIBIDO como texto sobre fundo claro
const SUCCESS = "#047857";
const DANGER = "#DC2626";
/** Parágrafo do hero público: text-white/85 composto sobre o bordô. */
const WHITE_85_OVER_PRIMARY = "#E2CDD1";

/**
 * Extrai de tailwind.config.ts o hex do token AA (ex.: "a11y-secondary").
 * A auditoria lê a FONTE dos tokens — se alguém mudar um hex sem manter
 * AA, o teste quebra antes de chegar à tela.
 */
function tokenHex(tokenName: string): string {
  const css = cachedConfig ?? readTailwindConfig();
  const escaped = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`"${escaped}"\\s*:\\s*"(#[0-9a-fA-F]{6})"`),
  );
  const hex = match?.[1];
  if (hex === undefined) {
    throw new Error(`Token ${tokenName} não encontrado em tailwind.config.ts`);
  }
  return hex;
}

let cachedConfig: string | undefined;
function readTailwindConfig(): string {
  if (cachedConfig === undefined) {
    cachedConfig = readFileSync(resolve("tailwind.config.ts"), "utf8");
  }
  return cachedConfig;
}

describe("S8-2 CA 1 — pares de TEXTO AA 4.5:1 (WCAG 1.4.3)", () => {
  const pairs: Array<{ fg: string; bg: string; note: string }> = [
    { fg: WHITE, bg: PRIMARY, note: "branco sobre bordô (botões, hero)" },
    { fg: PRIMARY, bg: WHITE, note: "títulos bordô sobre cartão branco" },
    { fg: PRIMARY, bg: CANVAS, note: "títulos bordô sobre canvas" },
    { fg: SLATE_900, bg: CANVAS, note: "corpo de texto sobre canvas" },
    { fg: SLATE_600, bg: CANVAS, note: "texto secundário sobre canvas" },
    { fg: SLATE_600, bg: WHITE, note: "texto secundário sobre cartão" },
    {
      fg: SLATE_500,
      bg: WHITE,
      note: "notas discretas (slate-500) sobre branco",
    },
    {
      fg: SLATE_500,
      bg: CANVAS,
      note: "notas discretas (slate-500) sobre canvas",
    },
    {
      fg: SLATE_700,
      bg: WHITE,
      note: "texto enfatizado (slate-700) sobre branco",
    },
    {
      fg: SLATE_700,
      bg: CANVAS,
      note: "texto enfatizado (slate-700) sobre canvas",
    },
    {
      fg: SECONDARY_DARK,
      bg: WHITE,
      note: "eyebrow dourado AA (secondary-dark) sobre branco",
    },
    {
      fg: SECONDARY_DARK,
      bg: CANVAS,
      note: "eyebrow dourado AA (secondary-dark) sobre canvas",
    },
    {
      fg: SECONDARY,
      bg: PRIMARY,
      note: "dourado sobre bordô (só em contexto escuro)",
    },
    { fg: SUCCESS, bg: WHITE, note: "status aprovado sobre branco" },
    { fg: DANGER, bg: WHITE, note: "status reprovado/danger sobre branco" },
    {
      fg: WHITE_85_OVER_PRIMARY,
      bg: PRIMARY,
      note: "parágrafo white/85 do hero público sobre bordô",
    },
  ];

  it.each(pairs)("$note atinge AA 4.5:1", ({ fg, bg }) => {
    expect(meetsWcagAA(fg, bg)).toBe(true);
  });

  it("dourado AA (secondary-dark) tem folga confortável sobre branco", () => {
    expect(getContrastRatio(SECONDARY_DARK, WHITE)).toBeGreaterThanOrEqual(6);
  });
});

describe("S8-2 CA 2 — indicador de FOCO AA 3:1 (WCAG 1.4.11)", () => {
  const focusPairs: Array<{ fg: string; bg: string; note: string }> = [
    {
      fg: PRIMARY,
      bg: WHITE,
      note: "anel de foco bordô sobre superfície branca",
    },
    { fg: PRIMARY, bg: CANVAS, note: "anel de foco bordô sobre canvas" },
    {
      fg: SECONDARY,
      bg: PRIMARY,
      note: "anel de foco dourado sobre primário (accent)",
    },
  ];

  it.each(focusPairs)("$note atinge 3:1", ({ fg, bg }) => {
    expect(meetsWcagAALargeText(fg, bg)).toBe(true);
  });

  it("dourado puro sobre branco NÃO serve de indicador de foco (< 3:1)", () => {
    expect(getContrastRatio(SECONDARY, WHITE)).toBeLessThan(3);
  });
});

describe("S8-2 — tokens AA a11y-* do Tailwind (texto sobre fundo claro)", () => {
  it("a11y-secondary resolve para o dourado AA (#7A5A16)", () => {
    expect(tokenHex("a11y-secondary").toLowerCase()).toBe(
      SECONDARY_DARK.toLowerCase(),
    );
  });

  it("a11y-slate-500 é a versão AA do texto discreto (slate-400 não atinge AA)", () => {
    expect(tokenHex("a11y-slate-500").toLowerCase()).toBe(
      SLATE_500.toLowerCase(),
    );
    expect(meetsWcagAA(SLATE_400, WHITE)).toBe(false);
    expect(meetsWcagAA(SLATE_500, WHITE)).toBe(true);
  });

  it("todos os tokens a11y-* atinge AA sobre branco e canvas", () => {
    for (const token of [
      "a11y-slate-500",
      "a11y-slate-600",
      "a11y-slate-700",
      "a11y-secondary",
      "a11y-success",
      "a11y-danger",
      "a11y-primary",
    ]) {
      const hex = tokenHex(token);
      expect(meetsWcagAA(hex, WHITE), `${token} sobre branco`).toBe(true);
      expect(meetsWcagAA(hex, CANVAS), `${token} sobre canvas`).toBe(true);
    }
  });
});
