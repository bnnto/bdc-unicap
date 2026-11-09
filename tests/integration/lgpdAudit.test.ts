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
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
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

const DAY = 86_400_000;
const JOB_VALIDITY = 30 * DAY;
const JOB_TITLE = "Estágio em Desenvolvimento Web";
const GRADUATION_YEAR = 2026;
/** O checklist tem ao menos os 4 itens nomeados + 1 de apoio. */
const MIN_CHECKLIST_ITEMS = 5;
const AUDIT_RUNS = 2;

beforeEach(() => {
  vi.restoreAllMocks();
});

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
      graduationYear: GRADUATION_YEAR,
      availability: ["estagio"],
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
      title: JOB_TITLE,
      description:
        "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + JOB_VALIDITY,
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

function asRecruiter(t: World, recruiterId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${recruiterId}`,
  });
}

/** Mapeia o board real do servidor para as exposições auditáveis (R6). */
function toExposures(
  items: ReadonlyArray<{
    applicationId: string;
    contactReleased: boolean;
    releaseReason:
      | "autorizacao_geral"
      | "aceite_no_processo"
      | "sem_autorizacao";
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

/** Executa a auditoria como gestor num mundo recém-criado. */
async function auditAsManager(options: { withConsent?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const { managerId } = await seedWorld(t, options);
  return asManager(t, managerId).mutation(api.lgpd.runAudit, {});
}

/** Aluno se candidata e o recrutador abre o board: devolve o board e o card. */
async function applyAndOpenBoard(showContact: boolean) {
  const t = convexTest(schema, modules);
  const { studentUserId, recruiterId, jobId } = await seedWorld(t, {
    showContact,
  });
  const { applicationId } = await asStudent(t, studentUserId).mutation(
    api.applications.applyToJob,
    { jobId },
  );
  const board = await asRecruiter(t, recruiterId).query(
    api.applications.jobBoard,
    { jobId },
  );
  assert(board, "o board da vaga deveria existir");
  const card = board.items.find((i) => i.applicationId === applicationId);
  assert(card, "a candidatura deveria aparecer no board");
  return { board, card };
}

/** Aluno se candidata e consulta o próprio relatório de dados. */
async function studentDataReport() {
  const t = convexTest(schema, modules);
  const { studentUserId, studentId, jobId } = await seedWorld(t);
  const student = asStudent(t, studentUserId);
  const { applicationId } = await student.mutation(
    api.applications.applyToJob,
    { jobId },
  );
  const report = await student.query(api.lgpd.myDataReport, {});
  assert(report, "o relatório do titular deveria existir");
  return { report, studentId, applicationId };
}

describe("S8-1 — checklist LGPD via lgpd.runAudit (integração)", () => {
  it("gestor obtém checklist consolidado válido (aceite vigente, sem vazamento)", async () => {
    const report = await auditAsManager();

    expect(report).toMatchObject({ passed: true, failed: [] });
    expect(typeof report.generatedAt).toBe("number");
  });

  it("o checklist cobre consentimento, contato, retificação e exclusão", async () => {
    const report = await auditAsManager();

    expect(report.items.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "consentimento_versionado",
        "autorizacao_contato",
        "retificacao",
        "exclusao",
      ]),
    );
    expect(report.items.length).toBeGreaterThanOrEqual(MIN_CHECKLIST_ITEMS);
  });

  it("auditoria é exclusiva do gestor (aluno é rejeitado)", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).mutation(api.lgpd.runAudit, {}),
    ).rejects.toThrow(/Apenas gestores/i);
  });

  it("auditoria exige consentimento vigente do próprio gestor (R7)", async () => {
    await expect(auditAsManager({ withConsent: false })).rejects.toThrow(
      /Aceite o Termo/i,
    );
  });

  it("runAudit sem autenticação é rejeitado", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    await expect(t.mutation(api.lgpd.runAudit, {})).rejects.toThrow(
      /Não autenticado/i,
    );
  });

  it("cada execução grava um snapshot na trilha de auditoria", async () => {
    const t = convexTest( schema, modules);
    const { managerId } = await seedWorld(t);
    const identity = asManager(t, managerId);
    const first = await identity.mutation(api.lgpd.runAudit, {});
    const second = await identity.mutation(api.lgpd.runAudit, {});

    const trail = await t.run(async (ctx) =>
      ctx.db.query("lgpdAudits").collect(),
    );

    expect(trail).toHaveLength(AUDIT_RUNS);
    const [snapshot] = trail;
    assert(snapshot, "a trilha deveria ter ao menos um snapshot");
    expect(snapshot).toMatchObject({
      actorRole: "gestor",
      report: { passed: first.passed },
    });
    expect(typeof snapshot.createdAt).toBe("number");
    const snapshotItems = (snapshot.report as { items: unknown[] }).items;
    expect(snapshotItems).toHaveLength(second.items.length);
  });
});

describe("S8-1 — relatório de dados do titular (art. 18, II)", () => {
  it("aluno autentica os próprios dados e perfil", async () => {
    const { report, studentId } = await studentDataReport();

    expect(report).toMatchObject({
      user: { email: STUDENT.email, role: "aluno" },
      data: { profile: { studentId, fullName: "Maria da Silva" } },
    });
  });

  it("o relatório lista a candidatura do titular", async () => {
    const { report, applicationId } = await studentDataReport();

    expect(report).toMatchObject({
      data: { applications: [{ applicationId, jobTitle: JOB_TITLE }] },
    });
  });

  it("o relatório traz a trilha de consentimento", async () => {
    const { report } = await studentDataReport();

    expect(report).toMatchObject({
      consents: [{ termVersion: CURRENT_TERM_VERSION }],
    });
  });

  it("relatório sem autenticação retorna null", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    expect(await t.query(api.lgpd.myDataReport, {})).toBeNull();
  });

  describe("R6 end-to-end — sem liberação de contato", () => {
    it("o board omite o contato do titular", async () => {
      const { card } = await applyAndOpenBoard(false);

      expect(card.contactReleased).toBe(false);
      expect({
        email: card.email,
        linkedinUrl: card.linkedinUrl,
        portfolioUrl: card.portfolioUrl,
      }).toEqual({});
    });

    it("o detector confirma zero vazamento", async () => {
      const { board } = await applyAndOpenBoard(false);

      expect(hasUnauthorizedContactExposure(toExposures(board.items))).toBe(
        false,
      );
    });
  });

  describe("R6 end-to-end — com autorização geral", () => {
    it("o e-mail do titular é projetado no board", async () => {
      const { card } = await applyAndOpenBoard(true);

      expect(card).toMatchObject({
        contactReleased: true,
        email: STUDENT.email,
      });
    });

    it("o checklist marca autorizacao_contato como ok", async () => {
      const { board } = await applyAndOpenBoard(true);

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
          contactExposures: toExposures(board.items),
          rectifySupported: true,
          eraseSupported: true,
          publicDivulgationWhitelist: true,
        },
        Date.now(),
      );

      expect(
        report.items.find((i) => i.id === "autorizacao_contato"),
      ).toMatchObject({
        status: "ok",
      });
    });
  });
});

describe("S8-1 — exclusão de dados pelo titular (art. 18, VI)", () => {
  it("exclusão remove perfil, candidaturas e trilha de aceites do titular", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, jobId } = await seedWorld(t);
    const student = asStudent(t, studentUserId);
    await student.mutation(api.applications.applyToJob, { jobId });

    const result = await student.mutation(api.students.deleteMyProfile, {});

    expect(result.ok).toBe(true);
    const remaining = await t.run(async (ctx) => ({
      students: await ctx.db.query("students").collect(),
      applications: await ctx.db.query("applications").collect(),
      // Aceites do próprio titular (os de recrutador/gestor permanecem).
      consents: await ctx.db
        .query("consents")
        .withIndex("by_user", (q) => q.eq("userId", studentUserId as never))
        .collect(),
    }));
    expect(remaining).toEqual({ students: [], applications: [], consents: [] });
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