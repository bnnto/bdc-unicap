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

const DAY = 86_400_000;

const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };
const STUDENT_CC = { email: "maria@unicap.br", subject: "aluno-cc" };

const MATCH_SCORE = 70;
const VALIDADE_VAGA = 30 * DAY;
const FORMATURA_CC = 2026;
const FORMATURA_ADM = 2025;

/** Deslocamentos (relativos a T0) dos eventos do mundo de teste. */
const OFFSET = {
  segundoDia: DAY,
  a2Publicada: -40 * DAY,
  a2Preenchida: -10 * DAY,
  a2Candidaturas: -35 * DAY,
  b1Publicada: 2 * DAY,
  b1Candidatura: 3 * DAY,
};

/** Valores esperados derivados do mundo descrito em `seedWorld`. */
const TOTAL_CANDIDATURAS = 6;
/** 2 aprovados / 3 finalizados = 67%. */
const EMPREGABILIDADE_GLOBAL = 67;
/** jobA2: candidatura há 35 dias, preenchida há 10 → 25 dias. */
const TTH_JOB_A2_DIAS = 25;
const PERIODO_AMPLO = 60 * DAY;

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
      graduationYear: FORMATURA_CC,
      availability: ["estagio"],
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
      graduationYear: FORMATURA_ADM,
      availability: ["integral"],
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
        expiresAt: publishedAt + VALIDADE_VAGA,
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
        matchScore: MATCH_SCORE,
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
      T0 + OFFSET.a2Publicada,
      T0 + OFFSET.a2Preenchida,
    );
    const jobB1 = await mkJob(
      betaId,
      "Dev Mobile (Beta)",
      "fechada",
      T0 + OFFSET.b1Publicada,
    );

    await mkApp(jobA1, ccStudentId, "inscrito", T0);
    await mkApp(jobA1, ccStudentId, "aprovado", T0 + OFFSET.segundoDia);
    await mkApp(jobA1, admStudentId, "triagem", T0 + OFFSET.segundoDia);
    await mkApp(jobA2, ccStudentId, "aprovado", T0 + OFFSET.a2Candidaturas);
    await mkApp(jobA2, admStudentId, "reprovado", T0 + OFFSET.a2Candidaturas);
    await mkApp(jobB1, admStudentId, "inscrito", T0 + OFFSET.b1Candidatura);

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

/** Cria o mundo de teste e devolve o cliente já autenticado como gestor. */
async function setup() {
  const t = convexTest(schema, modules);
  const world = await seedWorld(t);
  return { ...world, asGestor: asManager(t, world.managerId) };
}

const funnelCounts = (funnel: { steps: Array<{ count: number }> }) =>
  funnel.steps.map((step) => step.count);

describe("S5-5 — filtros combináveis do dashboard (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("sem filtros: métricas globais (baseline)", () => {
    it("summary: contagem de vagas por situação", async () => {
      const { asGestor } = await setup();
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
    });

    it("summary: candidaturas e empregabilidade globais", async () => {
      const { asGestor } = await setup();
      const summary = await asGestor.query(
        api.operational.operationalSummary,
        {},
      );
      expect(summary).toMatchObject({
        applications: { total: TOTAL_CANDIDATURAS },
        employability: { rate: EMPREGABILIDADE_GLOBAL },
      });
    });

    it("funil: contagem por etapa e total de candidaturas", async () => {
      const { asGestor } = await setup();
      const funnel = await asGestor.query(api.operational.pipelineFunnel, {});
      expect(funnelCounts(funnel)).toEqual([2, 1, 0, 2]);
      expect(funnel.totalApplications).toBe(TOTAL_CANDIDATURAS);
    });
  });

  describe("filtro status: só vagas daquele status", () => {
    it("summary enxerga só a vaga aberta e as candidaturas dela", async () => {
      const { asGestor } = await setup();
      const summary = await asGestor.query(
        api.operational.operationalSummary,
        { status: "aberta" },
      );
      expect(summary.jobs).toEqual({
        open: 1,
        closed: 0,
        filled: 0,
        total: 1,
      });
      // Só as candidaturas de jobA1 (aberta).
      expect(summary.applications.total).toBe(3);
    });

    it("funil conta só as candidaturas da vaga aberta", async () => {
      const { asGestor } = await setup();
      const funnel = await asGestor.query(api.operational.pipelineFunnel, {
        status: "aberta",
      });
      expect(funnelCounts(funnel)).toEqual([1, 1, 0, 1]);
    });

    it("ranking de vagas lista só a vaga aberta", async () => {
      const { asGestor, jobA1 } = await setup();
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
  });

  describe("filtro curso: métricas refletem só o curso", () => {
    it("funil: CC tem 1 inscrito (jobA1) e 2 aprovados (jobA1 e jobA2)", async () => {
      const { asGestor } = await setup();
      const funnel = await asGestor.query(api.operational.pipelineFunnel, {
        course: "Ciência da Computação",
      });
      expect(funnelCounts(funnel)).toEqual([1, 0, 0, 2]);
    });

    it("empregabilidade considera só resultados finais do curso (2 aprovados → 100%)", async () => {
      const { asGestor } = await setup();
      const summary = await asGestor.query(
        api.operational.operationalSummary,
        { course: "Ciência da Computação" },
      );
      expect(summary.employability.rate).toBe(100);
    });
  });

  describe("filtro empresa: métricas restritas às vagas da empresa", () => {
    it("funil: Beta só tem jobB1 com uma candidatura inscrita", async () => {
      const { asGestor } = await setup();
      const funnel = await asGestor.query(api.operational.pipelineFunnel, {
        company: "Beta Recruiter",
      });
      expect(funnelCounts(funnel)).toEqual([1, 0, 0, 0]);
      expect(funnel.totalApplications).toBe(1);
    });

    it("ranking de empresas lista só a Beta", async () => {
      const { asGestor, betaId } = await setup();
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
  });

  describe("filtros combináveis atualizam as métricas juntas", () => {
    it("status + curso + período: só a candidatura em triagem de ADM", async () => {
      const { asGestor, T0 } = await setup();
      const summary = await asGestor.query(
        api.operational.operationalSummary,
        { status: "aberta", course: "Administração", from: T0 },
      );
      // jobA1 (aberta) + curso ADM + publicada/candidatura a partir de T0.
      expect(summary.applications).toMatchObject({
        total: 1,
        inProgress: 1,
      });
    });

    it("status + curso + período: sem finalizados, a taxa é null", async () => {
      const { asGestor, T0 } = await setup();
      const summary = await asGestor.query(
        api.operational.operationalSummary,
        { status: "aberta", course: "Administração", from: T0 },
      );
      expect(summary.employability.rate).toBeNull();
    });

    it("TTH do curso CC com período amplo inclui a contratação da jobA2", async () => {
      const { asGestor, T0 } = await setup();
      const tth = await asGestor.query(api.operational.timeToHireStats, {
        course: "Ciência da Computação",
        from: T0 - PERIODO_AMPLO,
      });
      expect(tth).toMatchObject({
        samplesCount: 1,
        averageDays: TTH_JOB_A2_DIAS,
      });
    });

    it("TTH com status != encerrada: nenhuma vaga preenchida permanece", async () => {
      const { asGestor } = await setup();
      const tth = await asGestor.query(api.operational.timeToHireStats, {
        status: "aberta",
      });
      expect(tth).toMatchObject({ averageDays: null, samplesCount: 0 });
    });
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