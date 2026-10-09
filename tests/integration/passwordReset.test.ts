/**
 * [ONBOARDING_RECOVERY] Etapa 2 — segurança do fluxo "Esqueci minha senha"
 * testada contra o backend Convex real (convex-test):
 *
 * - `passwordResets.requestReset` gera token único com validade de 30 min,
 *   invalida tokens anteriores e agenda o e-mail; resposta SEMPRE igual
 *   (sem enumeração de contas) e sem e-mail para e-mail inexistente.
 * - `passwordResets.resetPassword` (TDD de segurança):
 *   1. grava a nova senha HASHADA (PBKDF2) — nunca em claro;
 *   2. a senha antiga deixa de autenticar;
 *   3. token é de uso único (após usar, morre);
 *   4. token expirado/desconhecido é rejeitado;
 *   5. senha curta não troca NEM consome o token;
 *   6. sessões abertas do utilizador são revogadas na troca.
 * - A action de e-mail faz fallback com console.log do link quando não
 *   há RESEND_API_KEY e usa a API do Resend quando há.
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";
import { hashPassword, verifyPassword } from "../../convex/password";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const EMAIL = "aluna@unicap.br";
const OLD_PASSWORD = "SenhaAntiga123";
const NEW_PASSWORD = "SenhaNova456";
const APP_URL = "https://carreiras.unicap.br";
const DAY = 24 * 60 * 60 * 1000;

/** Conta criada exatamente como o signUp do provider Credentials. */
async function signUp(t: World, email = EMAIL): Promise<string> {
  const secret = await hashPassword(OLD_PASSWORD);
  return t.mutation(internal.authHelpers.createUser, {
    email,
    name: "Aluna Teste",
    role: "aluno",
    secret,
    consentTermVersion: CURRENT_TERM_VERSION,
  });
}

type ResetRow = {
  _id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: number;
};

/** Todos os registos de recuperação (tabela nova). */
async function resets(t: World): Promise<ResetRow[]> {
  return t.run(async (ctx) => {
    return (await ctx.db.query("passwordResets").collect()) as ResetRow[];
  });
}

