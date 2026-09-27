/**
 * [S5-4] Testes de INTEGRAÇÃO do ranking de empresas/vagas — query
 * `activeRankings` contra o mock oficial do backend Convex (convex-test).
 *
 * CA 1: Top N por vagas publicadas e volume de candidaturas. Também
 * cobre o guard R7 (sem consentimento / papel aluno rejeitados).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };

/**
 * Mundo com 3 recrutadores (empresas) e vagas com volumes distintos:
 * - Alpha: 2 vagas (5 e 3 candidaturas) → 8 no total
 * - Beta: 1 vaga (7 candidaturas)
 * - Gamma: 1 vaga sem candidaturas (publicou, mas atraiu 0)
 * - Delta (usuário sem nome): 1 vaga com 1 candidatura
 */
async function seedWorld(
  t: World,
  options: { withManagerConsent?: boolean } = {},
) {
  const withManagerConsent = options.withManagerConsent ?? true;
  return t.run(async (ctx) => {
    const managerId = await ctx.db.insert("users", {
      email: MANAGER.email,
      name: "Gestora UNICAP",
      role: "gestor",
      active: true,
    });
    const mkRecruiter = async (email: string, name: string | undefined) =>
      ctx.db.insert("users", {
        email,
        ...(name !== undefined ? { name } : {}),
        role: "recrutador",
        active: true,
      });
    const alphaId = await mkRecruiter("alpha@empresa.br", "Alpha Recruiter");
    const betaId = await mkRecruiter("beta@empresa.br", "Beta Recruiter");
    const gammaId = await mkRecruiter("gamma@empresa.br", "Gamma Recruiter");
    const deltaId = await mkRecruiter("delta@empresa.br", undefined);
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const studentId = await ctx.db.insert("students", {
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
    for (const userId of [
      managerId,
      alphaId,
      betaId,
      gammaId,
      deltaId,
      studentUserId,
    ]) {
      if (userId === managerId && !withManagerConsent) continue;
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const mkJob = async (recruiterId: string, title: string, apps: number) => {
      const jobId = await ctx.db.insert("jobs", {
        recruiterId,
        title,
        description: "Vaga do ranking.",
        prerequisites: [],
        contractType: "clt",
        status: "aberta",
        publishedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      for (let i = 0; i < apps; i += 1) {
        await ctx.db.insert("applications", {
          jobId,
          studentId,
          stage: "inscrito",
          matchScore: 70,
          appliedAt: Date.now(),
        });
      }
      return jobId;
    };
    const jobAlphaWeb = await mkJob(alphaId, "Dev Web (Alpha)", 5);
    const jobAlphaAnalyst = await mkJob(alphaId, "Analista (Alpha)", 3);
    const jobBetaMobile = await mkJob(betaId, "Dev Mobile (Beta)", 7);
    const jobGammaTrainee = await mkJob(gammaId, "Trainee (Gamma)", 0);
    const jobDeltaDesigner = await mkJob(deltaId, "Designer (Delta)", 1);
    return {
      managerId,
      studentUserId,
      jobAlphaWeb,
      jobAlphaAnalyst,
      jobBetaMobile,
      jobGammaTrainee,
      jobDeltaDesigner,
      alphaId,
      betaId,
      deltaId,
    };
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

describe("S5-4 — empresas/vagas mais ativas (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — Top N de vagas por volume de candidaturas", async () => {
    const t = convexTest(schema, modules);
    const { managerId, jobBetaMobile, jobAlphaWeb } = await seedWorld(t);

    const { topJobs } = await asManager(t, managerId).query(
      api.operational.activeRankings,
      { limit: 2 },
    );

    expect(topJobs).toEqual([
      {
        jobId: jobBetaMobile,
        title: "Dev Mobile (Beta)",
        companyName: "Beta Recruiter",
        applicationsCount: 7,
      },
      {
        jobId: jobAlphaWeb,
        title: "Dev Web (Alpha)",
        companyName: "Alpha Recruiter",
        applicationsCount: 5,
      },
    ]);
  });

  it("CA 1 — Top N de empresas por candidatos atraídos, com desempate por publicações", async () => {
    const t = convexTest(schema, modules);
    const { managerId, alphaId, betaId, deltaId } = await seedWorld(t);

    const { topCompanies } = await asManager(t, managerId).query(
      api.operational.activeRankings,
      { limit: 3 },
    );

    // Alpha (8 candidaturas, 2 vagas) > Beta (7, 1) > Delta (1, 1).
    // Gamma (0 candidaturas) fica fora do Top 3 — rank é por candidatos.
    expect(topCompanies).toEqual([
      {
        recruiterId: alphaId,
        companyName: "Alpha Recruiter",
        publishedJobs: 2,
        applicationsCount: 8,
      },
      {
        recruiterId: betaId,
        companyName: "Beta Recruiter",
        publishedJobs: 1,
        applicationsCount: 7,
      },
      {
        recruiterId: deltaId,
        companyName: "delta@empresa.br",
        publishedJobs: 1,
        applicationsCount: 1,
      },
    ]);
  });

  it("empresa sem nome exibe fallback (e-mail) e aparece no rollup", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const { topCompanies } = await asManager(t, managerId).query(
      api.operational.activeRankings,
      { limit: 10 },
    );

    const delta = topCompanies.find(
      (company) => company.companyName === "delta@empresa.br",
    );
    expect(delta).toMatchObject({
      publishedJobs: 1,
      applicationsCount: 1,
    });
  });

  it("limit padrão (5) sem argumentos", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const { limit } = await asManager(t, managerId).query(
      api.operational.activeRankings,
      {},
    );

    expect(limit).toBe(5);
  });

  it("guard R7: gestor sem consentimento vigente é rejeitado", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, { withManagerConsent: false });

    await expect(
      asManager(t, managerId).query(api.operational.activeRankings, {}),
    ).rejects.toThrow(/Consentimento/i);
  });

  it("guard R7: aluno não acessa os rankings", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).query(api.operational.activeRankings, {}),
    ).rejects.toThrow(/gestores e recrutadores/i);
  });
});
