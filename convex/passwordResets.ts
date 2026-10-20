/**
 * [ONBOARDING_RECOVERY] Etapa 2 — backend do "Esqueci minha senha".
 *
 * - `requestReset` gera um token aleatório de 256 bits com validade de
 *   30 min, invalida pedidos anteriores e agenda o e-mail (action
 *   `emails.sendPasswordResetEmail`). A resposta é SEMPRE `{ ok: true }`
 *   — sem enumeração de contas — e nada é criado para e-mail inexistente.
 *   Pedidos repetidos dentro de RESET_COOLDOWN_MS são ignorados (mesma
 *   resposta) e NÃO invalidam o link anterior.
 * - `resetPassword` troca a senha com segurança (TDD em
 *   tests/integration/passwordReset.test.ts):
 *   1. senha fraca (mesmas regras do cadastro) ou acima do teto é
 *      rejeitada ANTES de tocar no token;
 *   2. token desconhecido, expirado ou já usado → "Token de recuperação
 *      inválido ou expirado." (mesma mensagem nos três casos);
 *   3. a nova senha é HASHADA (PBKDF2, convex/password) antes de gravar;
 *   4. o token morre com o uso (uso único), as sessões abertas do
 *      titular são revogadas e o bloqueio de login por tentativas é zerado.
 */
import { mutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashPassword } from "./password";
import {
  normalizeEmail,
  passwordRules,
  PASSWORD_MAX_LENGTH,
  type PasswordRule,
} from "../src/lib/auth";
import { PASSWORD_RESET_TTL_MS } from "../src/lib/passwordReset";

/** Intervalo mínimo entre dois pedidos de recuperação do mesmo usuário. */
const RESET_COOLDOWN_MS = 2 * 60 * 1000;

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
      const previous = await ctx.db
        .query("passwordResets")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      // Cooldown ANTES de apagar qualquer coisa: um pedido repetido não
      // pode destruir o link anterior (que ainda é válido) sem criar outro.
      const now = Date.now();
      if (
        previous.some((row) => now - row._creationTime < RESET_COOLDOWN_MS)
      ) {
        return { ok: true as const }; // mesma resposta, sem novo e-mail
      }

      // Só o link mais recente vale: pedidos anteriores morrem aqui.
      for (const row of previous) {
        await ctx.db.delete(row._id);
      }

      const token = generateResetToken();
      await ctx.db.insert("passwordResets", {
        userId: user._id,
        email,
        token,
        expiresAt: now + PASSWORD_RESET_TTL_MS,
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
    // Regras do cadastro, checadas antes do token: uma senha fraca nunca
    // consome (queima) um link válido.
    if (args.password.length > PASSWORD_MAX_LENGTH) {
      throw new ConvexError(
        `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
    }
    const weak = passwordRules(args.password).find((r: PasswordRule) => !r.ok);
    if (weak !== undefined) {
      throw new ConvexError(`Senha fraca: ${weak.label.toLowerCase()}.`);
    }

    const record = await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (record === null || record.expiresAt <= Date.now()) {
      throw new ConvexError(INVALID_TOKEN);
    }

    // Só agora o e-mail é conhecido: confere a regra "não contém o e-mail".
    const weakPersonal = passwordRules(args.password, {
      email: record.email,
    }).find((r: PasswordRule) => !r.ok);
    if (weakPersonal !== undefined) {
      throw new ConvexError(
        `Senha fraca: ${weakPersonal.label.toLowerCase()}.`,
      );
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", record.userId).eq("provider", "credentials-email"),
      )
      .unique();
    if (account === null) {
      throw new ConvexError(INVALID_TOKEN);
    }

    // Hash PRIMEIRO (Web Crypto) — só a derivação PBKDF2 vai ao banco.
    const secret = await hashPassword(args.password);
    await ctx.db.patch(account._id, { secret });

    // Uso único: o registo morre junto com o token.
    await ctx.db.delete(record._id);

    // Segurança: sessões abertas com a senha antiga são encerradas.
    await revokeUserSessions(ctx, record.userId);

    // Quem estava bloqueado por tentativas pode entrar com a senha nova.
    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", record.email))
      .unique();
    if (attempts !== null) await ctx.db.delete(attempts._id);

    return { ok: true as const };
  },
});