async function firstReset(t: World): Promise<ResetRow> {
  const rows = await resets(t);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

/** Secret gravado na conta de credenciais do utilizador. */
async function secretOf(t: World, userId: string): Promise<string> {
  const secret = await t.run(async (ctx): Promise<string | undefined> => {
    // Mesma conta do signIn: provider de credenciais do próprio usuário
    // (tabela de auth — varredura pequena, como nos demais testes).
    const accounts = (await ctx.db.query("authAccounts").collect()) as Array<{
      userId: string;
      provider: string;
      secret?: string;
    }>;
    const account = accounts.find(
      (row) => row.userId === userId && row.provider === "credentials-email",
    );
    expect(account).toBeDefined();
    return account?.secret;
  });
  expect(secret).toBeDefined();
  return secret!;
}

beforeEach(() => {
  vi.useFakeTimers();
  // Sem chave por omissão: o fallback console.log do link é o caminho testado.
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("APP_URL", APP_URL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("passwordResets.requestReset — geração do token", () => {
  it("cria token único de 30 min e agenda o e-mail com o link exato", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const userId = await signUp(t);

    // E-mail com caixa/espaços: normalizado no servidor.
    const result = await t.mutation(api.passwordResets.requestReset, {
      email: "  ALUNA@Unicap.br ",
    });
    expect(result).toEqual({ ok: true });

    const row = await firstReset(t);
    expect(row.userId).toBe(userId);
    expect(row.email).toBe(EMAIL);
    expect(row.token).toMatch(/^[a-f0-9]{64}$/);
    const remaining = row.expiresAt - Date.now();
    expect(remaining).toBeGreaterThan(29 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000);

    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain(`${APP_URL}/recuperar-senha?token=${row.token}`);
  });

  it("segundo pedido invalida o token anterior (só um ativo)", async () => {
    const t = convexTest({ schema, modules });
    await signUp(t);

    await t.mutation(api.passwordResets.requestReset, { email: EMAIL });
    const first = (await firstReset(t)).token;
    await t.mutation(api.passwordResets.requestReset, { email: EMAIL });

    const rows = await resets(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token).not.toBe(first);

    await expect(
      t.mutation(api.passwordResets.resetPassword, {
        token: first,
        password: NEW_PASSWORD,
      }),
    ).rejects.toThrow(/inválido ou expirado/i);
  });

  it("e-mail inexistente: mesma resposta e NENHUM e-mail (sem enumeração)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    await signUp(t);

    const known = await t.mutation(api.passwordResets.requestReset, {
      email: EMAIL,
    });
    // Consome o e-mail do pedido conhecido antes de limpar o spy.
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(log).toHaveBeenCalledTimes(1);
    log.mockClear();

    const unknown = await t.mutation(api.passwordResets.requestReset, {
      email: "ninguem@unicap.br",
    });

    // Resposta idêntica — impossível distinguir conta existente.
    expect(unknown).toEqual(known);
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(log).not.toHaveBeenCalled();
    expect(await resets(t)).toHaveLength(1);
  });
});

describe("passwordResets.resetPassword — segurança da troca (TDD)", () => {
  async function requestToken(t: World): Promise<string> {
    await t.mutation(api.passwordResets.requestReset, { email: EMAIL });
    return (await firstReset(t)).token;
  }

  it("grava a senha HASHADA (PBKDF2) e derruba a senha antiga", async () => {
    const t = convexTest({ schema, modules });
    const userId = await signUp(t);
    const token = await requestToken(t);

    await t.mutation(api.passwordResets.resetPassword, {
      token,
      password: NEW_PASSWORD,
    });

    const secret = await secretOf(t, userId);
    expect(secret).toMatch(/^pbkdf2\$/);
    expect(secret).not.toContain(NEW_PASSWORD);
    await expect(verifyPassword(NEW_PASSWORD, secret)).resolves.toBe(true);
    await expect(verifyPassword(OLD_PASSWORD, secret)).resolves.toBe(false);
  });

  it("token é de uso único: segundo reset com o mesmo token falha", async () => {
    const t = convexTest({ schema, modules });
    await signUp(t);
    const token = await requestToken(t);

    await t.mutation(api.passwordResets.resetPassword, {
      token,
      password: NEW_PASSWORD,
    });
    await expect(
      t.mutation(api.passwordResets.resetPassword, {
        token,
        password: "OutraSenha789",
      }),
    ).rejects.toThrow(/inválido ou expirado/i);
    // O registo morre com o uso (nada de token reaproveitável).
    expect(await resets(t)).toHaveLength(0);
  });

  it("token expirado é rejeitado e a senha NÃO muda", async () => {
    const t = convexTest({ schema, modules });
    const userId = await signUp(t);
    const token = await requestToken(t);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("passwordResets").collect();
      await ctx.db.patch(rows[0]!._id, { expiresAt: Date.now() - 1 });
    });

    await expect(
      t.mutation(api.passwordResets.resetPassword, {
        token,
        password: NEW_PASSWORD,
      }),
    ).rejects.toThrow(/inválido ou expirado/i);

    const secret = await secretOf(t, userId);
    await expect(verifyPassword(OLD_PASSWORD, secret)).resolves.toBe(true);
    await expect(verifyPassword(NEW_PASSWORD, secret)).resolves.toBe(false);
  });

  it("token desconhecido é rejeitado", async () => {
    const t = convexTest({ schema, modules });
    await signUp(t);
    await expect(
      t.mutation(api.passwordResets.resetPassword, {
        token: "f".repeat(64),
        password: NEW_PASSWORD,
      }),
    ).rejects.toThrow(/inválido ou expirado/i);
  });

  it("senha curta não troca e NÃO consome o token", async () => {
    const t = convexTest({ schema, modules });
    const userId = await signUp(t);
    const token = await requestToken(t);

    await expect(
      t.mutation(api.passwordResets.resetPassword, {
        token,
        password: "1234567",
      }),
    ).rejects.toThrow(/pelo menos 8 caracteres/i);

    expect(await resets(t)).toHaveLength(1);
    const secret = await secretOf(t, userId);
    await expect(verifyPassword(OLD_PASSWORD, secret)).resolves.toBe(true);

    // O mesmo token continua válido depois da tentativa inválida.
    await t.mutation(api.passwordResets.resetPassword, {
      token,
      password: NEW_PASSWORD,
    });
    const updated = await secretOf(t, userId);
    await expect(verifyPassword(NEW_PASSWORD, updated)).resolves.toBe(true);
  });

  it("revoga as sessões abertas do utilizador na troca", async () => {
    const t = convexTest({ schema, modules });
    const userId = await signUp(t);
    const otherUserId = await signUp(t, "outra@unicap.br");
    await t.run(async (ctx) => {
      await ctx.db.insert("authSessions", {
        userId: userId as never,
        expirationTime: Date.now() + DAY,
      });
      await ctx.db.insert("authSessions", {
        userId: otherUserId as never,
        expirationTime: Date.now() + DAY,
      });
    });
    const token = await requestToken(t);

    await t.mutation(api.passwordResets.resetPassword, {
      token,
      password: NEW_PASSWORD,
    });

    const sessions = await t.run(async (ctx) => {
      return await ctx.db.query("authSessions").collect();
    });
    // Só a sessão do titular da troca é derrubada.
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.userId).toBe(otherUserId);
  });
});

describe("emails.sendPasswordResetEmail — transporte", () => {
  it("com RESEND_API_KEY chama a API com o link no corpo", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const t = convexTest({ schema, modules });
    await signUp(t);

    await t.mutation(api.passwordResets.requestReset, { email: EMAIL });
    const row = await firstReset(t);
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body as string) as {
      to: string[];
      text: string;
    };
    expect(body.to).toEqual([EMAIL]);
    expect(body.text).toContain(
      `${APP_URL}/recuperar-senha?token=${row.token}`,
    );
  });
});
