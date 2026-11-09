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
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

// Constantes nomeadas (evitam "magic numbers" e documentam a intenção).
const DAY = 86_400_000; // 24 * 60 * 60 * 1000
const SETE_DIAS = 604_800_000;
const TRINTA_DIAS = 2_592_000_000;
const ANO_FORMATURA = 2026;
const ANO_LEGADO = 2020;
const SCORE_ALTO = 80;
const SCORE_MEDIO = 70;
const SCORE_BAIXO = 50;

// Tamanho do mundo criado por `seedWorld`.
const SEED_USERS = 4;
const SEED_CONSENTS = 4;
const SEED_JOBS = 2;
const CANDIDATURAS_DA_ALUNA = 2;
const CANDIDATURAS_NA_VAGA = 2; // a da aluna e a do colega

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
      graduationYear: ANO_FORMATURA,
      availability: ["estagio"],
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
      graduationYear: ANO_FORMATURA,
      availability: ["estagio"],
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
      expiresAt: Date.now() + TRINTA_DIAS,
    });
    const otherJobId = await ctx.db.insert("jobs", {
      recruiterId: otherRecruiterId,
      title: "Vaga de Outra Empresa",
      description: "Outro processo seletivo.",
      prerequisites: [],
      contractType: "clt",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + TRINTA_DIAS,
    });
    // Maria candidata-se às DUAS vagas; João candidata-se à vaga do dono.
    for (const jobIdToApply of [jobId, otherJobId]) {
      await ctx.db.insert("applications", {
        jobId: jobIdToApply,
        studentId,
        stage: "triagem",
        matchScore: SCORE_ALTO,
        appliedAt: Date.now(),
      });
    }
    await ctx.db.insert("applications", {
      jobId,
      studentId: otherStudentId,
      stage: "inscrito",
      matchScore: SCORE_MEDIO,
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
      expirationTime: Date.now() + TRINTA_DIAS,
    });
    const refreshTokenId = await ctx.db.insert("authRefreshTokens", {
      sessionId,
      expirationTime: Date.now() + SETE_DIAS,
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

/** Foto de todas as tabelas relevantes (leitura única, para asserções). */
async function snapshot(t: World) {
  return t.run(async (ctx) => ({
    users: (await ctx.db.query("users").collect()) as Doc<"users">[],
    students: (await ctx.db.query("students").collect()) as Doc<"students">[],
    consents: (await ctx.db.query("consents").collect()) as Doc<"consents">[],
    applications: (await ctx.db
      .query("applications")
      .collect()) as Doc<"applications">[],
    jobs: (await ctx.db.query("jobs").collect()) as Doc<"jobs">[],
    accounts: (await ctx.db
      .query("authAccounts")
      .collect()) as Doc<"authAccounts">[],
    sessions: (await ctx.db
      .query("authSessions")
      .collect()) as Doc<"authSessions">[],
    refreshTokens: (await ctx.db
      .query("authRefreshTokens")
      .collect()) as Doc<"authRefreshTokens">[],
    codes: (await ctx.db
      .query("authVerificationCodes")
      .collect()) as Doc<"authVerificationCodes">[],
    verifiers: (await ctx.db
      .query("authVerifiers")
      .collect()) as Doc<"authVerifiers">[],
  }));
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function allIds(state: Snapshot): Set<string> {
  const tables = Object.values(state) as Array<Array<{ _id: string }>>;
  return new Set(tables.flatMap((rows) => rows.map((row) => row._id)));
}

/** Dos `ids` informados, os que AINDA existem (vazio = tudo apagado). */
function presentIds(state: Snapshot, ids: string[]) {
  const existing = allIds(state);
  return ids.filter((id) => existing.has(id));
}

/** Dos `ids` informados, os que NÃO existem mais (vazio = tudo preservado). */
function missingIds(state: Snapshot, ids: string[]) {
  const existing = allIds(state);
  return ids.filter((id) => !existing.has(id));
}

const STUDENT_EMAIL = "aluna@unicap.br";
const PEER_EMAIL = "colega@unicap.br";

/** Cenário: a aluna exclui a própria conta; o colega é o "sobrevivente". */
async function deleteStudentAccount() {
  const t = convexTest({ schema, modules });
  const seed = await seedWorld(t);
  const auth = await seedAuthRecords(
    t,
    seed.studentUserId,
    STUDENT_EMAIL,
    "aluna",
  );
  const survivorAuth = await seedAuthRecords(
    t,
    seed.otherStudentUserId,
    PEER_EMAIL,
    "colega",
  );
  const result = await as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
    api.users.deleteMyAccount,
    {},
  );
  return { seed, auth, survivorAuth, result, state: await snapshot(t) };
}

/** Cenário: o recrutador dono da vaga exclui a própria conta. */
async function deleteRecruiterAccount() {
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
  return { seed, auth, result, state: await snapshot(t) };
}

/** Cenário degenerado: o recrutador também tem perfil de aluno e se candidatou. */
async function deleteRecruiterWithLegacyProfile() {
  const t = convexTest({ schema, modules });
  const seed = await seedWorld(t);
  // O app seria alcançado por by_job E by_student.
  const legacyStudentId = await t.run(async (ctx) =>
    ctx.db.insert("students", {
      userId: seed.recruiterId,
      fullName: "Recrutador Candidato",
      enrollment: "0000001",
      status: "ativo",
      course: "Administração",
      graduationYear: ANO_LEGADO,
      availability: ["freelancer"],
      visibility: "somente_candidaturas",
    }),
  );
  const selfApplicationId = await t.run(async (ctx) =>
    ctx.db.insert("applications", {
      jobId: seed.jobId,
      studentId: legacyStudentId,
      stage: "inscrito",
      matchScore: SCORE_BAIXO,
      appliedAt: Date.now(),
    }),
  );
  const result = await as(t, seed.recruiterId, seed.recruiterEmail).mutation(
    api.users.deleteMyAccount,
    {},
  );
  return {
    legacyStudentId,
    selfApplicationId,
    result,
    state: await snapshot(t),
  };
}

/** Mundo + um gestor (com consentimento) tentando se autoexcluir. */
async function seedWorldWithManager() {
  const t = convexTest({ schema, modules });
  await seedWorld(t);
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
  return { t, managerId };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("[PERFIL_E_LGPD] deleteMyAccount — apagão em cascata (Etapa 4)", () => {
  describe("aluno", () => {
    it("devolve a contagem do que foi apagado", async () => {
      const { result } = await deleteStudentAccount();
      expect(result).toMatchObject({
        ok: true,
        deleted: {
          users: 1,
          students: 1,
          consents: 1,
          applications: CANDIDATURAS_DA_ALUNA,
        },
      });
    });

    it("nada da aluna sobra (usuário e registros de auth)", async () => {
      const { seed, auth, state } = await deleteStudentAccount();
      const deleted = [
        seed.studentUserId,
        auth.accountId,
        auth.sessionId,
        auth.refreshTokenId,
        auth.codeId,
        auth.verifierId,
      ];
      expect(presentIds(state, deleted)).toEqual([]);
    });

    it("perfil e candidatura do colega ficam intactos", async () => {
      const { seed, state } = await deleteStudentAccount();
      expect(state.students.map((s) => s._id)).toEqual([seed.otherStudentId]);
      expect(state.applications.map((a) => a.studentId)).toEqual([
        seed.otherStudentId,
      ]);
    });

    it("vagas e consentimentos de terceiros ficam intactos", async () => {
      const { state } = await deleteStudentAccount();
      expect(state.jobs).toHaveLength(SEED_JOBS);
      expect(state.consents).toHaveLength(SEED_CONSENTS - 1);
    });

    it("usuário e auth do sobrevivente ficam intactos", async () => {
      const { seed, survivorAuth, state } = await deleteStudentAccount();
      const survivors = [
        seed.otherStudentUserId,
        survivorAuth.accountId,
        survivorAuth.sessionId,
      ];
      expect(missingIds(state, survivors)).toEqual([]);
    });
  });

  describe("recrutador", () => {
    it("devolve a contagem do que foi apagado", async () => {
      const { result } = await deleteRecruiterAccount();
      expect(result).toMatchObject({
        ok: true,
        deleted: { users: 1, jobs: 1, applications: CANDIDATURAS_NA_VAGA },
      });
    });

    it("o dono, sua vaga e o auth dele sumiram", async () => {
      const { seed, auth, state } = await deleteRecruiterAccount();
      const deleted = [
        seed.recruiterId,
        seed.jobId,
        auth.accountId,
        auth.sessionId,
        auth.refreshTokenId,
      ];
      expect(presentIds(state, deleted)).toEqual([]);
    });

    it("TODAS as candidaturas da vaga sumiram (nenhuma ficou órfã)", async () => {
      // Só sobra a candidatura da outra empresa.
      const { seed, state } = await deleteRecruiterAccount();
      expect(state.applications.map((a) => a.jobId)).toEqual([seed.otherJobId]);
    });

    it("terceiros ficam intactos: outra vaga e alunos", async () => {
      const { seed, state } = await deleteRecruiterAccount();
      const survivors = [seed.otherJobId, seed.otherStudentUserId];
      expect(missingIds(state, survivors)).toEqual([]);
    });
  });

  describe("recrutador com perfil legado de aluno", () => {
    it("exclui o perfil de aluno e a auto-candidatura sem duplicar exclusão", async () => {
      const { legacyStudentId, selfApplicationId, result, state } =
        await deleteRecruiterWithLegacyProfile();
      expect(result.ok).toBe(true);
      expect(presentIds(state, [legacyStudentId, selfApplicationId])).toEqual(
        [],
      );
    });

    it("só restam dados de terceiros", async () => {
      const { state } = await deleteRecruiterWithLegacyProfile();
      expect({
        applications: state.applications.length,
        jobs: state.jobs.length,
        users: state.users.length,
      }).toEqual({ applications: 1, jobs: 1, users: SEED_USERS - 1 });
    });
  });

  describe("gestor", () => {
    it("não pode se autoexcluir", async () => {
      const { t, managerId } = await seedWorldWithManager();
      await expect(
        as(t, managerId, "coordenacao@unicap.br").mutation(
          api.users.deleteMyAccount,
          {},
        ),
      ).rejects.toThrow(/gestor/i);
    });

    it("e NADA é apagado (atomicidade)", async () => {
      const { t, managerId } = await seedWorldWithManager();
      await as(t, managerId, "coordenacao@unicap.br")
        .mutation(api.users.deleteMyAccount, {})
        .catch(() => undefined); // a rejeição é verificada no teste anterior
      const state = await snapshot(t);
      expect({
        users: state.users.length,
        consents: state.consents.length,
        jobs: state.jobs.length,
      }).toEqual({
        users: SEED_USERS + 1, // seed + gestor
        consents: SEED_CONSENTS + 1,
        jobs: SEED_JOBS,
      });
    });
  });

  it("sem autenticação a exclusão é rejeitada", async () => {
    const t = convexTest({ schema, modules });
    await seedWorld(t);
    await expect(t.mutation(api.users.deleteMyAccount, {})).rejects.toThrow(
      /não autenticado/i,
    );
  });

  describe("usuário que não existe mais", () => {
    async function seedGhostScenario() {
      const t = convexTest({ schema, modules });
      await seedWorld(t);
      // Identidade que não casa com nenhum usuário.
      const tryDelete = () =>
        t
          .withIdentity({
            email: "fantasma@unicap.br",
            subject: "fantasma",
            tokenIdentifier: "tid-fantasma",
          })
          .mutation(api.users.deleteMyAccount, {});
      return { t, tryDelete };
    }

    it("a exclusão é rejeitada", async () => {
      const { tryDelete } = await seedGhostScenario();
      await expect(tryDelete()).rejects.toThrow(/não autenticado/i);
    });

    it("e nada é apagado", async () => {
      const { t, tryDelete } = await seedGhostScenario();
      await tryDelete().catch(() => undefined); // rejeição verificada acima
      const state = await snapshot(t);
      expect({ users: state.users.length, jobs: state.jobs.length }).toEqual({
        users: SEED_USERS,
        jobs: SEED_JOBS,
      });
    });
  });
});

describe("[PERFIL_E_LGPD] sessões — listagem e kill switch (Etapa 2)", () => {
  async function listSessionsScenario() {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const own = await seedAuthRecords(
      t,
      seed.studentUserId,
      STUDENT_EMAIL,
      "propria",
    );
    const ownOther = await seedAuthRecords(
      t,
      seed.studentUserId,
      STUDENT_EMAIL,
      "celular",
    );
    const stranger = await seedAuthRecords(
      t,
      seed.otherStudentUserId,
      PEER_EMAIL,
      "colega",
    );
    const sessions = await as(
      t,
      seed.studentUserId,
      STUDENT_EMAIL,
      own.sessionId,
    ).query(api.users.listMySessions, {});
    return { sessions, own, ownOther, stranger };
  }

  it("listMySessions devolve só as sessões do próprio usuário", async () => {
    const { sessions, own, ownOther } = await listSessionsScenario();
    expect(sessions.map((s) => s.sessionId).sort()).toEqual(
      [own.sessionId, ownOther.sessionId].sort(),
    );
  });

  it("listMySessions marca somente a sessão atual", async () => {
    const { sessions, own } = await listSessionsScenario();
    expect(sessions.filter((s) => s.isCurrent).map((s) => s.sessionId)).toEqual(
      [own.sessionId],
    );
  });

  it("listMySessions traz criação e expiração das sessões não atuais", async () => {
    const { sessions, ownOther } = await listSessionsScenario();
    const plain = sessions.find((s) => s.sessionId === ownOther.sessionId);
    assert(plain, "a outra sessão do usuário deveria estar na listagem");
    expect(plain.isCurrent).toBe(false);
    expect(plain.createdAt).toBeGreaterThan(0);
    expect(plain.expiresAt).toBeGreaterThan(Date.now());
  });

  describe("revokeOtherSessions", () => {
    async function revokeScenario() {
      const t = convexTest({ schema, modules });
      const seed = await seedWorld(t);
      const current = await seedAuthRecords(
        t,
        seed.studentUserId,
        STUDENT_EMAIL,
        "atual",
      );
      await seedAuthRecords(t, seed.studentUserId, STUDENT_EMAIL, "antiga");
      const result = await as(
        t,
        seed.studentUserId,
        STUDENT_EMAIL,
        current.sessionId,
      ).mutation(api.users.revokeOtherSessions, {});
      return { current, result, state: await snapshot(t) };
    }

    it("informa quantas sessões foram revogadas", async () => {
      const { result } = await revokeScenario();
      expect(result).toEqual({ revoked: 1, keptCurrent: true });
    });

    it("mantém só a sessão atual e o refresh token dela", async () => {
      const { current, state } = await revokeScenario();
      expect(state.sessions.map((s) => s._id)).toEqual([current.sessionId]);
      expect(state.refreshTokens.map((r) => r.sessionId)).toEqual([
        current.sessionId,
      ]);
    });
  });

  it("sem sessão atual identificável o kill switch falha (evita autologout)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    await seedAuthRecords(t, seed.studentUserId, STUDENT_EMAIL, "x");

    // subject SEM o sufixo "|sessionId" (token legado).
    await expect(
      as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
        api.users.revokeOtherSessions,
        {},
      ),
    ).rejects.toThrow(/sessão atual/i);
    expect((await snapshot(t)).sessions).toHaveLength(1); // nada mudou
  });
});

describe("[PERFIL_E_LGPD] portabilidade de dados (Etapa 3)", () => {
  async function exportAsStudent() {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const data = await as(t, seed.studentUserId, STUDENT_EMAIL).query(
      api.users.getMyDataExport,
      {},
    );
    assert(data, "a exportação do aluno autenticado não deveria ser null");
    return data;
  }

  it("exportação do aluno reúne usuário e perfil", async () => {
    const data = await exportAsStudent();
    expect(data.usuario.email).toBe(STUDENT_EMAIL);
    expect(data.perfilAluno?.fullName).toBe("Maria da Silva");
    expect(data.perfilAluno?.resumeData).toBeUndefined();
  });

  it("exportação do aluno reúne as candidaturas", async () => {
    const data = await exportAsStudent();
    expect(data.candidaturas.map((c) => c.jobTitle).sort()).toEqual([
      "Estágio em Desenvolvimento Web",
      "Vaga de Outra Empresa",
    ]);
  });

  it("exportação do aluno reúne os consentimentos", async () => {
    const data = await exportAsStudent();
    expect(data.consentimentos.map((c) => c.termVersion)).toEqual([
      CURRENT_TERM_VERSION,
    ]);
  });

  it("exportação do aluno não lista vagas e traz o carimbo de data", async () => {
    const data = await exportAsStudent();
    expect(data.vagasPublicadas).toHaveLength(0);
    expect(data.exportedAt).toBeGreaterThan(0);
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
  const TAMANHO_IMAGEM_VALIDA = 64;
  const TAMANHO_IMAGEM_ACIMA_DO_LIMITE = 600_000; // limite real: 400KB

  it("updateMyProfile grava a imagem de avatar no users", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const image = `data:image/png;base64,${"A".repeat(TAMANHO_IMAGEM_VALIDA)}`;

    await as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
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
      as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
        api.users.updateMyProfile,
        { image: "javascript:alert(1)" },
      ),
    ).rejects.toThrow(/imagem inválida/i);
  });

  it("updateMyProfile rejeita imagem acima do limite (400KB)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const huge = `data:image/png;base64,${"A".repeat(TAMANHO_IMAGEM_ACIMA_DO_LIMITE)}`;
    await expect(
      as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
        api.users.updateMyProfile,
        { image: huge },
      ),
    ).rejects.toThrow(/muito grande/i);
  });

  describe("updateMyNotificationPrefs", () => {
    async function updatePrefs() {
      const t = convexTest({ schema, modules });
      const seed = await seedWorld(t);
      const after = await as(t, seed.studentUserId, STUDENT_EMAIL).mutation(
        api.users.updateMyNotificationPrefs,
        { jobAlerts: false, applicationUpdates: true },
      );
      const user = await t.run(async (ctx) => ctx.db.get(seed.studentUserId));
      return { after, user };
    }

    it("devolve as preferências gravadas", async () => {
      const { after } = await updatePrefs();
      expect(after).toEqual({ jobAlerts: false, applicationUpdates: true });
    });

    it("persiste os switches no usuário", async () => {
      const { user } = await updatePrefs();
      expect(user).toMatchObject({
        notifyJobAlerts: false,
        notifyApplicationUpdates: true,
      });
    });
  });
});
