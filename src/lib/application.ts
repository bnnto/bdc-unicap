/**
 * Regras puras de Candidatura (issues [S3-4]/[S4-1], R8).
 * Compartilhadas entre as mutations/queries Convex (`applications`) e a
 * UI do aluno/recrutador — TDD, sem I/O.
 */
import type { LanguageLevel } from "./skills";
import type { Availability } from "./studentProfile";
import { hasSkillFor } from "./matching";

/**
 * Pipeline do Kanban (S4-1): as 5 colunas do issue, na ordem de fluxo.
 * Stage inicial "inscrito" (CA 3 de S3-4); "Aprovado" consolida
 * proposta/contratação conforme a especificação do issue.
 */
export const APPLICATION_STAGES = [
  "inscrito",
  "triagem",
  "entrevista",
  "aprovado",
  "reprovado",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  inscrito: "Inscrito",
  triagem: "Em Triagem",
  entrevista: "Entrevista",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

/**
 * Movimentação de card entre colunas (CA 1): qualquer coluna → qualquer
 * outra é permitida (pipeline real tem retorno de entrevista → triagem);
 * mover para a própria coluna é no-op e é rejeitado pela mutation.
 */
export function canTransitionTo(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  return from !== to;
}

/** Guarda de validação de stage (mutation aceita apenas valores válidos). */
export function isApplicationStage(value: unknown): value is ApplicationStage {
  return (
    typeof value === "string" &&
    (APPLICATION_STAGES as readonly string[]).includes(value)
  );
}

/** Agrupa candidaturas por coluna, com todas as 5 colunas presentes. */
export function groupApplicationsByStage<T extends { stage: ApplicationStage }>(
  applications: readonly T[],
): Record<ApplicationStage, T[]> {
  const grouped = {
    inscrito: [],
    triagem: [],
    entrevista: [],
    aprovado: [],
    reprovado: [],
  } as Record<ApplicationStage, T[]>;
  for (const application of applications) {
    grouped[application.stage].push(application);
  }
  return grouped;
}

/** Job mínimo necessário para decidir se a vaga aceita candidatura. */
export type ApplicableJob = {
  status: "aberta" | "fechada" | "encerrada";
  /** R4 — vencida não aceita candidatura (undefined = vaga legada aberta). */
  expiresAt?: number;
};

export type ApplyDecision =
  { ok: true } | { ok: false; reason: "vaga_nao_aberta" | "vaga_expirada" };

/**
 * A vaga aceita candidatura? Somente abertas e dentro do prazo (R4).
 */
export function canApplyTo(job: ApplicableJob, now: number): ApplyDecision {
  if (job.status !== "aberta") return { ok: false, reason: "vaga_nao_aberta" };
  if (job.expiresAt !== undefined && job.expiresAt <= now) {
    return { ok: false, reason: "vaga_expirada" };
  }
  return { ok: true };
}

/**
 * [S3-5] Bloqueio de candidatura fora dos requisitos obrigatórios:
 * avalia apenas os pré-requisitos marcados como `required` e devolve os
 * itens faltantes para o aviso claro na UI (CA 2). Opcional (não-marca-
 * dos) nunca bloqueiam — são insumo do matching, não critério de entrada.
 */
export type PrerequisiteGate = {
  ok: boolean;
  missing: string[];
};

export function checkRequiredPrerequisites(
  job: { prerequisites: ReadonlyArray<{ item: string; required: boolean }> },
  candidateSkills: readonly string[],
): PrerequisiteGate {
  const missing = job.prerequisites
    .filter((prerequisite) => prerequisite.required)
    .filter((prerequisite) => !hasSkillFor(candidateSkills, prerequisite.item))
    .map((prerequisite) => prerequisite.item);
  return { ok: missing.length === 0, missing };
}

/**
 * Mensagem de aviso claro para a UI (CA 2) — singular/plural corretos.
 */
export function formatMissingPrerequisites(missing: readonly string[]): string {
  if (missing.length === 1) {
    return `Requisito obrigatório não atendido: ${missing[0]}.`;
  }
  return `Requisitos obrigatórios não atendidos: ${missing.join(", ")}.`;
}

/** Campos do perfil do aluno consumidos pelo algoritmo de matching. */
export type ProfileMatchingFields = {
  skills?: string[];
  languages?: Array<{ name: string; level: LanguageLevel }>;
  availability: Availability;
};

/**
 * Monta a entrada de matching a partir do perfil persistido do aluno:
 * campos ausentes viram listas vazias (nunca undefined) — o score é
 * calculado no servidor com computeMatchScore (fonte da verdade, R8).
 */
export function buildMatchingCandidateInput(profile: ProfileMatchingFields): {
  skills: string[];
  languages: Array<{ name: string; level: LanguageLevel }>;
  availability: Availability;
} {
  return {
    skills: profile.skills ?? [],
    languages: profile.languages ?? [],
    availability: profile.availability,
  };
}
