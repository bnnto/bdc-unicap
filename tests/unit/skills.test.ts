import { describe, expect, it } from "vitest";
import {
  LANGUAGE_LEVELS,
  MAX_SKILLS,
  MAX_LANGUAGES,
  SKILLS_DICTIONARY,
  addSkill,
  removeSkill,
  addLanguage,
  removeLanguage,
  validateLanguages,
  type LanguageEntry,
} from "../../src/lib/skills";

describe("competências (S1-5)", () => {
  it("adiciona competência normalizada (trim) e sem duplicatas", () => {
    const skills = addSkill(["React", "TypeScript"], "  react  ");
    expect(skills).toEqual(["React", "TypeScript"]);
  });

  it("adota a forma oficial do dicionário (typescript → TypeScript)", () => {
    const skills = addSkill([], "typescript");
    expect(skills).toEqual(["TypeScript"]);
  });

  it("rejeita termo fora do dicionário (dicionário fechado)", () => {
    expect(addSkill([], "coxinha")).toEqual([]);
    expect(addSkill(["React"], "coxinha")).toEqual(["React"]);
  });

  it("ignora string vazia/só espaços", () => {
    expect(addSkill([], "   ")).toEqual([]);
    expect(addSkill(["React"], "")).toEqual(["React"]);
  });

  it("remove competência existente e ignora inexistente", () => {
    const skills = ["React", "TypeScript"];
    expect(removeSkill(skills, "react")).toEqual(["TypeScript"]);
    expect(removeSkill(skills, "Rust")).toEqual(["React", "TypeScript"]);
  });

  it("respeita limite máximo de competências", () => {
    let skills: string[] = [];
    for (let i = 0; i < MAX_SKILLS + 5; i += 1) {
      skills = addSkill(skills, SKILLS_DICTIONARY[i] ?? "");
    }
    expect(skills.length).toBe(MAX_SKILLS);
  });
});

describe("idiomas (S1-5)", () => {
  const levels = LANGUAGE_LEVELS;

  it("níveis de idioma aceitos", () => {
    expect(levels).toEqual([
      "basico",
      "intermediario",
      "avancado",
      "fluente",
      "nativo",
    ]);
  });

  it("adiciona idioma com nível válido, sem duplicar idioma", () => {
    const langs = addLanguage([], { name: "Inglês", level: "avancado" });
    expect(langs).toEqual([{ name: "Inglês", level: "avancado" }]);
    const duplicado = addLanguage(langs, {
      name: " inglês ",
      level: "fluente",
    });
    expect(duplicado).toEqual([{ name: "Inglês", level: "avancado" }]);
  });

  it("rejeita nível inválido (não adiciona)", () => {
    const langs = addLanguage([], {
      name: "Espanhol",
      level: "c1" as never,
    });
    expect(langs).toEqual([]);
  });

  it("remove idioma por nome (case-insensitive)", () => {
    const langs: LanguageEntry[] = [
      { name: "Inglês", level: "fluente" },
      { name: "Espanhol", level: "basico" },
    ];
    expect(removeLanguage(langs, "INGLÊS")).toEqual([
      { name: "Espanhol", level: "basico" },
    ]);
  });

  it("valida lista completa: nomes e níveis, sem duplicatas, dentro do limite", () => {
    const ok = validateLanguages([
      { name: "Inglês", level: "fluente" },
      { name: "Espanhol", level: "basico" },
    ]);
    expect(ok).toEqual({ ok: true });

    const nivelRuim = validateLanguages([
      { name: "Inglês", level: "b2" as never },
    ]);
    expect(nivelRuim).toEqual({
      ok: false,
      errors: ["Nível inválido para o idioma Inglês."],
    });

    const nomeRuim = validateLanguages([{ name: "  ", level: "fluente" }]);
    expect(nomeRuim.ok).toBe(false);

    const duplicado = validateLanguages([
      { name: "Inglês", level: "fluente" },
      { name: "inglês", level: "basico" },
    ]);
    expect(duplicado.ok).toBe(false);

    const excesso = validateLanguages(
      Array.from({ length: MAX_LANGUAGES + 1 }, (_, i) => ({
        name: `Idioma${i}`,
        level: "basico" as const,
      })),
    );
    expect(excesso.ok).toBe(false);
  });
});
