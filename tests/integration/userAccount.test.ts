/**
 * [PERFIL_E_LGPD] Etapas 2/3/4/5 — Central de Perfil e Compliance:
 *
 * - `deleteMyAccount` (Etapa 4): apagão em cascata ATÔMICO — aluno
 *   (students + candidaturas + consents) e recrutador (jobs + TODAS as
 *   applications dessas vagas), além das tabelas de auth
 *   (authAccounts/authSessions/authRefreshTokens/códigos/verificadores)
 *   e o próprio `users`, sem registros órfãos e sem tocar em terceiros.
 * - Sessões (Etapa 2): listagem com marcação da sessão atual e
 *   revogação das demais (kill switch).
 * - Portabilidade LGPD (Etapa 3): exportação dos dados em JSON.
 * - Preferências: foto de perfil e notificações persistidas no usuário.
 *
 * Executa contra o mock oficial do backend Convex (convex-test).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

type Seed = {
  recruiterId: Id<"users">;
  recruiterEmail: string;
  otherRecruiterId: Id<"users">;
  studentUserId: Id<"users">;
  studentId: Id<"students">;
  otherStudentUserId: Id<"users">;
  otherStudentId: Id<"students">;
  jobId: Id<"jobs">;
  otherJobId: Id<"jobs">;
};

/**
 * Mundo com: 2 recrutadores (um com vaga), 2 alunos (um com candidaturas
 * em duas vagas) e consents de todo mundo. Tudo que NÃO pertence ao
 * usuário excluído deve sobreviver intacto.
 */
async function seedWorld(t: World): Promise<Seed> {
  return t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: "recrutador@unicap.br",
      name: "Recrutador Dono",
      role: "recrutador",
      active: true,
    });
    const otherRecruiterId = await ctx.db.insert("users", {
      email: "outra-empresa@unicap.br",
      name: "Outra Empresa",
      role: "recrutador",
      active: true,
    });
    const studentUserId = await ctx.db.insert("users", {
      email: "aluna@unicap.br",
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const otherStudentUserId = await ctx.db.insert("users", {
      email: "colega@unicap.br",
      name: "João das Neves",
      role: "aluno",
      active: true,
    });
    for (const userId of [
      recruiterId,
      otherRecruiterId,
      studentUserId,
      otherStudentUserId,
    ]) {
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const studentId = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2026,
      availability: "estagio",
      visibility: "publico",
      skills: ["React"],
      languages: [{ name: "Inglês", level: "intermediario" }],
    });
    const otherStudentId = await ctx.db.insert("students", {
      userId: otherStudentUserId,
      fullName: "João das Neves",
      enrollment: "7654321",
      status: "ativo",
      course: "Engenharia de Software",
      graduationYear: 2026,
      availability: "estagio",
      visibility: "publico",
      skills: ["React"],
      languages: [{ name: "Inglês", level: "intermediario" }],
    });
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description: "Apoio no desenvolvimento de aplicações web.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    const otherJobId = await ctx.db.insert("jobs", {
      recruiterId: otherRecruiterId,
      title: "Vaga de Outra Empresa",
      description: "Outro processo seletivo.",
      prerequisites: [],
      contractType: "clt",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    // Maria candidata-se às DUAS vagas; João candidata-se à vaga do dono.
    for (const jobIdToApply of [jobId, otherJobId]) {
      await ctx.db.insert("applications", {
        jobId: jobIdToApply,
        studentId,
        stage: "triagem",
        matchScore: 80,
        appliedAt: Date.now(),
      });
    }
    await ctx.db.insert("applications", {
      jobId,
      studentId: otherStudentId,
      stage: "inscrito",
      matchScore: 70,
      appliedAt: Date.now(),
    });
    return {
      recruiterId,
      recruiterEmail: "recrutador@unicap.br",
      otherRecruiterId,
      studentUserId,
      studentId,
      otherStudentUserId,
      otherStudentId,
      jobId,
      otherJobId,
    };
  });
}

