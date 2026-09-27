/**
 * Regras puras de competências e idiomas (issue [S1-5]).
 * Usadas no formulário e na mutation `upsertProfile` — TDD.
 */

export const MAX_SKILLS = 20;
export const MAX_LANGUAGES = 8;

/**
 * [UX-P3] H6-1 — catálogo de idiomas para sugestão (datalist) nos campos
 * de idioma: reconhecimento em vez de memorização/soletração livre.
 * Somente leitura — consumidores não podem mutar o catálogo.
 */
export const KNOWN_LANGUAGES: readonly string[] = Object.freeze([
  "Alemão",
  "Espanhol",
  "Francês",
  "Inglês",
  "Italiano",
  "Japonês",
  "Libras",
  "Mandarim",
  "Português",
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

function normalizeSkillName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Adiciona competência normalizada; idempotente (case-insensitive) e limitada. */
export function addSkill(skills: readonly string[], raw: string): string[] {
  const name = normalizeSkillName(raw);
  if (name.length === 0) return [...skills];
  if (skills.some((s) => s.toLowerCase() === name.toLowerCase())) {
    return [...skills];
  }
  if (skills.length >= MAX_SKILLS) return [...skills];
  return [...skills, name];
}

/** Remove competência (case-insensitive). */
export function removeSkill(skills: readonly string[], raw: string): string[] {
  const target = raw.trim().toLowerCase();
  return skills.filter((s) => s.toLowerCase() !== target);
}

/** Adiciona idioma com nível válido; um registro por idioma (case-insensitive). */
export function addLanguage(
  languages: readonly LanguageEntry[],
  entry: { name: string; level: LanguageLevel },
): LanguageEntry[] {
  const name = entry.name.trim().replace(/\s+/g, " ");
  if (name.length === 0) return [...languages];
  if (!LANGUAGE_LEVELS.includes(entry.level)) return [...languages];
  if (languages.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
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
  const target = rawName.trim().toLowerCase();
  return languages.filter((l) => l.name.toLowerCase() !== target);
}

export type LanguagesValidation =
  { ok: true } | { ok: false; errors: string[] };

/** Valida lista completa de idiomas (nomes, níveis, duplicatas e limite). */
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
    if (!LANGUAGE_LEVELS.includes(l.level)) {
      errors.push(`Nível inválido para o idioma ${name}.`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Idioma duplicado: ${name}.`);
    }
    seen.add(key);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
