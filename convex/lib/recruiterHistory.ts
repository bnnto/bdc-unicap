import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type RecruiterEventKind = "recusado" | "revogado" | "conta_excluida";

export type PriorOccurrence = {
  at: number;
  /** "vaga" = evento do registro de moderação; "conta" = evento da conta. */
  source: "vaga" | "conta";
  action: string;
  reason: string;
  /** Título da vaga (eventos de vaga) ou null. */
  subject: string | null;
};

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Grava um evento de conta do recrutador (sobrevive à exclusão da conta). */
export async function logRecruiterEvent(
  ctx: MutationCtx,
  input: {
    user: Pick<Doc<"users">, "_id" | "name" | "email">;
    event: RecruiterEventKind;
    reason: string;
    actorId?: Id<"users">;
  },
): Promise<void> {
  if (input.user.email === undefined) return;
  await ctx.db.insert("recruiterEvents", {
    recruiterId: String(input.user._id),
    email: emailKey(input.user.email),
    name: input.user.name ?? "—",
    event: input.event,
    reason: input.reason,
    actorId: input.actorId === undefined ? undefined : String(input.actorId),
  });
}

/**
 * Ocorrências de CONTAS ANTERIORES com o mesmo e-mail (eventos da conta
 * atual ficam de fora: reincidência = quem reaparece com outro cadastro).
 */
export async function priorOccurrences(
  ctx: QueryCtx,
  user: Pick<Doc<"users">, "_id" | "email">,
): Promise<{ count: number; items: PriorOccurrence[] }> {
  if (user.email === undefined) return { count: 0, items: [] };
  const email = emailKey(user.email);
  const self = String(user._id);
  const items: PriorOccurrence[] = [];

  const logs = await ctx.db
    .query("moderationLogs")
    .withIndex("by_recruiter_email", (q) => q.eq("recruiterEmail", email))
    .collect();
  for (const log of logs) {
    if (log.action === "aprovada" || log.recruiterId === self) continue;
    items.push({
      at: log._creationTime,
      source: "vaga",
      action: log.action,
      reason: log.reason,
      subject: log.jobTitle,
    });
  }

  const events = await ctx.db
    .query("recruiterEvents")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  for (const event of events) {
    if (event.recruiterId === self) continue;
    items.push({
      at: event._creationTime,
      source: "conta",
      action: event.event,
      reason: event.reason,
      subject: null,
    });
  }

  items.sort((a, b) => b.at - a.at);
  return { count: items.length, items: items.slice(0, 20) };
}