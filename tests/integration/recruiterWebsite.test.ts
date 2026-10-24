import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

const BASE = {
  email: "rita@empresa.com.br",
  name: "Rita Recrutadora",
  secret: "hash-simulado",
  consentTermVersion: CURRENT_TERM_VERSION,
};
const LINKEDIN = "https://www.linkedin.com/in/rita";

async function getUser(
  t: ReturnType<typeof convexTest>,
  id: string,
): Promise<Record<string, unknown> | null> {
  const user: unknown = await t.run(async (ctx) => {
    const doc: unknown = await ctx.db.get(id as never);
    return doc;
  });
  return user as Record<string, unknown> | null;
}

describe("site opcional do recrutador (cadastro)", () => {
  it("grava o site normalizado junto do LinkedIn quando informado", async () => {
    const t = convexTest({ schema, modules });
    const id = await t.mutation(internal.authHelpers.createUser, {
      ...BASE,
      role: "recrutador",
      publicSignup: true,
      linkedinUrl: LINKEDIN,
      website: "Acme.com.br/sobre/",
    });
    const user = await getUser(t, id);
    expect(user?.website).toBe("https://acme.com.br/sobre");
    expect(user?.linkedinUrl).toBe(LINKEDIN);
    expect(user?.approvalStatus).toBe("pendente");
  });

  it("sem site o cadastro funciona e nenhum valor é gravado", async () => {
    const t = convexTest({ schema, modules });
    const id = await t.mutation(internal.authHelpers.createUser, {
      ...BASE,
      role: "recrutador",
      publicSignup: true,
      linkedinUrl: LINKEDIN,
    });
    const user = await getUser(t, id);
    expect(user?.website).toBeUndefined();
    expect(user?.approvalStatus).toBe("pendente");
  });

  it("site inválido é recusado no servidor (o front não é a única barreira)", async () => {
    const t = convexTest({ schema, modules });
    await expect(
      t.mutation(internal.authHelpers.createUser, {
        ...BASE,
        role: "recrutador",
        publicSignup: true,
        linkedinUrl: LINKEDIN,
        website: "javascript:alert(1)",
      }),
    ).rejects.toThrow(/site válido/i);
  });

  it("aluno não grava site, mesmo que alguém envie o campo", async () => {
    const t = convexTest({ schema, modules });
    const id = await t.mutation(internal.authHelpers.createUser, {
      ...BASE,
      email: "aluno@unicap.br",
      role: "aluno",
      publicSignup: true,
      website: "https://acme.com.br",
    });
    const user = await getUser(t, id);
    expect(user?.website).toBeUndefined();
    expect(user?.approvalStatus).toBeUndefined();
  });
});
