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

async function signUpRecruiter(
  t: World,
  extra: { publicSignup?: boolean; linkedinUrl?: string },
) {
  return t.mutation(internal.authHelpers.createUser, {
    email: "rec@empresa.com",
    name: "Recrutador Novo",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
    ...extra,
  });
}

describe("Aprovação de recrutador", () => {
  it("cadastro público sem LinkedIn válido é rejeitado", async () => {
    const t = convexTest(schema, modules);
    await expect(signUpRecruiter(t, { publicSignup: true })).rejects.toThrow(
      /linkedin/i,
    );
    await expect(
      signUpRecruiter(t, {
        publicSignup: true,
        linkedinUrl: "https://example.com/in/x",
      }),
    ).rejects.toThrow(/linkedin/i);
  });

  it("cadastro público nasce pendente e não publica vaga", async () => {
    const t = convexTest(schema, modules);
    const id = await signUpRecruiter(t, {
      publicSignup: true,
      linkedinUrl: "https://www.linkedin.com/in/joao-silva",
    });
    const user = await t.run(async (ctx) => ctx.db.get(id));
    expect(user?.approvalStatus).toBe("pendente");
    await expect(
      as(t, id).mutation(api.jobs.createJob, JOB),
    ).rejects.toThrow(/não foi aprovado/i);
  });

  it("recrutador aprovado publica; recusado fica bloqueado", async () => {
    const t = convexTest(schema, modules);
    const id = await signUpRecruiter(t, {
      publicSignup: true,
      linkedinUrl: "https://www.linkedin.com/in/joao-silva",
    });
    await t.run(async (ctx) => ctx.db.patch(id, { approvalStatus: "aprovado" }));
    const res = await as(t, id).mutation(api.jobs.createJob, JOB);
    expect(res.created).toBe(true);

    await t.run(async (ctx) => ctx.db.patch(id, { approvalStatus: "recusado" }));
    await expect(
      as(t, id).mutation(api.jobs.createJob, JOB),
    ).rejects.toThrow(/não foi aprovado/i);
  });

  it("recrutador legado (sem approvalStatus) segue aprovado", async () => {
    const t = convexTest(schema, modules);
    const id = await signUpRecruiter(t, {});
    const user = await t.run(async (ctx) => ctx.db.get(id));
    expect(user?.approvalStatus).toBeUndefined();
    const res = await as(t, id).mutation(api.jobs.createJob, JOB);
    expect(res.created).toBe(true);
  });
});