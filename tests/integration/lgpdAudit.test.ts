/**
 * [S8-1] Testes de INTEGRAÇÃO da auditoria LGPD end-to-end —
 * queries `lgpd.runAudit` / `lgpd.myDataReport` e mutation
 * `students.deleteMyProfile` contra o mock oficial do backend Convex
 * (convex-test), com identidades autenticadas.
 *
 * CAs: checklist LGPD validado (R7 — consentimento versionado; R6 —
 * contato nunca exposto sem autorização) e retificação/exclusão de
 * dados pelo titular.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";
import {
  buildLgpdChecklist,
  hasUnauthorizedContactExposure,
  type ContactExposure,
} from "../../src/lib/lgpdAudit";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };
const RECRUITER = { email: "recruiter@unicap.br", subject: "recruiter-1" };
const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };

const DAY = 24 * 60 * 60 * 1000;

async function seedWorld(
  t: World,
  options: {
    showContact?: boolean;
    withConsent?: boolean;
  } = {},
) {
  const showContact = options.showContact ?? false;
  const withConsent = options.withConsent ?? true;
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
    if (withConsent) {
      await ctx.db.insert("consents", {
        userId: studentUserId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    await ctx.db.insert("consents", {
      userId: recruiterId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    const managerId = await ctx.db.insert("users", {
      email: MANAGER.email,
      name: "Gestora de Carreiras",
      role: "gestor",
      active: true,
    });
    if (withConsent) {
      await ctx.db.insert("consents", {
        userId: managerId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description:
        "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
    });
    return { recruiterId, studentUserId, studentId, managerId, jobId };
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

/** Mapeia o board real do servidor para as exposições auditáveis (R6). */
function toExposures(
  items: ReadonlyArray<{
    applicationId: string;
    contactReleased: boolean;
    releaseReason:
      "autorizacao_geral" | "aceite_no_processo" | "sem_autorizacao";
    email?: string;
    phone?: string;
  }>,
): ContactExposure[] {
  return items.map((i) => ({
    applicationId: i.applicationId,
    contactReleased: i.contactReleased,
    releaseReason: i.releaseReason,
    email: i.email,
    phone: i.phone,
  }));
}

describe("S8-1 — checklist LGPD via lgpd.runAudit (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gestor obtém checklist consolidado válido (aceite vigente, sem vazamento)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);
    const report = await asManager(t, managerId).mutation(
      api.lgpd.runAudit,
      {},
    );
    expect(report.passed).toBe(true);
    expect(report.failed).toEqual([]);
    const ids = report.items.map((i) => i.id);
    expect(ids).toContain("consentimento_versionado");
    expect(ids).toContain("autorizacao_contato");
    expect(ids).toContain("retificacao");
    expect(ids).toContain("exclusao");
    expect(report.items.length).toBeGreaterThanOrEqual(5);
    expect(typeof report.generatedAt).toBe("number");
  });

  it("auditoria é exclusiva do gestor (aluno é rejeitado)", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);
    await expect(
      asStudent(t, studentUserId).mutation(api.lgpd.runAudit, {}),
    ).rejects.toThrow(/Apenas gestores/i);
  });

  it("auditoria exige consentimento vigente do próprio gestor (R7)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, { withConsent: false });
    await expect(
      asManager(t, managerId).mutation(api.lgpd.runAudit, {}),
    ).rejects.toThrow(/Aceite o Termo/i);
  });

  it("runAudit sem autenticação é rejeitado", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    await expect(t.mutation(api.lgpd.runAudit, {})).rejects.toThrow(
      /Não autenticado/i,
    );
  });

  it("cada execução grava um snapshot na trilha de auditoria", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);
    const identity = asManager(t, managerId);
    const first = await identity.mutation(api.lgpd.runAudit, {});
    const second = await identity.mutation(api.lgpd.runAudit, {});
    const trail = await t.run(async (ctx) =>
      ctx.db.query("lgpdAudits").collect(),
    );
    expect(trail).toHaveLength(2);
    const snapshot = trail[0];
    const snapshotReport = snapshot?.report as
      { passed: boolean; items: { id: string }[] } | undefined;
    expect(snapshot?.actorRole).toBe("gestor");
    expect(snapshotReport?.passed).toBe(first.passed);
    expect(snapshotReport?.items.length).toBe(second.items.length);
    expect(typeof snapshot?.createdAt).toBe("number");
  });
});

