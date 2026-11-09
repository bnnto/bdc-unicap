/**
 * [DICIONARIO_FECHADO] Competências e idiomas só entram pelo dicionário
 * oficial — sem strings livres ("coxinha"). TDD da camada pura usada pelo
 * formulário (frontend) e pelas mutations `upsertProfile` /
 * `saveSkillsAndLanguages` (servidor).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, expect, it } from "vitest";
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

/** Novas áreas da EXPANSÃO (TAREFA 1 — dicionário "super"). */
const REQUIRED_ENG = [
  "AutoCAD",
  "Revit",
  "SolidWorks",
  "SAP2000",
  "Eletrônica Analógica",
  "CLP",
  "MATLAB",
];
const REQUIRED_DIR = [
  "Direito Civil",
  "Direito Penal",
  "Processo Trabalhista",
  "Compliance",
  "LGPD",
];
const REQUIRED_COM = [
  "SEO",
  "Copywriting",
  "Google Ads",
  "Jornalismo de Dados",
  "Assessoria de Imprensa",
];
const REQUIRED_SAUDE = [
  "Psicologia Clínica",
  "Avaliação Psicológica",
  "Primeiros Socorros",
  "Anatomia",
];
const REQUIRED_TECH_EXTRA = [
  "Vue.js",
  "Angular",
  "Kubernetes",
  "GCP",
  "Azure",
  "Figma Avançado",
];

/** Idiomas pedidos na EXPANSÃO (TAREFA 2 — 40+ idiomas). */
const REQUIRED_LANGUAGES_EXTRA = [
  "Árabe",
  "Sueco",
  "Holandês",
  "Polonês",
  "Hebraico",
  "Hindi",
];

// Limites mínimos exigidos pelo briefing (constantes nomeadas).
const MIN_SKILLS = 200;
const MIN_LANGUAGES = 40;
const MIN_MUTATIONS_COM_VALIDACAO = 2;

/** Termos de `terms` que NÃO estão em `list` (vazio = tudo presente). */
function missingFrom(list: readonly string[], terms: readonly string[]) {
  return terms.filter((term) => !list.includes(term));
}

type Validation =
  ReturnType<typeof validateSkills> | ReturnType<typeof validateLanguages>;

/** Exige validação com erro; estreita o tipo e confere as mensagens. */
function expectInvalid(result: Validation, ...patterns: RegExp[]) {
  assert(!result.ok, "esperava validação com erro (ok === false)");
  const message = result.errors.join(" ");
  for (const pattern of patterns) {
    expect(message).toMatch(pattern);
  }
}

const REQUIRED_SKILL_GROUPS: Array<[string, string[]]> = [
  ["Tech", REQUIRED_TECH],
  ["Game Dev", REQUIRED_GAME],
  ["Design", REQUIRED_DESIGN],
  ["Gestão/Engenharias", REQUIRED_GESTAO],
];

const EXPANSION_SKILL_GROUPS: Array<[string, string[]]> = [
  ["Engenharias", REQUIRED_ENG],
  ["Direito", REQUIRED_DIR],
  ["Comunicação/Marketing", REQUIRED_COM],
  ["Saúde/Psicologia", REQUIRED_SAUDE],
  ["Tech (extra)", REQUIRED_TECH_EXTRA],
];

const EXPECTED_GROUP_LABELS = [
  "Engenharias (Civil, Elétrica, Mecânica)",
  "Direito",
  "Comunicação / Marketing",
  "Saúde / Psicologia",
];

const CANONICAL_SKILLS: Array<[string, string | null]> = [
  ["  react  ", "React"],
  ["typescript", "TypeScript"],
  ["gestao de projetos", "Gestão de Projetos"],
  ["C#", "C#"],
  // Fora da lista = sem correspondência (nada de personalização).
  ["coxinha", null],
  ["   ", null],
];

const CANONICAL_LANGUAGES: Array<[string, string | null]> = [
  [" inglês ", "Inglês"],
  ["PORTUGUÊS", "Português"],
  ["klingon", null],
];

const FORM_FILE = "src/components/student/meucurriculo/ResumeForm.tsx";
const TALENT_FILE = "src/components/recruiter/talent/TalentSearchPage.tsx";

