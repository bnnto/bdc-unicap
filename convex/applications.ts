import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import { computeMatchScore } from "../src/lib/matching";
import {
  canApplyTo,
  checkRequiredPrerequisites,
  buildMatchingCandidateInput,
  contactProjectionForApplication,
  formatMissingPrerequisites,
  isApplicationStage,
  isRejectionReason,
  moveStageDecision,
  rejectionDecision,
  REJECTION_REASON_LABELS,
  type ApplicableJob,
  type ApplicationStage,
  type RejectionReason,
} from "../src/lib/application";
import type { LanguageLevel } from "../src/lib/skills";
import { shouldNotifyStageAdvance } from "../src/lib/emailNotify";
import { computeStudentAnalytics } from "../src/lib/analytics";
import { getCurrentUser } from "./lib/currentUser";

/**
 * Candidaturas (issue [S3-4], R8).
 * O % de compatibilidade é calculado NO SERVIDOR (fonte da verdade, CA 1)
 * com a regra pura de matching (S3-3) e persistido no documento.
 * Toda operação exige consentimento vigente (R7) e o papel correto.
 */

/** Guard comum: usuário autenticado com consentimento vigente (R7). */
async function requireActiveUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const user = await getCurrentUser(ctx);
  if (user === null) throw new Error("Usuário não encontrado.");
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
  if (!active) {
    throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
  }
  return user;
}

/** Carrega a vaga no formato da regra pura de candidatura. */
function toApplicableJob(job: Doc<"jobs">): ApplicableJob {
  return {
    status: job.status,
    expiresAt: job.expiresAt,
  };
}

/** Monta os pré-requisitos da vaga no formato da regra de matching. */
function jobPrerequisites(job: Doc<"jobs">) {
  return job.prerequisites.map((p) => ({
    item: p.item,
    required: p.required,
  }));
}

/**
 * CA 1 + CA 3 — Candidatura do aluno à vaga: valida elegibilidade (vaga
 * aberta e dentro do prazo, R4), calcula o match NO SERVIDOR com
 * `computeMatchScore` (R8 — fonte da verdade) e grava com stage inicial
 * "inscrito". Idempotente: aluno já inscrito recebe erro claro.
 */
export const applyToJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") {
      throw new Error("Apenas alunos se candidatam às vagas.");
    }

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) {
      throw new Error("Complete o cadastro do perfil antes de se candidatar.");
    }

    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");

    const decision = canApplyTo(toApplicableJob(job), Date.now());
    if (!decision.ok) {
      throw new Error(
        decision.reason === "vaga_expirada"
          ? "Esta vaga está expirada e não aceita mais candidaturas."
          : "Esta vaga não está aberta para candidaturas.",
      );
    }

    // Unicidade: um aluno, uma candidatura por vaga.
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();
    if (existing.some((a) => a.jobId === jobId)) {
      throw new Error("Você já se candidatou a esta vaga.");
    }

    // [S3-5] CA 1 — bloqueio no servidor: pré-requisitos obrigatórios
    // não atendidos impedem a candidatura (mesma regra da UI, mas aqui
    // é a fonte da verdade — o cliente nunca decide).
    const gate = checkRequiredPrerequisites(
      { prerequisites: jobPrerequisites(job) },
      student.skills ?? [],
    );
    if (!gate.ok) {
      throw new Error(formatMissingPrerequisites(gate.missing));
    }

    // R8 — match calculado no servidor e persistido (CA 1).
    const score = computeMatchScore(
      buildMatchingCandidateInput({
        skills: student.skills,
        languages: student.languages as Array<{
          name: string;
          level: LanguageLevel;
        }>,
        availability: student.availability,
      }),
      {
        prerequisites: jobPrerequisites(job),
        requiredLanguage: job.requiredLanguage,
        availability: job.availability,
      },
    );

    const applicationId = await ctx.db.insert("applications", {
      jobId,
      studentId: student._id,
      stage: "inscrito" as ApplicationStage,
      matchScore: score,
      appliedAt: Date.now(),
    });
    return { applicationId, matchScore: score };
  },
});

