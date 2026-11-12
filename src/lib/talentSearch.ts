/**
 * Banco de Talentos — regras puras de busca com filtros avançados
 * (issue [S2-3]). Compartilhadas entre a query Convex (`students.searchTalent`)
 * e a UI reativa. R1 (apenas ativo/egresso) e R2 (apenas `publico`) são
 * aplicados aqui e re-verificados no servidor — TDD, sem I/O.
 */
import type { LanguageLevel } from "./skills";
import {
  AVAILABILITY,
  type Availability,
  type EnrollmentStatus,
} from "./studentProfile";

/** Tamanho da página da busca paginada (CA 2). */
export const TALENT_PAGE_SIZE = 10;

/**
 * [S2-4] Teto por varredura de índice no Banco de Talentos (proteção de
 * leitura em base 10k+). O restante da paginação é feito em memória
 * sobre as varreduras trincadas.
 */
export const TALENT_SCAN_BATCH = 200;

/**
 * [QUICK_WIN_MULTI] Um índice Convex sobre campo ARRAY NÃO é multikey:
 * ele ordena pelo array completo ("contém elemento" não existe no índice).
 * A varredura por disponibilidade é feita em fatias contíguas, uma por
 * PRIMEIRO elemento possível — todo array cativado por esse "grupo" — e o
 * "contém a disponibilidade pedida" é confirmado em memória. O orçamento
 * total permanece `TALENT_SCAN_BATCH` por status (4 fatias × 50).
 */
export const TALENT_SCAN_SLICE_BATCH = Math.floor(
  TALENT_SCAN_BATCH / AVAILABILITY.length,
);

/**
 * Bounds inclusivos da fatia de índice do "grupo" do primeiro elemento.
 * Arrays são comparados elemento a elemento (mais curto primeiro), então
 * todo array NÃO vazio começa em algum `[primeiro, ...]` — as 4 fatias
 * (uma por valor oficial com primeiro = valor) particionam exatamente os
 * arrays não vazios, sem sobreposição e sem vazamento.
 */
/**
 * [PERF_LOAD] Bounds são CONSTANTES por grupo (derivam só do catálogo
 * oficial), mas eram recalculados a cada query (4 grupos × 2 status):
 * 8 filtragens + 8 ordenações de array por requisição. Memoizado abaixo.
 */
const AVAILABILITY_BOUNDS_CACHE = new Map<
  Availability,
  { lower: Availability[]; upper: Availability[] }
>();

export function availabilitySliceBounds(group: Availability): {
  lower: Availability[];
  upper: Availability[];
} {
  const cached = AVAILABILITY_BOUNDS_CACHE.get(group);
  if (cached !== undefined) return cached;
  // Maior array possível do grupo: primeiro = group + demais em ordem
  // decrescente — cobre qualquer resto, pois a comparação é prefixo.
  const othersDesc = AVAILABILITY.filter((value) => value !== group).sort(
    (left, right) => (left < right ? 1 : -1),
  );
  const bounds = { lower: [group], upper: [group, ...othersDesc] };
  AVAILABILITY_BOUNDS_CACHE.set(group, bounds);
  return bounds;
}

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

type TalentScanIndex = keyof typeof TALENT_SCAN_SCHEMA;

/**
 * [REFACTOR_UI] Opções do dropdown "Ordenar por" do Banco de Talentos.
 * "relevancia" preserva a ordem da varredura indexada (padrão); as demais
 * ordenam após os filtros, antes da paginação.
 */
export type TalentSortOption = "relevancia" | "nome" | "conclusao_proxima";

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
  /** [QUICK_WIN_MULTI] multi-seleção custodada pelo aluno. */
  availability: Availability[];
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