/** Identidade canônica: subject "<userId>|<sessionId>" (Convex Auth). */
function as(t: World, userId: string, email: string, sessionId?: string) {
  return t.withIdentity({
    email,
    subject: sessionId !== undefined ? `${userId}|${sessionId}` : userId,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${userId}`,
  });
}

/** Insere registros de auth (conta, sessão, refresh token, código). */
async function seedAuthRecords(
  t: World,
  userId: string,
  email: string,
  suffix: string,
) {
  return t.run(async (ctx) => {
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: "credentials-email",
      providerAccountId: email,
      secret: `hash-${suffix}`,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 30 * DAY,
    });
    const refreshTokenId = await ctx.db.insert("authRefreshTokens", {
      sessionId,
      expirationTime: Date.now() + 7 * DAY,
    });
    const codeId = await ctx.db.insert("authVerificationCodes", {
      accountId,
      provider: "credentials-email",
      code: "123456",
      expirationTime: Date.now() + DAY,
    });
    const verifierId = await ctx.db.insert("authVerifiers", {
      sessionId,
      signature: `sig-${suffix}`,
    });
    return { accountId, sessionId, refreshTokenId, codeId, verifierId };
  });
}

async function collectIds(t: World, table: "users" | "students" | "jobs") {
  return t.run(async (ctx) => {
    const rows = (await ctx.db.query(table).collect()) as Array<{
      _id: string;
    }>;
    return rows.map((row) => row._id);
  });
}

describe("[PERFIL_E_LGPD] deleteMyAccount — apagão em cascata (Etapa 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aluno: apaga users, students, candidaturas e consents sem tocar em terceiros", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const auth = await seedAuthRecords(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      "aluna",
    );
    const survivorAuth = await seedAuthRecords(
      t,
      seed.otherStudentUserId,
      "colega@unicap.br",
      "colega",
    );

    const result = await as(t, seed.studentUserId, "aluna@unicap.br").mutation(
      api.users.deleteMyAccount,
      {},
    );
    expect(result).toMatchObject({
      ok: true,
      deleted: { users: 1, students: 1, consents: 1, applications: 2 },
    });

    const state = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      students: await ctx.db.query("students").collect(),
      consents: await ctx.db.query("consents").collect(),
      applications: await ctx.db.query("applications").collect(),
      jobs: await ctx.db.query("jobs").collect(),
      accounts: await ctx.db.query("authAccounts").collect(),
      sessions: await ctx.db.query("authSessions").collect(),
      refreshTokens: await ctx.db.query("authRefreshTokens").collect(),
      codes: await ctx.db.query("authVerificationCodes").collect(),
      verifiers: await ctx.db.query("authVerifiers").collect(),
    }));

    // Nada da aluna sobra (inclusive registros de auth).
    expect(state.users.some((u) => u._id === seed.studentUserId)).toBe(false);
    expect(state.students).toHaveLength(1); // só a do colega
    expect(state.applications).toHaveLength(1); // só a do colega
    expect(state.consents).toHaveLength(3); // 4 − 1 da aluna
    expect(state.jobs).toHaveLength(2); // vagas intactas
    expect(state.accounts.some((a) => a._id === auth.accountId)).toBe(false);
    expect(state.sessions.some((s) => s._id === auth.sessionId)).toBe(false);
    expect(state.refreshTokens.some((r) => r._id === auth.refreshTokenId)).toBe(
      false,
    );
    expect(state.codes.some((c) => c._id === auth.codeId)).toBe(false);
    expect(state.verifiers.some((v) => v._id === auth.verifierId)).toBe(false);

    // Registros do sobrevivente intactos.
    expect(state.users.some((u) => u._id === seed.otherStudentUserId)).toBe(
      true,
    );
    expect(state.accounts.some((a) => a._id === survivorAuth.accountId)).toBe(
      true,
    );
    expect(state.sessions.some((s) => s._id === survivorAuth.sessionId)).toBe(
      true,
    );
    expect(
      state.applications.some((a) => a.studentId === seed.otherStudentId),
    ).toBe(true);
  });

  it("recrutador: apaga vagas, TODAS as applications dessas vagas e o user", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const auth = await seedAuthRecords(
      t,
      seed.recruiterId,
      seed.recruiterEmail,
      "rec",
    );

    const result = await as(t, seed.recruiterId, seed.recruiterEmail).mutation(
      api.users.deleteMyAccount,
      {},
    );
    expect(result).toMatchObject({
      ok: true,
      deleted: { users: 1, jobs: 1, applications: 2 },
    });

    const state = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      jobs: await ctx.db.query("jobs").collect(),
      applications: await ctx.db.query("applications").collect(),
      accounts: await ctx.db.query("authAccounts").collect(),
      sessions: await ctx.db.query("authSessions").collect(),
      refreshTokens: await ctx.db.query("authRefreshTokens").collect(),
    }));

    // O dono e sua vaga sumiram; as DUAS candidaturas da vaga também
    // (a da aluna E a do colega — nenhuma ficou órfã).
    expect(state.users.some((u) => u._id === seed.recruiterId)).toBe(false);
    expect(state.jobs.some((j) => j._id === seed.jobId)).toBe(false);
    expect(state.applications.some((a) => a.jobId === seed.jobId)).toBe(false);
    expect(state.applications).toHaveLength(1); // só a da outra empresa
    expect(state.accounts).toHaveLength(0); // auth do dono apagado
    expect(state.sessions).toHaveLength(0);
    expect(state.refreshTokens).toHaveLength(0);

    // Terceiros intactos: outra vaga + candidatura da outra empresa.
    expect(state.jobs.some((j) => j._id === seed.otherJobId)).toBe(true);
    expect(state.applications.some((a) => a.jobId === seed.otherJobId)).toBe(
      true,
    );
    expect(state.users.some((u) => u._id === seed.otherStudentUserId)).toBe(
      true,
    );
    expect(state.accounts.some((a) => a._id === auth.accountId)).toBe(false);
  });

  it("recrutador com perfil legado de aluno não duplica exclusão nem deixa lixo", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    // O dono TAMBÉM tem perfil de aluno e candidatou-se à própria vaga
    // (caso degenerado): o app seria alcançado por by_job E by_student.
    const legacyStudentId = await t.run(async (ctx) =>
      ctx.db.insert("students", {
        userId: seed.recruiterId,
        fullName: "Recrutador Candidato",
        enrollment: "0000001",
        status: "ativo",
        course: "Administração",
        graduationYear: 2020,
        availability: "freelancer",
        visibility: "somente_candidaturas",
      }),
    );
    const selfApplicationId = await t.run(async (ctx) =>
      ctx.db.insert("applications", {
        jobId: seed.jobId,
        studentId: legacyStudentId,
        stage: "inscrito",
        matchScore: 50,
        appliedAt: Date.now(),
      }),
    );

    const result = await as(t, seed.recruiterId, seed.recruiterEmail).mutation(
      api.users.deleteMyAccount,
      {},
    );
    expect(result.ok).toBe(true);

    const state = await t.run(async (ctx) => ({
      students: await ctx.db.query("students").collect(),
      applications: await ctx.db.query("applications").collect(),
      jobs: await ctx.db.query("jobs").collect(),
      users: await ctx.db.query("users").collect(),
    }));
    expect(state.students.some((s) => s._id === legacyStudentId)).toBe(false);
    expect(state.applications.some((a) => a._id === selfApplicationId)).toBe(
      false,
    );
    // Só restam dados de terceiros.
    expect(state.applications).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.users).toHaveLength(3);
  });

  it("gestor não pode se autoexcluir — e NADA é apagado (atomicidade)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const managerId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "coordenacao@unicap.br",
        name: "Coordenação",
        role: "gestor",
        active: true,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("consents", {
        userId: managerId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      }),
    );

    await expect(
      as(t, managerId, "coordenacao@unicap.br").mutation(
        api.users.deleteMyAccount,
        {},
      ),
    ).rejects.toThrow(/gestor/i);

    // Atomicidade: nenhuma escrita parcial.
    const users = await collectIds(t, "users");
    expect(users).toHaveLength(5); // 4 do seed + gestor
    const consents = await t.run(async (ctx) =>
      ctx.db.query("consents").collect(),
    );
    expect(consents).toHaveLength(5);
    expect(await collectIds(t, "jobs")).toHaveLength(2);
    expect(seed.studentUserId).toBeDefined();
  });

  it("sem autenticação a exclusão é rejeitada", async () => {
    const t = convexTest({ schema, modules });
    await seedWorld(t);
    await expect(t.mutation(api.users.deleteMyAccount, {})).rejects.toThrow(
      /não autenticado/i,
    );
  });

  it("exclusão falha sem apagar nada quando o usuário não existe mais", async () => {
    const t = convexTest({ schema, modules });
    await seedWorld(t);
    // Identidade que não casa com nenhum usuário.
    await expect(
      t
        .withIdentity({
          email: "fantasma@unicap.br",
          subject: "fantasma",
          tokenIdentifier: "tid-fantasma",
        })
        .mutation(api.users.deleteMyAccount, {}),
    ).rejects.toThrow(/não autenticado/i);
    expect(await collectIds(t, "users")).toHaveLength(4);
    expect(await collectIds(t, "jobs")).toHaveLength(2);
  });
});

describe("[PERFIL_E_LGPD] sessões — listagem e kill switch (Etapa 2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("listMySessions devolve só as sessões do próprio usuário, com a atual marcada", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const own = await seedAuthRecords(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      "propria",
    );
    const ownOther = await seedAuthRecords(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      "celular",
    );
    const stranger = await seedAuthRecords(
      t,
      seed.otherStudentUserId,
      "colega@unicap.br",
      "colega",
    );

    const sessions = await as(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      own.sessionId,
    ).query(api.users.listMySessions, {});

    expect(sessions).toHaveLength(2);
    expect(sessions.some((s) => s.sessionId === stranger.sessionId)).toBe(
      false,
    );
    const current = sessions.filter((s) => s.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0]?.sessionId).toBe(own.sessionId);
    const plain = sessions.find((s) => s.sessionId === ownOther.sessionId);
    expect(plain?.isCurrent).toBe(false);
    expect(plain?.createdAt).toBeGreaterThan(0);
    expect(plain?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("revokeOtherSessions encerra as outras sessões e os refresh tokens delas", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const current = await seedAuthRecords(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      "atual",
    );
    const other = await seedAuthRecords(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      "antiga",
    );

    const result = await as(
      t,
      seed.studentUserId,
      "aluna@unicap.br",
      current.sessionId,
    ).mutation(api.users.revokeOtherSessions, {});
    expect(result).toEqual({ revoked: 1, keptCurrent: true });

    const state = await t.run(async (ctx) => ({
      sessions: await ctx.db.query("authSessions").collect(),
      refreshTokens: await ctx.db.query("authRefreshTokens").collect(),
    }));
    expect(state.sessions.map((s) => s._id)).toEqual([current.sessionId]);
    // Só sobra o refresh token da sessão atual.
    expect(state.refreshTokens.map((r) => r.sessionId)).toEqual([
      current.sessionId,
    ]);
    expect(state.sessions.some((s) => s._id === other.sessionId)).toBe(false);
  });

  it("sem sessão atual identificável o kill switch falha (evita autologout)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    await seedAuthRecords(t, seed.studentUserId, "aluna@unicap.br", "x");

    // subject SEM o sufixo "|sessionId" (token legado).
    await expect(
      as(t, seed.studentUserId, "aluna@unicap.br").mutation(
        api.users.revokeOtherSessions,
        {},
      ),
    ).rejects.toThrow(/sessão atual/i);
    const sessions = await t.run(async (ctx) =>
      ctx.db.query("authSessions").collect(),
    );
    expect(sessions).toHaveLength(1); // nada mudou
  });
});

describe("[PERFIL_E_LGPD] portabilidade de dados (Etapa 3)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exportação do aluno reúne usuário, perfil, candidaturas e consentimentos", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);

    const data = await as(t, seed.studentUserId, "aluna@unicap.br").query(
      api.users.getMyDataExport,
      {},
    );
    expect(data).not.toBeNull();
    expect(data?.usuario.email).toBe("aluna@unicap.br");
    expect(data?.perfilAluno?.fullName).toBe("Maria da Silva");
    expect(data?.perfilAluno?.resumeData).toBeUndefined();
    expect(data?.candidaturas).toHaveLength(2);
    expect(data?.candidaturas.map((c) => c.jobTitle).sort()).toEqual([
      "Estágio em Desenvolvimento Web",
      "Vaga de Outra Empresa",
    ]);
    expect(data?.consentimentos).toHaveLength(1);
    expect(data?.consentimentos[0]?.termVersion).toBe(CURRENT_TERM_VERSION);
    expect(data?.vagasPublicadas).toHaveLength(0);
    expect(data?.exportedAt).toBeGreaterThan(0);
  });

  it("exportação do recrutador inclui suas vagas e não vaza dados alheios", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);

    const data = await as(t, seed.recruiterId, seed.recruiterEmail).query(
      api.users.getMyDataExport,
      {},
    );
    expect(data?.vagasPublicadas.map((v) => v.jobId)).toEqual([seed.jobId]);
    expect(data?.candidaturas).toHaveLength(0);
    expect(data?.perfilAluno).toBeNull();
  });

  it("sem autenticação a exportação retorna null", async () => {
    const t = convexTest({ schema, modules });
    await seedWorld(t);
    expect(await t.query(api.users.getMyDataExport, {})).toBeNull();
  });
});

describe("[PERFIL_E_LGPD] preferências: foto e notificações (Etapa 2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updateMyProfile grava a imagem de avatar no users", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const image = `data:image/png;base64,${"A".repeat(64)}`;

    await as(t, seed.studentUserId, "aluna@unicap.br").mutation(
      api.users.updateMyProfile,
      { image },
    );
    const user = await t.run(async (ctx) => ctx.db.get(seed.studentUserId));
    expect(user?.image).toBe(image);
  });

  it("updateMyProfile rejeita imagem que não seja data URL de imagem", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    await expect(
      as(t, seed.studentUserId, "aluna@unicap.br").mutation(
        api.users.updateMyProfile,
        { image: "javascript:alert(1)" },
      ),
    ).rejects.toThrow(/imagem inválida/i);
  });

  it("updateMyProfile rejeita imagem acima do limite (400KB)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const huge = `data:image/png;base64,${"A".repeat(600_000)}`;
    await expect(
      as(t, seed.studentUserId, "aluna@unicap.br").mutation(
        api.users.updateMyProfile,
        { image: huge },
      ),
    ).rejects.toThrow(/muito grande/i);
  });

  it("updateMyNotificationPrefs persiste os switches no usuário", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);

    const after = await as(t, seed.studentUserId, "aluna@unicap.br").mutation(
      api.users.updateMyNotificationPrefs,
      { jobAlerts: false, applicationUpdates: true },
    );
    expect(after).toEqual({ jobAlerts: false, applicationUpdates: true });
    const user = await t.run(async (ctx) => ctx.db.get(seed.studentUserId));
    expect(user?.notifyJobAlerts).toBe(false);
    expect(user?.notifyApplicationUpdates).toBe(true);
  });
});
