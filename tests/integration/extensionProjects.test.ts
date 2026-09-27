/**
 * [S7-1] Testes de INTEGRAÇÃO do CRUD de projetos de extensão —
 * mutations/queries `extensionProjects.*` contra o mock oficial do
 * backend Convex (convex-test), com identidades autenticadas.
 *
 * CAs: CRUD completo persistido em `extensionProjects` (CA 1) e
 * validações básicas aplicadas no SERVIDOR (CA 2), com guard R7
 * (consentimento vigente) e papel gestor do Setor de Extensão.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const MANAGER = { email: "gestor.extensao@unicap.br", subject: "gestor-ext-1" };
const COORDINATOR = { email: "coordenador@unicap.br", subject: "coord-1" };
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };

const VALID_INPUT = {
  title: "Escola de Verão de Computação para Escolas Públicas",
  description:
    "Oficinas de programação para estudantes de escolas públicas do Recife.",
  coordinatorId: "" as Id<"users">,
  area: "educacao" as const,
  targetAudience: "Estudantes do ensino médio da rede pública",
};

async function seedWorld(t: World) {
  return t.run(async (ctx) => {
    const managerId = await ctx.db.insert("users", {
      email: MANAGER.email,
      name: "Gestor de Extensão",
      role: "gestor",
      active: true,
    });
    const coordinatorUserId = await ctx.db.insert("users", {
      email: COORDINATOR.email,
      name: "Profa. Ana Coordenadora",
      role: "gestor",
      active: true,
    });
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    for (const userId of [managerId, coordinatorUserId, studentUserId]) {
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    return { managerId, coordinatorUserId, studentUserId };
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

describe("S7-1 — CRUD de projetos de extensão (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — create persiste o projeto com campos normalizados", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project).not.toBeNull();
    expect(project?.title).toBe(VALID_INPUT.title);
    expect(project?.description).toBe(VALID_INPUT.description);
    expect(project?.coordinatorId).toBe(coordinatorUserId);
    expect(project?.area).toBe("educacao");
    expect(project?.targetAudience).toBe(VALID_INPUT.targetAudience);
    expect(typeof project?.createdAt).toBe("number");
  });

  it("CA 1 — update (patch) altera os campos sem duplicar o projeto", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    const result = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      {
        projectId,
        title: "Escola de Verão de Computação — Edição 2026",
        description: VALID_INPUT.description,
        coordinatorId: coordinatorUserId,
        area: "tecnologia_e_producao" as const,
        targetAudience: VALID_INPUT.targetAudience,
      },
    );
    expect(result.created).toBe(false);
    expect(result.projectId).toBe(projectId);

    const projects = await asManager(t, managerId).query(
      api.extensionProjects.listProjects,
      {},
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe(
      "Escola de Verão de Computação — Edição 2026",
    );
    expect(projects[0]?.area).toBe("tecnologia_e_producao");
  });

  it("CA 1 — listProjects devolve os projetos, mais recentes primeiro", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const identity = asManager(t, managerId);
    await identity.mutation(api.extensionProjects.upsertProject, {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Primeiro Projeto de Extensão",
    });
    await identity.mutation(api.extensionProjects.upsertProject, {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Segundo Projeto de Extensão",
      area: "saude" as const,
    });

    const projects = await identity.query(
      api.extensionProjects.listProjects,
      {},
    );
    expect(projects).toHaveLength(2);
    expect(projects[0]?.title).toBe("Segundo Projeto de Extensão");
    expect(projects[1]?.title).toBe("Primeiro Projeto de Extensão");
  });

  it("CA 1 — getProject devolve o detalhe e deleteProject remove", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    const { projectId } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    const detail = await identity.query(api.extensionProjects.getProject, {
      projectId,
    });
    expect(detail?.title).toBe(VALID_INPUT.title);

    await identity.mutation(api.extensionProjects.deleteProject, { projectId });

    const afterDelete = await t.run((ctx) => ctx.db.get(projectId));
    expect(afterDelete).toBeNull();
    const remaining = await identity.query(
      api.extensionProjects.listProjects,
      {},
    );
    expect(remaining).toHaveLength(0);
  });

  it("CA 2 — validação no servidor rejeita título curto", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    await expect(
      asManager(t, managerId).mutation(api.extensionProjects.upsertProject, {
        ...VALID_INPUT,
        coordinatorId: coordinatorUserId,
        title: "abc",
      }),
    ).rejects.toThrow(/título/i);
  });

  it("CA 2 — coordenador inexistente é rejeitado no servidor", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    await expect(
      asManager(t, managerId).mutation(api.extensionProjects.upsertProject, {
        ...VALID_INPUT,
        coordinatorId: "jx0000000000000000000000000",
      }),
    ).rejects.toThrow(/coordenador/i);
  });

  it("guard R7 — gestor sem consentimento vigente é rejeitado", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    await t.run(async (ctx) => {
      const consents = await ctx.db
        .query("consents")
        .filter((q) => q.eq(q.field("userId"), managerId))
        .collect();
      for (const consent of consents) {
        await ctx.db.delete(consent._id);
      }
    });

    await expect(
      asManager(t, managerId).mutation(api.extensionProjects.upsertProject, {
        ...VALID_INPUT,
        coordinatorId: coordinatorUserId,
      }),
    ).rejects.toThrow(/Consentimento/i);
  });

  it("guard de papel — aluno não cadastra projetos de extensão", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId, coordinatorUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).mutation(
        api.extensionProjects.upsertProject,
        { ...VALID_INPUT, coordinatorId: coordinatorUserId },
      ),
    ).rejects.toThrow(/gestor/i);
  });

  it("guard R7 — sem autenticação não lista projetos", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    await expect(
      t.query(api.extensionProjects.listProjects, {}),
    ).rejects.toThrow(/Não autenticado/i);
  });
});