describe("dicionário fechado de competências", () => {
  it.each(REQUIRED_SKILL_GROUPS)(
    "inclui os termos obrigatórios de %s",
    (_grupo, terms) => {
      expect(missingFrom(SKILLS_DICTIONARY, terms)).toEqual([]);
    },
  );

  it("expansão TAREFA 1: centenas de termos", () => {
    // "Centenas de competências" — Engenharias, Direito, Comunicação,
    // Saúde/Psicologia além de Tech/Design.
    expect(SKILLS_DICTIONARY.length).toBeGreaterThanOrEqual(MIN_SKILLS);
  });

  it.each(EXPANSION_SKILL_GROUPS)(
    "expansão TAREFA 1: cobre a área %s",
    (_area, terms) => {
      expect(missingFrom(SKILLS_DICTIONARY, terms)).toEqual([]);
    },
  );

  it("expansão TAREFA 1: cada área vira um grupo (a UI agrupa por curso)", () => {
    const labels = SKILLS_GROUPS.map((group) => group.label);
    expect(missingFrom(labels, EXPECTED_GROUP_LABELS)).toEqual([]);
  });

  it("é congelado (dicionário e grupos)", () => {
    expect(Object.isFrozen(SKILLS_DICTIONARY)).toBe(true);
    expect(Object.isFrozen(SKILLS_GROUPS)).toBe(true);
  });

  it("não tem duplicatas", () => {
    expect(new Set(SKILLS_DICTIONARY).size).toBe(SKILLS_DICTIONARY.length);
  });

  it("os grupos cobrem todas as entradas (o que a UI renderiza nos <optgroup>)", () => {
    const fromGroups = SKILLS_GROUPS.flatMap((group) => [...group.items]);
    expect(fromGroups).toEqual([...SKILLS_DICTIONARY]);
  });

  it("comporta o limite máximo de competências por perfil", () => {
    expect(SKILLS_DICTIONARY.length).toBeGreaterThanOrEqual(MAX_SKILLS);
  });

  it.each(CANONICAL_SKILLS)(
    "canonicalSkill(%j) devolve %j",
    (input, expected) => {
      expect(canonicalSkill(input)).toBe(expected);
    },
  );

  it("addSkill ignora termo fora do dicionário (sem customização)", () => {
    expect(addSkill([], "coxinha")).toEqual([]);
  });

  it("addSkill grava a forma oficial do termo", () => {
    expect(addSkill([], "  react  ")).toEqual(["React"]);
    expect(addSkill([], "typescript")).toEqual(["TypeScript"]);
  });

  it("addSkill é idempotente para duplicata (mesma forma oficial)", () => {
    expect(addSkill(["React"], "REACT")).toEqual(["React"]);
  });

  it("validateSkills aceita termos do dicionário", () => {
    expect(validateSkills(["React", "Figma"])).toEqual({ ok: true });
  });

  it("validateSkills rejeita termo fora do dicionário com erro claro", () => {
    expectInvalid(
      validateSkills(["React", "coxinha"]),
      /coxinha/,
      /dicionário oficial/i,
    );
  });

  it("validateSkills rejeita termo vazio", () => {
    expect(validateSkills([""]).ok).toBe(false);
  });

  it("validateSkills não trata variação da forma oficial como erro", () => {
    // "REACT" é deduplicado na gravação pelo addSkill (regra da main).
    expect(validateSkills(["React", "react"])).toEqual({ ok: true });
  });

  it("validateSkills rejeita excesso de competências", () => {
    const excesso = validateSkills(SKILLS_DICTIONARY.slice(0, MAX_SKILLS + 1));
    expect(excesso.ok).toBe(false);
  });
});

