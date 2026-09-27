/**
 * [S5-5] Testes de INTEGRAÇÃO dos filtros combináveis do dashboard —
 * queries `operationalSummary`, `pipelineFunnel`, `activeRankings` e
 * `timeToHireStats` contra o mock oficial do backend (convex-test).
 *
 * CA 1: filtros combináveis (período, curso, empresa e status)
 * atualizando TODAS as métricas de forma consistente. A reatividade
 * (atualização em tempo real) é propriedade das subscriptions Convex —
 * aqui validamos que cada combinação de filtros produz as métricas
 * corretas, que é o que a UI exibe ao mudar os filtros.
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
const STUDENT_CC = { email: "maria@unicap.br", subject: "aluno-cc" };

/**
 * Mundo com 2 empresas (Alpha/Beta), 2 alunos (CC/ADM) e:
 * - jobA1 (Alpha, aberta, publicada em T0): CC inscrito, CC aprovado,
 *   ADM triagem (candidaturas em T0 e T0+1d)
 * - jobA2 (Alpha, encerrada há 10 dias, publicada há 40): CC aprovado e
 *   ADM reprovado (candidaturas há 35 dias) — alimenta o TTH
 * - jobB1 (Beta, fechada, publicada em T0+2d): ADM inscrito (T0+3d)
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
      email: "alpha@empresa.br",
      name: "Alpha Recruiter",
      role: "recrutador",
      active: true,
    });
    const betaId = await ctx.db.insert("users", {
      email: "beta@empresa.br",
      name: "Beta Recruiter",
      role: "recrutador",
      active: true,
    });
    const ccUserId = await ctx.db.insert("users", {
      email: STUDENT_CC.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const ccStudentId = await ctx.db.insert("students", {
      userId: ccUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2026,
      availability: "estagio",
      visibility: "somente_candidaturas",
      skills: ["React"],
    });
    const admUserId = await ctx.db.insert("users", {
      email: "joao@unicap.br",
      name: "João de Souza",
      role: "aluno",
      active: true,
    });
    const admStudentId = await ctx.db.insert("students", {
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
    for (const userId of [managerId, alphaId, betaId, ccUserId, admUserId]) {
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const mkJob = async (
      recruiterId: string,
      title: string,
      status: "aberta" | "fechada" | "encerrada",
      publishedAt: number,
      filledAt?: number,
    ) =>
      ctx.db.insert("jobs", {
        recruiterId,
        title,
        description: "Vaga dos testes de filtros.",
        prerequisites: [],
        contractType: "clt",
        status,
        publishedAt,
        expiresAt: publishedAt + 30 * DAY,
        ...(filledAt !== undefined ? { filledAt } : {}),
      });
    const mkApp = async (
      jobId: string,
      studentId: string,
      stage: "inscrito" | "triagem" | "entrevista" | "aprovado" | "reprovado",
      appliedAt: number,
    ) =>
      ctx.db.insert("applications", {
        jobId,
        studentId,
        stage,
        matchScore: 70,
        appliedAt,
        ...(stage === "reprovado"
          ? { rejectionReason: "requisitos_obrigatorios" as const }
          : {}),
      });

    const jobA1 = await mkJob(alphaId, "Dev Web (Alpha)", "aberta", T0);
    const jobA2 = await mkJob(
      alphaId,
      "Analista (Alpha)",
      "encerrada",
      T0 - 40 * DAY,
      T0 - 10 * DAY,
    );
    const jobB1 = await mkJob(
      betaId,
      "Dev Mobile (Beta)",
      "fechada",
      T0 + 2 * DAY,
    );

    await mkApp(jobA1, ccStudentId, "inscrito", T0);
    await mkApp(jobA1, ccStudentId, "aprovado", T0 + DAY);
    await mkApp(jobA1, admStudentId, "triagem", T0 + DAY);
    await mkApp(jobA2, ccStudentId, "aprovado", T0 - 35 * DAY);
    await mkApp(jobA2, admStudentId, "reprovado", T0 - 35 * DAY);
    await mkApp(jobB1, admStudentId, "inscrito", T0 + 3 * DAY);

    return { managerId, T0, jobA1, betaId };
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

describe("S5-5 — filtros combináveis do dashboard (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sem filtros: métricas globais (baseline)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);
    const asGestor = asManager(t, managerId);

    const summary = await asGestor.query(
      api.operational.operationalSummary,
      {},
    );
    expect(summary.jobs).toEqual({
      open: 1,
      closed: 1,
      filled: 1,
      total: 3,
    });
    // 2 aprovados / 3 finalizados = 67%.
    expect(summary.applications.total).toBe(6);
    expect(summary.employability.rate).toBe(67);

    const funnel = await asGestor.query(api.operational.pipelineFunnel, {});
    expect(funnel.steps.map((step) => step.count)).toEqual([2, 1, 0, 2]);
    expect(funnel.totalApplications).toBe(6);
  });

  it("filtro status: summary, funil e rankings enxergam só vagas daquele status", async () => {
    const t = convexTest(schema, modules);
    const { managerId, jobA1 } = await seedWorld(t);
    const asGestor = asManager(t, managerId);

    const summary = await asGestor.query(api.operational.operationalSummary, {
      status: "aberta",
    });
    expect(summary.jobs).toEqual({
      open: 1,
      closed: 0,
      filled: 0,
      total: 1,
    });
    // Só as candidaturas de jobA1 (aberta).
    expect(summary.applications.total).toBe(3);

    const funnel = await asGestor.query(api.operational.pipelineFunnel, {
      status: "aberta",
    });
    expect(funnel.steps.map((step) => step.count)).toEqual([1, 1, 0, 1]);

    const rankings = await asGestor.query(api.operational.activeRankings, {
      limit: 5,
      status: "aberta",
    });
    expect(rankings.topJobs).toEqual([
      {
        jobId: jobA1,
        title: "Dev Web (Alpha)",
        companyName: "Alpha Recruiter",
        applicationsCount: 3,
      },
    ]);
  });

  it("filtro curso: funil e empregabilidade passam a refletir só o curso", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);
    const asGestor = asManager(t, managerId);

    const funnel = await asGestor.query(api.operational.pipelineFunnel, {
      course: "Ciência da Computação",
    });
    // CC: inscrito (jobA1) e 2 aprovados (jobA1 e jobA2).
    expect(funnel.steps.map((step) => step.count)).toEqual([1, 0, 0, 2]);

    const summary = await asGestor.query(api.operational.operationalSummary, {
      course: "Ciência da Computação",
    });
    // Só resultados finais do curso: 2 aprovados → 100%.
    expect(summary.employability.rate).toBe(100);
  });

  it("filtro empresa: métricas ficam restritas às vagas da empresa", async () => {
    const t = convexTest(schema, modules);
    const { managerId, betaId } = await seedWorld(t);
    const asGestor = asManager(t, managerId);

    const funnel = await asGestor.query(api.operational.pipelineFunnel, {
      company: "Beta Recruiter",
    });
    // Beta só tem jobB1 com uma candidatura "inscrito".
    expect(funnel.steps.map((step) => step.count)).toEqual([1, 0, 0, 0]);
    expect(funnel.totalApplications).toBe(1);

    const rankings = await asGestor.query(api.operational.activeRankings, {
      limit: 5,
      company: "Beta Recruiter",
    });
    expect(rankings.topCompanies).toEqual([
      {
        recruiterId: betaId,
        companyName: "Beta Recruiter",
        publishedJobs: 1,
        applicationsCount: 1,
      },
    ]);
  });

  it("filtros combináveis (status + curso + período) atualizam as métricas juntas", async () => {
    const t = convexTest(schema, modules);
    const { managerId, T0 } = await seedWorld(t);
    const asGestor = asManager(t, managerId);

    const summary = await asGestor.query(api.operational.operationalSummary, {
      status: "aberta",
      course: "Administração",
      from: T0,
    });
    // jobA1 (aberta) + curso ADM + publicada/candidatura a partir de T0:
    // apenas a candidatura "triagem" de ADM.
    expect(summary.applications.total).toBe(1);
    expect(summary.applications.inProgress).toBe(1);
    // Sem finalizados no filtro: taxa null.
    expect(summary.employability.rate).toBeNull();

    // TTH: curso CC com contratação na jobA2 (encerrada há 10 dias,
    // candidatura há 35) — período amplo inclui; 25 dias.
    const tth = await asGestor.query(api.operational.timeToHireStats, {
      course: "Ciência da Computação",
      from: T0 - 60 * DAY,
    });
    expect(tth.samplesCount).toBe(1);
    expect(tth.averageDays).toBe(25);

    // TTH com status != encerrada: nenhuma vaga preenchida permanece.
    const tthVazio = await asGestor.query(api.operational.timeToHireStats, {
      status: "aberta",
    });
    expect(tthVazio.averageDays).toBeNull();
    expect(tthVazio.samplesCount).toBe(0);
  });

  it("guard R7: aluno não acessa as métricas mesmo com filtros", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    const asStudent = t.withIdentity({
      email: STUDENT_CC.email,
      subject: STUDENT_CC.subject,
      emailVerificationTime: Date.now(),
      tokenIdentifier: `tid-aluno`,
    });

    await expect(
      asStudent.query(api.operational.operationalSummary, { status: "aberta" }),
    ).rejects.toThrow(/gestores e recrutadores/i);
  });
});
