import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { CURRENT_TERM_VERSION } from "../consentTerms";

/**
 * Usuário autenticado (documento `users`) ou null.
 *
 * 1. Caminho canônico (produção): o Convex Auth codifica o `userId` no
 *    claim `sub` do token (`subject = "<userId>|<sessionId>"`), então
 *    `getAuthUserId` resolve o documento pelo id — sem lookup, à prova de
 *    tokens sem e-mail casável (provider Credentials do signUp).
 * 2. Fallback (tokens legados/identidades sem `sub` resolvível): procura
 *    pelo e-mail da identidade e, por último, pelo tokenIdentifier —
 *    preserva a resolução que contas antigas já usavam, sem regressão.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId !== null) {
    const byId = await ctx.db.get(userId);
    if (byId !== null) return byId;
  }
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  const email = identity.email ?? identity.tokenIdentifier;
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

/**
 * [MODERACAO_RECRUTADOR] Recrutador só opera se aprovado. Conta sem o
 * campo `approvalStatus` (anterior à moderação) conta como aprovada, e
 * os demais papéis não passam por aprovação.
 */
export function isRecruiterApproved(user: Doc<"users">): boolean {
  if (user.role !== "recrutador") return true;
  return (
    user.approvalStatus === undefined || user.approvalStatus === "aprovado"
  );
}

export type ConsentGuard =
  | { ok: true; userId: Id<"users">; role: string | null }
  | { ok: false; reason: GuardFailure };

export type GuardFailure =
  | "usuario_inexistente"
  | "conta_inativa"
  | "recrutador_nao_aprovado"
  | "consentimento_ausente";

/** Mensagem única por motivo, para os módulos não duplicarem textos. */
export function guardMessage(reason: GuardFailure): string {
  switch (reason) {
    case "usuario_inexistente":
      return "Usuário não encontrado.";
    case "conta_inativa":
      return "Conta desativada. Procure a coordenação.";
    case "recrutador_nao_aprovado":
      return "Seu cadastro de recrutador ainda não foi aprovado pela coordenação.";
    case "consentimento_ausente":
      return "Aceite o Termo de Consentimento LGPD vigente para continuar.";
  }
}

/** Avalia conta ativa, recrutador aprovado e aceite LGPD vigente (R7). */
async function evaluateUser(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<ConsentGuard> {
  if (user.active === false) return { ok: false, reason: "conta_inativa" };
  if (!isRecruiterApproved(user)) {
    return { ok: false, reason: "recrutador_nao_aprovado" };
  }
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  if (!consents.some((c) => c.termVersion === CURRENT_TERM_VERSION)) {
    return { ok: false, reason: "consentimento_ausente" };
  }
  return { ok: true, userId: user._id, role: user.role ?? null };
}

/**
 * Guard R7 reutilizável (retorno discriminado): usuário autenticado via
 * getCurrentUser, conta ativa, recrutador aprovado e aceite vigente.
 */
export async function requireActiveConsentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<ConsentGuard> {
  const user = await getCurrentUser(ctx);
  if (user === null) return { ok: false, reason: "usuario_inexistente" };
  return evaluateUser(ctx, user);
}

/**
 * Mesmo guard, em versão que lança erro e devolve o documento do usuário.
 * Substitui as cópias de `requireRecruiter`/`requireActiveUser`.
 */
export async function requireConsentedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const user = await getCurrentUser(ctx);
  if (user === null) throw new Error(guardMessage("usuario_inexistente"));
  const guard = await evaluateUser(ctx, user);
  if (!guard.ok) throw new Error(guardMessage(guard.reason));
  return user;
}

/** Guard do gestor: conta ativa, consentimento vigente e papel gestor. */
export async function requireGestorUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireConsentedUser(ctx);
  if (user.role !== "gestor") {
    throw new Error("Apenas gestores acessam esta área.");
  }
  return user;
}