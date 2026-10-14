/**
 * [DICIONARIO_FECHADO] Competências e idiomas só entram pelo dicionário
 * oficial — sem strings livres ("coxinha"). TDD da camada pura usada pelo
 * formulário (frontend) e pelas mutations `upsertProfile` /
 * `saveSkillsAndLanguages` (servidor).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_LANGUAGES,
  MAX_LANGUAGES,
  MAX_SKILLS,
  SKILLS_DICTIONARY,
  SKILLS_GROUPS,
  addLanguage,
  addSkill,
  canonicalLanguage,
  canonicalSkill,
  validateLanguages,
  validateSkills,
} from "../../src/lib/skills";

/** Termos que o dicionário DEVE ter (briefing — todos os cursos UNICAP). */
const REQUIRED_TECH = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "Node.js",
  "Django",
  "PostgreSQL",
  "Docker",
  "Git",
  "SQL",
  "React Native",
  "Expo",
  "AWS",
];

const REQUIRED_GAME = ["Unity", "Unreal Engine", "Blender"];

const REQUIRED_DESIGN = [
  "Figma",
  "Adobe XD",
  "Photoshop",
  "Illustrator",
  "UI/UX Design",
  "Prototipagem",
];

const REQUIRED_GESTAO = [
  "Scrum",
  "Kanban",
  "Gestão de Projetos",
  "Excel Avançado",
  "Power BI",
  "Estatística",
  "Matemática Discreta",
  "Redes de Computadores",
];

const REQUIRED_LANGUAGES = [
  "Português",
  "Inglês",
  "Espanhol",
  "Francês",
  "Alemão",
  "Italiano",
  "Mandarim",
  "Japonês",
  "Coreano",
  "Russo",
];

describe("dicionário fechado de competências", () => {
  it("inclui obrigatoriamente Tech, Game Dev, Design e Gestão/Engenharias", () => {
    for (const term of [
      ...REQUIRED_TECH,
      ...REQUIRED_GAME,
      ...REQUIRED_DESIGN,
      ...REQUIRED_GESTAO,
    ]) {
      expect(SKILLS_DICTIONARY, `falta "${term}"`).toContain(term);
    }
  });

  it("é congelado, sem duplicatas e agrupado por área", () => {
    expect(Object.isFrozen(SKILLS_DICTIONARY)).toBe(true);
    expect(Object.isFrozen(SKILLS_GROUPS)).toBe(true);
    expect(new Set(SKILLS_DICTIONARY).size).toBe(SKILLS_DICTIONARY.length);
    // Grupos cobrem todas as entradas — é o que a UI renderiza nos <optgroup>.
    const fromGroups = SKILLS_GROUPS.flatMap((group) => [...group.items]);
    expect(fromGroups).toEqual([...SKILLS_DICTIONARY]);
    expect(SKILLS_DICTIONARY.length).toBeGreaterThanOrEqual(MAX_SKILLS);
  });

  it("canonicalSkill devolve a forma oficial ou null para termo livre", () => {
    expect(canonicalSkill("  react  ")).toBe("React");
    expect(canonicalSkill("typescript")).toBe("TypeScript");
    expect(canonicalSkill("gestao de projetos")).toBe("Gestão de Projetos");
    expect(canonicalSkill("C#")).toBe("C#");
    // Fora da lista = sem correspondência (nada de personalização).
    expect(canonicalSkill("coxinha")).toBeNull();
    expect(canonicalSkill("   ")).toBeNull();
  });

  it("addSkill só aceita termos do dicionário (sem customização)", () => {
    expect(addSkill([], "coxinha")).toEqual([]);
    expect(addSkill([], "  react  ")).toEqual(["React"]);
    expect(addSkill([], "typescript")).toEqual(["TypeScript"]);
    // Duplicata (mesma forma oficial) segue idempotente.
    expect(addSkill(["React"], "REACT")).toEqual(["React"]);
  });

  it("validateSkills rejeita termo fora do dicionário com erro claro", () => {
    const ok = validateSkills(["React", "Figma"]);
    expect(ok).toEqual({ ok: true });

    const livre = validateSkills(["React", "coxinha"]);
    expect(livre.ok).toBe(false);
    if (!livre.ok) {
      expect(livre.errors.join(" ")).toMatch(/coxinha/);
      expect(livre.errors.join(" ")).toMatch(/dicionário oficial/i);
    }

    const vazio = validateSkills([""]);
    expect(vazio.ok).toBe(false);

    // Variações da mesma forma oficial ("REACT") são deduplicadas na
    // gravação pelo addSkill (regra da main) — não são erro.
    expect(validateSkills(["React", "react"])).toEqual({ ok: true });

    const excesso = validateSkills(SKILLS_DICTIONARY.slice(0, MAX_SKILLS + 1));
    expect(excesso.ok).toBe(false);
  });
});