/**
 * Vagas abertas e dentro do prazo (R4) para o home do aluno (CA 2).
 * Ancorada no índice by_status — sem full-scan (padrão S2-4).
 *
 * [REFACTOR_ALUNO Etapa 3.4] — cada vaga sai com o Percentual de
 * Compatibilidade do aluno calculado NO SERVIDOR (R8, mesma regra pura
 * do `applyToJob`) para o destaque do Mural estilo LinkedIn.
 */
export const openJobs = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    const student =
      user.role === "aluno"
        ? await ctx.db
            .query("students")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .unique()
        : null;
    const candidate =
      student !== null
        ? buildMatchingCandidateInput({
            skills: student.skills,
            languages: student.languages as Array<{
              name: string;
              level: LanguageLevel;
            }>,
            availability: student.availability,
          })
        : null;

    const now = Date.now();
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .order("desc")
      .take(50);
    return rows
      .filter((job) => job.expiresAt === undefined || job.expiresAt > now)
      .map((job) => ({
        ...job,
        matchScore:
          candidate === null
            ? null
            : computeMatchScore(candidate, {
                prerequisites: jobPrerequisites(job),
                requiredLanguage: job.requiredLanguage,
                availability: job.availability,
              }),
      }));
  },
});

/**
 * Candidaturas do aluno autenticado, com vaga e % de match (CA 2).
 */
export const myApplications = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") return [];
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) return [];

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .collect();

    const items = [];
    for (const row of rows) {
      const job = await ctx.db.get(row.jobId);
      if (job === null) continue;
      items.push({
        applicationId: row._id,
        jobId: job._id,
        jobTitle: job.title,
        jobStatus: job.status,
        stage: row.stage,
        matchScore: row.matchScore,
        appliedAt: row.appliedAt,
        // [S4-3] R6 — estado do aceite do aluno no processo (auditável).
        processAccepted: row.processAccepted ?? false,
        // [S4-4] — motivo padronizado quando reprovado (R5, transparência).
        rejectionReason: row.rejectionReason ?? null,
      });
    }
    return items;
  },
});

/**
 * [FINAL_UPGRADE Etapa 3] — Dashboard de Analytics do aluno: total de
 * candidaturas, Taxa de Sucesso ((Entrevista + Aprovado) / Total × 100),
 * distribuição por etapa, média de match e Visualizações do Perfil.
 * Cálculo PURO em src/lib/analytics.ts (TDD) executado NO SERVIDOR.
 */
export const myStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") return null;
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) return null;
    const rows = await ctx.db
      .query("applications")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .take(500);
    return computeStudentAnalytics(
      rows.map((row) => ({ stage: row.stage, matchScore: row.matchScore })),
      student.profileViews ?? 0,
    );
  },
});

/**
 * [FINAL_UPGRADE Etapa 3] — contador (mock) de Visualizações do Perfil:
 * o recrutador dono da vaga "clicou" no contato/LinkedIn do aluno no
 * Kanban. Guarda pelo dono da vaga (mesma regra do jobBoard).
 */
export const trackProfileView = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    const user = await requireActiveUser(ctx);
    const application = await ctx.db.get(applicationId);
    if (application === null) {
      throw new Error("Candidatura não encontrada.");
    }
    const job = await ctx.db.get(application.jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Apenas o recrutador da vaga conta visualizações.");
    }
    const student = await ctx.db.get(application.studentId);
    if (student === null) throw new Error("Perfil de aluno não encontrado.");
    const profileViews = (student.profileViews ?? 0) + 1;
    await ctx.db.patch(student._id, { profileViews });
    return { ok: true as const, profileViews };
  },
});

/**
 * Candidaturas de uma vaga para o recrutador dono (CA 2), ordenadas do
 * maior para o menor % de compatibilidade.
 */
