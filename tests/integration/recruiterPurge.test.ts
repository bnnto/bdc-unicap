import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");
const DAY = 24 * 60 * 60 * 1000;

type World = ReturnType<typeof convexTest>;

async function newRecruiter(t: World, email: string) {
  return t.mutation(internal.authHelpers.createUser, {
    email,
    name: "Recrutador",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
    publicSignup: true,
    linkedinUrl: "https://www.linkedin.com/in/fulano",
  });
}

describe("Retenção de recrutadores", () => {
  it("apaga recusado antigo sem vagas e preserva os demais", async () => {
    const t = convexTest(schema, modules);
    const oldRefused = await newRecruiter(t, "a@x.com");
    const recentRefused = await newRecruiter(t, "b@x.com");
    const withJob = await newRecruiter(t, "c@x.com");

    await t.run(async (ctx) => {
      await ctx.db.patch(oldRefused, {
        approvalStatus: "recusado",
        approvalReviewedAt: Date.now() - 200 * DAY,
      });
      await ctx.db.patch(recentRefused, {
        approvalStatus: "recusado",
        approvalReviewedAt: Date.now() - 10 * DAY,
      });
      await ctx.db.patch(withJob, {
        approvalStatus: "recusado",
        approvalReviewedAt: Date.now() - 200 * DAY,
      });
      await ctx.db.insert("jobs", {
        recruiterId: withJob,
        title: "Vaga antiga",
        description: "Descrição qualquer da vaga antiga.",
        prerequisites: [],
        contractType: "estagio",
        status: "encerrada",
      });
    }); 

    const result = await t.mutation(internal.moderation.purgeStaleRecruiters, {});
    expect(result.refused).toBe(1);
    expect(result.skipped).toBe(1);

    const left = await t.run(async (ctx) => ({
      old: await ctx.db.get(oldRefused),
      recent: await ctx.db.get(recentRefused),
      job: await ctx.db.get(withJob),
      users: await ctx.db.query("users").collect(),
      consents: await ctx.db.query("consents").collect(),
    }));
    expect(left.old).toBeNull();
    expect(left.recent).not.toBeNull();
    expect(left.job).not.toBeNull();
    // Sobraram só os 2 recrutadores mantidos (o antigo foi apagado).
    expect(left.users.map((u) => u.email).sort()).toEqual([
      "b@x.com",
      "c@x.com",
    ]);
    // O consentimento do apagado também saiu: sobram 2.
    expect(left.consents).toHaveLength(2);
  });

  it("apaga pendente esquecido há mais de 90 dias", async () => {
    const t = convexTest(schema, modules);
    const stale = await newRecruiter(t, "d@x.com");
    const fresh = await newRecruiter(t, "e@x.com");
    expect([stale, fresh]).toHaveLength(2);
    const result = await t.mutation(internal.moderation.purgeStaleRecruiters, {});
    expect(result.pending).toBe(0);
  });
});