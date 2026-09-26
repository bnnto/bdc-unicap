/**
 * Algoritmo de Matching % de compatibilidade currículo × vaga
 * (issue [S3-3], R8). Função pura, determinística e sem I/O — TDD.
 *
 * Arquitetura do score (0–100, inteiro):
 * - Pré-requisitos (base): até 90 pontos, proporcionais aos pesos —
 *   obrigatório 1.2 · opcional 1.0 (transparência R8: obrigatório pesa mais).
 * - Bônus de idioma: +6 quando o candidato possui o idioma exigido
 *   pela vaga no nível pedido ou superior.
 * - Bônus de disponibilidade: +4 quando a disponibilidade do candidato
 *   coincide exatamente com a da vaga.
 *
 * Faixas de exibição: ≥85% Strong · 50–84% Medium · <50% Low.
 */
import { normalizeForSearch } from "./talentSearch";
import { LANGUAGE_LEVELS, type LanguageLevel } from "./skills";
import type { Availability } from "./studentProfile";

/** Pesos dos pré-requisitos (CA 1). */
export const WEIGHT_REQUIRED = 1.2;
export const WEIGHT_OPTIONAL = 1.0;

/** Bônus (CA 1). */
export const LANGUAGE_BONUS = 6;
export const AVAILABILITY_BONUS = 4;

/** Base dos pré-requisitos: 90 + 6 + 4 = 100. */
export const BASE_MAX = 90;

export type MatchingPrerequisite = {
  item: string;
  required: boolean;
};

export type MatchingLanguageRequirement = {
  name: string;
  level: LanguageLevel;
};

export type MatchingCandidate = {
  skills: readonly string[];
  languages: ReadonlyArray<{ name: string; level: LanguageLevel }>;
  availability: Availability;
};

export type MatchingJob = {
  prerequisites: ReadonlyArray<MatchingPrerequisite>;
  /** Idioma mínimo exigido pela vaga (quando exigido). */
  requiredLanguage?: MatchingLanguageRequirement;
  /** Disponibilidade desejada pela vaga (quando exigida). */
  availability?: Availability;
};

const LEVEL_ORDER: Record<LanguageLevel, number> = Object.fromEntries(
  LANGUAGE_LEVELS.map((level, index) => [level, index + 1]),
) as Record<LanguageLevel, number>;

function prerequisiteWeight(required: boolean): number {
  return required ? WEIGHT_REQUIRED : WEIGHT_OPTIONAL;
}

/**
 * Pré-requisito atendido quando existe skill equivalente (sem acento/caixa).
 * Exportada para reuso no bloqueio de candidaturas (S3-5).
 */
export function hasSkillFor(skills: readonly string[], item: string): boolean {
  const wanted = normalizeForSearch(item);
  return skills.some((skill) => normalizeForSearch(skill) === wanted);
}

/** Idioma atendido quando nome coincide e nível é igual ou superior. */
function hasLanguageAtLeast(
  languages: MatchingCandidate["languages"],
  requirement: MatchingLanguageRequirement,
): boolean {
  const wanted = normalizeForSearch(requirement.name);
  return languages.some(
    (language) =>
      normalizeForSearch(language.name) === wanted &&
      LEVEL_ORDER[language.level] >= LEVEL_ORDER[requirement.level],
  );
}

/**
 * Score de compatibilidade 0–100 (inteiro) entre currículo e vaga.
 * Determinístico: mesma entrada produz sempre o mesmo resultado (CA 2).
 */
export function computeMatchScore(
  candidate: MatchingCandidate,
  job: MatchingJob,
): number {
  let totalWeight = 0;
  let attendedWeight = 0;
  for (const prerequisite of job.prerequisites) {
    const weight = prerequisiteWeight(prerequisite.required);
    totalWeight += weight;
    if (hasSkillFor(candidate.skills, prerequisite.item)) {
      attendedWeight += weight;
    }
  }
  const baseFraction = totalWeight === 0 ? 1 : attendedWeight / totalWeight;

  const languageEarned =
    job.requiredLanguage !== undefined &&
    hasLanguageAtLeast(candidate.languages, job.requiredLanguage)
      ? LANGUAGE_BONUS
      : 0;

  const availabilityEarned =
    job.availability !== undefined &&
    candidate.availability === job.availability
      ? AVAILABILITY_BONUS
      : 0;

  const raw = baseFraction * BASE_MAX + languageEarned + availabilityEarned;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

export type MatchBand = "strong" | "medium" | "low";

/** Faixas de exibição (CA 3): ≥85 Strong · 50–84 Medium · <50 Low. */
export function matchBand(score: number): MatchBand {
  if (score >= 85) return "strong";
  if (score >= 50) return "medium";
  return "low";
}

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  strong: "Match forte",
  medium: "Match médio",
  low: "Match baixo",
};
