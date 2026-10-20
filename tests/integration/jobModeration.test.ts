import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
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
  // Sem publicSignup: recrutador legado, tratado como aprovado.
  const recruiterId = await t.mutation(internal.authHelpers.createUser, {
    email: "rec@empresa.com",
    name: "Recrutador",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
  });
  return { gestorId, recruiterId };
}

describe("Moderação de vagas", () => {
  it("bloqueia o óbvio e manda o duvidoso para revisão", async () => {
    const t = convexTest(schema, modules);
    const { recruiterId } = await seed(t);
    const rec = as(t, recruiterId);

    await expect(
      rec.mutation(api.jobs.createJob, {
        ...JOB,
        description: "Vaga com taxa de inscrição de R$ 50 para o material.",
      }),
    ).rejects.toThrow(/taxa/i);

    const res = await rec.mutation(api.jobs.createJob, {
      ...JOB,
      description: JOB.description + " Chame no WhatsApp para saber mais.",
    });
    expect(res.status).toBe("em_revisao");

    await expect(
      rec.mutation(api.jobs.setJobStatus, { jobId: res.jobId, status: "aberta" }),
    ).rejects.toThrow(/revisão ou suspensa/i);
    await expect(
      rec.mutation(api.jobs.renewJob, { jobId: res.jobId }),
    ).rejects.toThrow(/revisão ou suspensa/i);
  });

  it("gestor aprova vaga em revisão e ela abre", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, recruiterId } = await seed(t);
    const res = await as(t, recruiterId).mutation(api.jobs.createJob, {
      ...JOB,
      description: JOB.description + " Chame no WhatsApp para saber mais.",
    });
    const gestor = as(t, gestorId);
    expect(await gestor.query(api.moderation.pendingModerationCount, {})).toBe(1);

    await gestor.mutation(api.moderation.decideJob, {
      jobId: res.jobId,
      decision: "aprovar",
    });
    const job = await t.run(async (ctx) => ctx.db.get(res.jobId));
    expect(job?.status).toBe("aberta");
    expect(job?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("suspender exige motivo", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, recruiterId } = await seed(t);
    const res = await as(t, recruiterId).mutation(api.jobs.createJob, JOB);
    await expect(
      as(t, gestorId).mutation(api.moderation.decideJob, {
        jobId: res.jobId,
        decision: "suspender",
      }),
    ).rejects.toThrow(/motivo/i);
  });

  it("recrutador exclui vaga encerrada ou suspensa, mas não a ativa", async () => {
    const t = convexTest(schema, modules);
    const { recruiterId } = await seed(t);
    const rec = as(t, recruiterId);
    const { jobId } = await rec.mutation(api.jobs.createJob, JOB);

    await expect(
      rec.mutation(api.jobs.deleteJob, { jobId }),
    ).rejects.toThrow(/encerradas ou suspensas/i);

    await rec.mutation(api.jobs.setJobStatus, { jobId, status: "encerrada" });
    await rec.mutation(api.jobs.deleteJob, { jobId });
    expect(await t.run(async (ctx) => ctx.db.get(jobId))).toBeNull();
  });

  it("recusar o recrutador suspende as vagas abertas; aprovar restaura", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, recruiterId } = await seed(t);
    const res = await as(t, recruiterId).mutation(api.jobs.createJob, JOB);
    const gestor = as(t, gestorId);

    await gestor.mutation(api.moderation.decideRecruiter, {
      recruiterId,
      decision: "recusado",
      reason: "LinkedIn não confere",
    });
    let job = await t.run(async (ctx) => ctx.db.get(res.jobId));
    expect(job?.status).toBe("suspensa");

    await gestor.mutation(api.moderation.decideRecruiter, {
      recruiterId,
      decision: "aprovado",
    });
    job = await t.run(async (ctx) => ctx.db.get(res.jobId));
    expect(job?.status).toBe("aberta");
  });
});