export const jobApplications = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    if (job.recruiterId !== user._id) return null;

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();

    const items = [];
    for (const row of rows) {
      const student = await ctx.db.get(row.studentId);
      if (student === null) continue;
      items.push({
        applicationId: row._id,
        studentId: student._id,
        fullName: student.fullName,
        course: student.course,
        stage: row.stage,
        matchScore: row.matchScore,
        appliedAt: row.appliedAt,
        // R6 — contato segue a autorização geral do aluno.
        contactAllowed: student.showContactToRecruiters ?? false,
      });
    }
    return items.sort((a, b) => b.matchScore - a.matchScore);
  },
});

/**
 * [S4-1] CA 1 — Mover card no Kanban: atualiza `applications.stage`.
 * Apenas o recrutador dono da vaga move; transição para a mesma coluna
 * é rejeitada (no-op); stage destino validado pela guarda pura.
 * A reatividade do Convex propaga a mudança a todos os clientes abertos.
 *
 * [RECRUITER_WORKFLOW] R5 (defesa em profundidade): mover para
 * "reprovado" EXIGE o `rejectionReason` do enum fixo — sem motivo a
 * mutation falha no servidor, mesmo que um cliente malicioso tente
 * contornar o modal da UI. Aprovar grava `filledAt` na vaga ([S5-2],
 * base do time-to-hire); desfazer a aprovação o limpa. Sair da coluna
 * "Reprovado" limpa o motivo gravado (o aluno voltou ao pipeline).
 *
 * [UX_UPGRADE] Anti-cheat (caminho obrigatório inscrito → triagem →
 * entrevista → aprovado): saltos para frente falham no servidor;
 * `interviewDate` + `interviewLink` são OBRIGATÓRIOS ao entrar em
 * "entrevista" e `expectedStartDate` ao entrar em "aprovado" — um
 * cliente malicioso não contorna os modais da UI.
 */
export const moveApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    to: v.union(
      v.literal("inscrito"),
      v.literal("triagem"),
      v.literal("entrevista"),
      v.literal("aprovado"),
      v.literal("reprovado"),
    ),
    /** R5 — obrigatório quando `to = "reprovado"` (regra pura). */
    rejectionReason: v.optional(
      v.union(
        v.literal("requisitos_obrigatorios"),
        v.literal("formacao_incompativel"),
        v.literal("disponibilidade_incompativel"),
        v.literal("idioma_insuficiente"),
        v.literal("perfil_duplicado"),
        v.literal("vaga_preenchida"),
        v.literal("vaga_cancelada"),
        v.literal("outro"),
      ),
    ),
    /** [UX_UPGRADE] data/hora da entrevista (epoch millis). */
    interviewDate: v.optional(v.number()),
    /** [UX_UPGRADE] link de videochamada ou local presencial. */
    interviewLink: v.optional(v.string()),
    /** [UX_UPGRADE] data de início prevista da contratação. */
    expectedStartDate: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      applicationId,
      to,
      rejectionReason,
      interviewDate,
      interviewLink,
      expectedStartDate,
    },
  ) => {
    const user = await requireActiveUser(ctx);
    if (!isApplicationStage(to)) {
      throw new Error("Coluna de destino inválida.");
    }
    const application = await ctx.db.get(applicationId);
    if (application === null) {
      throw new Error("Candidatura não encontrada.");
    }
    const job = await ctx.db.get(application.jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Apenas o recrutador da vaga move as candidaturas.");
    }

    const decision = moveStageDecision({
      stage: application.stage,
      to,
      rejectionReason,
      interviewDate,
      interviewLink,
      expectedStartDate,
    });
    if (!decision.ok) {
      throw new Error(decision.error);
    }

    // Gravação da candidatura: stage (+ motivo na reprovação; limpo ao
    // reativar um card que estava na coluna Reprovado).
    const patch: Partial<Doc<"applications">> = {
      stage: decision.nextStage,
    };
    if (decision.rejectionReason !== undefined) {
      // null = limpar o campo (reactivação); validator não aceita null.
      patch.rejectionReason =
        decision.rejectionReason === null
          ? undefined
          : decision.rejectionReason;
    }
    // [UX_UPGRADE] dados auditáveis por etapa — a decisão pura já
    // exigiu os valores quando `nextStage` é entrevista/aprovado.
    if (decision.nextStage === "entrevista") {
      patch.interviewDate = interviewDate;
      patch.interviewLink = interviewLink;
    }
    if (decision.nextStage === "aprovado") {
      patch.expectedStartDate = expectedStartDate;
    }
    if (decision.jobUnfilled) {
      // Desfez a aprovação: a data de início prevista deixa de valer.
      patch.expectedStartDate = undefined;
    }
    await ctx.db.patch(applicationId, patch);

    // [S5-2] — preenchimento da vaga acompanha a coluna Aprovado.
    const now = Date.now();
    if (decision.jobFilled) {
      await ctx.db.patch(job._id, { filledAt: now });
    } else if (decision.jobUnfilled) {
      await ctx.db.patch(job._id, { filledAt: undefined });
    }

    // [FINAL_UPGRADE Etapa 2] — avanço de etapa para "Entrevista" ou
    // "Aprovado" notifica o aluno por e-mail. A action (Resend ou mock
    // com console.log quando falta RESEND_API_KEY) é AGENDADA — o envio
    // nunca quebra a transação do Kanban — e respeita a preferência
    // "Atualizações de Candidatura" do usuário (padrão ligado).
    if (shouldNotifyStageAdvance(application.stage, decision.nextStage)) {
      const student = await ctx.db.get(application.studentId);
      const owner = student !== null ? await ctx.db.get(student.userId) : null;
      if (
        student !== null &&
        owner !== null &&
        owner.email !== undefined &&
        (owner.notifyApplicationUpdates ?? true)
      ) {
        await ctx.scheduler.runAfter(0, internal.emails.sendStageNotification, {
          to: owner.email,
          studentName: student.fullName,
          jobTitle: job.title,
          stage: decision.nextStage as "entrevista" | "aprovado",
        });
      }
    }
    return { ok: true as const, stage: decision.nextStage };
  },
});

