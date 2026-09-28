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
 * Guard R7 reutilizável: usuário autenticado (via getCurrentUser) com
 * aceite vigente do termo LGPD. Substitui o padrão antigo de resolver o
 * usuário pelo e-mail da identidade (requireActiveConsent), que falhava
 * com tokens do signUp sem e-mail ("Usuário não encontrado.").
 */
export type ConsentGuard =
  | { ok: true; userId: Id<"users">; role: string | null }
  | { ok: false; reason: "usuario_inexistente" | "consentimento_ausente" };

export async function requireActiveConsentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<ConsentGuard> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    return { ok: false, reason: "usuario_inexistente" };
  }
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
  if (!active) {
    return { ok: false, reason: "consentimento_ausente" };
  }
  return { ok: true, userId: user._id, role: user.role ?? null };
}
