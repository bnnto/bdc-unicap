/**
 * Filtros combináveis do dashboard (issue [S5-5]) — regras puras.
 *
 * CA 1 — filtros combináveis (período, curso, empresa e status) que
 * atualizam TODAS as métricas reativamente: as queries do painel recebem
 * esses filtros e aplicam as mesmas regras (definidas aqui) a cada
 * métrica — vagas por status/empregabilidade/funil/rankings/TTH.
 *
 * Convenções dos filtros:
 * - período (`from`/`to`): aplicado sobre a data relevante de cada
 *   métrica (publicação para vagas, candidatura para candidaturas,
 *   preenchimento para amostras de TTH — já existente na S5-2);
 * - curso: filtra candidaturas pelo curso do aluno (via servidor);
 * - empresa: filtra vagas/candidaturas pelo recrutador responsável;
 * - status: filtra vagas pelo ciclo de vida e candidaturas pela vaga.
 *
 * Arquivo puro (sem I/O, sem React) — consumido pelas queries Convex
 * e pela UI (normalização + estado "limpar filtros").
 */

/** Filtros combináveis do dashboard (entrada da UI, pode ter ruído). */
export type DashboardFiltersInput = {
  from?: number;
  to?: number;
  course?: string;
  company?: string;
  status?: string;
};

/** Status do ciclo de vida da vaga (espelha convex/schema.ts). */
export type DashboardJobStatus = "aberta" | "fechada" | "encerrada";

/** Filtros normalizados: só campos válidos e preenchidos. */
export type DashboardFilters = {
  from?: number;
  to?: number;
  course?: string;
  company?: string;
  status?: DashboardJobStatus;
};

const JOB_STATUSES: readonly DashboardJobStatus[] = [
  "aberta",
  "fechada",
  "encerrada",
];

/** Normaliza a entrada: trim, remove vazios e descarta status inválido. */
export function normalizeDashboardFilters(
  input: DashboardFiltersInput,
): DashboardFilters {
  const filters: DashboardFilters = {};
  if (input.from !== undefined) filters.from = input.from;
  if (input.to !== undefined) filters.to = input.to;

  const course = input.course?.trim();
  if (course !== undefined && course !== "") filters.course = course;

  const company = input.company?.trim();
  if (company !== undefined && company !== "") filters.company = company;

  const status = input.status?.trim();
  if (
    status !== undefined &&
    (JOB_STATUSES as readonly string[]).includes(status)
  ) {
    filters.status = status as DashboardJobStatus;
  }

  return filters;
}

/** Há pelo menos um filtro ativo? (base do botão "Limpar filtros") */
export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.course !== undefined ||
    filters.company !== undefined ||
    filters.status !== undefined
  );
}

/** Linha mínima de vaga para os filtros do dashboard. */
export type DashboardJobRow = {
  jobId: string;
  status: DashboardJobStatus;
  publishedAt?: number;
};

/**
 * Aplica status + período (por `publishedAt`) a uma lista de vagas.
 * Sem filtro de período, vagas sem `publishedAt` permanecem; com filtro,
 * saem (não é possível verificar a faixa).
 */
export function filterJobsForDashboard(
  jobs: readonly DashboardJobRow[],
  filters: DashboardFilters,
): DashboardJobRow[] {
  return jobs.filter((job) => {
    if (filters.status !== undefined && job.status !== filters.status) {
      return false;
    }
    if (filters.from !== undefined || filters.to !== undefined) {
      if (job.publishedAt === undefined) return false;
      if (filters.from !== undefined && job.publishedAt < filters.from) {
        return false;
      }
      if (filters.to !== undefined && job.publishedAt > filters.to) {
        return false;
      }
    }
    return true;
  });
}

/** Linha mínima de candidatura para os filtros do dashboard. */
export type DashboardApplicationRow = {
  jobId: string;
  stage: import("./application").ApplicationStage;
  appliedAt: number;
};

/**
 * Aplica status (via vaga) + período (por `appliedAt`) a candidaturas.
 * `jobStatusById` é o mapa jobId → status fornecido pelo servidor;
 * com filtro de status, candidaturas de vagas desconhecidas saem.
 */
export function filterApplicationsForDashboard(
  applications: readonly DashboardApplicationRow[],
  jobStatusById: ReadonlyMap<string, DashboardJobStatus>,
  filters: DashboardFilters,
): DashboardApplicationRow[] {
  return applications.filter((application) => {
    if (filters.status !== undefined) {
      if (jobStatusById.get(application.jobId) !== filters.status) {
        return false;
      }
    }
    if (filters.from !== undefined && application.appliedAt < filters.from) {
      return false;
    }
    if (filters.to !== undefined && application.appliedAt > filters.to) {
      return false;
    }
    return true;
  });
}
