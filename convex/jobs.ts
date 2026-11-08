import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  validateJob,
  type JobInput,
  type JobPrerequisite,
} from "../src/lib/job";
import {
  computeExpiresAt,
  isJobExpired,
  renewJob as renewJobDecision,
} from "../src/lib/jobExpiry";
import { requireConsentedUser } from "./lib/currentUser";
import {
  HOLD_MESSAGE,
  isModerationHold,
  reviewJobContent,
} from "../src/lib/jobModeration";
import { logModeration } from "./lib/moderationLog";

/**
 * Vagas do recrutador (issue [S3-1]).
 * Toda operação exige consentimento vigente (R7) e papel de recrutador
 * ou gestor. A validação usa a mesma regra pura do formulário
 * (src/lib/job.ts) — erros claros no servidor, não apenas na UI.
 */

/** Papéis autorizados a publicar/gerenciar vagas. */
function canManageJobs(
  role: string | null | undefined,
): role is "recrutador" | "gestor" {
  return role === "recrutador" || role === "gestor";
}

/** Guard comum (R7 + aprovação + papel). */
async function requireRecruiter(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireConsentedUser(ctx);
  if (!canManageJobs(user.role)) {
    throw new Error(
      "Apenas recrutadores e gestores publicam e gerenciam vagas.",
    );
  }
  return user;
}

/** Converte os argumentos crus da mutation para o formato da regra pura. */
function toJobInput(args: {
  title: string;
  description: string;
  prerequisites: JobPrerequisite[];
  contractType: JobInput["contractType"];
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
}): JobInput {
  return {
    title: args.title,
    description: args.description,
    prerequisites: args.prerequisites.map((p) => ({ item: p.item, required: p.required, kind: p.kind })),
    contractType: args.contractType,
    salaryMin: args.salaryMin,
    salaryMax: args.salaryMax,
    location: args.location,
  };
}

/**
 * Cria ou atualiza uma vaga do recrutador autenticado (CA 1).
 * Validação completa no servidor (CA 2) — faixa salarial consistente,
 * campos obrigatórios e pré-requisitos com flag obrigatório/opcional
 * (CA 3, base para R3/R8).
 */
export const upsertJob = mutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    title: v.string(),
    description: v.string(),
    prerequisites: v.array(
      v.object({
        item: v.string(),
        required: v.boolean(),
        kind: v.optional(v.union(v.literal("skill"), v.literal("text"))),
      }),
    ),
    contractType: v.union(
      v.literal("estagio"),
      v.literal("clt"),
      v.literal("pj"),
      v.literal("temporario"),
    ),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    location: v.optional(v.string()),
    /** [S3-4] Insumos do matching (R8): idioma mínimo e disponibilidade. */
    requiredLanguage: v.optional(
      v.object({
        name: v.string(),
        level: v.union(
          v.literal("basico"),
          v.literal("intermediario"),
          v.literal("avancado"),
          v.literal("fluente"),
          v.literal("nativo"),
        ),
      }),
    ),
    availability: v.optional(
      v.union(
        v.literal("estagio"),
        v.literal("integral"),
        v.literal("meio_periodo"),
        v.literal("freelancer"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRecruiter(ctx);

    const validation = validateJob(toJobInput(args));
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }
    const job = validation.normalized;

    // [MODERACAO_VAGA] Nível 1: bloqueia o óbvio. Nível 2: duvidoso → revisão.
    const review = reviewJobContent({
      title: job.title,
      description: job.description,
      contractType: job.contractType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      location: job.location,
    });
    if (review.verdict === "bloqueada") {
      throw new Error(`Vaga não publicada: ${review.reasons.join(" ")}`);
    }
    const toReview = review.verdict === "revisao";
    const reviewFields = {
      status: "em_revisao" as const,
      moderationReason: review.reasons.join(" "),
      moderationCause: "regra" as const,
      moderatedAt: Date.now(),
    };

    if (args.jobId !== undefined) {
      const existing = await ctx.db.get(args.jobId);

      if (existing === null) throw new Error("Vaga não encontrada.");
      if (existing.recruiterId !== user._id) {
        throw new Error("Você só pode editar as suas próprias vagas.");
      }
      const sendToReview =
        toReview &&
        (existing.status === "aberta" || existing.status === "fechada");
      await ctx.db.patch(
        args.jobId,
        sendToReview ? { ...job, ...reviewFields } : { ...job },
      );
      
      if (sendToReview) {
        await logModeration(ctx, {
          job: {
            _id: args.jobId,
            recruiterId: existing.recruiterId,
            title: job.title,
            description: job.description,
          },
          action: "em_revisao",
          cause: "regra",
          reason: reviewFields.moderationReason,
        });
      }
      return {
        jobId: args.jobId,
        created: false as const,
        status: sendToReview ? ("em_revisao" as const) : existing.status,
      };
    }

    // [S3-2] CA 1 — prazo de expiração gravado na publicação (R4).
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      recruiterId: user._id,
      ...job,
      publishedAt: now,
      expiresAt: computeExpiresAt(now),
      ...(toReview ? reviewFields : { status: "aberta" as const }),
    });

    if (toReview) {
      await logModeration(ctx, {
        job: {
          _id: jobId,
          recruiterId: user._id,
          title: job.title,
          description: job.description,
        },
        action: "em_revisao",
        cause: "regra",
        reason: reviewFields.moderationReason,
      });
    }
    return {
      jobId,
      created: true as const,
      status: toReview ? ("em_revisao" as const) : ("aberta" as const),
    };
  },
});

