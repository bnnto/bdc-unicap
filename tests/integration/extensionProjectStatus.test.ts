/**
 * [S7-2] Testes de INTEGRAÇÃO do toggle de status — mutations/queries
 * `extensionProjects.setStatus` contra o mock oficial do backend Convex
 * (convex-test), com identidades autenticadas.
 *
 * CA — toggle de status registrado com timestamp: grava `active` e
 * `statusChangedAt`, é idempotente, valida a data no servidor, exige
 * guard R7/papel gestor e preserva os dados do cadastro (S7-1).
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

/**
 * Datas SEMPRE futuras em relação ao `statusChangedAt` de nascimento do
 * projeto (a mutation grava `Date.now()` na criação), com margem larga
 * para o tempo de execução da suíte.
 */
const T0 = Date.now() + 60_000;
const T1 = T0 + 5_000;

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

describe("S7-2 — toggle de status do projeto de extensão (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA — projeto recém-cadastrado nasce não ativo com data registrada", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project?.active).toBe(false);
    expect(typeof project?.statusChangedAt).toBe("number");
  });

  it("CA — ativação grava active=true e o timestamp informado", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T1,
    });

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project?.active).toBe(true);
    expect(project?.statusChangedAt).toBe(T1);
  });

  it("CA — desativação grava active=false e atualiza o timestamp", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T0,
    });
    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: false,
      changedAt: T1,
    });

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project?.active).toBe(false);
    expect(project?.statusChangedAt).toBe(T1);
  });

  it("CA — toggle sem mudança de estado não altera o timestamp (idempotente)", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T0,
    });
    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T1,
    });

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project?.active).toBe(true);
    expect(project?.statusChangedAt).toBe(T0);
  });

  it("CA — data anterior à última mudança é rejeitada no servidor", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T1,
    });

    await expect(
      asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
        projectId,
        active: false,
        changedAt: T0,
      }),
    ).rejects.toThrow(/data/i);
  });

  it("CA — projeto inexistente é rejeitado", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    // ID real da tabela (o validador do Convex rejeita ids fabricados).
    const { projectId } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );
    await identity.mutation(api.extensionProjects.deleteProject, { projectId });

    await expect(
      identity.mutation(api.extensionProjects.setStatus, {
        projectId,
        active: true,
        changedAt: T1,
      }),
    ).rejects.toThrow(/Projeto não encontrado/i);
  });

  it("guard de papel — aluno não altera status de projeto", async () => {
    const t = convexTest(schema, modules);
    const { managerId, studentUserId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await expect(
      asStudent(t, studentUserId).mutation(api.extensionProjects.setStatus, {
        projectId,
        active: true,
        changedAt: T1,
      }),
    ).rejects.toThrow(/gestor/i);
  });

  it("guard R7 — gestor sem consentimento vigente não altera status", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

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
      asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
        projectId,
        active: true,
        changedAt: T1,
      }),
    ).rejects.toThrow(/Consentimento/i);
  });

  it("guard R7 — sem autenticação não consulta o status", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await expect(
      t.query(api.extensionProjects.getProject, { projectId }),
    ).rejects.toThrow(/Não autenticado/i);
  });

  it("CA — upsert de edição (S7-1) preserva o status vigente", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);

    const { projectId } = await asManager(t, managerId).mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await asManager(t, managerId).mutation(api.extensionProjects.setStatus, {
      projectId,
      active: true,
      changedAt: T0,
    });

    await asManager(t, managerId).mutation(
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

    const project = await t.run((ctx) => ctx.db.get(projectId));
    expect(project?.title).toBe("Escola de Verão de Computação — Edição 2026");
    expect(project?.active).toBe(true);
    expect(project?.statusChangedAt).toBe(T0);
  });

  it("CA — listProjects expõe active e statusChangedAt de cada projeto", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    const identity = asManager(t, managerId);

    const { projectId: first } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );
    const { projectId: second } = await identity.mutation(
      api.extensionProjects.upsertProject,
      { ...VALID_INPUT, coordinatorId: coordinatorUserId },
    );

    await identity.mutation(api.extensionProjects.setStatus, {
      projectId: first,
      active: true,
      changedAt: T1,
    });

    const projects = await identity.query(
      api.extensionProjects.listProjects,
      {},
    );
    expect(projects).toHaveLength(2);
    const firstRow = projects.find((p) => p._id === first);
    const secondRow = projects.find((p) => p._id === second);
    expect(firstRow?.active).toBe(true);
    expect(firstRow?.statusChangedAt).toBe(T1);
    expect(secondRow?.active).toBe(false);
  });
});
