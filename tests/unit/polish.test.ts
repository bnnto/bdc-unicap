import { describe, expect, it } from "vitest";
import { formatDay } from "../../src/lib/formatters";
import { KNOWN_LANGUAGES } from "../../src/lib/skills";

describe("formatDay (UX-P3, H6-2 — datas legíveis)", () => {
  it("formata timestamp como dd/mm/aaaa (pt-BR)", () => {
    // 2026-01-05T12:00:00Z — formato é o que importa, não o fuso do teste.
    const timestamp = Date.UTC(2026, 0, 5, 12, 0, 0);
    expect(formatDay(timestamp)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("ausente vira travessão (não 'Invalid Date' nem vazio)", () => {
    expect(formatDay(undefined)).toBe("—");
  });
});

describe("KNOWN_LANGUAGES (UX-P3, H6-1 — sugestões do datalist)", () => {
  it("inclui os idiomas esperados pelo portal", () => {
    expect(KNOWN_LANGUAGES).toContain("Inglês");
    expect(KNOWN_LANGUAGES).toContain("Espanhol");
    expect(KNOWN_LANGUAGES).toContain("Português");
    expect(KNOWN_LANGUAGES).toContain("Francês");
    expect(KNOWN_LANGUAGES).toContain("Alemão");
    expect(KNOWN_LANGUAGES).toContain("Mandarim");
    expect(KNOWN_LANGUAGES).toContain("Libras");
  });

  it("não tem duplicatas", () => {
    expect(new Set(KNOWN_LANGUAGES).size).toBe(KNOWN_LANGUAGES.length);
  });

  it("é lista somente leitura (não mutável por consumidores)", () => {
    expect(Object.isFrozen(KNOWN_LANGUAGES)).toBe(true);
  });
});