describe("whitelist de idiomas", () => {
  it("inclui os idiomas principais pedidos (mais Libras)", () => {
    for (const language of REQUIRED_LANGUAGES) {
      expect(KNOWN_LANGUAGES, `falta "${language}"`).toContain(language);
    }
    expect(KNOWN_LANGUAGES).toContain("Libras");
    expect(Object.isFrozen(KNOWN_LANGUAGES)).toBe(true);
    expect(new Set(KNOWN_LANGUAGES).size).toBe(KNOWN_LANGUAGES.length);
  });

  it("canonicalLanguage devolve a forma oficial ou null", () => {
    expect(canonicalLanguage(" inglês ")).toBe("Inglês");
    expect(canonicalLanguage("PORTUGUÊS")).toBe("Português");
    expect(canonicalLanguage("klingon")).toBeNull();
  });

  it("addLanguage só aceita idiomas da whitelist", () => {
    expect(addLanguage([], { name: "Klingon", level: "fluente" })).toEqual([]);
    expect(addLanguage([], { name: " português ", level: "fluente" })).toEqual([
      { name: "Português", level: "fluente" },
    ]);
  });

  it("validateLanguages rejeita idioma fora da whitelist", () => {
    const fora = validateLanguages([{ name: "Klingon", level: "fluente" }]);
    expect(fora.ok).toBe(false);
    if (!fora.ok) {
      expect(fora.errors.join(" ")).toMatch(/dicionário oficial/i);
    }

    const ok = validateLanguages([
      { name: "Inglês", level: "fluente" },
      { name: "Mandarim", level: "basico" },
    ]);
    expect(ok).toEqual({ ok: true });
  });

  it("excesso continua rejeitado (limite de idiomas)", () => {
    const excesso = validateLanguages(
      KNOWN_LANGUAGES.slice(0, MAX_LANGUAGES + 1).map((name) => ({
        name,
        level: "basico" as const,
      })),
    );
    expect(excesso.ok).toBe(false);
  });
});

describe("pontos de entrada sem texto livre", () => {
  const root = process.cwd();
  const read = (path: string) => readFileSync(join(root, path), "utf8");

  it("formulários de edição leem o dicionário (select, não input livre)", () => {
    for (const file of [
      "src/components/student/ResumeForm.tsx",
      "src/components/student/StudentProfileForm.tsx",
    ]) {
      const src = read(file);
      // O <select> de competências é montado a partir do dicionário
      // (lista plana ou agrupada por área em <optgroup>).
      expect(src, `${file} sem o dicionário de competências`).toMatch(
        /SKILLS_(DICTIONARY|GROUPS)/,
      );
      expect(src, `${file} sem KNOWN_LANGUAGES`).toContain("KNOWN_LANGUAGES");
      // Nada de campo de texto (nem o <Input> do Design System) para
      // competência: o caminho é sempre o <select> do dicionário.
      expect(src, `${file} com input livre de competência`).not.toMatch(
        /<(input|Input)\b[^>]*(aria-label="Nova competência"|label="Nova competência"|placeholder="Ex\.)/,
      );
      // Nem para idioma fora da whitelist.
      expect(src, `${file} com input livre de idioma`).not.toMatch(
        /<(input|Input)\b[^>]*(aria-label="Novo idioma"|label="Idioma")/,
      );
      expect(src, `${file} sem <select> de dicionário`).toMatch(/<select\b/);
    }
  });

  it("servidor valida as duas listas antes de gravar", () => {
    const server = read("convex/students.ts");
    expect(server).toContain("validateSkills");
    // As duas mutations que gravam skills/idiomas passam pela validação.
    expect(server.match(/validateSkills\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(server).toContain("validateLanguages(");
  });

  it("filtro de competências do Banco de Talentos é select do dicionário", () => {
    const src = read("src/components/talent/TalentSearchPage.tsx");
    expect(src).toContain("SKILLS_GROUPS");
    // O filtro é um <select> com aria-label, nunca campo de texto livre.
    // (lazy e limitado: os atributos do <select> contêm "=>", por isso não [^>]).
    expect(src).toMatch(/<select[\s\S]{0,300}?aria-label="Nova competência"/);
    expect(src).not.toMatch(
      /<(input|Input)\b[^>]*aria-label="Nova competência"/,
    );
    expect(src).not.toContain('placeholder="Ex.: SQL"');
  });
});
