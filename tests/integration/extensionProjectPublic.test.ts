/**
 * [S7-3] Testes de INTEGRAÇÃO da divulgação pública — query
 * `extensionProjects.listPublicProjects` contra o mock oficial do backend
 * Convex (convex-test).
 *
 * R9 — a divulgação é pública (SEM autenticação) e lista apenas projetos
 * ativos; CA 2 — a resposta contém exclusivamente os campos públicos
 * (projeção whitelist no servidor).
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
    await ctx.db.insert("consents", {
      userId: managerId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    return { managerId, coordinatorUserId };
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

describe("S7-3 — divulgação pública de projetos ativos (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("R9 — query pública funciona SEM autenticação", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    const { projectId } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );
    await identity.mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: Date.now() + 60_000,
    });

    const projects = await t.query(
      api.extensionProjects.listPublicProjects,
      {},
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe(VALID_INPUT.title);
  });

  it("R9 — lista apenas projetos ATIVOS; não ativos ficam ocultos", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    const { projectId: activeId } = await identity.mutation(
      api.extensionProjects.upsertProject,
      {
        ...VALID_INPUT,
        coordinatorId: coordinatorUserId,
        title: "Projeto Ativo de Extensão",
      },
    );
    await identity.mutation(api.extensionProjects.setStatus, {
      projectId: activeId,
      active: true,
      changedAt: Date.now() + 60_000,
    });

    // Segundo projeto permanece no estado de nascimento: NÃO ativo.
    await identity.mutation(api.extensionProjects.upsertProject, {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Projeto Inativo de Extensão",
    });

    const projects = await t.query(
      api.extensionProjects.listPublicProjects,
      {},
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]?.title).toBe("Projeto Ativo de Extensão");
  });

  it("CA 2 — resposta contém APENAS campos públicos (whitelist)", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    const { projectId } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );
    await identity.mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: Date.now() + 60_000,
    });

    const projects = await t.query(
      api.extensionProjects.listPublicProjects,
      {},
    );
    expect(Object.keys(projects[0] as object).sort()).toEqual([
      "area",
      "createdAt",
      "description",
      "statusChangedAt",
      "targetAudience",
      "title",
    ]);
    expect(projects[0]).not.toHaveProperty("coordinatorId");
    expect(projects[0]).not.toHaveProperty("_id");
  });

  it("R9 — mais recentes primeiro (createdAt desc)", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    await identity.mutation(api.extensionProjects.upsertProject, {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Primeiro Projeto Publicado",
    });
    await identity.mutation(api.extensionProjects.upsertProject, {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Segundo Projeto Publicado",
    });
    // Ativa ambos para ficarem visíveis.
    const projects = await t.run(async (ctx) =>
      ctx.db.query("extensionProjects").collect(),
    );
    for (const project of projects) {
      await identity.mutation(api.extensionProjects.setStatus, {
        projectId: project._id,
        active: true,
        changedAt: Date.now() + 60_000,
      });
    }

    const publicProjects = await t.query(
      api.extensionProjects.listPublicProjects,
      {},
    );
    expect(publicProjects).toHaveLength(2);
    expect(publicProjects[0]?.title).toBe("Segundo Projeto Publicado");
    expect(publicProjects[1]?.title).toBe("Primeiro Projeto Publicado");
  });

  it("R9 — sem projetos ativos devolve lista vazia (não erro)", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    const projects = await t.query(
      api.extensionProjects.listPublicProjects,
      {},
    );
    expect(projects).toEqual([]);
  });
});
