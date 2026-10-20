import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { logModeration } from "./lib/moderationLog";
import { reportBreakdown } from "../src/lib/jobReport";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { isRecruiterApproved, requireGestorUser } from "./lib/currentUser";
import { computeExpiresAt } from "../src/lib/jobExpiry";
import { isModerationHold } from "../src/lib/jobModeration";

const DAY = 24 * 60 * 60 * 1000;
export const REFUSED_RETENTION_DAYS = 180;
export const PENDING_RETENTION_DAYS = 90;
const PURGE_BATCH = 100;

/**
 * [MODERACAO_RECRUTADOR] Decisão do gestor sobre cadastros de recrutador.
 * Conta sem `approvalStatus` (anterior à moderação) conta como aprovada.
 */

const statusFilter = v.union(
  v.literal("pendente"),
  v.literal("aprovado"),
  v.literal("recusado"),
  v.literal("todos"),
);

/** Recrutadores para a aba do gestor; padrão: só os pendentes. */
export const listRecruiters = query({
  args: { status: v.optional(statusFilter) },
  handler: async (ctx, { status }) => {
    await requireGestorUser(ctx);
    const filter = status ?? "pendente";

    const recruiters = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "recrutador"))
      .collect();

    const rows = [];
    for (const recruiter of recruiters) {
      const current = recruiter.approvalStatus ?? "aprovado";
      if (filter !== "todos" && current !== filter) continue;
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_recruiter", (q) => q.eq("recruiterId", recruiter._id))
        .collect();
      rows.push({
        userId: recruiter._id,
        name: recruiter.name ?? "—",
        email: recruiter.email ?? "—",
        linkedinUrl: recruiter.linkedinUrl ?? null,
        status: current,
        reason: recruiter.approvalReason ?? null,
        createdAt: recruiter._creationTime,
        reviewedAt: recruiter.approvalReviewedAt ?? null,
        jobsCount: jobs.length,
        openJobsCount: jobs.filter((job) => job.status === "aberta").length,
      });
    }

    // Pendentes primeiro; depois os mais recentes.
    return rows.sort((a, b) => {
      if (a.status === "pendente" && b.status !== "pendente") return -1;
      if (b.status === "pendente" && a.status !== "pendente") return 1;
      return b.createdAt - a.createdAt;
    });
  },
});

/** Contador do selo da aba "Recrutadores". */
export const pendingRecruiterCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    await requireGestorUser(ctx);
    const pending = await ctx.db
      .query("users")
      .withIndex("by_role_approval", (q) =>
        q.eq("role", "recrutador").eq("approvalStatus", "pendente"),
      )
      .collect();
    return pending.length;
  },
});

/**
 * Aprova ou recusa um recrutador. Recusar exige motivo (mostrado ao
 * recrutador). Revogar um aprovado = recusar. Dispara o e-mail de decisão.
 */
export const decideRecruiter = mutation({
  args: {
    recruiterId: v.id("users"),
    decision: v.union(v.literal("aprovado"), v.literal("recusado")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { recruiterId, decision, reason }) => {
    const gestor = await requireGestorUser(ctx);

    const target = await ctx.db.get(recruiterId);
    if (target === null || target.role !== "recrutador") {
      throw new Error("Recrutador não encontrado.");
    }
    const current = target.approvalStatus ?? "aprovado";
    if (current === decision) {
      throw new Error(
        decision === "aprovado"
          ? "Este recrutador já está aprovado."
          : "Este recrutador já está recusado.",
      );
    }

    const cleanReason = reason?.trim() ?? "";
    if (decision === "recusado" && cleanReason.length < 5) {
      throw new Error("Informe o motivo da recusa (mín. 5 caracteres).");
    }
    if (cleanReason.length > 500) {
      throw new Error("O motivo deve ter no máximo 500 caracteres.");
    }

    await ctx.db.patch(recruiterId, {
      approvalStatus: decision,
      approvalReason: decision === "recusado" ? cleanReason : undefined,
      approvalReviewedAt: Date.now(),
      approvalReviewedBy: gestor._id,
    });

    if (target.email !== undefined) {
      await ctx.scheduler.runAfter(
        0,
        internal.emails.sendRecruiterDecisionEmail,
        {
          to: target.email,
          name: target.name ?? target.email,
          decision,
          reason: decision === "recusado" ? cleanReason : undefined,
        },
      );
    }
    // Vagas abertas do recusado/revogado saem do ar; se for aprovado de
    // novo, só as suspensas por este motivo voltam.
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_recruiter", (q) => q.eq("recruiterId", recruiterId))
      .collect();
    const now = Date.now();
    let suspended = 0;
    let restored = 0;
        for (const job of jobs) {
      if (decision === "recusado" && job.status === "aberta") {
        const why = "Cadastro do recrutador recusado ou revogado.";
        await ctx.db.patch(job._id, {
          status: "suspensa",
          moderationCause: "recrutador",
          moderationReason: why,
          moderatedAt: now,
        });
        await logModeration(ctx, {
          job,
          action: "suspensa",
          cause: "recrutador",
          reason: why,
          actorId: gestor._id,
        });
        suspended += 1;
      } else if (
        decision === "aprovado" &&
        job.status === "suspensa" &&
        job.moderationCause === "recrutador"
      ) {
        await ctx.db.patch(job._id, {
          status: "aberta",
          publishedAt: now,
          expiresAt: computeExpiresAt(now),
          filledAt: undefined,
          moderationCause: undefined,
          moderationReason: undefined,
          moderatedAt: now,
        });
        await logModeration(ctx, {
          job,
          action: "aprovada",
          cause: "recrutador",
          reason: "Recrutador aprovado novamente; vaga restaurada.",
          actorId: gestor._id,
        });
        restored += 1;
      }
    }
    return { ok: true as const, status: decision, suspended, restored };
  },
});

/**
 * Apaga um recrutador e todo o rastro de autenticação. Só é chamada para
 * contas SEM vagas e SEM convites (checado antes).
 */
async function deleteRecruiterCascade(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string | undefined,
): Promise<void> {
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const consent of consents) await ctx.db.delete(consent._id);

  const resets = await ctx.db
    .query("passwordResets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const reset of resets) await ctx.db.delete(reset._id);

  if (email !== undefined) {
    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const attempt of attempts) await ctx.db.delete(attempt._id);
  }

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }

  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) await ctx.db.delete(code._id);
    await ctx.db.delete(account._id);
  }

  await ctx.db.delete(userId);
}

