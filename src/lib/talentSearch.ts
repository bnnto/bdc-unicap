/**
 * Banco de Talentos — regras puras de busca com filtros avançados
 * (issue [S2-3]). Compartilhadas entre a query Convex (`students.searchTalent`)
 * e a UI reativa. R1 (apenas ativo/egresso) e R2 (apenas `publico`) são
 * aplicados aqui e re-verificados no servidor — TDD, sem I/O.
 */
import type { LanguageLevel } from "./skills";
import type { Availability, EnrollmentStatus } from "./studentProfile";

/** Tamanho da página da busca paginada (CA 2). */
export const TALENT_PAGE_SIZE = 10;

/**
 * [S2-4] Teto por varredura de índice no Banco de Talentos (proteção de
 * leitura em base 10k+). O restante da paginação é feito em memória
 * sobre as varreduras trincadas.
 */
export const TALENT_SCAN_BATCH = 200;

/**
 * [S2-4] Plano de varredura do Banco de Talentos: escolha do índice de
 * entrada por filtro (sempre indexado, nunca full-scan de 10k+ currículos).
 * O servidor executa este plano; o teste de fitness garante que o schema
 * declara os índices escolhidos.
 */
export const TALENT_SCAN_SCHEMA = {
  /** R1+R2 já na seleção — entrada padrão da busca. */
  by_visibility_status: ["visibility", "status"] as const,
  /** Entrada quando o recrutador filtra disponibilidade. */
  by_status_availability: ["status", "availability"] as const,
} as const;

export type TalentScanIndex = keyof typeof TALENT_SCAN_SCHEMA;

/**
 * [REFACTOR_UI] Opções do dropdown "Ordenar por" do Banco de Talentos.
 * "relevancia" preserva a ordem da varredura indexada (padrão); as demais
 * ordenam após os filtros, antes da paginação.
 */
export const TALENT_SORT_OPTIONS = [
  "relevancia",
  "nome",
  "conclusao_proxima",
] as const;

export type TalentSortOption = (typeof TALENT_SORT_OPTIONS)[number];

/**
 * Escolhe o índice de entrada a partir dos filtros (regra pura, testável).
 * Disponibilidade → `by_status_availability`; caso contrário, a entrada
 * padrão `by_visibility_status` (R1+R2 na varredura). Em ambos os casos
 * `status` é componente do índice, garantindo a R1 no range varrido.
 */
export function chooseTalentScanPlan(availability: string | undefined): {
  index: TalentScanIndex;
  statuses: Array<"ativo" | "egresso">;
} {
  return {
    index:
      availability !== undefined && availability.length > 0
        ? "by_status_availability"
        : "by_visibility_status",
    statuses: ["ativo", "egresso"],
  };
}

const LEVEL_ORDER: Record<LanguageLevel, number> = {
  basico: 1,
  intermediario: 2,
  avancado: 3,
  fluente: 4,
  nativo: 5,
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ativo: "Aluno ativo",
  egresso: "Egresso",
  inativo: "Inativo",
};

export type TalentCandidate = {
  id: string;
  fullName: string;
  course: string;
  status: EnrollmentStatus;
  /** R2 — apenas "publico" participa do banco de talentos. */
  visibility: "publico" | "somente_candidaturas";
  graduationYear: number;
  semester: number | null;
  location: string | null;
  availability: Availability;
  skills: readonly string[];
  languages: ReadonlyArray<{ name: string; level: LanguageLevel }>;
};

export type TalentFilters = {
  /** Busca textual: nome, curso, competências e localização. */
  query?: string;
  course?: string;
  status?: EnrollmentStatus;
  availability?: Availability;
  location?: string;
  skill?: string;
  /**
   * [REFACTOR_UI] Competências em chips — o candidato precisa casar com
   * pelo menos uma (OU dentro do grupo; E entre categorias de filtro).
   */
  skills?: readonly string[];
  language?: string;
  /** Nível mínimo exigido do idioma informado (aceita superiores). */
  languageLevel?: LanguageLevel;
  /**
   * [REFACTOR_UI] Faixa de "Previsão de Conclusão" — ano de graduação
   * inclusivo nos dois extremos.
   */
  graduationYearFrom?: number;
  graduationYearTo?: number;
  /** [REFACTOR_UI] Ordenação do dropdown "Ordenar por" (padrão: relevância). */
  sort?: TalentSortOption;
  /** Página atual (0-based). */
  page?: number;
};

