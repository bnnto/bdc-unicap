import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { CURRENT_TERM_VERSION, isKnownTermVersion } from "./consentTerms";
import { getCurrentUser, requireActiveConsentUser } from "./lib/currentUser";

/**
 * Consentimento LGPD versionado (issue [S1-2], R7).
 * Todo aceite é imutável: gravamos um documento por aceite (trilha de
 * auditoria com versão do termo + timestamp). Nunca sobrescrevemos.
 */

/** Últimos aceites do usuário autenticado + status em relação à versão vigente. */
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return {
        authenticated: false as const,
        consents: [],
        currentVersion: CURRENT_TERM_VERSION,
        active: false,
      };
    }
    // Resolução pelo token (getAuthUserId + fallback) — não pelo e-mail da
    // identidade, que falhava no signUp do provider Credentials.
    const guard = await requireActiveConsentUser(ctx);
    if (guard.ok === false && guard.reason === "usuario_inexistente") {
      return {
        authenticated: false as const,
        consents: [],
        currentVersion: CURRENT_TERM_VERSION,
        active: false,
      };
    }
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return {
        authenticated: false as const,
        consents: [],
        currentVersion: CURRENT_TERM_VERSION,
        active: false,
      };
    }
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return {
      authenticated: true as const,
      consents: consents.map((c) => ({
        termVersion: c.termVersion,
        acceptedAt: c.acceptedAt,
      })),
      currentVersion: CURRENT_TERM_VERSION,
      active: consents.some((c) => c.termVersion === CURRENT_TERM_VERSION),
    };
  },
});

/**
 * Registra o aceite da versão vigente para o usuário autenticado.
 * Idempotente: não duplica aceite da mesma versão.
 */
export const acceptCurrentTerm = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Não autenticado.");
    }
    const user = await getCurrentUser(ctx);
    if (user === null) {
      throw new Error("Usuário não encontrado.");
    }
    const existing = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.some((c) => c.termVersion === CURRENT_TERM_VERSION)) {
      return { ok: true as const, alreadyAccepted: true as const };
    }
    await ctx.db.insert("consents", {
      userId: user._id,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    return { ok: true as const, alreadyAccepted: false as const };
  },
});

/**
 * Guard interno (R7) legado: resolve o usuário pelo E-MAIL informado
 * (chamado por mutations que já resolveram o e-mail da identidade).
 * O caminho preferencial é `requireActiveConsentUser` (lib/currentUser),
 * que resolve pelo token e não depende do e-mail.
 */
export const requireActiveConsent = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (user === null)
      return { ok: false as const, reason: "usuario_inexistente" as const };
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
    return active
      ? { ok: true as const, userId: user._id, role: user.role ?? null }
      : { ok: false as const, reason: "consentimento_ausente" as const };
  },
});

/** Validação de versão conhecida (uso interno por outras issues). */
export const termVersionGuard = internalQuery({
  args: { termVersion: v.string() },
  handler: async (_ctx, { termVersion }) => ({
    known: isKnownTermVersion(termVersion),
    current: termVersion === CURRENT_TERM_VERSION,
  }),
});