describe("S8-1 — relatório de dados do titular (art. 18, II)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aluno autentica os próprios dados, perfil e trilha de consentimento", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, studentId, jobId } = await seedWorld(t);
    const student = asStudent(t, studentUserId);
    const { applicationId } = await student.mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const report = await student.query(api.lgpd.myDataReport, {});
    expect(report).not.toBeNull();
    expect(report?.user.email).toBe(STUDENT.email);
    expect(report?.user.role).toBe("aluno");
    expect(report?.data.profile?.studentId).toBe(studentId);
    expect(report?.data.profile?.fullName).toBe("Maria da Silva");
    expect(report?.data.applications).toHaveLength(1);
    expect(report?.data.applications[0]?.applicationId).toBe(applicationId);
    expect(report?.data.applications[0]?.jobTitle).toBe(
      "Estágio em Desenvolvimento Web",
    );
    expect(report?.consents).toHaveLength(1);
    expect(report?.consents[0]?.termVersion).toBe(CURRENT_TERM_VERSION);
  });

  it("relatório sem autenticação retorna null", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    expect(await t.query(api.lgpd.myDataReport, {})).toBeNull();
  });

  it("R6 end-to-end — sem liberação o board omite o contato e o detector confirma zero vazamento", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, recruiterId, jobId } = await seedWorld(t, {
      showContact: false,
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const board = await t
      .withIdentity({
        ...RECRUITER,
        emailVerificationTime: Date.now(),
        tokenIdentifier: `tid-${recruiterId}`,
      })
      .query(api.applications.jobBoard, { jobId });
    const card = board?.items.find((i) => i.applicationId === applicationId);
    expect(card?.contactReleased).toBe(false);
    expect(card?.email).toBeUndefined();
    expect(card?.linkedinUrl).toBeUndefined();
    expect(card?.portfolioUrl).toBeUndefined();
    expect(
      hasUnauthorizedContactExposure(toExposures(board?.items ?? [])),
    ).toBe(false);
  });

  it("R6 end-to-end — com autorização geral o e-mail do titular é projetado", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, recruiterId, jobId } = await seedWorld(t, {
      showContact: true,
    });
    const { applicationId } = await asStudent(t, studentUserId).mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const board = await t
      .withIdentity({
        ...RECRUITER,
        emailVerificationTime: Date.now(),
        tokenIdentifier: `tid-${recruiterId}`,
      })
      .query(api.applications.jobBoard, { jobId });
    const card = board?.items.find((i) => i.applicationId === applicationId);
    expect(card?.contactReleased).toBe(true);
    expect(card?.email).toBe(STUDENT.email);
    const report = buildLgpdChecklist(
      {
        currentTermVersion: CURRENT_TERM_VERSION,
        consents: [
          { termVersion: CURRENT_TERM_VERSION, acceptedAt: Date.now() },
        ],
        contactAuthorization: {
          showContactToRecruiters: true,
          processAccepted: false,
          email: STUDENT.email,
        },
        contactExposures: toExposures(board?.items ?? []),
        rectifySupported: true,
        eraseSupported: true,
        publicDivulgationWhitelist: true,
      },
      Date.now(),
    );
    const item = report.items.find((i) => i.id === "autorizacao_contato");
    expect(item?.status).toBe("ok");
  });
});

describe("S8-1 — exclusão de dados pelo titular (art. 18, VI)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exclusão remove perfil, candidaturas e trilha de aceites do titular", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, jobId } = await seedWorld(t);
    const student = asStudent(t, studentUserId);
    const { applicationId } = await student.mutation(
      api.applications.applyToJob,
      { jobId },
    );
    const result = await student.mutation(api.students.deleteMyProfile, {});
    expect(result.ok).toBe(true);
    const remaining = await t.run(async (ctx) => ({
      students: await ctx.db.query("students").collect(),
      applications: await ctx.db.query("applications").collect(),
      consents: await ctx.db
        .query("consents")
        .withIndex("by_user", (q) =>
          // O userId do aluno é o único restante? Verificamos por e-mail do usuário.
          q.eq("userId", studentUserId as never),
        )
        .collect(),
    }));
    expect(remaining.students).toHaveLength(0);
    expect(remaining.applications).toHaveLength(0);
    expect(remaining.consents).toHaveLength(0);
    expect(applicationId).toBeDefined();
  });

  it("exclusão exige consentimento vigente (R7)", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t, { withConsent: false });
    await expect(
      asStudent(t, studentUserId).mutation(api.students.deleteMyProfile, {}),
    ).rejects.toThrow(/Aceite o Termo/i);
  });

  it("usuário não cadastrado não tem o que excluir", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    const ghost = t.withIdentity({
      email: "fantasma@unicap.br",
      subject: "fantasma-1",
      emailVerificationTime: Date.now(),
      tokenIdentifier: "tid-fantasma",
    });
    await expect(
      ghost.mutation(api.students.deleteMyProfile, {}),
    ).rejects.toThrow(/Usuário não encontrado/i);
  });
});