describe("whitelist de idiomas", () => {
  it("inclui os idiomas principais pedidos", () => {
    expect(missingFrom(KNOWN_LANGUAGES, REQUIRED_LANGUAGES)).toEqual([]);
  });

  it("inclui Libras", () => {
    expect(KNOWN_LANGUAGES).toContain("Libras");
  });

  it("é congelada e sem duplicatas", () => {
    expect(Object.isFrozen(KNOWN_LANGUAGES)).toBe(true);
    expect(new Set(KNOWN_LANGUAGES).size).toBe(KNOWN_LANGUAGES.length);
  });

  it("expansão TAREFA 2: 40+ idiomas relevantes", () => {
    expect(KNOWN_LANGUAGES.length).toBeGreaterThanOrEqual(MIN_LANGUAGES);
  });

  it("expansão TAREFA 2: inclui Árabe, Sueco…", () => {
    expect(missingFrom(KNOWN_LANGUAGES, REQUIRED_LANGUAGES_EXTRA)).toEqual([]);
  });

  it.each(CANONICAL_LANGUAGES)(
    "canonicalLanguage(%j) devolve %j",
    (input, expected) => {
      expect(canonicalLanguage(input)).toBe(expected);
    },
  );

  it("addLanguage ignora idioma fora da whitelist", () => {
    expect(addLanguage([], { name: "Klingon", level: "fluente" })).toEqual([]);
  });

  it("addLanguage grava a forma oficial do idioma", () => {
    expect(addLanguage([], { name: " português ", level: "fluente" })).toEqual([
      { name: "Português", level: "fluente" },
    ]);
  });

  it("validateLanguages rejeita idioma fora da whitelist", () => {
    expectInvalid(
      validateLanguages([{ name: "Klingon", level: "fluente" }]),
      /dicionário oficial/i,
    );
  });

  it("validateLanguages aceita idiomas da whitelist", () => {
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

  describe("formulário de edição do currículo", () => {
    const src = read(FORM_FILE);

    it("monta os campos a partir do dicionário e da whitelist", () => {
      expect(src, "sem o dicionário de competências").toMatch(
        /SKILLS_(DICTIONARY|GROUPS)/,
      );
      expect(src, "sem KNOWN_LANGUAGES").toContain("KNOWN_LANGUAGES");
    });

    it("usa Combobox pesquisável para competência e idioma", () => {
      expect(src, "sem Combobox de competência").toMatch(
        /<Combobox[\s\S]{0,300}?ariaLabel="Nova competência"/,
      );
      expect(src, "sem Combobox de idioma").toMatch(
        /<Combobox[\s\S]{0,300}?ariaLabel="(Novo idioma|Idioma)"/,
      );
    });

    it("não tem campo de texto livre para competência nem idioma", () => {
      // Nem o <Input> do Design System: o caminho é sempre o Combobox.
      expect(src, "input livre de competência").not.toMatch(
        /<(input|Input)\b[^>]*(aria-label="Nova competência"|label="Nova competência"|placeholder="Ex\.)/,
      );
      expect(src, "input livre de idioma").not.toMatch(
        /<(input|Input)\b[^>]*(aria-label="Novo idioma"|label="Idioma")/,
      );
    });

    it("mantém os <select> remanescentes (níveis etc.)", () => {
      expect(src).toMatch(/<select\b/);
    });
  });

  it("servidor valida as duas listas antes de gravar", () => {
    const server = read("convex/students.ts");
    expect(server).toContain("validateSkills");
    expect(server).toContain("validateLanguages(");
  });

  it("as duas mutations que gravam skills/idiomas passam pela validação", () => {
    const server = read("convex/students.ts");
    expect(server.match(/validateSkills\(/g)?.length).toBeGreaterThanOrEqual(
      MIN_MUTATIONS_COM_VALIDACAO,
    );
  });

  describe("filtro do Banco de Talentos", () => {
    const src = read(TALENT_FILE);

    it("competências: Combobox do dicionário agrupado", () => {
      expect(src).toContain("SKILLS_GROUPS");
      expect(src).toMatch(
        /<Combobox[\s\S]{0,300}?ariaLabel="Nova competência"/,
      );
    });

    it("competências: nunca campo de texto livre nem <select> nativo", () => {
      expect(src).not.toMatch(
        /<(input|Input)\b[^>]*aria-label="Nova competência"/,
      );
      expect(src).not.toMatch(
        /<select[\s\S]{0,300}?aria-label="Nova competência"/,
      );
      expect(src).not.toContain('placeholder="Ex.: SQL"');
    });

    it("idioma: Combobox da whitelist (datalist removido)", () => {
      expect(src).toMatch(/<Combobox[\s\S]{0,300}?ariaLabel="Idioma"/);
      expect(src).not.toContain('list="talent-language-options"');
    });
  });
});