/**
 * [S4-1] CA 1/CA 2 — Board do Kanban de uma vaga do recrutador dono:
 * todas as candidaturas com dados do candidato e % de match. A query
 * reativa re-renderiza as colunas em tempo real a cada `moveApplication`.
 */
export const jobBoard = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    if (job.recruiterId !== user._id) return null;

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();

    const items = [];
    for (const row of rows) {
      const student = await ctx.db.get(row.studentId);
      if (student === null) continue;
      // Fonte dos dados de contato: o usuário autenticado (e-mail) e o
      // perfil (LinkedIn/portfólio). Nunca deixam o servidor sem liberação.
      const owner = await ctx.db.get(student.userId);
      // [S4-3] R6 — contato projetado no servidor: omitido sem autorização
      // geral do aluno ou aceite no processo (CA 1); contactReleased
      // reflete a liberação (CA 2).
      const contact = contactProjectionForApplication({
        showContactToRecruiters: student.showContactToRecruiters ?? false,
        processAccepted: row.processAccepted ?? false,
        email: owner?.email,
      });
      items.push({
        applicationId: row._id,
        studentId: student._id,
        fullName: student.fullName,
        course: student.course,
        stage: row.stage,
        matchScore: row.matchScore,
        appliedAt: row.appliedAt,
        // [UX_UPGRADE] dados auditáveis p/ prefill dos modais da UI.
        interviewDate: row.interviewDate,
        interviewLink: row.interviewLink,
        expectedStartDate: row.expectedStartDate,
        contactReleased: contact.contactReleased,
        releaseReason: contact.releaseReason,
        ...(contact.contactReleased
          ? {
              email: contact.email,
              linkedinUrl: student.linkedinUrl ?? undefined,
              portfolioUrl: student.portfolioUrl ?? undefined,
            }
          : {}),
      });
    }
    return { job: { jobId: job._id, title: job.title }, items };
  },
});