/**
 * Cron diário: remove recrutadores recusados (> 180 dias) e pendentes
 * esquecidos (> 90 dias), desde que não tenham vagas nem convites.
 */
export const purgeStaleRecruiters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const result = { refused: 0, pending: 0, skipped: 0 };

    const groups = [
      {
        status: "recusado" as const,
        cutoff: now - REFUSED_RETENTION_DAYS * DAY,
        key: "refused" as const,
      },
      {
        status: "pendente" as const,
        cutoff: now - PENDING_RETENTION_DAYS * DAY,
        key: "pending" as const,
      },
    ];

    for (const group of groups) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_role_approval", (q) =>
          q.eq("role", "recrutador").eq("approvalStatus", group.status),
        )
        .take(PURGE_BATCH);

      for (const user of users) {
        // Recusado conta a partir da decisão; pendente, do cadastro.
        const since =
          group.status === "recusado"
            ? (user.approvalReviewedAt ?? user._creationTime)
            : user._creationTime;
        if (since > group.cutoff) continue;

        const hasJob = await ctx.db
          .query("jobs")
          .withIndex("by_recruiter", (q) => q.eq("recruiterId", user._id))
          .first();
        const hasInvitation = await ctx.db
          .query("invitations")
          .withIndex("by_recruiter", (q) => q.eq("recruiterId", user._id))
          .first();
        if (hasJob !== null || hasInvitation !== null) {
          result.skipped += 1;
          continue;
        }

        await deleteRecruiterCascade(ctx, user._id, user.email);
        result[group.key] += 1;
      }
    }
    return result;
  },
});
/** Denúncias ativas da vaga: total, motivos e relatos (sem identificar o aluno). */
async function reportInfo(ctx: QueryCtx, jobId: Id<"jobs">) {
  const rows = await ctx.db
    .query("jobReports")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  const active = rows.filter((row) => row.status === "ativa");
  return {
    count: active.length,
    breakdown: reportBreakdown(active.map((row) => row.reason)),
    details: active.flatMap((row) =>
      row.details === undefined ? [] : [row.details],
    ),
  };
}

/** Arquiva as denúncias ativas da vaga (a contagem recomeça do zero). */
async function archiveActiveReports(
  ctx: MutationCtx,
  jobId: Id<"jobs">,
): Promise<number> {
  const rows = await ctx.db
    .query("jobReports")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  let archived = 0;
  for (const row of rows) {
    if (row.status === "ativa") {
      await ctx.db.patch(row._id, { status: "arquivada" });
      archived += 1;
    }
  }
  return archived;
}

/** Vagas em revisão e suspensas, para a aba Moderação (revisão primeiro). */
export const listJobsInModeration = query({
  args: {},
  handler: async (ctx) => {
    await requireGestorUser(ctx);
    const rows = [];
    for (const status of ["em_revisao", "suspensa"] as const) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .collect();
      for (const job of jobs) {
        const recruiter = await ctx.db.get(job.recruiterId);
        const reports = await reportInfo(ctx, job._id);
        rows.push({
          jobId: job._id,
          title: job.title,
          description: job.description,
          contractType: job.contractType,
          location: job.location ?? null,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          prerequisites: job.prerequisites,
          status: job.status,
          reason: job.moderationReason ?? null,
          cause: job.moderationCause ?? null,
          moderatedAt: job.moderatedAt ?? null,
          createdAt: job._creationTime,
          recruiterName: recruiter?.name ?? "—",
          recruiterEmail: recruiter?.email ?? "—",
          recruiterLinkedin: recruiter?.linkedinUrl ?? null,
          reportsCount: reports.count,
          reportBreakdown: reports.breakdown,
          reportDetails: reports.details,
        });
      }
    }
    return rows.sort((a, b) =>
      a.status === b.status
        ? b.createdAt - a.createdAt
        : a.status === "em_revisao"
          ? -1
          : 1,
    );
  },
});

