/**
 * [PERFIL_E_LGPD] Etapa 1 — preferências de acessibilidade (tema
 * escuro, alto contraste e redimensionamento de fonte) persistidas em
 * localStorage e aplicadas no elemento <html>.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  FONT_SCALE_STEPS,
  STORAGE_KEY,
  applyPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from "../../src/lib/preferences";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "high-contrast");
  document.documentElement.style.fontSize = "";
});

describe("[PERFIL_E_LGPD] preferências de acessibilidade (Etapa 1)", () => {
  it("padrão: tema claro, sem alto contraste e fonte 100%", () => {
    const prefs = defaultPreferences();
    expect(prefs.theme).toBe("light");
    expect(prefs.highContrast).toBe(false);
    expect(prefs.fontScale).toBe(0);
    expect(FONT_SCALE_STEPS[0]).toBe(100);
  });

  it("roundtrip: salvar e carregar preserva os valores no localStorage", () => {
    savePreferences({ theme: "dark", highContrast: true, fontScale: 2 });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadPreferences()).toEqual({
      theme: "dark",
      highContrast: true,
      fontScale: 2,
    });
  });

  it("JSON corrompido cai no padrão sem lançar erro", () => {
    localStorage.setItem(STORAGE_KEY, "{corrompido");
    expect(loadPreferences()).toEqual(defaultPreferences());
  });

  it("valores fora da faixa são normalizados (fontScale 0..2)", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: "dark", highContrast: false, fontScale: 99 }),
    );
    expect(loadPreferences().fontScale).toBe(2);
  });

  it("applyPreferences liga e desliga as classes no <html>", () => {
    applyPreferences({ theme: "dark", highContrast: true, fontScale: 0 });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(
      true,
    );

    applyPreferences({ theme: "light", highContrast: false, fontScale: 0 });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(
      false,
    );
  });

  it("applyPreferences aplica o tamanho de fonte no <html>", () => {
    applyPreferences({ theme: "light", highContrast: false, fontScale: 2 });
    expect(document.documentElement.style.fontSize).toBe("125%");

    applyPreferences({ theme: "light", highContrast: false, fontScale: 0 });
    expect(document.documentElement.style.fontSize).toBe("100%");
  });
});
