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

async function signUp(t: World) {
  return t.mutation(internal.authHelpers.createUser, {
    email: "golpista@empresa.com",
    name: "Fulano",
    role: "recrutador",
    secret: "hash",
    consentTermVersion: CURRENT_TERM_VERSION,
    publicSignup: true,
    linkedinUrl: "https://www.linkedin.com/in/fulano",
  });
}

describe("Reincidência de recrutador", () => {
  it("quem apaga a conta recusada e volta com o mesmo e-mail é sinalizado", async () => {
    const t = convexTest(schema, modules);
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
    const gestor = as(t, gestorId);

    const first = await signUp(t);
    await gestor.mutation(api.moderation.decideRecruiter, {
      recruiterId: first,
      decision: "recusado",
      reason: "LinkedIn não confere",
    });

    // Na própria conta recusada não há aviso (eventos da conta atual ficam de fora).
    let rows = await gestor.query(api.moderation.listRecruiters, {
      status: "recusado",
    });
    expect(rows.find((r) => r.userId === first)?.previousCount).toBe(0);

    // Apaga a conta e se recadastra com o mesmo e-mail.
    await as(t, first).mutation(api.users.deleteMyAccount, {});
    const second = await signUp(t);

    rows = await gestor.query(api.moderation.listRecruiters, {
      status: "pendente",
    });
    const row = rows.find((r) => r.userId === second);
    expect(row?.previousCount).toBe(2); // recusa + exclusão da conta
    expect(row?.previous.map((p) => p.action)).toEqual(
      expect.arrayContaining(["recusado", "conta_excluida"]),
    );
  });

  it("recrutador novo, sem histórico, não é sinalizado", async () => {
    const t = convexTest(schema, modules);
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
    const id = await signUp(t);
    const rows = await as(t, gestorId).query(api.moderation.listRecruiters, {});
    expect(rows.find((r) => r.userId === id)?.previousCount).toBe(0);
  });
});