export type TalentSearchResult = {
  items: TalentCandidate[];
  total: number;
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/** Texto minúsculo e sem acentos, para comparações tolerantes. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * R1 + R2 — elegibilidade para aparecer no Banco de Talentos:
 * vínculo válido (R1: ativo/egresso) e escolha do aluno (R2: público).
 * Inativo nunca aparece, mesmo com visibilidade pública.
 */
export function canAppearInTalentBank(
  candidate: Pick<TalentCandidate, "status" | "visibility">,
): boolean {
  // R1 — regra de vínculo avaliada primeiro.
  if (candidate.status === "inativo") return false;
  // R2 — o aluno opta por se expor, nunca o contrário.
  return candidate.visibility === "publico";
}

/**
 * Projeta um documento de estudante (ex.: Doc<"students"> do Convex) para
 * o candidato puro da busca — mantém src/lib livre de tipos do Convex.
 */
export function toTalentCandidate<
  T extends {
    _id: string;
    fullName: string;
    course: string;
    status: "ativo" | "egresso" | "inativo";
    graduationYear: number;
    semester?: number;
    location?: string;
    availability: "estagio" | "integral" | "meio_periodo" | "freelancer";
    skills?: string[];
    languages?: Array<{ name: string; level: LanguageLevel }>;
  },
>(doc: T): TalentCandidate {
  return {
    id: doc._id,
    fullName: doc.fullName,
    course: doc.course,
    status: doc.status,
    // Varreduras partem de índices que já garantem R2 (visibilidade pública).
    visibility: "publico",
    graduationYear: doc.graduationYear,
    semester: doc.semester ?? null,
    location: doc.location ?? null,
    availability: doc.availability,
    skills: doc.skills ?? [],
    languages: doc.languages ?? [],
  };
}

function matchesTextFilters(
  candidate: TalentCandidate,
  filters: TalentFilters,
): boolean {
  const course = filters.course ?? "";
  if (course.length > 0) {
    if (
      !normalizeForSearch(candidate.course).includes(normalizeForSearch(course))
    )
      return false;
  }

  if (filters.status !== undefined && candidate.status !== filters.status)
    return false;

  // [REFACTOR_UI] Faixa de previsão de conclusão (anos inclusivos).
  if (
    filters.graduationYearFrom !== undefined &&
    candidate.graduationYear < filters.graduationYearFrom
  )
    return false;
  if (
    filters.graduationYearTo !== undefined &&
    candidate.graduationYear > filters.graduationYearTo
  )
    return false;

  if (
    filters.availability !== undefined &&
    candidate.availability !== filters.availability
  )
    return false;

  const location = filters.location ?? "";
  if (location.length > 0) {
    const candidateLocation = normalizeForSearch(candidate.location ?? "");
    if (!candidateLocation.includes(normalizeForSearch(location))) return false;
  }

  const skill = filters.skill ?? "";
  if (skill.length > 0) {
    const wanted = normalizeForSearch(skill);
    const has = candidate.skills.some((s) =>
      normalizeForSearch(s).includes(wanted),
    );
    if (!has) return false;
  }

  // [REFACTOR_UI] Chips de competências: casa com pelo menos uma (OU).
  const chips = (filters.skills ?? []).filter((c) => c.trim().length > 0);
  if (chips.length > 0) {
    const hasAny = chips.some((chip) => {
      const wanted = normalizeForSearch(chip);
      return candidate.skills.some((s) =>
        normalizeForSearch(s).includes(wanted),
      );
    });
    if (!hasAny) return false;
  }

  const language = filters.language ?? "";
  if (language.length > 0) {
    const wanted = normalizeForSearch(language);
    const minLevel = filters.languageLevel;
    const has = candidate.languages.some((l) => {
      if (!normalizeForSearch(l.name).includes(wanted)) return false;
      if (minLevel === undefined) return true;
      return LEVEL_ORDER[l.level] >= LEVEL_ORDER[minLevel];
    });
    if (!has) return false;
  }

  const query = filters.query ?? "";
  if (query.length > 0) {
    const q = normalizeForSearch(query);
    const haystack = [
      candidate.fullName,
      candidate.course,
      candidate.location ?? "",
      ...candidate.skills,
    ]
      .map(normalizeForSearch)
      .join(" ");
    if (!haystack.includes(q)) return false;
  }

  return true;
}

const SORT_COMPARATORS: Record<
  TalentSortOption,
  (a: TalentCandidate, b: TalentCandidate) => number
> = {
  relevancia: () => 0,
  nome: (a, b) =>
    a.fullName.localeCompare(b.fullName, "pt-BR", { sensitivity: "base" }),
  conclusao_proxima: (a, b) => a.graduationYear - b.graduationYear,
};

/**
 * Aplica filtros combináveis (E lógico entre categorias), mantendo apenas
 * candidatos elegíveis (R1/R2), ordenando pelo "Ordenar por" escolhido e
 * paginando o resultado.
 */
export function filterTalentCandidates(
  candidates: readonly TalentCandidate[],
  filters: TalentFilters,
): TalentSearchResult {
  const eligible = candidates.filter((c) => canAppearInTalentBank(c));
  const matching = eligible.filter((c) => matchesTextFilters(c, filters));

  // [REFACTOR_UI] Ordenação estável (Array.sort) aplicada antes da paginação.
  const sort = filters.sort ?? "relevancia";
  const comparator = SORT_COMPARATORS[sort];
  const sorted =
    comparator === undefined ? matching : [...matching].sort(comparator);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / TALENT_PAGE_SIZE));
  const requestedPage = filters.page ?? 0;
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), pageCount - 1);
  const start = page * TALENT_PAGE_SIZE;

  return {
    items: sorted.slice(start, start + TALENT_PAGE_SIZE),
    total,
    page,
    pageCount,
    hasNext: page < pageCount - 1,
    hasPrev: page > 0,
  };
}

/** Linha de resumo do card (Design System: contraste AA, sem jargão). */
export function formatTalentSummary(input: {
  status: EnrollmentStatus;
  course: string;
  graduationYear: number;
  semester: number | null;
}): string {
  const detail =
    input.semester !== null
      ? `${input.semester}º semestre (conclusão ${input.graduationYear})`
      : `conclusão ${input.graduationYear}`;
  return [STATUS_LABELS[input.status], input.course, detail].join(" · ");
}
