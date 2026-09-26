/**
 * [S5-2] Testes de INTEGRAÇÃO do Time-to-Hire — query `timeToHireStats`
 * contra o mock oficial do backend Convex (convex-test).
 *
 * CAs: cálculo em dias agregado corretamente (CA 1) e filtros de
 * período/curso/empresa (CA 2). Também cobre o guard R7.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };
const ALPHA = { email: "alpha@empresa.br", subject: "alpha-1" };
const BETA = { email: "beta@empresa.br", subject: "beta-1" };
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };

/**
 * Mundo com 2 recrutadores (empresas), 2 alunos (cursos diferentes) e:
 * - jobA (Alpha): preenchida em T0+10d, com 2 aprovações (TTH 10 e 8 dias)
 * - jobB (Beta): preenchida em T0+20d, com 1 aprovação (TTH 20 dias)
 * - jobC (Alpha): ainda aberta, com 1 aprovação (não gera amostra)
 * - 1 reprovação em jobA (não entra no TTH)
 */
async function seedWorld(t: World) {
  const T0 = Date.now();
  return t.run(async (ctx) => {
    const managerId = await ctx.db.insert("users", {
      email: MANAGER.email,
      name: "Gestora UNICAP",
      role: "gestor",
      active: true,
    });
    const alphaId = await ctx.db.insert("users", {
      email: ALPHA.email,
      name: "Alpha Recruiter",
      role: "recrutador",
      active: true,
    });
    const betaId = await ctx.db.insert("users", {
      email: BETA.email,
      name: "Beta Recruiter",
      role: "recrutador",
      active: true,
    });
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const studentCC = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2026,
      availability: "estagio",
      visibility: "somente_candidaturas",
      skills: ["React"],
    });
    // Segundo aluno (ADM) — perfil de outro usuário.
    const admUserId = await ctx.db.insert("users", {
      email: "joao@unicap.br",
      name: "João de Souza",
      role: "aluno",
      active: true,
    });
    const studentADM = await ctx.db.insert("students", {
      userId: admUserId,
      fullName: "João de Souza",
      enrollment: "7654321",
      status: "ativo",
      course: "Administração",
      graduationYear: 2025,
      availability: "integral",
      visibility: "somente_candidaturas",
      skills: ["Excel"],
    });
    for (const userId of [
      managerId,
      alphaId,
      betaId,
      studentUserId,
      admUserId,
    ]) {
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const jobA = await ctx.db.insert("jobs", {
      recruiterId: alphaId,
      title: "Dev Web (Alpha)",
      description: "Vaga preenchida pela Alpha.",
      prerequisites: [],
      contractType: "clt",
      status: "encerrada",
      publishedAt: T0,
      expiresAt: T0 + 30 * DAY,
      filledAt: T0 + 10 * DAY,
    });
    const jobB = await ctx.db.insert("jobs", {
      recruiterId: betaId,
      title: "Analista (Beta)",
      description: "Vaga preenchida pela Beta.",
      prerequisites: [],
      contractType: "clt",
      status: "encerrada",
      publishedAt: T0,
      expiresAt: T0 + 30 * DAY,
      filledAt: T0 + 20 * DAY,
    });
    const jobC = await ctx.db.insert("jobs", {
      recruiterId: alphaId,
      title: "Estágio (Alpha, aberta)",
      description: "Vaga em andamento.",
      prerequisites: [],
      contractType: "estagio",
      status: "aberta",
      publishedAt: T0,
      expiresAt: T0 + 30 * DAY,
    });
    // Aprovações/reprovação do pipeline.
    await ctx.db.insert("applications", {
      jobId: jobA,
      studentId: studentCC,
      stage: "aprovado",
      matchScore: 90,
      appliedAt: T0, // TTH = 10 dias
    });
    await ctx.db.insert("applications", {
      jobId: jobA,
      studentId: studentADM,
      stage: "aprovado",
      matchScore: 80,
      appliedAt: T0 + 2 * DAY, // TTH = 8 dias
    });
    await ctx.db.insert("applications", {
      jobId: jobB,
      studentId: studentCC,
      stage: "aprovado",
      matchScore: 70,
      appliedAt: T0, // TTH = 20 dias
    });
    await ctx.db.insert("applications", {
      jobId: jobC,
      studentId: studentCC,
      stage: "aprovado",
      matchScore: 60,
      appliedAt: T0, // vaga não preenchida: sem amostra
    });
    await ctx.db.insert("applications", {
      jobId: jobA,
      studentId: studentCC,
      stage: "reprovado",
      matchScore: 30,
      appliedAt: T0,
      rejectionReason: "requisitos_obrigatorios",
    });
    return { managerId, studentUserId };
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

describe("S5-2 — time-to-hire (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — média em dias agregada de todas as contratações", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const stats = await asManager(t, managerId).query(
      api.operational.timeToHireStats,
      {},
    );

    // Amostras: 10 + 8 + 20 = 38 / 3 → 13 dias (jobC não conta).
    expect(stats.averageDays).toBe(13);
    expect(stats.label).toBe("13 dias");
    expect(stats.samplesCount).toBe(3);
    expect(stats.facets.courses).toEqual([
      "Administração",
      "Ciência da Computação",
    ]);
    expect(stats.facets.companies).toEqual([
      "Alpha Recruiter",
      "Beta Recruiter",
    ]);
  });

  it("CA 2 — filtro por curso restringe as amostras", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const stats = await asManager(t, managerId).query(
      api.operational.timeToHireStats,
      { course: "Ciência da Computação" },
    );

    // Apenas o aluno de CC: 10 (jobA) + 20 (jobB) = 15 dias.
    expect(stats.averageDays).toBe(15);
    expect(stats.samplesCount).toBe(2);
  });

  it("CA 2 — filtro por empresa (recrutador da vaga)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const stats = await asManager(t, managerId).query(
      api.operational.timeToHireStats,
      { company: "Alpha Recruiter" },
    );

    // Apenas jobA: (10 + 8) / 2 = 9 dias.
    expect(stats.averageDays).toBe(9);
    expect(stats.samplesCount).toBe(2);
  });

  it("CA 2 — filtro por período (preenchimentos a partir de `from`)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const stats = await asManager(t, managerId).query(
      api.operational.timeToHireStats,
      { from: Date.now() + 15 * DAY },
    );

    // Só jobB foi preenchida depois de T0+15d → 20 dias.
    expect(stats.averageDays).toBe(20);
    expect(stats.samplesCount).toBe(1);
  });

  it("sem contratações no filtro: média null, exibida como travessão", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const stats = await asManager(t, managerId).query(
      api.operational.timeToHireStats,
      { company: "Empresa Inexistente" },
    );

    expect(stats.averageDays).toBeNull();
    expect(stats.label).toBe("—");
    expect(stats.samplesCount).toBe(0);
  });

  it("guard R7: aluno não acessa as estatísticas de TTH", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).query(api.operational.timeToHireStats, {}),
    ).rejects.toThrow(/gestores e recrutadores/i);
  });
});
