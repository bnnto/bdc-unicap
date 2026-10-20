import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type ModerationAction = "em_revisao" | "suspensa" | "aprovada" | "excluida";
export type ModerationCause = "regra" | "gestor" | "recrutador" | "denuncia";

/**
 * [MODERACAO_VAGA] Grava o registro de moderação com cópia do conteúdo
 * da vaga e dos dados do recrutador (sobrevive à exclusão de ambos).
 * Deve ser chamado ANTES de apagar a vaga.
 */
export async function logModeration(
  ctx: MutationCtx,
  input: {
    job: Pick<Doc<"jobs">, "_id" | "title" | "description" | "recruiterId">;
    action: ModerationAction;
    cause?: ModerationCause;
    reason: string;
    actorId?: Id<"users">;
    reportsCount?: number;
  },
): Promise<void> {
  const recruiter = await ctx.db.get(input.job.recruiterId);
  await ctx.db.insert("moderationLogs", {
    jobId: String(input.job._id),
    jobTitle: input.job.title,
    jobDescription: input.job.description.slice(0, 2000),
    recruiterId: String(input.job.recruiterId),
    recruiterName: recruiter?.name ?? "—",
    recruiterEmail: recruiter?.email ?? "—",
    action: input.action,
    cause: input.cause,
    reason: input.reason,
    actorId: input.actorId === undefined ? undefined : String(input.actorId),
    reportsCount: input.reportsCount,
  });
}