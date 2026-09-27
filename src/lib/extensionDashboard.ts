/**
 * [S7-4] Painel gestor de extensão — regras puras de agregação.
 *
 * CA 1 — contagens por área/status; CA 2 — filtros combináveis (área,
 * status, período) que atualizam as métricas de forma consistente.
 * Mesma filosofia da S5 (operationalPanel/dashboardFilters): arquivo
 * puro, sem I/O, sem React — a UI consome o contrato abaixo e a
 * reatividade vem das subscriptions do Convex (`listProjects`).
 *
 * O status exibido é o do acompanhamento da [S7-2] (`active`), e a
 * área segue o enum fixo do RESGES da [S7-1].
 */
import { EXTENSION_AREAS, type ExtensionArea } from "./extensionProject";

/** Filtros combináveis do painel (entrada da UI, pode ter ruído). */
export type ExtensionFiltersInput = {
  area?: string;
  status?: string;
  from?: number;
  to?: number;
};

/** Status de acompanhamento (espelha o toggle da [S7-2]). */
export type ExtensionStatusFilter = "ativo" | "inativo";

/** Filtros normalizados: só campos válidos e preenchidos. */
export type ExtensionDashboardFilters = {
  area?: ExtensionArea;
  status?: ExtensionStatusFilter;
  from?: number;
  to?: number;
};

const STATUSES: readonly ExtensionStatusFilter[] = ["ativo", "inativo"];

/** Normaliza a entrada: trim, remove vazios, descarta área/status inválidos. */
export function normalizeExtensionFilters(
  input: ExtensionFiltersInput,
): ExtensionDashboardFilters {
  const filters: ExtensionDashboardFilters = {};

  const area = input.area?.trim();
  if (
    area !== undefined &&
    (EXTENSION_AREAS as readonly string[]).includes(area)
  ) {
    filters.area = area as ExtensionArea;
  }

  const status = input.status?.trim();
  if (
    status !== undefined &&
    (STATUSES as readonly string[]).includes(status)
  ) {
    filters.status = status as ExtensionStatusFilter;
  }

  if (input.from !== undefined && input.from >= 0) filters.from = input.from;
  if (input.to !== undefined && input.to >= 0) filters.to = input.to;
  // Faixa inconsistente (from > to): descarta o período inteiro.
  if (
    filters.from !== undefined &&
    filters.to !== undefined &&
    filters.from > filters.to
  ) {
    delete filters.from;
    delete filters.to;
  }

  return filters;
}

/** Há pelo menos um filtro ativo? (base do botão "Limpar filtros") */
export function hasActiveExtensionFilters(
  filters: ExtensionDashboardFilters,
): boolean {
  return (
    filters.area !== undefined ||
    filters.status !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined
  );
}

/** Linha mínima de projeto para o painel (o que `listProjects` devolve). */
export type ExtensionProjectRow = {
  title: string;
  area: ExtensionArea;
  active: boolean;
  createdAt: number;
};

/**
 * Aplica os filtros combináveis (CA 2) a uma lista de projetos.
 * Período por `createdAt` com limites inclusivos; área e status são
 * igualdades exatas.
 */
export function filterProjectsForDashboard(
  projects: readonly ExtensionProjectRow[],
  filters: ExtensionDashboardFilters,
): ExtensionProjectRow[] {
  return projects.filter((project) => {
    if (filters.area !== undefined && project.area !== filters.area) {
      return false;
    }
    if (filters.status !== undefined) {
      const isActive = filters.status === "ativo";
      if (project.active !== isActive) return false;
    }
    if (filters.from !== undefined && project.createdAt < filters.from) {
      return false;
    }
    if (filters.to !== undefined && project.createdAt > filters.to) {
      return false;
    }
    return true;
  });
}

/** Contagem de projetos por área — sempre as 8 áreas (zeros incluídos). */
export function countByArea(
  projects: readonly ExtensionProjectRow[],
): Record<ExtensionArea, number> {
  const counts = Object.fromEntries(
    EXTENSION_AREAS.map((area) => [area, 0]),
  ) as Record<ExtensionArea, number>;
  for (const project of projects) {
    counts[project.area] += 1;
  }
  return counts;
}

/** Resumo por status — total é sempre a soma das categorias (consistência). */
export function countByStatus(projects: readonly ExtensionProjectRow[]): {
  ativo: number;
  inativo: number;
  total: number;
} {
  const ativo = projects.filter((project) => project.active).length;
  return { ativo, inativo: projects.length - ativo, total: projects.length };
}

/**
 * Visão-resumo dos KPIs do painel: totais + quantas das 8 áreas têm
 * pelo menos um projeto (cobertura temática do Setor).
 */
export function summarizeProjects(projects: readonly ExtensionProjectRow[]): {
  total: number;
  ativo: number;
  inativo: number;
  areasWithProjects: number;
} {
  const byStatus = countByStatus(projects);
  const byArea = countByArea(projects);
  return {
    total: byStatus.total,
    ativo: byStatus.ativo,
    inativo: byStatus.inativo,
    areasWithProjects: Object.values(byArea).filter((n) => n > 0).length,
  };
}
