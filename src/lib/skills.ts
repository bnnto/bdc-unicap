/**
 * Regras puras de competências e idiomas (issue [S1-5]).
 *
 * [DICIONARIO_FECHADO] O utilizador SÓ seleciona termos das listas
 * oficiais — sem introdução de strings livres ("coxinha"). A forma
 * gravada é SEMPRE a canônica do dicionário (caixa/acentos oficiais).
 *
 * Usadas no formulário (frontend) e nas mutations `upsertProfile` /
 * `saveSkillsAndLanguages` (servidor) — TDD.
 */

export const MAX_SKILLS = 20;
export const MAX_LANGUAGES = 8;

/** Área do dicionário — vira <optgroup> nos selects de edição. */
export type SkillGroup = {
  readonly label: string;
  readonly items: readonly string[];
};

const GROUPS_INPUT: ReadonlyArray<{
  readonly label: string;
  readonly items: ReadonlyArray<string>;
}> = [
  {
    label: "Tech / Dev",
    items: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript",
      "HTML",
      "CSS",
      "Tailwind CSS",
      "Vue.js",
      "Angular",
      "Node.js",
      "Python",
      "Java",
      "C++",
      "C#",
      "PHP",
      "Ruby",
      "Django",
      "Spring",
      "Laravel",
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Redis",
      "SQL",
      "GraphQL",
      "Docker",
      "Kubernetes",
      "Git",
      "Linux",
      "AWS",
      "React Native",
      "Expo",
      "Flutter",
      "Kotlin",
      "Swift",
      "R",
    ],
  },
  {
    label: "Game Dev / AR-VR",
    items: ["Unity", "Unreal Engine", "Blender"],
  },
  {
    label: "Design / UX",
    items: [
      "Figma",
      "Adobe XD",
      "Photoshop",
      "Illustrator",
      "InDesign",
      "After Effects",
      "UI/UX Design",
      "Prototipagem",
    ],
  },
  {
    label: "Gestão / Engenharias / Outros",
    items: [
      "Scrum",
      "Kanban",
      "Gestão de Projetos",
      "Excel",
      "Excel Avançado",
      "Power BI",
      "Estatística",
      "Matemática Discreta",
      "Redes de Computadores",
      "Comunicação",
      "Trabalho em Equipe",
      "Liderança",
      "Resolução de Problemas",
    ],
  },
];

/** Dicionário oficial agrupado (congelado — só leitura). */
export const SKILLS_GROUPS: readonly SkillGroup[] = Object.freeze(
  GROUPS_INPUT.map((group) =>
    Object.freeze({
      label: group.label,
      items: Object.freeze([...group.items]),
    }),
  ),
);

/**
 * [DICIONARIO_FECHADO] Whitelist oficial de competências — qualquer
 * entrada fora daqui é rejeitada no cliente e no servidor.
 */
export const SKILLS_DICTIONARY: readonly string[] = Object.freeze(
  SKILLS_GROUPS.reduce<string[]>(
    (all, group) => all.concat([...group.items]),
    [],
  ),
);

/**
 * [DICIONARIO_FECHADO] Whitelist de idiomas: os principais idiomas
 * (Português, Inglês, Espanhol, Francês, Alemão, Italiano, Mandarim,
 * Japonês, Coreano, Russo…) + Libras. Somente leitura — consumidores
 * não podem mutar o catálogo.
 */
export const KNOWN_LANGUAGES: readonly string[] = Object.freeze([
  "Alemão",
  "Árabe",
  "Coreano",
  "Espanhol",
  "Francês",
  "Grego",
  "Holandês",
  "Inglês",
  "Italiano",
  "Japonês",
  "Libras",
  "Mandarim",
  "Português",
  "Russo",
  "Turco",
] as const);

export const LANGUAGE_LEVELS = [
  "basico",
  "intermediario",
  "avancado",
  "fluente",
  "nativo",
] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export type LanguageEntry = { name: string; level: LanguageLevel };

/**
 * Chave de comparação do dicionário: caixa, acentos, espaços e pontos
 * são ignorados ("  Gestao de Projetos " → "gestaodeprojetos"), mas a
 * forma GRAVADA é sempre a canônica da lista oficial.
 */
function dictionaryKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\s]+/g, "");
}

function buildIndex(
  dictionary: readonly string[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const term of dictionary) {
    index.set(dictionaryKey(term), term);
  }
  return index;
}

const SKILL_INDEX = buildIndex(SKILLS_DICTIONARY);
const LANGUAGE_INDEX = buildIndex(KNOWN_LANGUAGES);

