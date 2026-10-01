/**
 * [PERFIL_E_LGPD] Etapa 1 — preferências de acessibilidade do portal:
 * tema escuro/claro, modo de alto contraste e redimensionamento de
 * fonte. Persistidas em localStorage (escolha do spec — valem para
 * visitantes e sobrevivem a reloads) e aplicadas no elemento <html>
 * como classes (`dark`, `high-contrast`) + tamanho de fonte raiz.
 */

export type ThemePreferences = {
  theme: "light" | "dark";
  highContrast: boolean;
  /** Índice em FONT_SCALE_STEPS (0 = tamanho padrão). */
  fontScale: number;
};

export const STORAGE_KEY = "unicap-portal-a11y";

/** Passos de redimensionamento da fonte raiz (%, WCAG 1.4.4). */
export const FONT_SCALE_STEPS = [100, 112.5, 125] as const;

/** Padrão inicial: respeita a preferência do sistema no primeiro acesso. */
export function defaultPreferences(): ThemePreferences {
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    theme: prefersDark ? "dark" : "light",
    highContrast: false,
    fontScale: 0,
  };
}

/** Normaliza qualquer entrada (inclusive corrompida) para o tipo seguro. */
function normalize(raw: unknown): ThemePreferences {
  const fallback = defaultPreferences();
  if (typeof raw !== "object" || raw === null) return fallback;
  const value = raw as Record<string, unknown>;
  const theme =
    value.theme === "dark"
      ? "dark"
      : value.theme === "light"
        ? "light"
        : fallback.theme;
  const highContrast =
    typeof value.highContrast === "boolean"
      ? value.highContrast
      : fallback.highContrast;
  let fontScale = fallback.fontScale;
  if (typeof value.fontScale === "number" && Number.isFinite(value.fontScale)) {
    fontScale = Math.min(
      Math.max(Math.round(value.fontScale), 0),
      FONT_SCALE_STEPS.length - 1,
    );
  }
  return { theme, highContrast, fontScale };
}

/** Lê as preferências salvas; JSON inválido cai no padrão sem lançar. */
export function loadPreferences(): ThemePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultPreferences();
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(prefs: ThemePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(prefs)));
  } catch {
    // Storage indisponível (modo privado) — preferência vira só de sessão.
  }
}

/** Aplica as preferências no <html> (classes + tamanho de fonte raiz). */
export function applyPreferences(prefs: ThemePreferences): void {
  const root = document.documentElement;
  root.classList.toggle("dark", prefs.theme === "dark");
  root.classList.toggle("high-contrast", prefs.highContrast);
  root.style.fontSize = `${FONT_SCALE_STEPS[prefs.fontScale] ?? 100}%`;
}
