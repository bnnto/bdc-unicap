import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");
type World = ReturnType<typeof convexTest>;

/** Número de denúncias de alunos diferentes que suspende a vaga. */
const LIMITE_DENUNCIAS = 10;
const ANO_FORMATURA = 2027;
const MOTIVO = "empresa_falsa" as const;
const RECRUITER_EMAIL = "rec@empresa.com";

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
    email: RECRUITER_EMAIL,
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
      graduationYear: ANO_FORMATURA,
      availability: ["estagio"],
    });
    return userId;
  });
}

async function reportAs(t: World, n: number, jobId: Id<"jobs">) {
  const studentId = await newStudent(t, n);
  return as(t, studentId).mutation(api.reports.reportJob, {
    jobId,
    reason: MOTIVO,
  });
}

/** Denúncias em sequência de `count` alunos diferentes (numerados de 0). */
async function reportMany(t: World, jobId: Id<"jobs">, count: number) {
  const results: Array<Awaited<ReturnType<typeof reportAs>>> = [];
  for (let n = 0; n < count; n++) {
    results.push(await reportAs(t, n, jobId));
  }
  return results;
}

/** Vaga criada e já suspensa pelo limite de denúncias. */
async function seedSuspendedJob(t: World) {
  const seeded = await seed(t);
  await reportMany(t, seeded.jobId, LIMITE_DENUNCIAS);
  return seeded;
}

const getJob = (t: World, jobId: Id<"jobs">) =>
  t.run(async (ctx) => ctx.db.get(jobId));
const listReports = (t: World) =>
  t.run(async (ctx) => ctx.db.query("jobReports").collect());
const listLogs = (t: World) =>
  t.run(async (ctx) => ctx.db.query("moderationLogs").collect());

describe("Denúncias de vagas", () => {
  it("só a 10ª denúncia de alunos diferentes suspende a vaga", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await seed(t);

    const results = await reportMany(t, jobId, LIMITE_DENUNCIAS);

    expect(results.map((r) => r.suspended)).toEqual([
      ...Array<boolean>(LIMITE_DENUNCIAS - 1).fill(false),
      true,
    ]);
  });

  it("a suspensão por denúncias fica registrada na vaga e no log", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await seedSuspendedJob(t);

    expect(await getJob(t, jobId)).toMatchObject({
      status: "suspensa",
      moderationCause: "denuncia",
    });
    expect(await listLogs(t)).toMatchObject([
      { action: "suspensa", reportsCount: LIMITE_DENUNCIAS },
    ]);
  });

  it("o mesmo aluno não denuncia a mesma vaga duas vezes", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await seed(t);
    const student = as(t, await newStudent(t, 0));
    await student.mutation(api.reports.reportJob, { jobId, reason: MOTIVO });

    await expect(
      student.mutation(api.reports.reportJob, { jobId, reason: MOTIVO }),
    ).rejects.toThrow(/já denunciou/i);
  });

  describe("gestor reativa a vaga suspensa", () => {
    async function approveAfterSuspension(t: World) {
      const seeded = await seedSuspendedJob(t);
      await as(t, seeded.gestorId).mutation(api.moderation.decideJob, {
        jobId: seeded.jobId,
        decision: "aprovar",
      });
      return seeded;
    }

    it("a vaga volta a ficar aberta e as denúncias são arquivadas", async () => {
      const t = convexTest(schema, modules);
      const { jobId } = await approveAfterSuspension(t);

      expect(await getJob(t, jobId)).toMatchObject({ status: "aberta" });
      const statuses = (await listReports(t)).map((r) => r.status);
      expect([...new Set(statuses)]).toEqual(["arquivada"]);
    });

    it("a contagem recomeça: nova denúncia não suspende de novo", async () => {
      const t = convexTest(schema, modules);
      const { jobId } = await approveAfterSuspension(t);

      const nova = await reportAs(t, LIMITE_DENUNCIAS, jobId);

      expect(nova.suspended).toBe(false);
    });
  });

  it("recrutador exclui a vaga suspensa e o registro permanece", async () => {
    const t = convexTest(schema, modules);
    const { recruiterId, jobId } = await seedSuspendedJob(t);

    await as(t, recruiterId).mutation(api.jobs.deleteJob, { jobId });

    expect(await getJob(t, jobId)).toBeNull();
    expect(await listReports(t)).toEqual([]);
    const deleted = (await listLogs(t)).find((log) => log.action === "excluida");
    expect(deleted).toMatchObject({
      jobTitle: JOB.title,
      reportsCount: LIMITE_DENUNCIAS,
      recruiterEmail: RECRUITER_EMAIL,
    });
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

    expect(log[0]).toMatchObject({ action: "suspensa", byGestor: true });
  });
});