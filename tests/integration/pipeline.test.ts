/**
 * [S4-5] Testes de INTEGRAÇÃO do fluxo de pipeline — mutations reais
 * (`applyToJob`, `moveApplication`, `rejectApplication`,
 * `acceptProcess`, `revokeProcessAcceptance`) executadas contra o mock
 * oficial do backend Convex (convex-test), com identidades autenticadas.
 *
 * CAs: transições válidas/inválidas (S4-1), reprovação com motivo
 * padronizado (S4-2, R5) e liberação de contato LGPD (S4-3, R6).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { APPLICATION_STAGES } from "../../src/lib/application";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };
const RECRUITER = { email: "recruiter@unicap.br", subject: "recruiter-1" };

async function seedWorld(
  t: World,
  options: {
    jobStatus?: "aberta" | "fechada" | "encerrada";
    showContact?: boolean;
  } = {},
) {
  const jobStatus = options.jobStatus ?? "aberta";
  const showContact = options.showContact ?? false;
  return t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: RECRUITER.email,
      name: "Recrutador Responsável",
      role: "recrutador",
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
      showContactToRecruiters: showContact,
      skills: ["React"],
      languages: [{ name: "Inglês", level: "intermediario" }],
    });
    await ctx.db.insert("consents", {
      userId: recruiterId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    await ctx.db.insert("consents", {
      userId: studentUserId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description:
        "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: jobStatus,
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    return { recruiterId, studentUserId, studentId, jobId };
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

function asRecruiter(t: World, recruiterId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${recruiterId}`,
  });
}

describe("S4-5 — fluxo de pipeline (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("candidatura nasce em 'inscrito' com match calculado no servidor", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, studentUserId } = await seedWorld(t);
    const { applicationId, matchScore } = await asStudent(
      t,
      studentUserId,
    ).mutation(api.applications.applyToJob, { jobId });
    expect(matchScore).toBeGreaterThanOrEqual(0);
    expect(matchScore).toBeLessThanOrEqual(100);
    const stage = await t.run(
      async (ctx) => (await ctx.db.get(applicationId))?.stage,
    );
    expect(stage).toBe("inscrito");
  });

  it("vaga encerrada não aceita candidatura (R4)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, studentUserId } = await seedWorld(t, {
      jobStatus: "encerrada",
    });
    await expect(
      asStudent(t, studentUserId).mutation(api.applications.applyToJob, {
        jobId,
      }),
    ).rejects.toThrow(/não está aberta/i);
  });

  it("recrutador dono move o card e o stage é atualizado (S4-1)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const recruiter = asRecruiter(t, recruiterId);
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    const stage = await t.run(
      async (ctx) => (await ctx.db.get(applicationId))?.stage,
    );
    expect(stage).toBe("triagem");
  });

  it("transição inválida: mover para a mesma coluna é rejeitado (S4-1)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    await expect(
      asRecruiter(t, recruiterId).mutation(api.applications.moveApplication, {
        applicationId,
        to: "inscrito",
      }),
    ).rejects.toThrow(/já está nesta coluna/i);
  });

  it("recrutador de outra vaga não move o card (S4-1)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, studentUserId } = await seedWorld(t);
    const otherRecruiterId = await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", {
        email: "other@empresa.br",
        name: "Outro Recrutador",
        role: "recrutador",
        active: true,
      });
      await ctx.db.insert("consents", {
        userId: other,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
      return other;
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const asOther = t.withIdentity({
      email: "other@empresa.br",
      subject: "other-1",
      emailVerificationTime: Date.now(),
      tokenIdentifier: `tid-${otherRecruiterId}`,
    });
    await expect(
      asOther.mutation(api.applications.moveApplication, {
        applicationId,
        to: "triagem",
      }),
    ).rejects.toThrow(/recrutador da vaga/i);
  });

  it("fluxo completo: inscrição → triagem → entrevista → aprovado (S4-1)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const recruiter = asRecruiter(t, recruiterId);
    for (const to of ["triagem", "entrevista", "aprovado"] as const) {
      await recruiter.mutation(api.applications.moveApplication, {
        applicationId,
        to,
      });
    }
    const stage = await t.run(
      async (ctx) => (await ctx.db.get(applicationId))?.stage,
    );
    expect(stage).toBe("aprovado");
    expect(APPLICATION_STAGES).toContain("aprovado");
  });
});

describe("S4-5 — reprovação com motivo padronizado (R5, integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reprovação sem motivo é impossível via API (arg obrigatório) e já-reprovado falha", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const recruiter = asRecruiter(t, recruiterId);
    await recruiter.mutation(api.applications.rejectApplication, {
      applicationId,
      reason: "requisitos_obrigatorios",
    });
    // Candidatura agora está reprovada; tentar reprovar de novo falha.
    await expect(
      recruiter.mutation(api.applications.rejectApplication, {
        applicationId,
        reason: "outro",
      }),
    ).rejects.toThrow(/já está reprovada/i);
    const doc = await t.run(async (ctx) => {
      const app = await ctx.db.get(applicationId);
      return { stage: app?.stage, reason: app?.rejectionReason };
    });
    expect(doc.stage).toBe("reprovado");
    expect(doc.reason).toBe("requisitos_obrigatorios");
  });

  it("motivo fora do enum é rejeitado (validador do Convex + guarda, R5)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    // Defesa em profundidade: o validador do Convex (union de literais)
    // rejeita o valor antes mesmo de a guarda pura rodar.
    await expect(
      asRecruiter(t, recruiterId).mutation(
        api.applications.rejectApplication,
        // @ts-expect-error motivo fora do enum fixo deve falhar
        { applicationId, reason: "nao_gostei_da_cara" },
      ),
    ).rejects.toThrow(/Validator error|inválido/i);
  });

  it("query de auditoria lista a reprovação com rótulo do enum (R5)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const recruiter = asRecruiter(t, recruiterId);
    await recruiter.mutation(api.applications.rejectApplication, {
      applicationId,
      reason: "vaga_preenchida",
    });
    const audit = await recruiter.query(api.applications.jobRejections, {
      jobId,
    });
    expect(audit).toHaveLength(1);
    expect(audit?.[0]?.reason).toBe("vaga_preenchida");
    expect(audit?.[0]?.reasonLabel).toContain("preenchida");
  });
});

describe("S4-5 — liberação de contato LGPD (R6, integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sem autorização geral e sem aceite: contato omitido no board (R6)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t, {
      showContact: false,
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const board = await asRecruiter(t, recruiterId).query(
      api.applications.jobBoard,
      { jobId },
    );
    const card = board?.items.find(
      (item) => item.applicationId === applicationId,
    );
    expect(card?.contactReleased).toBe(false);
    expect(card?.email).toBeUndefined();
  });

  it("autorização geral do aluno libera o contato no board (R6)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t, {
      showContact: true,
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const board = await asRecruiter(t, recruiterId).query(
      api.applications.jobBoard,
      { jobId },
    );
    const card = board?.items.find(
      (item) => item.applicationId === applicationId,
    );
    expect(card?.contactReleased).toBe(true);
    expect(card?.releaseReason).toBe("autorizacao_geral");
    expect(card?.email).toBe(STUDENT.email);
  });

  it("aceite no processo libera o contato por candidatura e é revogável (R6)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t, {
      showContact: false,
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const student = asStudent(t, studentUserId);
    await student.mutation(api.applications.acceptProcess, { applicationId });
    let board = await asRecruiter(t, recruiterId).query(
      api.applications.jobBoard,
      { jobId },
    );
    let card = board?.items.find(
      (item) => item.applicationId === applicationId,
    );
    expect(card?.contactReleased).toBe(true);
    expect(card?.releaseReason).toBe("aceite_no_processo");

    // Revogação LGPD: liberação cessa.
    await student.mutation(api.applications.revokeProcessAcceptance, {
      applicationId,
    });
    board = await asRecruiter(t, recruiterId).query(api.applications.jobBoard, {
      jobId,
    });
    card = board?.items.find((item) => item.applicationId === applicationId);
    expect(card?.contactReleased).toBe(false);
  });
});

describe("[RECRUITER_WORKFLOW] R5 no servidor — mover para Reprovado exige motivo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("moveApplication para 'reprovado' SEM motivo falha (furo R5 fechado)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );

    await expect(
      asRecruiter(t, recruiterId).mutation(api.applications.moveApplication, {
        applicationId,
        to: "reprovado",
      }),
    ).rejects.toThrow(/Motivo de reprovação é obrigatório/i);

    // Nada mudou no banco — a candidatura permanece onde estava.
    const doc = await t.run(async (ctx) => await ctx.db.get(applicationId));
    expect(doc?.stage).toBe("inscrito");
    expect(doc?.rejectionReason).toBeUndefined();
  });

  it("moveApplication para 'reprovado' COM motivo do enum grava stage e motivo", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );

    await asRecruiter(t, recruiterId).mutation(
      api.applications.moveApplication,
      {
        applicationId,
        to: "reprovado",
        rejectionReason: "disponibilidade_incompativel",
      },
    );

    const doc = await t.run(async (ctx) => await ctx.db.get(applicationId));
    expect(doc?.stage).toBe("reprovado");
    expect(doc?.rejectionReason).toBe("disponibilidade_incompativel");
  });

  it("aprovação grava filledAt na vaga; desfazer aprovação limpa (S5-2)", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const recruiter = asRecruiter(t, recruiterId);
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "aprovado",
    });

    let job = await t.run(async (ctx) => await ctx.db.get(jobId));
    expect(job?.filledAt).toBeDefined();

    // Recrutador desfaz a aprovação — o preenchimento deixa de existir.
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
    });
    job = await t.run(async (ctx) => await ctx.db.get(jobId));
    expect(job?.filledAt).toBeUndefined();
  });

  it("outro recrutador não reprova candidaturas de vaga alheia", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const otherRecruiterId = await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", {
        email: "intruso@empresa.br",
        name: "Recrutador Intruso",
        role: "recrutador",
        active: true,
      });
      await ctx.db.insert("consents", {
        userId: other,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
      return other;
    });

    // Identidade PRÓPRIA do intruso (e-mail diferente — o fallback do
    // getCurrentUser resolve pelo e-mail da identidade).
    const asOther = t.withIdentity({
      email: "intruso@empresa.br",
      subject: "intruso-1",
      emailVerificationTime: Date.now(),
      tokenIdentifier: `tid-${otherRecruiterId}`,
    });

    await expect(
      asOther.mutation(api.applications.rejectApplication, {
        applicationId,
        reason: "outro",
      }),
    ).rejects.toThrow(/recrutador da vaga/i);
  });
});

describe("[RECRUITER_WORKFLOW] createJob/getMyJobs e getJobApplications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createJob publica vaga própria (aberta, 30 dias); getMyJobs lista só as do dono", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId } = await seedWorld(t);

    const { jobId } = await asRecruiter(t, recruiterId).mutation(
      api.jobs.createJob,
      {
        title: "Vaga Nova do Workflow",
        description:
          "Descrição da vaga criada no fluxo do recrutador para o teste.",
        prerequisites: [{ item: "React", required: true }],
        contractType: "estagio",
      },
    );

    const doc = await t.run(async (ctx) => {
      const job = await ctx.db.get(jobId);
      return job === null
        ? null
        : {
            status: job.status,
            publishedAt: job.publishedAt,
            expiresAt: job.expiresAt,
            recruiterId: job.recruiterId,
          };
    });
    expect(doc?.status).toBe("aberta");
    expect(doc?.recruiterId).toBe(recruiterId);
    expect(doc?.publishedAt).toBeDefined();
    // R4 — expiração gravada exatamente 30 dias após a publicação.
    expect((doc?.expiresAt ?? 0) - (doc?.publishedAt ?? 0)).toBe(30 * DAY);

    // Outro recrutador NÃO vê a vaga alheia; o dono vê.
    const otherRecruiterId = await t.run(async (ctx) => {
      const other = await ctx.db.insert("users", {
        email: "outra@empresa.br",
        name: "Outra Empresa",
        role: "recrutador",
        active: true,
      });
      await ctx.db.insert("consents", {
        userId: other,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
      return other;
    });
    const asOther = t.withIdentity({
      email: "outra@empresa.br",
      subject: "outra-1",
      emailVerificationTime: Date.now(),
      tokenIdentifier: `tid-${otherRecruiterId}`,
    });
    const otherJobs = await asOther.query(api.jobs.getMyJobs, {});
    expect(otherJobs.some((job) => job._id === jobId)).toBe(false);
    const myJobs = await asRecruiter(t, recruiterId).query(
      api.jobs.getMyJobs,
      {},
    );
    expect(myJobs.map((job) => job.title)).toContain("Vaga Nova do Workflow");
  });

  it("getJobApplications (jobApplications) junta aluno, curso e matchScore", async () => {
    const t = convexTest({ schema, modules });
    const { jobId, recruiterId, studentUserId } = await seedWorld(t);
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );

    const items = await asRecruiter(t, recruiterId).query(
      api.applications.jobApplications,
      { jobId },
    );
    expect(items).not.toBeNull();
    const card = items?.find((item) => item.applicationId === applicationId);
    expect(card?.fullName).toBe("Maria da Silva");
    expect(card?.course).toBe("Ciência da Computação");
    expect(card?.matchScore).toBeGreaterThanOrEqual(0);
    expect(card?.stage).toBe("inscrito");
  });
});
