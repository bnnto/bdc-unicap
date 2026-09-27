/**
 * [S7-4] Testes de INTEGRAÇÃO do painel gestor de extensão — a fonte de
 * dados é a query `extensionProjects.listProjects` (guard R7/papel
 * gestor, reativa); o painel agrega com as regras puras da S7-4.
 *
 * CAs: contagens por área/status (CA 1) e filtros combináveis aplicados
 * sobre dados reais do banco (CA 2), com o guard R7 impedindo acesso de
 * não gestores.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";
import {
  countByArea,
  countByStatus,
  filterProjectsForDashboard,
} from "../../src/lib/extensionDashboard";

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

/** Semeia 3 projetos (2 educação ativos, 1 saúde não ativo). */
async function seedProjects(
  t: World,
  managerId: string,
  coordinatorUserId: Id<"users">,
) {
  const identity = asManager(t, managerId);
  await identity.mutation(api.extensionProjects.upsertProject, {
    ...VALID_INPUT,
    coordinatorId: coordinatorUserId,
    title: "Projeto A de Extensão",
    area: "educacao" as const,
  });
  const { projectId: bId } = await identity.mutation(
    api.extensionProjects.upsertProject,
    {
      ...VALID_INPUT,
      coordinatorId: coordinatorUserId,
      title: "Projeto B de Extensão",
      area: "saude" as const,
    },
  );
  await identity.mutation(api.extensionProjects.upsertProject, {
    ...VALID_INPUT,
    coordinatorId: coordinatorUserId,
    title: "Projeto C de Extensão",
    area: "educacao" as const,
  });
  await identity.mutation(api.extensionProjects.setStatus, {
    projectId: bId,
    active: true,
    changedAt: Date.now() + 60_000,
  });
}

describe("S7-4 — painel gestor de extensão (integração)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — contagens por área/status sobre os dados do banco", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    await seedProjects(t, managerId, coordinatorUserId);

    const projects = await asManager(t, managerId).query(
      api.extensionProjects.listProjects,
      {},
    );

    expect(projects).toHaveLength(3);
    const byArea = countByArea(projects);
    expect(byArea["educacao"]).toBe(2);
    expect(byArea["saude"]).toBe(1);
    const byStatus = countByStatus(projects);
    expect(byStatus).toEqual({ ativo: 1, inativo: 2, total: 3 });
  });

  it("CA 2 — filtros combináveis aplicados aos dados reais", async () => {
    const t = convexTest(schema, modules);
    const { managerId, coordinatorUserId } = await seedWorld(t);
    await seedProjects(t, managerId, coordinatorUserId);

    const projects = await asManager(t, managerId).query(
      api.extensionProjects.listProjects,
      {},
    );

    const onlyEducation = filterProjectsForDashboard(projects, {
      area: "educacao",
    });
    expect(onlyEducation).toHaveLength(2);

    const onlyActive = filterProjectsForDashboard(projects, {
      status: "ativo",
    });
    expect(onlyActive).toHaveLength(1);
    expect(onlyActive[0]?.title).toBe("Projeto B de Extensão");

    const combined = filterProjectsForDashboard(projects, {
      area: "educacao",
      status: "inativo",
    });
    expect(combined).toHaveLength(2);
  });

  it("guard R7 — aluno não consegue a fonte de dados do painel", async () => {
    const t = convexTest(schema, modules);
    const { studentUserId } = await seedWorld(t);

    await expect(
      asStudent(t, studentUserId).query(api.extensionProjects.listProjects, {}),
    ).rejects.toThrow(/gestor/i);
  });

  it("guard R7 — sem autenticação não há dados do painel", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);

    await expect(
      t.query(api.extensionProjects.listProjects, {}),
    ).rejects.toThrow(/Não autenticado/i);
  });
});