type TalentSearchResult = {
  items: TalentCandidate[];
  total: number;
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * [PERF_LOAD] Cache de normalização.
 *
 * `normalize` (NFD) + regex + `toLowerCase` é caro e era refeito para a
 * MESMA string em cada candidato da varredura (curso, competências,
 * idioma, localidade e chips do filtro). O vocabulário do portal é
 * fechado (dicionário oficial de competências/idiomas, catálogo de cursos
 * e localidades), então o cache acerta quase sempre. Nomes de candidatos
 * variam: o cache é limitado e é limpo ao encher, para não crescer sem
 * limite dentro do isolate.
 */
const NORMALIZE_CACHE_LIMIT = 4096;
const NORMALIZE_CACHE = new Map<string, string>();

/** Texto minúsculo e sem acentos, para comparações tolerantes. */
export function normalizeForSearch(value: string): string {
  const cached = NORMALIZE_CACHE.get(value);
  if (cached !== undefined) return cached;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (NORMALIZE_CACHE.size >= NORMALIZE_CACHE_LIMIT) NORMALIZE_CACHE.clear();
  NORMALIZE_CACHE.set(value, normalized);
  return normalized;
}

/** Igualdade de competência com o alvo JÁ normalizado. */
function ownsNormalizedSkill(
  skills: readonly string[],
  normalizedTarget: string,
): boolean {
  for (const skill of skills) {
    if (normalizeForSearch(skill) === normalizedTarget) return true;
  }
  return false;
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
    availability: Array<"estagio" | "integral" | "meio_periodo" | "freelancer">;
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

/**
 * [PERF_LOAD] Termos de texto dos filtros normalizados UMA vez por
 * requisição. Antes, cada candidato da varredura renormalizava curso,
 * local, competência, chips, idioma e busca — trabalho O(linhas × filtros)
 * que não depende do candidato.
 */
type PreparedFilters = {
  course: string;
  location: string;
  skill: string;
  /** Chips de competência já normalizados (casamento exato). */
  chips: readonly string[];
  language: string;
  query: string;
};

function prepareFilters(filters: TalentFilters): PreparedFilters {
  return {
    course: normalizeForSearch(filters.course ?? ""),
    location: normalizeForSearch(filters.location ?? ""),
    skill: normalizeForSearch(filters.skill ?? ""),
    chips: (filters.skills ?? [])
      .filter((chip) => chip.trim().length > 0)
      .map((chip) => normalizeForSearch(chip)),
    language: normalizeForSearch(filters.language ?? ""),
    query: normalizeForSearch(filters.query ?? ""),
  };
}

function matchesTextFilters(
  candidate: TalentCandidate,
  filters: TalentFilters,
  prepared: PreparedFilters,
): boolean {
  if (
    prepared.course.length > 0 &&
    !normalizeForSearch(candidate.course).includes(prepared.course)
  ) {
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

  // [QUICK_WIN_MULTI] o campo é um array: o filtro casa se o aluno
  // marcou AQUELA disponibilidade ("contém", não igualdade de array).
  if (
    filters.availability !== undefined &&
    !candidate.availability.includes(filters.availability)
  )
    return false;

  if (prepared.location.length > 0) {
    const candidateLocation = normalizeForSearch(candidate.location ?? "");
    if (!candidateLocation.includes(prepared.location)) return false;
  }

  if (prepared.skill.length > 0) {
    let has = false;
    for (const candidateSkill of candidate.skills) {
      if (normalizeForSearch(candidateSkill).includes(prepared.skill)) {
        has = true;
        break;
      }
    }
    if (!has) return false;
  }

  // [REFACTOR_UI] Chips de competências: casa com pelo menos uma (OU).
  if (prepared.chips.length > 0) {
    let has = false;
    for (const chip of prepared.chips) {
      if (ownsNormalizedSkill(candidate.skills, chip)) {
        has = true;
        break;
      }
    }
    if (!has) return false;
  }

  if (prepared.language.length > 0) {
    const minLevel = filters.languageLevel;
    let has = false;
    for (const language of candidate.languages) {
      if (!normalizeForSearch(language.name).includes(prepared.language))
        continue;
      if (minLevel === undefined) {
        has = true;
        break;
      }
      if (LEVEL_ORDER[language.level] >= LEVEL_ORDER[minLevel]) {
        has = true;
        break;
      }
    }
    if (!has) return false;
  }

  if (prepared.query.length > 0) {
    // Mesmo campo de busca de antes (nome · curso · local · competências),
    // agora montado sem array intermediário.
    let haystack =
      `${normalizeForSearch(candidate.fullName)} ` +
      `${normalizeForSearch(candidate.course)} ` +
      normalizeForSearch(candidate.location ?? "");
    for (const candidateSkill of candidate.skills) {
      haystack += ` ${normalizeForSearch(candidateSkill)}`;
    }
    if (!haystack.includes(prepared.query)) return false;
  }

  return true;
}

/**
 * [PERF_LOAD] `String.localeCompare` com locale + options revalida a
 * configuração a cada comparação (~n·log n por página). Um `Intl.Collator`
 * único preserva exatamente a ordenação pt-BR/base e é ordens de grandeza
 * mais barato.
 */
const PT_BR_COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });

const SORT_COMPARATORS: Record<
  TalentSortOption,
  (a: TalentCandidate, b: TalentCandidate) => number
> = {
  relevancia: () => 0,
  nome: (a, b) => PT_BR_COLLATOR.compare(a.fullName, b.fullName),
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
  // [PERF_LOAD] Um único passo (elegibilidade R1/R2 + filtros) em vez de
  // duas varreduras com dois arrays intermediários sobre o teto de 400
  // linhas por requisição.
  const prepared = prepareFilters(filters);
  const matching: TalentCandidate[] = [];
  for (const candidate of candidates) {
    if (!canAppearInTalentBank(candidate)) continue;
    if (!matchesTextFilters(candidate, filters, prepared)) continue;
    matching.push(candidate);
  }

  // [REFACTOR_UI] Ordenação estável (Array.sort) aplicada antes da paginação.
  const sort = filters.sort ?? "relevancia";
  const comparator = SORT_COMPARATORS[sort];
  let sorted: TalentCandidate[];
  if (prepared.chips.length > 0) {
    const scored = matching.map((candidate) => ({
      candidate,
      score: countNormalizedSkillMatches(candidate, prepared.chips),
    }));
    scored.sort(
      (a, b) => b.score - a.score || comparator(a.candidate, b.candidate),
    );
    sorted = scored.map((entry) => entry.candidate);
  } else {
    // `matching` é um array novo criado acima: ordenar no lugar é seguro.
    sorted = matching.sort(comparator);
  }

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

/** Conta chips já normalizados (caminho quente do filtro). */
function countNormalizedSkillMatches(
  candidate: Pick<TalentCandidate, "skills">,
  normalizedChips: readonly string[],
): number {
  let matches = 0;
  for (const chip of normalizedChips) {
    if (ownsNormalizedSkill(candidate.skills, chip)) matches += 1;
  }
  return matches;
}

/**
 * Quantas das competências escolhidas (chips) o candidato possui.
 * Mesmo critério de casamento do filtro (normalizado, igualdade), mas
 * cada chip conta no máximo uma vez.
 */
export function countSkillMatches(
  candidate: Pick<TalentCandidate, "skills">,
  chips: readonly string[],
): number {
  const normalized: string[] = [];
  for (const chip of chips) {
    if (chip.trim().length === 0) continue;
    normalized.push(normalizeForSearch(chip));
  }
  return countNormalizedSkillMatches(candidate, normalized);
}