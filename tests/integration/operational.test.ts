/**
 * [S5-1] Testes de INTEGRAÇÃO do Painel Operacional — query agregada
 * `operationalSummary` executada contra o mock oficial do backend
 * Convex (convex-test), com identidades autenticadas.
 *
 * CAs: números dos cards consistentes com o banco (CA 1) e taxa de
 * empregabilidade calculada a partir de aprovações (CA 2). Também cobre
 * o guard R7 + papel (aluno e sem-consentimento são rejeitados).
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
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };

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
    if (withManagerConsent) {
      await ctx.db.insert("consents", {
        userId: managerId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    await ctx.db.insert("consents", {
      userId: studentUserId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    const openJobId = await ctx.db.insert("jobs", {
      recruiterId: managerId,
      title: "Estágio em Desenvolvimento Web",
      description: "Apoio no desenvolvimento de aplicações web.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    const closedJobId = await ctx.db.insert("jobs", {
      recruiterId: managerId,
      title: "Vaga Fechada",
      description: "Fechada manualmente pelo recrutador.",
      prerequisites: [],
      contractType: "clt",
      status: "fechada",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    const filledJobId = await ctx.db.insert("jobs", {
      recruiterId: managerId,
      title: "Vaga Preenchida",
      description: "Encerrada com processo concluído.",
      prerequisites: [],
      contractType: "pj",
      status: "encerrada",
      publishedAt: Date.now() - 35 * DAY,
      expiresAt: Date.now() - 5 * DAY,
    });
    return {
      managerId,
      studentUserId,
      studentId,
      openJobId,
      closedJobId,
      filledJobId,
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

describe("S5-1 — painel operacional (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — cards refletem exatamente os status das vagas no banco", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const summary = await asManager(t, managerId).query(
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

  it("CA 2 — taxa de empregabilidade calculada a partir de aprovações", async () => {
    const t = convexTest(schema, modules);
    const { managerId, studentId, openJobId, filledJobId } = await seedWorld(t);

    await t.run(async (ctx) => {
      const now = Date.now();
      // Pipeline real: 1 aprovado, 1 reprovado (finalizados) e
      // 2 em andamento (inscrito/triagem), que não entram na taxa.
      await ctx.db.insert("applications", {
        jobId: filledJobId,
        studentId,
        stage: "aprovado",
        matchScore: 90,
        appliedAt: now,
      });
      await ctx.db.insert("applications", {
        jobId: filledJobId,
        studentId,
        stage: "reprovado",
        matchScore: 40,
        appliedAt: now,
        rejectionReason: "requisitos_obrigatorios",
      });
      await ctx.db.insert("applications", {
        jobId: openJobId,
        studentId,
        stage: "triagem",
        matchScore: 60,
        appliedAt: now,
      });
      await ctx.db.insert("applications", {
        jobId: openJobId,
        studentId,
        stage: "inscrito",
        matchScore: 55,
        appliedAt: now,
      });
    });

    const summary = await asManager(t, managerId).query(
      api.operational.operationalSummary,
      {},
    );

    // 1 aprovado / 2 finalizados = 50%.
    expect(summary.employability.rate).toBe(50);
    expect(summary.employability.label).toBe("50%");
    expect(summary.applications.total).toBe(4);
    expect(summary.applications.approved).toBe(1);
    expect(summary.applications.rejected).toBe(1);
    expect(summary.applications.finalized).toBe(2);
    expect(summary.applications.inProgress).toBe(2);
  });

  it("sem candidaturas finalizadas: taxa null, exibida como travessão", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const summary = await asManager(t, managerId).query(
      api.operational.operationalSummary,
      {},
    );

    expect(summary.employability.rate).toBeNull();
    expect(summary.employability.label).toBe("—");
  });

  it("guard R7: gestor sem consentimento vigente é rejeitado", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, { withManagerConsent: false });

    await expect(
      asManager(t, managerId).query(api.operational.operationalSummary, {}),
    ).rejects.toThrow(/Consentimento/i);
  });

  it("guard R7: aluno não acessa o painel operacional", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).query(api.operational.operationalSummary, {}),
    ).rejects.toThrow(/gestores e recrutadores/i);
  });
});
