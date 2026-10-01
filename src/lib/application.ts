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

/** Ordem do funil principal — sem a coluna terminal "reprovado". */
const FUNNEL_ORDER = ["inscrito", "triagem", "entrevista", "aprovado"] as const;

/**
 * Movimentação de card entre colunas (CA 1) — [UX_UPGRADE] caminho
 * OBRIGATÓRIO anti-cheat: o avanço no funil é de UMA etapa por vez
 * (`inscrito → triagem → entrevista → aprovado`); saltos para frente
 * são bloqueados. Retrocessos são livres (desfazer/auditar), mover para
 * "reprovado" continua permitido de qualquer coluna (com motivo, R5) e
 * a reentrada de "reprovado" só acontece reiniciando em "inscrito".
 * Mover para a própria coluna é no-op e é rejeitado pela mutation.
 */
export function canTransitionTo(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  if (to === "reprovado") return true;
  if (from === "reprovado") return to === "inscrito";
  const fromIndex = FUNNEL_ORDER.indexOf(from);
  const toIndex = FUNNEL_ORDER.indexOf(to);
  return toIndex < fromIndex || toIndex === fromIndex + 1;
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
 * [RECRUITER_WORKFLOW] Etapa 2 — decisão pura da movimentação do card do
 * Kanban, usada pela mutation `moveApplication` (fonte da verdade):
 *
 * R5 — mover para "reprovado" EXIGE motivo do enum fixo: sem motivo ou
 * com motivo fora do catálogo a decisão falha (defesa em profundidade —
 * o modal da UI também exige antes de disparar a mutation).
 * [S5-2] — a aprovação marca o preenchimento da vaga (`filledAt`, base
 * do time-to-hire) e desfazer a aprovação o limpa; sair da coluna
 * "Reprovado" limpa o motivo gravado (o aluno voltou ao pipeline).
 *
 * [UX_UPGRADE] Anti-cheat (caminho obrigatório inscrito → triagem →
 * entrevista → aprovado):
 * - saltos para frente são bloqueados (`canTransitionTo`);
 * - mover para "entrevista" EXIGE `interviewDate` (data/hora) e
 *   `interviewLink` (link ou local) — a coluna nunca fica sem dado
 *   auditável;
 * - mover para "aprovado" EXIGE `expectedStartDate` (data de início
 *   prevista da contratação).
 */
export type MoveStageDecision =
  | {
      ok: true;
      nextStage: ApplicationStage;
      /** Gravar `filledAt = now` na vaga (primeira aprovação). */
      jobFilled: boolean;
      /** Limpar `filledAt` da vaga (saiu de "aprovado"). */
      jobUnfilled: boolean;
      /** Motivo a gravar (reprovação) ou a limpar (null); ausente = intocado. */
      rejectionReason?: RejectionReason | null;
    }
  | { ok: false; error: string };

/** Timestamp auditável (> 0 e finito) — data/hora em epoch millis. */
function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function moveStageDecision(input: {
  stage: ApplicationStage;
  to: ApplicationStage;
  rejectionReason?: unknown;
  interviewDate?: unknown;
  interviewLink?: unknown;
  expectedStartDate?: unknown;
}): MoveStageDecision {
  const {
    stage,
    to,
    rejectionReason,
    interviewDate,
    interviewLink,
    expectedStartDate,
  } = input;
  if (stage === to) {
    return { ok: false, error: "O card já está nesta coluna." };
  }
  if (to === "reprovado") {
    if (typeof rejectionReason !== "string" || rejectionReason.length === 0) {
      return {
        ok: false,
        error: "Motivo de reprovação é obrigatório (R5).",
      };
    }
    if (!isRejectionReason(rejectionReason)) {
      return {
        ok: false,
        error:
          "Motivo de reprovação inválido — escolha um motivo da lista padronizada.",
      };
    }
    return {
      ok: true,
      nextStage: "reprovado",
      rejectionReason,
      jobFilled: false,
      jobUnfilled: false,
    };
  }
  // [UX_UPGRADE] Anti-cheat: bloqueia saltos e reentrada fora do início.
  if (!canTransitionTo(stage, to)) {
    return {
      ok: false,
      error:
        stage === "reprovado"
          ? 'Movimento bloqueado: candidatura reprovada só reinicia em "inscrito" (caminho obrigatório: inscrito → triagem → entrevista → aprovado).'
          : "Movimento bloqueado: avance no máximo uma etapa por vez (inscrito → triagem → entrevista → aprovado).",
    };
  }
  if (to === "entrevista") {
    if (!isTimestamp(interviewDate)) {
      return {
        ok: false,
        error: "Data e hora da entrevista é obrigatória (auditoria do funil).",
      };
    }
    if (
      typeof interviewLink !== "string" ||
      interviewLink.trim().length === 0 ||
      interviewLink.trim().length > 500
    ) {
      return {
        ok: false,
        error:
          "Link ou local da entrevista é obrigatório (até 500 caracteres).",
      };
    }
  }
  if (to === "aprovado") {
    if (!isTimestamp(expectedStartDate)) {
      return {
        ok: false,
        error: "Data de início prevista é obrigatória para a contratação.",
      };
    }
  }
  if (stage === "reprovado") {
    // Reentrada auditável (só "inscrito"): o motivo antigo não faz
    // sentido na nova coluna.
    return {
      ok: true,
      nextStage: to,
      rejectionReason: null,
      jobFilled: false,
      jobUnfilled: false,
    };
  }
  return {
    ok: true,
    nextStage: to,
    jobFilled: to === "aprovado",
    jobUnfilled: stage === "aprovado",
  };
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

/** Tom visual do badge por etapa (variantes do componente Badge). */
export type StageBadgeVariant =
  "aprovado" | "triagem" | "reprovado" | "andamento";

export const STAGE_BADGE: Record<ApplicationStage, StageBadgeVariant> = {
  inscrito: "andamento",
  triagem: "triagem",
  entrevista: "andamento",
  aprovado: "aprovado",
  reprovado: "reprovado",
};

/**
 * [REFACTOR_ALUNO Etapa 4.2] — feedback claro por etapa: o aluno
 * entende de imediato o que aconteceu e o que esperar em seguida.
 */
export function stageFeedback(stage: ApplicationStage): string {
  switch (stage) {
    case "inscrito":
      return "Candidatura enviada — sua inscrição está na fila aguardando a triagem da equipe.";
    case "triagem":
      return "Em triagem — o recrutador está avaliando o seu perfil nesta etapa.";
    case "entrevista":
      return "Você está na etapa de entrevista: a empresa quer conhecer melhor o seu perfil.";
    case "aprovado":
      return "Parabéns! Você foi aprovado(a) neste processo seletivo.";
    case "reprovado":
      return "Sua candidatura foi reprovada neste processo — veja o motivo abaixo e continue evoluindo.";
  }
}

/**
 * [REFACTOR_ALUNO Etapa 4.3] — motivo padronizado (R5, enum fixo de 8)
 * traduzido para um conselho amigável e ACIONÁVEL: o aluno sai sabendo
 * onde melhorar. Nunca texto livre — só o enum do servidor.
 */
export function rejectionFeedback(reason: RejectionReason): {
  headline: string;
  advice: string;
} {
  const headline = "Não foi desta vez";
  const adviceByReason: Record<RejectionReason, string> = {
    requisitos_obrigatorios:
      "A vaga pedia requisitos obrigatórios que não constavam no seu perfil. Atualize as competências exigidas no currículo e tente de novo.",
    formacao_incompativel:
      "Sua formação não era compatível com a vaga. Candidate-se a oportunidades do seu curso ou conclua a graduação solicitada.",
    disponibilidade_incompativel:
      "A disponibilidade de horário pedida não fecha com a sua. Ajuste a disponibilidade no perfil e candidate-se a vagas compatíveis.",
    idioma_insuficiente:
      "O nível de idioma exigido ficou acima do seu cadastro. Revise os níveis no bloco de Idiomas do currículo.",
    perfil_duplicado:
      "Encontramos mais de uma candidatura sua neste processo. Mantenha um único perfil atualizado para não perder oportunidades.",
    vaga_preenchida:
      "A vaga foi preenchida por outro candidato, mas novas vagas saem toda semana — mantenha seu perfil visível no banco de talentos.",
    vaga_cancelada:
      "A empresa cancelou a vaga. Explore oportunidades parecidas no mural de vagas.",
    outro:
      "O recrutador encerrou sua candidatura. Use os conselhos dos demais processos para deixar seu currículo ainda mais forte.",
  };
  return { headline, advice: adviceByReason[reason] };
}
