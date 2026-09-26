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

/**
 * [S4-2] R5 — Motivo padronizado de reprovação (enum fixo) para auditoria
 * e métricas. Nada de texto livre: a mutation só grava com um motivo do
 * catálogo abaixo.
 */
export const REJECTION_REASONS = [
  "requisitos_obrigatorios",
  "formacao_incompativel",
  "disponibilidade_incompativel",
  "idioma_insuficiente",
  "perfil_duplicado",
  "vaga_preenchida",
  "vaga_cancelada",
  "outro",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  requisitos_obrigatorios: "Não atende aos requisitos obrigatórios da vaga",
  formacao_incompativel: "Formação incompatível com a vaga",
  disponibilidade_incompativel: "Disponibilidade incompatível com a vaga",
  idioma_insuficiente: "Idioma abaixo do nível exigido",
  perfil_duplicado: "Perfil duplicado/candidatura múltipla indevida",
  vaga_preenchida: "Vaga já preenchida",
  vaga_cancelada: "Vaga cancelada ou suspensa",
  outro: "Outro motivo (detalhado pelo recrutador)",
};

/** Guarda do enum fixo (mutation aceita apenas motivos do catálogo). */
export function isRejectionReason(value: unknown): value is RejectionReason {
  return (
    typeof value === "string" &&
    (REJECTION_REASONS as readonly string[]).includes(value)
  );
}

export type RejectionDecision =
  { ok: true; nextStage: "reprovado" } | { ok: false; error: string }; /**
 * R5/CA 1 — Decisão de reprovação: exige motivo do enum fixo; falha
 * clara sem motivo, com motivo fora do catálogo ou em já-reprovado.
 */
export function rejectionDecision(input: {
  stage: ApplicationStage;
  reason: unknown;
}): RejectionDecision {
  const { stage, reason } = input;
  if (typeof reason !== "string" || reason.length === 0) {
    return { ok: false, error: "Motivo de reprovação é obrigatório (R5)." };
  }
  if (!isRejectionReason(reason)) {
    return {
      ok: false,
      error:
        "Motivo de reprovação inválido — escolha um motivo da lista padronizada.",
    };
  }
  if (stage === "reprovado") {
    return { ok: false, error: "Candidatura já está reprovada." };
  }
  return { ok: true, nextStage: "reprovado" };
}

/**
 * [S4-3] R6 — Liberação de contato por candidatura (LGPD).
 * O recrutador só vê os dados de contato quando o ALUNO autoriza:
 * (a) autorização geral (`showContactToRecruiters`), ou
 * (b) aceite explícito em participar daquele processo seletivo
 *     (`processAccepted`, por candidatura).
 * O aceite do termo LGPD (R7) é pré-condição de uso do portal — sozinho
 * NÃO libera contato; a liberação é sempre escolha do aluno.
 */
export type ContactReleaseInput = {
  showContactToRecruiters: boolean;
  processAccepted: boolean;
  /** R7 — aceite vigente do termo (contexto; não libera sozinho). */
  consentAccepted?: boolean;
  email?: string;
  phone?: string;
};

export type ContactReleaseDecision = {
  contactReleased: boolean;
  reason: "autorizacao_geral" | "aceite_no_processo" | "sem_autorizacao";
};

export function contactReleaseDecision(
  input: ContactReleaseInput,
): ContactReleaseDecision {
  if (input.showContactToRecruiters) {
    return { contactReleased: true, reason: "autorizacao_geral" };
  }
  if (input.processAccepted) {
    return { contactReleased: true, reason: "aceite_no_processo" };
  }
  return { contactReleased: false, reason: "sem_autorizacao" };
}

export type ContactProjection = {
  contactReleased: boolean;
  releaseReason: ContactReleaseDecision["reason"];
  email?: string;
  phone?: string;
};

/**
 * Projeção segura por candidatura (CA 1/CA 2): sem liberação, os campos
 * de contato são OMITIDOS do objeto (nunca mascarados) — os dados não
 * chegam ao cliente; com liberação, `contactReleased: true` + contato.
 */
export function contactProjectionForApplication(
  input: ContactReleaseInput,
): ContactProjection {
  const decision = contactReleaseDecision(input);
  if (!decision.contactReleased) {
    return { contactReleased: false, releaseReason: decision.reason };
  }
  return {
    contactReleased: true,
    releaseReason: decision.reason,
    email: input.email,
    phone: input.phone,
  };
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

/**
 * [S4-4] "Minhas Candidaturas" — regras puras da view do aluno.
 * Lista reativa (useQuery) ordenada da candidatura mais recente para a
 * mais antiga, com etapa atual do pipeline (CA 1) e % de match (CA 2).
 */

/** Candidatura como exibida na lista do aluno. */
export type MyApplication = {
  applicationId: string;
  jobTitle: string;
  stage: ApplicationStage;
  matchScore: number;
  appliedAt: number;
};

/** Ordena da mais recente para a mais antiga, sem mutar a entrada. */
export function sortMyApplications<T extends { appliedAt: number }>(
  applications: readonly T[],
): T[] {
  return [...applications].sort((a, b) => b.appliedAt - a.appliedAt);
}

/** Linha de status legível para a lista (etapa atual do pipeline). */
export function formatApplicationStatusLabel(application: {
  jobTitle: string;
  stage: ApplicationStage;
  appliedAt: number;
}): string {
  const date = new Date(application.appliedAt);
  return `${application.jobTitle} — etapa: ${
    STAGE_LABELS[application.stage]
  } (Inscrito em ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}).`;
}

export type TimelineStep = {
  stage: ApplicationStage;
  state: "done" | "current" | "upcoming";
};

/**
 * Timeline das 5 etapas do pipeline a partir da etapa atual:
 * etapas anteriores "done", atual "current", futuras "upcoming".
 * Nota: "reprovado" é coluna terminal do board (S4-1); na linha do
 * tempo do aluno ele aparece como etapa futura até ocorrer.
 */
export function stageTimeline(current: ApplicationStage): TimelineStep[] {
  const currentIndex = APPLICATION_STAGES.indexOf(current);
  return APPLICATION_STAGES.map((stage, index) => ({
    stage,
    state:
      index < currentIndex
        ? ("done" as const)
        : index === currentIndex
          ? ("current" as const)
          : ("upcoming" as const),
  }));
}

export type MyApplicationsKpis = {
  total: number;
  /** Ainda em andamento (não reprovadas). */
  active: number;
  /** Melhor % de match entre as candidaturas (null quando não há). */
  bestMatch: number | null;
};

/** Indicadores-resumo do cabeçalho da view. */
export function myApplicationsKpis(
  applications: ReadonlyArray<MyApplication>,
): MyApplicationsKpis {
  const total = applications.length;
  const active = applications.filter((a) => a.stage !== "reprovado").length;
  const bestMatch =
    total === 0
      ? null
      : applications.reduce((best, a) => Math.max(best, a.matchScore), 0);
  return { total, active, bestMatch };
}
