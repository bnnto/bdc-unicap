import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  validateExtensionProject,
  type ExtensionProjectInput,
} from "../src/lib/extensionProject";
import { evaluateStatusChange } from "../src/lib/extensionProjectStatus";
import {
  isProjectPubliclyVisible,
  toPublicProjectView,
} from "../src/lib/extensionProjectPublic";
import { getCurrentUser } from "./lib/currentUser";

/**
 * [S7-1] Cadastro de projetos de extensão — CRUD no servidor.
 *
 * CA 1 — CRUD completo persistido em `extensionProjects` (upsert, list,
 * get e delete). CA 2 — validações básicas aplicadas NO SERVIDOR com a
 * mesma regra pura do formulário (src/lib/extensionProject.ts) — erros
 * claros independentes da UI.
 *
 * Guard (R7): usuário autenticado, com consentimento LGPD vigente e papel
 * de gestor do Setor de Extensão (o cadastro é operação administrativa;
 * a divulgação pública da [S7-3] terá a própria query aberta).
 */

/** Papel autorizado a administrar o cadastro de projetos de extensão. */
function canManageExtensionProjects(
  role: string | null | undefined,
): role is "gestor" {
  return role === "gestor";
}

/** Guard comum (R7 + papel): autenticado, consentimento vigente, gestor. */
async function requireExtensionManager(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const email = identity.email ?? identity.tokenIdentifier;
  const user = await getCurrentUser(ctx);
  if (user === null) throw new Error("Usuário não encontrado.");
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
  if (!active) {
    throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
  }
  if (!canManageExtensionProjects(user.role)) {
    throw new Error(
      "Apenas gestores administram o cadastro de projetos de extensão.",
    );
  }
  return user;
}

/** Converte os argumentos crus da mutation para o formato da regra pura. */
function toProjectInput(args: {
  title: string;
  description: string;
  coordinatorId: string;
  area: ExtensionProjectInput["area"];
  targetAudience: string;
}): ExtensionProjectInput {
  return {
    title: args.title,
    description: args.description,
    coordinatorId: args.coordinatorId,
    area: args.area,
    targetAudience: args.targetAudience,
  };
}

export const upsertProject = mutation({
  args: {
    projectId: v.optional(v.id("extensionProjects")),
    title: v.string(),
    description: v.string(),
    /** Id genérico (string): a existência do coordenador é verificada no handler. */
    coordinatorId: v.string(),
    area: v.union(
      v.literal("comunicacao"),
      v.literal("cultura"),
      v.literal("direitos_humanos_justica"),
      v.literal("educacao"),
      v.literal("meio_ambiente"),
      v.literal("saude"),
      v.literal("tecnologia_e_producao"),
      v.literal("trabalho"),
    ),
    targetAudience: v.string(),
  },
  handler: async (ctx, args) => {
    await requireExtensionManager(ctx);

    // CA 2 — validação completa no servidor (regra pura compartilhada).
    const validation = validateExtensionProject(toProjectInput(args));
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }
    const project = validation.normalized;

    // Referencial: o coordenador precisa existir na tabela `users`.
    const coordinatorId = project.coordinatorId as Id<"users">;
    const coordinator = await ctx.db.get(coordinatorId);
    if (coordinator === null) {
      throw new Error("Coordenador não encontrado.");
    }

    if (args.projectId !== undefined) {
      const existing = await ctx.db.get(args.projectId);
      if (existing === null) throw new Error("Projeto não encontrado.");
      await ctx.db.patch(args.projectId, { ...project, coordinatorId });
      return { projectId: args.projectId, created: false as const };
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("extensionProjects", {
      ...project,
      coordinatorId,
      createdAt: now,
      /** [S7-2] Recém-cadastrado nasce NÃO ativo, com a data registrada. */
      active: false,
      statusChangedAt: now,
    });
    return { projectId, created: true as const };
  },
});

/** Lista todos os projetos, mais recentes primeiro (painel gestor). */
export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    await requireExtensionManager(ctx);
    return ctx.db
      .query("extensionProjects")
      .withIndex("by_created_at")
      .order("desc")
      .collect();
  },
});

/** Detalhe de um projeto para edição/exibição. */
export const getProject = query({
  args: { projectId: v.id("extensionProjects") },
  handler: async (ctx, { projectId }) => {
    await requireExtensionManager(ctx);
    return ctx.db.get(projectId);
  },
});

/** Remove um projeto do cadastro. */
export const deleteProject = mutation({
  args: { projectId: v.id("extensionProjects") },
  handler: async (ctx, { projectId }) => {
    await requireExtensionManager(ctx);
    const existing = await ctx.db.get(projectId);
    if (existing === null) throw new Error("Projeto não encontrado.");
    await ctx.db.delete(projectId);
    return { ok: true as const };
  },
});

/**
 * [S7-2] Toggle de status ativo/não ativo com registro de data (CA).
 * A decisão (gravar? qual estado? qual timestamp?) vem da regra pura
 * `evaluateStatusChange`: sem mudança de estado é idempotente (nada é
 * gravado) e data anterior à última mudança é rejeitada no servidor.
 */
export const setStatus = mutation({
  args: {
    projectId: v.id("extensionProjects"),
    active: v.boolean(),
    changedAt: v.number(),
  },
  handler: async (ctx, { projectId, active, changedAt }) => {
    await requireExtensionManager(ctx);

    const project = await ctx.db.get(projectId);
    if (project === null) throw new Error("Projeto não encontrado.");

    const decision = evaluateStatusChange(
      { active: project.active, statusChangedAt: project.statusChangedAt },
      active,
      changedAt,
    );
    if (!decision.ok) {
      // Idempotente (sem mudança): nada a gravar, mantém o histórico.
      if (decision.errors.length === 0) {
        return { ok: true as const, changed: false as const };
      }
      throw new Error(decision.errors.join(" "));
    }

    await ctx.db.patch(projectId, {
      active: decision.active,
      statusChangedAt: decision.statusChangedAt,
    });
    return { ok: true as const, changed: true as const };
  },
});

/**
 * [S7-3] Divulgação pública de projetos ativos (R9) — SEM autenticação:
 * aberta a estudantes, professores e público externo.
 *
 * CA — lista apenas projetos ATIVOS ([S7-2] é a fonte do estado) e aplica
 * a projeção whitelist da regra pura (CA 2 da S7-3): a resposta carrega
 * SOMENTE campos públicos — `coordinatorId` e dados internos nunca saem
 * daqui. Projetos não ativos ficam ocultos (R1/R9); sem projetos, devolve
 * lista vazia (a página pública exibe o estado vazio orientador).
 */
export const listPublicProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("extensionProjects")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    return projects
      .filter((project) => isProjectPubliclyVisible(project))
      .map((project) => toPublicProjectView(project));
  },
});
