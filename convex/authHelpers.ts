import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  validateRecruiterLinkedin,
  validateRecruiterWebsite,
} from "../src/lib/recruiterSignup";

/**
 * Funções de suporte à autenticação e papéis (issue [S1-1]).
 * O hash da senha fica apenas em authAccounts (nunca retornado).
 */

/** Anti força bruta no login: 5 erros em 15 min bloqueiam o e-mail por 15 min. */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Retorna o id do usuário com o e-mail normalizado, ou null.
 * INTERNA: se fosse pública, qualquer pessoa descobriria quais e-mails
 * têm conta chamando a função direto do navegador.
 */
export const lookupByEmail = internalQuery({
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

/**
 * Registra uma tentativa de login ANTES de verificar a senha (atômico:
 * tentativas paralelas não furam o limite) e informa se pode prosseguir.
 * Conta também e-mails inexistentes, para o bloqueio não revelar contas.
 */
export const beginLoginAttempt = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const rec = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (rec === null) {
      await ctx.db.insert("loginAttempts", {
        email,
        attempts: 1,
        windowStart: now,
      });
      return { allowed: true as const };
    }

    if (rec.lockedUntil !== undefined && rec.lockedUntil > now) {
      return { allowed: false as const, retryAfterMs: rec.lockedUntil - now };
    }

    // Bloqueio vencido ou janela expirada: recomeça a contagem.
    const expired =
      rec.lockedUntil !== undefined || now - rec.windowStart > WINDOW_MS;
    const attempts = expired ? 1 : rec.attempts + 1;
    const windowStart = expired ? now : rec.windowStart;

    if (attempts > MAX_ATTEMPTS) {
      await ctx.db.patch(rec._id, {
        attempts,
        windowStart,
        lockedUntil: now + LOCK_MS,
      });
      return { allowed: false as const, retryAfterMs: LOCK_MS };
    }

    await ctx.db.patch(rec._id, {
      attempts,
      windowStart,
      lockedUntil: undefined,
    });
    return { allowed: true as const };
  },
});

/** Zera o contador (login correto ou senha redefinida). */
export const clearLoginAttempts = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const rec = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (rec !== null) await ctx.db.delete(rec._id);
  },
});

/** Cria usuário (com papel) + conta de credenciais atomicamente no signUp. */
export const createUser = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("aluno"),
      v.literal("recrutador"),
      v.literal("gestor"),
    ),
    secret: v.string(),
    consentTermVersion: v.string(),
    publicSignup: v.optional(v.boolean()),
    linkedinUrl: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      email,
      name,
      role,
      secret,
      consentTermVersion,
      publicSignup,
      linkedinUrl,
      website,
    },
  ) => {
    const moderate = publicSignup === true && role === "recrutador";
    let normalizedLinkedin: string | undefined;
    let normalizedWebsite: string | undefined;
    if (moderate) {
      const check = validateRecruiterLinkedin(linkedinUrl);
      if (!check.ok) throw new Error(check.error);
      normalizedLinkedin = check.normalized;

      const siteCheck = validateRecruiterWebsite(website);
      if (!siteCheck.ok) throw new Error(siteCheck.error);
      normalizedWebsite = siteCheck.normalized;
    }

    const userId = await ctx.db.insert("users", {
      email,
      name,
      role,
      active: true,
      ...(moderate
        ? {
            approvalStatus: "pendente" as const,
            linkedinUrl: normalizedLinkedin,
            ...(normalizedWebsite !== undefined
              ? { website: normalizedWebsite }
              : {}),
          }
        : {}),
    });
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
