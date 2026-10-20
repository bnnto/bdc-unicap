import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

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
    name: "Recrutador Novo",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
    publicSignup: true,
    linkedinUrl: "https://www.linkedin.com/in/joao-silva",
  });
  return { gestorId, recruiterId };
}

describe("Moderação de recrutadores", () => {
  it("gestor lista pendentes e aprova", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, recruiterId } = await seed(t);
    const gestor = as(t, gestorId);

    const pending = await gestor.query(api.moderation.listRecruiters, {});
    expect(pending.map((r) => r.userId)).toContain(recruiterId);
    expect(await gestor.query(api.moderation.pendingRecruiterCount, {})).toBe(1);

    await gestor.mutation(api.moderation.decideRecruiter, {
      recruiterId,
      decision: "aprovado",
    });
    const user = await t.run(async (ctx) => ctx.db.get(recruiterId));
    expect(user?.approvalStatus).toBe("aprovado");
    expect(user?.approvalReviewedBy).toBe(gestorId);
  });

  it("recusar exige motivo e grava o motivo", async () => {
    const t = convexTest(schema, modules);
    const { gestorId, recruiterId } = await seed(t);
    const gestor = as(t, gestorId);

    await expect(
      gestor.mutation(api.moderation.decideRecruiter, {
        recruiterId,
        decision: "recusado",
      }),
    ).rejects.toThrow(/motivo/i);

    await gestor.mutation(api.moderation.decideRecruiter, {
      recruiterId,
      decision: "recusado",
      reason: "LinkedIn não confere com a empresa",
    });
    const user = await t.run(async (ctx) => ctx.db.get(recruiterId));
    expect(user?.approvalStatus).toBe("recusado");
    expect(user?.approvalReason).toMatch(/linkedin/i);
  });

  it("recrutador não acessa as funções do gestor", async () => {
    const t = convexTest(schema, modules);
    const { recruiterId } = await seed(t);
    await t.run(async (ctx) =>
      ctx.db.patch(recruiterId, { approvalStatus: "aprovado" }),
    );
    await expect(
      as(t, recruiterId).mutation(api.moderation.decideRecruiter, {
        recruiterId,
        decision: "aprovado",
      }),
    ).rejects.toThrow(/gestores/i);
  });

  it("empresas parceiras ignoram recrutador pendente", async () => {
    const t = convexTest(schema, modules);
    const { gestorId } = await seed(t);
    const partners = await as(t, gestorId).query(
      api.manager.getPartnerCompanies,
      {},
    );
    expect(partners).toHaveLength(0);
  });
});