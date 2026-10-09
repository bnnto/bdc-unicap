/**
 * [ONBOARDING_RECOVERY] Etapa 2 — backend do "Esqueci minha senha".
 *
 * - `requestReset` gera um token aleatório de 256 bits com validade de
 *   30 min, invalida pedidos anteriores e agenda o e-mail (action
 *   `emails.sendPasswordResetEmail`). A resposta é SEMPRE `{ ok: true }`
 *   — sem enumeração de contas — e nada é criado para e-mail inexistente.
 * - `resetPassword` troca a senha com segurança (TDD em
 *   tests/integration/passwordReset.test.ts):
 *   1. senha com menos de 8 caracteres é rejeitada ANTES de tocar no token;
 *   2. token desconhecido, expirado ou já usado → "Token de recuperação
 *      inválido ou expirado." (mesma mensagem nos três casos);
 *   3. a nova senha é HASHADA (PBKDF2, convex/password) antes de gravar;
 *   4. o token morre com o uso (uso único) e as sessões abertas do
 *      titular são revogadas (quem trocou a senha fecha as outras entradas).
 */
import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashPassword } from "./password";
import { normalizeEmail } from "../src/lib/auth";
import { PASSWORD_RESET_TTL_MS } from "../src/lib/passwordReset";

/** Mensagem única para token desconhecido/expirado/usado (sem vazamento). */
const INVALID_TOKEN = "Token de recuperação inválido ou expirado.";

/** Token seguro: 32 bytes aleatórios (Web Crypto) em hex — 256 bits. */
function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Encerra todas as sessões do titular (e os refresh tokens delas). */
async function revokeUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }
}

/**
 * Pedido de recuperação (público — o utilizador está deslogado).
 * E-mail normalizado; conta inexistente NÃO gera token nem e-mail e
 * devolve a mesma resposta (anti enumeração).
 */
export const requestReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const email = normalizeEmail(args.email);
    const user =
      email.length > 0
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
        : null;

    if (user !== null) {
      // Só o link mais recente vale: pedidos anteriores morrem aqui.
      const previous = await ctx.db
        .query("passwordResets")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const row of previous) {
        await ctx.db.delete(row._id);
      }

      const token = generateResetToken();
      await ctx.db.insert("passwordResets", {
        userId: user._id,
        email,
        token,
        expiresAt: Date.now() + PASSWORD_RESET_TTL_MS,
      });
      // E-mail é best-effort: a action nunca derruba o fluxo.
      await ctx.scheduler.runAfter(0, internal.emails.sendPasswordResetEmail, {
        to: email,
        token,
      });
    }

    return { ok: true as const };
  },
});

/**
 * Troca de senha pelo token (público). Valida tudo ANTES das escritas e
 * grava apenas o hash PBKDF2 em `authAccounts` (nunca a senha em claro).
 */
export const resetPassword = mutation({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    // Regra do cadastro: mínimo de 8 caracteres — checada antes do token,
    // para que uma senha fraca nunca consuma (queime) um link válido.
    if (args.password.length < 8) {
      throw new Error("A senha deve ter pelo menos 8 caracteres.");
    }

    const record = await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (record === null || record.expiresAt <= Date.now()) {
      throw new Error(INVALID_TOKEN);
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", record.userId).eq("provider", "credentials-email"),
      )
      .unique();
    if (account === null) {
      throw new Error(INVALID_TOKEN);
    }

    // Hash PRIMEIRO (Web Crypto) — só a derivação PBKDF2 vai ao banco.
    const secret = await hashPassword(args.password);
    await ctx.db.patch(account._id, { secret });

    // Uso único: o registo morre junto com o token.
    await ctx.db.delete(record._id);

    // Segurança: sessões abertas com a senha antiga são encerradas.
    await revokeUserSessions(ctx, record.userId);

    return { ok: true as const };
  },
});
