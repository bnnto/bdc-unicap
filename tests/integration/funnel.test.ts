/**
 * [S5-3] Testes de INTEGRAÇÃO do funil de conversão — query
 * `pipelineFunnel` contra o mock oficial do backend Convex (convex-test).
 *
 * CAs: contagem e conversão % entre etapas (CA 1) e dados prontos para a
 * visualização (CA 2 — ordem, rótulos e etapas zeradas). Também cobre o
 * guard R7 (sem consentimento / papel aluno rejeitados).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  type ApplicationStage,
} from "../../src/lib/application";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };

/**
 * Mundo com recrutador/vaga e candidaturas semeadas por etapa:
 * 4 inscrito, 2 triagem, 1 entrevista, 1 aprovado e 2 reprovado.
 */
async function seedWorld(
  t: World,
  options: {
    withManagerConsent?: boolean;
    stageCounts?: Partial<Record<ApplicationStage, number>>;
  } = {},
) {
  const withManagerConsent = options.withManagerConsent ?? true;
  const stageCounts: Record<ApplicationStage, number> = {
    inscrito: 4,
    triagem: 2,
    entrevista: 1,
    aprovado: 1,
    reprovado: 2,
    ...(options.stageCounts ?? {}),
  };
  return t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: "recruiter@unicap.br",
      name: "Recrutador Responsável",
      role: "recrutador",
      active: true,
    });
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
    for (const userId of [recruiterId, managerId, studentUserId]) {
      if (userId === managerId && !withManagerConsent) continue;
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description: "Apoio no desenvolvimento de aplicações web.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    let total = 0;
    for (const stage of APPLICATION_STAGES) {
      for (let i = 0; i < stageCounts[stage]; i += 1) {
        await ctx.db.insert("applications", {
          jobId,
          studentId,
          stage,
          matchScore: 70,
          appliedAt: Date.now(),
          ...(stage === "reprovado"
            ? { rejectionReason: "requisitos_obrigatorios" as const }
            : {}),
        });
        total += 1;
      }
    }
    return { managerId, studentUserId, total };
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

describe("S5-3 — funil de conversão (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — contagem e conversão % entre etapas", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const { steps, totalApplications } = await asManager(t, managerId).query(
      api.operational.pipelineFunnel,
      {},
    );

    expect(steps).toEqual([
      {
        stage: "inscrito",
        label: STAGE_LABELS.inscrito,
        count: 4,
        conversionFromPrevious: null,
      },
      {
        stage: "triagem",
        label: STAGE_LABELS.triagem,
        count: 2,
        conversionFromPrevious: 50,
      },
      {
        stage: "entrevista",
        label: STAGE_LABELS.entrevista,
        count: 1,
        conversionFromPrevious: 50,
      },
      {
        stage: "aprovado",
        label: STAGE_LABELS.aprovado,
        count: 1,
        conversionFromPrevious: 100,
      },
    ]);
    // CA 1 — total inclui os reprovados (eles saem do funil, mas existem).
    expect(totalApplications).toBe(10);
    // CA 1 — degraus são só as etapas de avanço (reprovado é saída).
    expect(steps.map((step) => step.stage)).toEqual([
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
    ]);
  });

  it("CA 2 — funil vazio: 4 degraus zerados na ordem, conversões null", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      stageCounts: {
        inscrito: 0,
        triagem: 0,
        entrevista: 0,
        aprovado: 0,
        reprovado: 0,
      },
    });

    const { steps, totalApplications } = await asManager(t, managerId).query(
      api.operational.pipelineFunnel,
      {},
    );

    expect(totalApplications).toBe(0);
    expect(steps).toHaveLength(4);
    expect(steps.map((step) => step.stage)).toEqual([
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
    ]);
    expect(steps.every((step) => step.count === 0)).toBe(true);
    expect(steps.every((step) => step.conversionFromPrevious === null)).toBe(
      true,
    );
  });

  it("funil parcial: etapa anterior zerada não divide por zero", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      stageCounts: {
        inscrito: 0,
        triagem: 0,
        entrevista: 2,
        aprovado: 1,
        reprovado: 0,
      },
    });

    const { steps } = await asManager(t, managerId).query(
      api.operational.pipelineFunnel,
      {},
    );

    expect(steps[0]).toMatchObject({
      stage: "inscrito",
      count: 0,
      conversionFromPrevious: null,
    });
    expect(steps[1]).toMatchObject({
      stage: "triagem",
      count: 0,
      conversionFromPrevious: null,
    });
    expect(steps[2]).toMatchObject({
      stage: "entrevista",
      count: 2,
      conversionFromPrevious: null,
    });
    expect(steps[3]).toMatchObject({
      stage: "aprovado",
      count: 1,
      conversionFromPrevious: 50,
    });
  });

  it("guard R7: gestor sem consentimento vigente é rejeitado", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, { withManagerConsent: false });

    await expect(
      asManager(t, managerId).query(api.operational.pipelineFunnel, {}),
    ).rejects.toThrow(/Consentimento/i);
  });

  it("guard R7: aluno não acessa o funil de conversão", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).query(api.operational.pipelineFunnel, {}),
    ).rejects.toThrow(/gestores e recrutadores/i);
  });
});