/** Vagas abertas (as mais denunciadas primeiro), para o gestor derrubar. */
export const listLiveJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireGestorUser(ctx);
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .order("desc")
      .take(200);
    const rows = [];
    for (const job of jobs) {
      const recruiter = await ctx.db.get(job.recruiterId);
      const reports = await reportInfo(ctx, job._id);
      rows.push({
        jobId: job._id,
        title: job.title,
        description: job.description,
        contractType: job.contractType,
        location: job.location ?? null,
        salaryMin: job.salaryMin ?? null,
        salaryMax: job.salaryMax ?? null,
        createdAt: job._creationTime,
        recruiterName: recruiter?.name ?? "—",
        recruiterEmail: recruiter?.email ?? "—",
        recruiterLinkedin: recruiter?.linkedinUrl ?? null,
        reportsCount: reports.count,
        reportBreakdown: reports.breakdown,
        reportDetails: reports.details,
      });
    }
    return rows.sort(
      (a, b) => b.reportsCount - a.reportsCount || b.createdAt - a.createdAt,
    );
  },
});

/** Histórico de moderação (últimos 100 eventos), mesmo de vagas já excluídas. */
export const listModerationLog = query({
  args: {},
  handler: async (ctx) => {
    await requireGestorUser(ctx);
    const rows = await ctx.db.query("moderationLogs").order("desc").take(100);
    return rows.map((row) => ({
      logId: row._id,
      createdAt: row._creationTime,
      action: row.action,
      cause: row.cause ?? null,
      reason: row.reason,
      jobTitle: row.jobTitle,
      jobDescription: row.jobDescription,
      recruiterName: row.recruiterName,
      recruiterEmail: row.recruiterEmail,
      reportsCount: row.reportsCount ?? null,
      byGestor: row.actorId !== undefined,
    }));
  },
});

/** Contador do selo da aba "Moderação" (vagas aguardando revisão). */
export const pendingModerationCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    await requireGestorUser(ctx);
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "em_revisao"))
      .collect();
    return rows.length;
  },
});

/** Gestor arquiva as denúncias de uma vaga aberta (considerou infundadas). */
export const dismissReports = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    await requireGestorUser(ctx);
    const archived = await archiveActiveReports(ctx, jobId);
    return { ok: true as const, archived };
  },
});

/**
 * Decisão do gestor sobre uma vaga: aprovar/reativar (volta a "aberta" com
 * 30 dias novos e zera as denúncias) ou suspender (motivo obrigatório,
 * visível ao recrutador). Toda decisão fica no registro de moderação.
 */
export const decideJob = mutation({
  args: {
    jobId: v.id("jobs"),
    decision: v.union(v.literal("aprovar"), v.literal("suspender")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, decision, reason }) => {
    const gestor = await requireGestorUser(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    const now = Date.now();

    if (decision === "aprovar") {
      if (!isModerationHold(job.status)) {
        throw new Error("Esta vaga não está em revisão nem suspensa.");
      }
      const recruiter = await ctx.db.get(job.recruiterId);
      if (
        recruiter === null ||
        recruiter.active === false ||
        !isRecruiterApproved(recruiter)
      ) {
        throw new Error(
          "O recrutador desta vaga não está aprovado. Aprove o recrutador primeiro.",
        );
      }
      const archived = await archiveActiveReports(ctx, jobId);
      await ctx.db.patch(jobId, {
        status: "aberta",
        publishedAt: now,
        expiresAt: computeExpiresAt(now),
        filledAt: undefined,
        moderationCause: undefined,
        moderationReason: undefined,
        moderatedAt: now,
      });
      await logModeration(ctx, {
        job,
        action: "aprovada",
        cause: job.moderationCause,
        reason:
          archived > 0
            ? `Aprovada pela coordenação; ${archived} denúncia(s) arquivada(s).`
            : "Aprovada pela coordenação.",
        actorId: gestor._id,
        reportsCount: archived,
      });
      return { ok: true as const, status: "aberta" as const };
    }

    if (job.status === "suspensa") throw new Error("Esta vaga já está suspensa.");
    if (job.status === "encerrada") {
      throw new Error("Vaga encerrada não pode ser suspensa.");
    }
    const cleanReason = reason?.trim() ?? "";
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      throw new Error("Informe o motivo (5 a 500 caracteres).");
    }
    await ctx.db.patch(jobId, {
      status: "suspensa",
      moderationCause: "gestor",
      moderationReason: cleanReason,
      moderatedAt: now,
    });
    await logModeration(ctx, {
      job,
      action: "suspensa",
      cause: "gestor",
      reason: cleanReason,
      actorId: gestor._id,
    });
    return { ok: true as const, status: "suspensa" as const };
  },
});