/**
 * Forma oficial da competência no dicionário, ou `null` quando o termo
 * não consta da whitelist (string livre — proibida).
 */
export function canonicalSkill(raw: string): string | null {
  const key = dictionaryKey(raw);
  if (key.length === 0) return null;
  return SKILL_INDEX.get(key) ?? null;
}

/** Forma oficial do idioma na whitelist, ou `null` (fora da lista). */
export function canonicalLanguage(raw: string): string | null {
  const key = dictionaryKey(raw);
  if (key.length === 0) return null;
  return LANGUAGE_INDEX.get(key) ?? null;
}

/**
 * Adiciona competência do dicionário (forma oficial); termo livre não
 * entra. Idempotente (case-insensitive) e limitada.
 */
export function addSkill(skills: readonly string[], raw: string): string[] {
  const name = canonicalSkill(raw);
  if (name === null) return [...skills];
  if (skills.some((s) => dictionaryKey(s) === dictionaryKey(name))) {
    return [...skills];
  }
  if (skills.length >= MAX_SKILLS) return [...skills];
  return [...skills, name];
}

/** Remove competência (case-insensitive). */
export function removeSkill(skills: readonly string[], raw: string): string[] {
  const target = dictionaryKey(raw);
  return skills.filter((s) => dictionaryKey(s) !== target);
}

/**
 * Adiciona idioma da whitelist (forma oficial) com nível válido; um
 * registro por idioma (case-insensitive). Nome fora da lista não entra.
 */
export function addLanguage(
  languages: readonly LanguageEntry[],
  entry: { name: string; level: LanguageLevel },
): LanguageEntry[] {
  const name = canonicalLanguage(entry.name);
  if (name === null) return [...languages];
  if (!LANGUAGE_LEVELS.includes(entry.level)) return [...languages];
  if (languages.some((l) => dictionaryKey(l.name) === dictionaryKey(name))) {
    return [...languages];
  }
  if (languages.length >= MAX_LANGUAGES) return [...languages];
  return [...languages, { name, level: entry.level }];
}

/** Remove idioma pelo nome (case-insensitive). */
export function removeLanguage(
  languages: readonly LanguageEntry[],
  rawName: string,
): LanguageEntry[] {
  const target = dictionaryKey(rawName);
  return languages.filter((l) => dictionaryKey(l.name) !== target);
}

export type SkillsValidation = { ok: true } | { ok: false; errors: string[] };

/**
 * [DICIONARIO_FECHADO] Valida a lista de competências: só termos do
 * dicionário oficial, sem vazios e dentro do limite — qualquer termo
 * livre é rejeitado com erro claro (cliente e servidor). Variações da
 * mesma forma oficial ("REACT"/"react") são deduplicadas na gravação
 * pelo `addSkill`, como sempre foi — não é erro.
 */
export function validateSkills(skills: readonly string[]): SkillsValidation {
  const errors: string[] = [];

  if (skills.length > MAX_SKILLS) {
    errors.push(`Máximo de ${MAX_SKILLS} competências.`);
  }

  for (const raw of skills) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (name.length === 0) {
      errors.push("Competência vazia não é permitida.");
      continue;
    }
    if (canonicalSkill(name) === null) {
      errors.push(
        `Competência fora do dicionário oficial: "${name}". Escolha uma competência da lista.`,
      );
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type LanguagesValidation =
  { ok: true } | { ok: false; errors: string[] };

/**
 * Valida lista completa de idiomas: whitelist oficial, nomes, níveis,
 * duplicatas e limite. Nome fora da whitelist é rejeitado com erro.
 */
export function validateLanguages(
  languages: readonly LanguageEntry[],
): LanguagesValidation {
  const errors: string[] = [];

  if (languages.length > MAX_LANGUAGES) {
    errors.push(`Máximo de ${MAX_LANGUAGES} idiomas.`);
  }

  const seen = new Set<string>();
  for (const l of languages) {
    const name = l.name.trim();
    if (name.length === 0) {
      errors.push("Informe o nome do idioma.");
      continue;
    }
    if (canonicalLanguage(name) === null) {
      errors.push(
        `Idioma fora do dicionário oficial: "${name}". Escolha um idioma da lista.`,
      );
    }
    if (!LANGUAGE_LEVELS.includes(l.level)) {
      errors.push(`Nível inválido para o idioma ${name}.`);
    }
    const key = dictionaryKey(name);
    if (seen.has(key)) {
      errors.push(`Idioma duplicado: ${name}.`);
    }
    seen.add(key);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
