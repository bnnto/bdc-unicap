import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireConsentedUser } from "./lib/currentUser";
import { logModeration } from "./lib/moderationLog";
import {
  REPORT_DETAILS_MAX,
  REPORT_OTHER_MIN,
  REPORT_SUSPENSION_MESSAGE,
  shouldSuspendForReports,
} from "../src/lib/jobReport";

/**
 * [MODERACAO_VAGA] Aluno denuncia uma vaga aberta. Um aluno denuncia a
 * mesma vaga uma única vez; ao atingir o limite de alunos diferentes, a
 * vaga é suspensa automaticamente até o gestor decidir.
 */
export const reportJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.union(
      v.literal("cobranca_indevida"),
      v.literal("empresa_falsa"),
      v.literal("contato_fora_do_portal"),
      v.literal("conteudo_enganoso"),
      v.literal("discriminacao"),
      v.literal("outro"),
    ),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, reason, details }) => {
    const user = await requireConsentedUser(ctx);
    if (user.role !== "aluno") {
      throw new Error("Apenas alunos denunciam vagas.");
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) {
      throw new Error("Complete o cadastro do perfil antes de denunciar.");
    }
    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.status !== "aberta") throw new Error("Esta vaga não está aberta.");

    const already = await ctx.db
      .query("jobReports")
      .withIndex("by_job_student", (q) =>
        q.eq("jobId", jobId).eq("studentId", student._id),
      )
      .first();
    if (already !== null) throw new Error("Você já denunciou esta vaga.");

    const cleanDetails = details?.trim() ?? "";
    if (cleanDetails.length > REPORT_DETAILS_MAX) {
      throw new Error(`Os detalhes devem ter no máximo ${REPORT_DETAILS_MAX} caracteres.`);
    }
    if (reason === "outro" && cleanDetails.length < REPORT_OTHER_MIN) {
      throw new Error(`Descreva o problema (mín. ${REPORT_OTHER_MIN} caracteres).`);
    }

    await ctx.db.insert("jobReports", {
      jobId,
      studentId: student._id,
      reason,
      details: cleanDetails.length > 0 ? cleanDetails : undefined,
      status: "ativa",
    });

    const active = (
      await ctx.db
        .query("jobReports")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect()
    ).filter((row) => row.status === "ativa");

    if (!shouldSuspendForReports(active.length)) {
      return { ok: true as const, suspended: false as const };
    }

    await ctx.db.patch(jobId, {
      status: "suspensa",
      moderationCause: "denuncia",
      moderationReason: REPORT_SUSPENSION_MESSAGE,
      moderatedAt: Date.now(),
    });
    await logModeration(ctx, {
      job,
      action: "suspensa",
      cause: "denuncia",
      reason: REPORT_SUSPENSION_MESSAGE,
      reportsCount: active.length,
    });
    return { ok: true as const, suspended: true as const };
  },
});

/** Ids das vagas que o aluno logado já denunciou (desabilita o botão). */
export const myReportedJobIds = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const user = await requireConsentedUser(ctx);
    if (user.role !== "aluno") return [];
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) return [];
    const rows = await ctx.db
      .query("jobReports")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();
    return rows.map((row) => String(row.jobId));
  },
});