/** Vagas do recrutador autenticado, mais recentes primeiro (painel). */
export const myJobs = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRecruiter(ctx);
    return ctx.db
      .query("jobs")
      .withIndex("by_recruiter", (q) => q.eq("recruiterId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * [RECRUITER_WORKFLOW] Etapa 1 — alias semântico de `myJobs` (mesma
 * query, mesmo guard `requireRecruiter`): as vagas do recrutador logado
 * via índice `by_recruiter`, nunca as de outro recrutador.
 */
export const getMyJobs = myJobs;

/**
 * [RECRUITER_WORKFLOW] Etapa 1 — alias semântico de `upsertJob` sem
 * `jobId` (mesma validação e guard): publica a vaga do recrutador logado
 * como "aberta", com `publishedAt` agora e `expiresAt` em 30 dias (R4).
 */
export const createJob = upsertJob;

/**
 * Detalhe de uma vaga para edição — apenas o recrutador dono a lê aqui.
 */
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireRecruiter(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    if (job.recruiterId !== user._id) return null;
    return job;
  },
});

/**
 * Abre/fecha/encerra uma vaga própria (ciclo de vida do CA 1).
 * Reabrir (status "aberta") reativa o prazo de 30 dias (R4/CA 3).
 */
export const setJobStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("aberta"),
      v.literal("fechada"),
      v.literal("encerrada"),
    ),
  },
  handler: async (ctx, { jobId, status }) => {
    const user = await requireRecruiter(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Você só pode alterar as suas próprias vagas.");
    }
    if (isModerationHold(job.status)) throw new Error(HOLD_MESSAGE);
    if (status === "aberta") {
      // Reabertura — reinicia o prazo de expiração a partir de agora e
      // [S5-2] limpa o momento de preenchimento (vaga volta ao ciclo ativo).
      const now = Date.now();
      await ctx.db.patch(jobId, {
        status,
        publishedAt: now,
        expiresAt: computeExpiresAt(now),
        filledAt: undefined,
      });
    } else {
      // [S5-2] encerramento manual grava o momento do preenchimento.
      await ctx.db.patch(jobId, { status, filledAt: Date.now() });
    }
    return { ok: true as const, status };
  },
});

/**
 * [S3-2] CA 3 — Renovação: reativa o prazo de 30 dias da vaga própria.
 * Vaga fechada volta a ficar aberta; vencida é recusada (o cron a
 * encerra — evita renovar vagas fora do ar); encerrada não é renovável.
 */
export const renewJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireRecruiter(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Você só pode renovar as suas próprias vagas.");
    }
    const now = Date.now();
    const decision = renewJobDecision(
      {
        status: job.status,
        publishedAt: job.publishedAt ?? now,
        expiresAt: job.expiresAt ?? now,
      },
      now,
    );
    if (!decision.ok) {
      throw new Error(
        decision.reason === "expirada"
          ? "Vaga expirada — o encerramento automático acontece no próximo ciclo."
          : decision.reason === "moderacao"
            ? HOLD_MESSAGE
            : "Vaga encerrada não pode ser renovada.",
      );
    }
    await ctx.db.patch(jobId, {
      status: "aberta",
      publishedAt: now,
      expiresAt: decision.expiresAt,
      filledAt: undefined,
    });
    return { ok: true as const, expiresAt: decision.expiresAt };
  },
});

/**
 * Exclusão definitiva de vaga própria. Só vagas encerradas ou suspensas
 * podem ser excluídas. Antes de apagar, grava o registro de moderação
 * (que sobrevive à exclusão); depois apaga denúncias e candidaturas.
 */
export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireRecruiter(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");
    if (job.recruiterId !== user._id) {
      throw new Error("Você só pode excluir as suas próprias vagas.");
    }
    if (job.status !== "encerrada" && job.status !== "suspensa") {
      throw new Error("Só é possível excluir vagas encerradas ou suspensas.");
    }

    const reports = await ctx.db
      .query("jobReports")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
    if (job.status === "suspensa" || reports.length > 0) {
      await logModeration(ctx, {
        job,
        action: "excluida",
        cause: job.moderationCause,
        reason:
          `Excluída pelo recrutador (status: ${job.status}).` +
          (job.moderationReason
            ? ` Motivo da moderação: ${job.moderationReason}`
            : ""),
        reportsCount: reports.length,
      });
    }
    for (const report of reports) await ctx.db.delete(report._id);

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
    for (const application of applications) {
      await ctx.db.delete(application._id);
    }
    await ctx.db.delete(jobId);
    return { ok: true as const, deletedApplications: applications.length };
  },
});

/**
 * [S3-2] CA 2 — Cron diário (convex/crons.ts): encerra automaticamente
 * todas as vagas abertas vencidas (R4 — "Encerrada" se não renovada).
 * Varredura ancorada no índice by_status (somente abertas).
 */
export const closeExpiredJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .collect();
    let closed = 0;
    for (const job of openJobs) {
      if (
        job.expiresAt !== undefined &&
        isJobExpired({ status: job.status, expiresAt: job.expiresAt }, now)
      ) {
        // [S5-2] grava o momento do preenchimento (base do time-to-hire).
        await ctx.db.patch(job._id, {
          status: "encerrada",
          filledAt: now,
        });
        closed += 1;
      }
    }
    return { closed, checkedAt: now };
  },
});
