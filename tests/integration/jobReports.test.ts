import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");
type World = ReturnType<typeof convexTest>;

const JOB = {
  title: "Estágio em Desenvolvimento Web",
  description:
    "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
  prerequisites: [{ item: "React", required: true }],
  contractType: "estagio" as const,
};

function as(t: World, userId: string) {
  return t.withIdentity({
    subject: `${userId}|sessao-1`,
    emailVerificationTime: Date.now(),
  });
}

async function seed(t: World) {
  const gestorId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      email: "gestor@unicap.br",
      name: "Gestor",
      role: "gestor",
      active: true,
    });
    await ctx.db.insert("consents", {
      userId: id,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    return id;
  });
  const recruiterId = await t.mutation(internal.authHelpers.createUser, {
    email: "rec@empresa.com",
    name: "Recrutador",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
  });
  const { jobId } = await as(t, recruiterId).mutation(api.jobs.createJob, JOB);
  return { gestorId, recruiterId, jobId };
}

async function newStudent(t: World, n: number) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `aluno${n}@unicap.br`,
      name: `Aluno ${n}`,
      role: "aluno",
      active: true,
    });
    await ctx.db.insert("consents", {
      userId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    await ctx.db.insert("students", {
      userId,
      fullName: `Aluno ${n}`,
      enrollment: `2099000${n}`,
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2027,
      availability: ["estagio"],
    });
    return userId;
  });
}

async function reportAs(t: World, n: number, jobId: Id<"jobs">) {
  const studentId = await newStudent(t, n);
  return as(t, studentId).mutation(api.reports.reportJob, {
    jobId,
    reason: "empresa_falsa",
  });
}

describe("Denúncias de vagas", () => {
  it("3 alunos diferentes suspendem a vaga e o fato fica registrado", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await seed(t);

    expect((await reportAs(t, 1, jobId)).suspended).toBe(false);
    expect((await reportAs(t, 2, jobId)).suspended).toBe(false);
    expect((await reportAs(t, 3, jobId)).suspended).toBe(true);

    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("suspensa");
    expect(job?.moderationCause).toBe("denuncia");

    const logs = await t.run(async (ctx) =>
      ctx.db.query("moderationLogs").collect(),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("suspensa");
    expect(logs[0]?.reportsCount).toBe(3);
  });

  it("o mesmo aluno não denuncia a mesma vaga duas vezes", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await seed(t);
    const studentId = await newStudent(t, 1);
    const student = as(t, studentId);
    await student.mutation(api.reports.reportJob, {
      jobId,
      reason: "empresa_falsa",
    });
    await expect(
      student.mutation(api.reports.reportJob, { jobId, reason: "empresa_falsa" }),
    ).rejects.toThrow(/já denunciou/i);
  });

  it("gestor reativa: denúncias são arquivadas e a contagem recomeça", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, jobId } = await seed(t);
    for (const n of [1, 2, 3]) await reportAs(t, n, jobId);

    await as(t, gestorId).mutation(api.moderation.decideJob, {
      jobId,
      decision: "aprovar",
    });
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("aberta");
    const reports = await t.run(async (ctx) =>
      ctx.db.query("jobReports").collect(),
    );
    expect(reports.every((r) => r.status === "arquivada")).toBe(true);

    // Uma nova denúncia não suspende de novo.
    expect((await reportAs(t, 4, jobId)).suspended).toBe(false);
  });

  it("recrutador exclui a vaga suspensa e o registro permanece", async () => {
    const t = convexTest(schema, modules);
    const { recruiterId, jobId } = await seed(t);
    for (const n of [1, 2, 3]) await reportAs(t, n, jobId);

    await as(t, recruiterId).mutation(api.jobs.deleteJob, { jobId });

    expect(await t.run(async (ctx) => ctx.db.get(jobId))).toBeNull();
    const reports = await t.run(async (ctx) =>
      ctx.db.query("jobReports").collect(),
    );
    expect(reports).toHaveLength(0);

    const logs = await t.run(async (ctx) =>
      ctx.db.query("moderationLogs").collect(),
    );
    const deleted = logs.find((log) => log.action === "excluida");
    expect(deleted?.jobTitle).toBe(JOB.title);
    expect(deleted?.reportsCount).toBe(3);
    expect(deleted?.recruiterEmail).toBe("rec@empresa.com");
  });

  it("gestor suspende vaga aberta e o histórico lista o evento", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, jobId } = await seed(t);
    const gestor = as(t, gestorId);
    await gestor.mutation(api.moderation.decideJob, {
      jobId,
      decision: "suspender",
      reason: "Empresa não verificável",
    });
    const log = await gestor.query(api.moderation.listModerationLog, {});
    expect(log[0]?.action).toBe("suspensa");
    expect(log[0]?.byGestor).toBe(true);
  });
});