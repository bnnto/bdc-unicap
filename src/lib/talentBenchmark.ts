/**
 * [S8-3] Benchmark de busca do Banco de Talentos com 10k+ currículos
 * seedados (RN: escalabilidade — requisito não-funcional).
 *
 * Regra PURA (sem I/O), compartilhada entre o servidor (internalMutation
 * de seed usa o mesmo gerador dos testes) e a validação dos CAs:
 * - CA 1 — queries dentro do SLA com a base semeada;
 * - CA 2 — sem full-scan: leitura por índice com teto por varredura
 *   muito abaixo da base (2 status × TALENT_SCAN_BATCH).
 */
import type { LanguageLevel } from "./skills";
import { TALENT_SCAN_BATCH, TALENT_SCAN_SCHEMA } from "./talentSearch";

/** SLA da query do Banco de Talentos com a base semeada (CA 1): p99 ≤ 500 ms. */
export const TALENT_QUERY_SLA_MS = 500;

/** Base mínima semeada para o benchmark (CA da issue: "10k+ currículos"). */
export const TALENT_BENCHMARK_MIN_ROWS = 10_000;

/** Tamanho do lote unitário de seed (inserido por chamada da mutation). */
export const BENCHMARK_UNIT_SIZE = 100;

/**
 * Lotes unitários do seed: mínimo de 10k com margem (105 × 100 = 10.500).
 * A margem evita que ajustes de população derrubem a base abaixo do mínimo.
 */
export function benchmarkUnitCount(): number {
  return Math.ceil(TALENT_BENCHMARK_MIN_ROWS / BENCHMARK_UNIT_SIZE) + 5;
}

/**
 * Leitura máxima por query do plano atual: 2 varreduras (status ativo e
 * egresso) × teto por índice. Sempre muito abaixo da base semeada —
 * é o teto usado como `scannedRows` na prova de não-full-scan (CA 2).
 */
export function benchmarkScannedRows(): number {
  return 2 * TALENT_SCAN_BATCH;
}

/** PRNG determinístico (LCG) — mesma sequência para a mesma seed. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return state / 4_294_967_296;
  };
}

/**
 * Catálogo de cursos UNICAP — compartilhado com a UI (facets do Banco de
 * Talentos) e com o seed do benchmark.
 */
export const COURSES = [
  "Ciência da Computação",
  "Sistemas para Internet",
  "Engenharia de Computação",
  "Direito",
  "Administração",
  "Psicologia",
] as const;

const LOCATIONS = [
  "Recife",
  "Olinda",
  "Jaboatão dos Guararapes",
  "Caruaru",
  "Petrolina",
] as const;

const AVAILABILITIES = [
  "estagio",
  "integral",
  "meio_periodo",
  "freelancer",
] as const;

const SKILLS = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "SQL",
  "Excel",
  "Power BI",
  "Figma",
  "Java",
  "Redação",
  "Marketing Digital",
  "Gestão de Projetos",
] as const;

const LANGUAGES = ["Inglês", "Espanhol", "Francês", "Alemão"] as const;

const LANGUAGE_LEVELS = [
  "basico",
  "intermediario",
  "avancado",
  "fluente",
  "nativo",
] as const satisfies readonly LanguageLevel[];

/** Acesso seguro a catálogo (noUncheckedIndexedAccess): índice sempre válido. */
function pick<T>(items: readonly T[], index: number): T {
  const value = items[((index % items.length) + items.length) % items.length];
  return value as T;
}

/** Linha de seed do benchmark — consumida pela internalMutation do Convex. */
export type BenchmarkSeedRow = {
  /** Índice global do registro (runId, lote) — usado no e-mail da conta. */
  benchmarkIndex: number;
  fullName: string;
  enrollment: string;
  status: "ativo" | "egresso" | "inativo";
  course: string;
  graduationYear: number;
  semester?: number;
  location: string;
  availability: (typeof AVAILABILITIES)[number];
  /** R2 — 20% da população fica privada (fora do Banco de Talentos). */
  visibility: "publico" | "somente_candidaturas";
  skills: string[];
  languages: Array<{ name: string; level: LanguageLevel }>;
};

/**
 * Gera um lote determinístico de BENCHMARK_UNIT_SIZE perfis.
 * População segregada por índice global (g): g%5==0 → inativo (R1),
 * g%5==1 → privado (R2), demais → elegíveis (públicos ativos/egressos).
 * Matrícula única por (runId, g) — reexecuções com outro runId não
 * colidem; a mutation é idempotente pela âncora do lote.
 */
