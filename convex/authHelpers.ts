import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Funções de suporte à autenticação e papéis (issue [S1-1]).
 * O hash da senha fica apenas em authAccounts (nunca retornado).
 */

/** Retorna o id do usuário com o e-mail normalizado, ou null. */
export const lookupByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    return user?._id ?? null;
  },
});

/** Uso interno do provider de credenciais no fluxo signIn. */
export const findAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (user === null) return null;
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "credentials-email"),
      )
      .unique();
    if (account === null || account.secret === undefined) return null;
    return {
      userId: user._id,
      secret: account.secret,
      active: user.active ?? true,
    };
  },
});

/** Cria usuário (com papel) + conta de credenciais atomicamente no signUp. */
export const createUser = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    /** [REFACTOR_UI] Cadastro com os papéis vigentes do sistema. */
    role: v.union(
      v.literal("aluno"),
      v.literal("recrutador"),
      v.literal("gestor"),
    ),
    secret: v.string(),
    consentTermVersion: v.string(),
  },
  handler: async (ctx, { email, name, role, secret, consentTermVersion }) => {
    const userId = await ctx.db.insert("users", {
      email,
      name,
      role,
      active: true,
    });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "credentials-email",
      providerAccountId: email,
      secret,
    });
    // R7 — aceite do termo LGPD gravado atomicamente com o cadastro
    // (issue [S1-2]); o criador do usuário concordou com esta versão.
    await ctx.db.insert("consents", {
      userId,
      termVersion: consentTermVersion,
      acceptedAt: Date.now(),
    });
    return userId;
  },
});

/**
 * Documento do usuário autenticado (ou null). O `TokenIdentifier` do Convex
 * Auth carrega o e-mail — a resolução é via índice by_email.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});
