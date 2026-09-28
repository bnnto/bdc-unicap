/**
 * [Hotfix produção] Fluxo de registro ponta a ponta (signUp → perfil).
 *
 * Regressão do bug "Usuário não encontrado." no `upsertProfile`: os guards
 * resolviam o usuário pelo e-mail da identidade do token
 * (`identity.email ?? identity.tokenIdentifier` → índice by_email), mas o
 * token do provider Credentials não carrega um e-mail casável com o
 * documento `users` (claim ausente ou não normalizado) e o fallback
 * `tokenIdentifier` nunca é um e-mail. O caminho correto — já usado no
 * login — é `getAuthUserId`/`getCurrentUser`.
 *
 * O teste simula a produção: conta criada exatamente como no signUp
 * (`authHelpers.createUser`) e identidade SEM e-mail (só subject/token).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const SIGNUP = {
  email: "nova.aluna@unicap.br",
  name: "Nova Aluna",
  passwordHash: "scrypt-hash-simulado",
};

/** Cria a conta exatamente como o signUp do provider Credentials faz. */
async function signUpAluno(t: World): Promise<string> {
  return t.mutation(internal.authHelpers.createUser, {
    email: SIGNUP.email,
    name: SIGNUP.name,
    role: "aluno",
    secret: SIGNUP.passwordHash,
    consentTermVersion: CURRENT_TERM_VERSION,
  });
}

/**
 * Identidade de produção do provider Credentials: o Convex Auth emite
 * `subject = "<userId>|<sessionId>"` e o token NÃO traz e-mail casável
 * (causa raiz do bug reproduzida fielmente).
 */
function asAluno(t: World, userId: string) {
  return t.withIdentity({
    subject: `${userId}|sessao-1`,
    emailVerificationTime: Date.now(),
  });
}

const PERFIL = {
  fullName: "Nova Aluna da Silva",
  enrollment: "20991234",
  status: "ativo" as const,
  course: "Ciência da Computação",
  graduationYear: 2027,
  availability: "estagio" as const,
};

describe("Hotfix — fluxo de registro (signUp → perfil)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("signUp (authHelpers.createUser) grava users com nome, papel, ativo e aceite vigente", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const userId = await ctx.runMutation(internal.authHelpers.createUser, {
        email: SIGNUP.email,
        name: SIGNUP.name,
        role: "aluno",
        secret: SIGNUP.passwordHash,
        consentTermVersion: CURRENT_TERM_VERSION,
      });
      const user = await ctx.db.get(userId);
      const consents = await ctx.db
        .query("consents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      return { user, consents };
    });
    expect(result.user?.name).toBe(SIGNUP.name);
    expect(result.user?.role).toBe("aluno");
    expect(result.user?.active).toBe(true);
    expect(result.consents).toHaveLength(1);
    expect(result.consents[0]?.termVersion).toBe(CURRENT_TERM_VERSION);
  });

  it("REGRESSÃO: upsertProfile resolve o usuário pelo token, sem depender do e-mail da identidade", async () => {
    const t = convexTest(schema, modules);
    const userId = await signUpAluno(t);

    const res = await asAluno(t, userId).mutation(
      api.students.upsertProfile,
      PERFIL,
    );
    expect(res.created).toBe(true);

    const profile = await asAluno(t, userId).query(api.students.myProfile, {});
    expect(profile?.enrollment).toBe("20991234");
    expect(profile?.fullName).toBe("Nova Aluna da Silva");
  });

  it("perfil sem aceite vigente é bloqueado com mensagem de termo (não 'usuário inexistente')", async () => {
    const t = convexTest(schema, modules);
    // Conta existente sem consentimento gravado (ex.: termo versionado).
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: SIGNUP.email,
        name: SIGNUP.name,
        role: "aluno",
        active: true,
      }),
    );
    await expect(
      asAluno(t, userId).mutation(api.students.upsertProfile, PERFIL),
    ).rejects.toThrow("Aceite o Termo de Consentimento LGPD vigente");
  });

  it("myStatus e acceptCurrentTerm resolvem o usuário pelo token", async () => {
    const t = convexTest(schema, modules);
    const userId = await signUpAluno(t);

    const status = await asAluno(t, userId).query(api.consents.myStatus, {});
    expect(status.authenticated).toBe(true);
    expect(status.active).toBe(true);
    expect(status.consents).toHaveLength(1);

    const accepted = await asAluno(t, userId).mutation(
      api.consents.acceptCurrentTerm,
      {},
    );
    expect(accepted.alreadyAccepted).toBe(true);
  });
});