export function buildBenchmarkBatch(args: {
  runId: number;
  unitIndex: number;
}): { rows: BenchmarkSeedRow[]; generationMs: number } {
  const { runId, unitIndex } = args;
  const totalUnits = benchmarkUnitCount();
  if (!Number.isInteger(runId) || runId < 1) {
    throw new Error(`runId de seed inválido: ${String(runId)}`);
  }
  if (
    !Number.isInteger(unitIndex) ||
    unitIndex < 0 ||
    unitIndex >= totalUnits
  ) {
    throw new Error(
      `unidade de seed inválida: ${String(unitIndex)} (0..${String(totalUnits - 1)})`,
    );
  }

  const random = lcg(runId * 7919 + unitIndex + 1);
  const started = performance.now();
  const rows: BenchmarkSeedRow[] = [];
  for (let k = 0; k < BENCHMARK_UNIT_SIZE; k++) {
    const g = unitIndex * BENCHMARK_UNIT_SIZE + k;
    const klass = g % 5;
    const status: BenchmarkSeedRow["status"] =
      klass === 0 ? "inativo" : g % 7 === 3 ? "egresso" : "ativo";
    const visibility: BenchmarkSeedRow["visibility"] =
      klass === 1 ? "somente_candidaturas" : "publico";
    // Dois PRNGs por linha mantêm a sequência estável (consumo fixo).
    const r1 = random();
    const r2 = random();
    rows.push({
      benchmarkIndex: g,
      fullName: `Aluno B${String(runId)} ${String(g).padStart(5, "0")} ${pick(COURSES, Math.floor(r1 * COURSES.length))}`,
      enrollment: `${String(runId).padStart(2, "0")}${String(g + 1).padStart(6, "0")}`,
      status,
      course: pick(COURSES, Math.floor(r2 * COURSES.length)),
      graduationYear: 2024 + (g % 4),
      ...(g % 4 !== 3 ? { semester: (g % 9) + 1 } : {}),
      location: pick(LOCATIONS, g),
      availability: pick(AVAILABILITIES, g),
      visibility,
      skills: [pick(SKILLS, g * 3 + 1), pick(SKILLS, g * 5 + 4)],
      languages: [
        {
          name: pick(LANGUAGES, g),
          level: pick(LANGUAGE_LEVELS, g + 2),
        },
      ],
    });
  }
  return { rows, generationMs: performance.now() - started };
}

export type TalentBenchmarkInput = {
  /** Cenário medido (ex.: "padrao", "disponibilidade+curso"). */
  scenario: string;
  /** Tamanho da base semeada (CA 1: ≥ 10k). */
  seededRows: number;
  /** Duração medida da query (CA 1: ≤ TALENT_QUERY_SLA_MS). */
  elapsedMs: number;
  /** Linhas lidas pelos índices na varredura (CA 2: < base). */
  scannedRows: number;
  /** Índice de entrada usado pelo plano da query (CA 2: declarado). */
  indexUsed: string;
};

export type TalentBenchmarkReport = {
  ok: boolean;
  scenario: string;
  seededRows: number;
  elapsedMs: number;
  slaMs: number;
  scannedRows: number;
  indexUsed: string;
  checks: {
    baseSemeada: boolean;
    sla: boolean;
    semFullScan: boolean;
    indiceDeclarado: boolean;
  };
  failed: string[];
};

/**
 * Valida os CAs da S8-3 sobre uma medição do benchmark:
 * - base_semeada_insuficiente: menos de 10k currículos;
 * - sla_excedido: query acima do SLA de 500 ms;
 * - full_scan_detectado: varredura alcançou a base inteira;
 * - indice_nao_declarado: índice usado não está no plano do schema.
 */
export function validateTalentBenchmark(
  input: TalentBenchmarkInput,
): TalentBenchmarkReport {
  const checks = {
    baseSemeada: input.seededRows >= TALENT_BENCHMARK_MIN_ROWS,
    sla: input.elapsedMs <= TALENT_QUERY_SLA_MS,
    semFullScan: input.scannedRows > 0 && input.scannedRows < input.seededRows,
    indiceDeclarado: Object.keys(TALENT_SCAN_SCHEMA).includes(input.indexUsed),
  };
  const failed: string[] = [];
  if (!checks.baseSemeada) failed.push("base_semeada_insuficiente");
  if (!checks.sla) failed.push("sla_excedido");
  if (!checks.semFullScan) failed.push("full_scan_detectado");
  if (!checks.indiceDeclarado) failed.push("indice_nao_declarado");
  return {
    ok: failed.length === 0,
    scenario: input.scenario,
    seededRows: input.seededRows,
    elapsedMs: input.elapsedMs,
    slaMs: TALENT_QUERY_SLA_MS,
    scannedRows: input.scannedRows,
    indexUsed: input.indexUsed,
    checks,
    failed,
  };
}