/**
 * [S4-2] R5 — Reprovação com motivo padronizado OBRIGATÓRIO (CA 1).
 * A mutation falha sem `rejectionReason`, com motivo fora do enum fixo
 * (nada de texto livre) ou em candidatura já reprovada; grava o motivo
 * do catálogo junto com o stage "reprovado" (CA 2 — auditável).
 * Apenas o recrutador dono da vaga reprova.
 */
export const rejectApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    reason: v.union(
      v.literal("requisitos_obrigatorios"),
      v.literal("formacao_incompativel"),
      v.literal("disponibilidade_incompativel"),
      v.literal("idioma_insuficiente"),
      v.literal("perfil_duplicado"),
      v.literal("vaga_preenchida"),
      v.literal("vaga_cancelada"),
      v.literal("outro"),
    ),
  },
  handler: async (ctx, { applicationId, reason }) => {
    const user = await requireActiveUser(ctx);
    if (!isRejectionReason(reason)) {
      throw new Error(
        "Motivo de reprovação inválido — escolha um motivo da lista padronizada.",
      );
    }
    const application = await ctx.db.get(applicationId);
    if (application === null) {
      throw new Error("Candidatura não encontrada.");
    }
    const job = await ctx.db.get(application.jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Apenas o recrutador da vaga reprova candidaturas.");
    }
    const decision = rejectionDecision({ stage: application.stage, reason });
    if (!decision.ok) {
      throw new Error(decision.error);
    }
    await ctx.db.patch(applicationId, {
      stage: decision.nextStage,
      rejectionReason: reason as RejectionReason,
    });
    return { ok: true as const, stage: decision.nextStage, reason };
  },
});

/**
 * [S4-2] CA 2 — Auditoria: motivos de reprovação da vaga (dono apenas),
 * com rótulo pt-BR do enum fixo, do mais recente para o mais antigo.
 */
export const jobRejections = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    if (job.recruiterId !== user._id) return null;

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();

    return rows
      .filter(
        (row) => row.stage === "reprovado" && row.rejectionReason !== undefined,
      )
      .sort((a, b) => b.appliedAt - a.appliedAt)
      .map((row) => ({
        applicationId: row._id,
        stage: row.stage,
        reason: row.rejectionReason as RejectionReason,
        reasonLabel:
          REJECTION_REASON_LABELS[row.rejectionReason as RejectionReason],
        appliedAt: row.appliedAt,
      }));
  },
});

/**
 * [S4-3] R6 — Aceite do aluno em participar do processo seletivo da vaga
 * (por candidatura). Libera o contato ao recrutador daquela vaga mesmo
 * sem a autorização geral; registrado com timestamp para auditoria LGPD.
 */
export const acceptProcess = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") {
      throw new Error("Apenas o aluno candidato aceita o processo.");
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) {
      throw new Error("Perfil de aluno não encontrado.");
    }
    const application = await ctx.db.get(applicationId);
    if (application === null) {
      throw new Error("Candidatura não encontrada.");
    }
    if (application.studentId !== student._id) {
      throw new Error(
        "Você só pode aceitar processos das suas próprias candidaturas.",
      );
    }
    await ctx.db.patch(applicationId, {
      processAccepted: true,
      processAcceptedAt: Date.now(),
    });
    return { ok: true as const, processAccepted: true };
  },
});

/**
 * [S4-3] R6 — Retirada do aceite do aluno (revogação LGPD). A liberação
 * por aceite cessa; a autorização geral do aluno não é alterada aqui.
 */
export const revokeProcessAcceptance = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") {
      throw new Error("Apenas o aluno candidato revoga o aceite.");
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) {
      throw new Error("Perfil de aluno não encontrado.");
    }
    const application = await ctx.db.get(applicationId);
    if (application === null) {
      throw new Error("Candidatura não encontrada.");
    }
    if (application.studentId !== student._id) {
      throw new Error(
        "Você só pode revogar o aceite das suas próprias candidaturas.",
      );
    }
    await ctx.db.patch(applicationId, { processAccepted: false });
    return { ok: true as const, processAccepted: false };
  },
});

/** Id tipado para reuso interno (exportado para testes de tipo). */
export type ApplicationId = Id<"applications">;
