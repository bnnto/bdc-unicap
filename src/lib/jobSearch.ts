/**
 * [REFACTOR_ALUNO Etapa 3] — Regras puras (TDD) do Mural de Oportunidades
 * estilo LinkedIn: filtros combináveis (busca por cargo/skill, contrato,
 * localidade, salário mínimo, match mínimo) e ordenação do feed.
 *
 * O percentual de compatibilidade (`matchScore`) chega PRONTO do servidor
 * (R8 — calculado em `applications.openJobs`); aqui só filtramos/ordenamos.
 */
import type { ContractType } from "./job";

export type MuralJob = {
  title: string;
  description: string;
  /** String genérica p/ aceitar o union do schema sem redundância. */
  contractType: string;
  location?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  matchScore?: number | null;
  publishedAt?: number;
  prerequisites?: ReadonlyArray<{ item: string; required: boolean }>;
};

export type OpenJobFilters = {
  /** Busca textual por cargo/skill/palavra-chave (vazio = sem filtro). */
  query: string;
  /** Tipo de contrato ou "todos". */
  contract: ContractType | "todos";
  /** Substring de localidade (vazio = sem filtro). */
  location: string;
  /** Piso salarial desejado; null = sem filtro. */
  minSalary: number | null;
  /** Compatibilidade mínima (score do servidor); null = sem filtro. */
  minMatch: number | null;
};

export const DEFAULT_JOB_FILTERS: OpenJobFilters = {
  query: "",
  contract: "todos",
  location: "",
  minSalary: null,
  minMatch: null,
};

/** Minúsculas sem acento — mesma tolerância do matching/mural. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Score máximo da vaga (usa o piso quando só ele existe). */
function salaryCeiling(job: MuralJob): number | null {
  const max = job.salaryMax ?? job.salaryMin ?? null;
  return max;
}

function matchesQuery(job: MuralJob, rawQuery: string): boolean {
  const query = normalize(rawQuery);
  if (query.length === 0) return true;
  const haystack = [
    job.title,
    job.description,
    ...(job.prerequisites ?? []).map((p) => p.item),
  ].join(" ");
  return normalize(haystack).includes(query);
}

/**
 * Aplica TODOS os filtros em E (AND). Vaga sem dado filtrável (ex. sem
 * salário publicado) não passa no filtro correspondente — o aluno não
 * deve ver algo que não atende ao critério escolhido.
 */
export function filterOpenJobs<T extends MuralJob>(
  jobs: readonly T[],
  filters: OpenJobFilters,
): T[] {
  return jobs.filter((job) => {
    if (!matchesQuery(job, filters.query)) return false;

    if (filters.contract !== "todos" && job.contractType !== filters.contract) {
      return false;
    }

    const location = normalize(filters.location);
    if (location.length > 0) {
      if (job.location === undefined || job.location === null) return false;
      if (!normalize(job.location).includes(location)) return false;
    }

    if (filters.minSalary !== null) {
      const ceiling = salaryCeiling(job);
      if (ceiling === null || ceiling < filters.minSalary) return false;
    }

    if (filters.minMatch !== null) {
      if (job.matchScore === undefined || job.matchScore === null) return false;
      if (job.matchScore < filters.minMatch) return false;
    }

    return true;
  });
}

export type JobSortOrder = "compatibilidade" | "recentes";

/**
 * Ordenação do feed: compatibilidade (match desc — score nulo por último)
 * ou mais recentes (publishedAt desc). Sort estável do JS preserva a
 * ordem do servidor entre empates.
 */
export function sortOpenJobs<T extends MuralJob>(
  jobs: readonly T[],
  order: JobSortOrder,
): T[] {
  const list = [...jobs];
  if (order === "recentes") {
    return list.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  }
  return list.sort((a, b) => {
    const scoreA = a.matchScore ?? null;
    const scoreB = b.matchScore ?? null;
    if (scoreA === null && scoreB === null) return 0;
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    return scoreB - scoreA;
  });
}
