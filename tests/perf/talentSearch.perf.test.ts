/**
 * [PERF] Loading Test + Stress Test do caminho mais quente do produto:
 * a query `students.searchTalent` (Banco de Talentos) sobre a base do
 * benchmark (10.500 currículos), executada pelo backend real via
 * convex-test (mesma função, mesmo schema, mesmos índices e guards).
 *
 * Loading Test — concorrência normal (8 VUs) com mix de 5 filtros reais;
 * mede throughput, p50/p90/p95/p99 e estabilidade (taxa de erro).
 *
 * Stress Test — rampa de concorrência 1 → 128 VUs até o ponto de quebra
 * (p95 > SLA de 500 ms ou taxa de erro > 1%), seguida de estágio de
 * recuperação para medir como o sistema volta ao regime normal.
 *
 * Artefatos: docs/performance-artifacts/loading-test.json e
 * stress-test.json.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  TALENT_BENCHMARK_MIN_ROWS,
  TALENT_QUERY_SLA_MS,
} from "../../src/lib/talentBenchmark";
import { TALENT_PAGE_SIZE } from "../../src/lib/talentSearch";
import {
  filterTalentCandidates,
  type TalentCandidate,
} from "../../src/lib/talentSearch";
import {
  runRamp,
  runStage,
  stage,
  toMarkdownTable,
  writeJson,
  type RampResult,
  type StageResult,
} from "./harness";
import {
  createPerfWorld,
  TALENT_SCENARIOS,
  type PerfWorld,
  type TalentSearchArgs,
} from "./world";

const RESULTS_DIR = "docs/performance-artifacts";

/** Critérios de saúde: SLA declarado (p95 ≤ 500 ms) e erro < 1%. */
const HEALTH = { maxP95Ms: TALENT_QUERY_SLA_MS, maxErrorRatePct: 1 } as const;

let world: PerfWorld;

function scenario(vu: number, iteration: number): TalentSearchArgs {
  const args = TALENT_SCENARIOS[(vu + iteration) % TALENT_SCENARIOS.length];
  if (args === undefined) throw new Error("Cenário de performance ausente.");
  return args.args;
}

/** Tarefa medida: 1 query do Banco de Talentos com o mix de filtros. */
async function searchTask(vu: number, iteration: number) {
  return world.asRecruiter.query(
    api.students.searchTalent,
    scenario(vu, iteration),
  );
}

function logStage(result: StageResult): void {
  console.log(
    `[stage] ${result.name.padEnd(22)} VUs=${String(result.concurrency).padStart(3)} ` +
      `rps=${String(result.rps).padStart(7)} p50=${String(result.p50).padStart(6)} ` +
      `p95=${String(result.p95).padStart(7)} p99=${String(result.p99).padStart(7)} ` +
      `erros=${result.errors}`,
  );
}

/** Candidato sintético no formato devolvido pela varredura do índice. */
function syntheticCandidate(index: number): TalentCandidate {
  const courses = ["Ciência da Computação", "Direito", "Psicologia"] as const;
  const locations = ["Recife", "Olinda", "Caruaru"] as const;
  const skills = [
    ["React", "SQL"],
    ["TypeScript", "Node.js"],
    ["Python", "Power BI"],
  ][index % 3] as string[];
  return {
    id: `synthetic-${String(index)}`,
    fullName: `Aluno B1 ${String(index).padStart(5, "0")} ${courses[index % 3]}`,
    course: courses[index % 3] as string,
    status: index % 7 === 3 ? "egresso" : "ativo",
    visibility: "publico",
    graduationYear: 2024 + (index % 4),
    semester: (index % 9) + 1,
    location: locations[index % 3] as string,
    availability: [
      ["estagio", "integral", "meio_periodo", "freelancer"][
        index % 4
      ] as "estagio",
    ],
    skills,
    languages: [{ name: "Inglês", level: "avancado" }],
  };
}

/** Carga de 400 linhas — mesmo teto de varredura da query real. */
const SCAN_ROWS = Array.from({ length: 400 }, (_, index) =>
  syntheticCandidate(index),
);

/** Cenários de filtragem pura medidos no benchmark de CPU. */
const CPU_SCENARIOS: ReadonlyArray<{
  name: string;
  filters: Parameters<typeof filterTalentCandidates>[1];
}> = [
  { name: "padrao", filters: { page: 0 } },
  { name: "busca textual", filters: { query: "Aluno B1 00010", page: 0 } },
  {
    name: "chips + curso + nome",
    filters: {
      skills: ["React", "TypeScript", "SQL"],
      course: "Ciência da Computação",
      sort: "nome",
      page: 0,
    },
  },
  {
    name: "idioma + disponibilidade",
    filters: {
      availability: "estagio",
      language: "Inglês",
      languageLevel: "avancado",
      page: 0,
    },
  },
];

function environment(): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    runtime: `node ${process.version}`,
    vcpus: 2,
    totalMemoryMb: 3915,
    backend: "convex-test (mock oficial, em memória)",
    seededRows: world.seededRows,
    seedMs: world.seedMs,
    slaP95Ms: TALENT_QUERY_SLA_MS,
  };
}

beforeAll(async () => {
  world = await createPerfWorld();
  console.log(
    `[seed] ${String(world.seededRows)} currículos em ${String(world.seedMs)} ms`,
  );
}, 600_000);

describe("Performance — Banco de Talentos com 10.500 currículos", () => {
  it("Loading Test — 8 VUs simultâneos com mix de filtros (15 s)", async () => {
    expect(world.seededRows).toBeGreaterThanOrEqual(TALENT_BENCHMARK_MIN_ROWS);

    // Warmup: aquece JIT e caches antes de medir.
    await runStage(stage("warmup", 2, 2), searchTask);

    const load = await runStage(stage("carga normal", 8, 15), searchTask);
    logStage(load);

    const payload = {
      ...environment(),
      type: "loading",
      result: load,
      withinSla:
        load.p95 <= HEALTH.maxP95Ms &&
        load.errorRatePct <= HEALTH.maxErrorRatePct,
    };
    writeJson(`${RESULTS_DIR}/loading-test.json`, payload);

    console.log(`\n### Loading Test\n\n${toMarkdownTable([load])}\n`);

    // Invariantes funcionais: a busca continua correta sob carga.
    expect(load.requests).toBeGreaterThan(0);
    expect(load.errorRatePct).toBe(0);
    const sample = await searchTask(0, 0);
    expect("items" in sample && sample.items.length).toBe(TALENT_PAGE_SIZE);
  });

  it("Benchmark de CPU — filtragem pura sobre 400 linhas", () => {
    const ITERATIONS = 400;
    const rows: Array<Record<string, unknown>> = [];

    for (const scenario of CPU_SCENARIOS) {
      // Warmup do cenário (JIT + caches de normalização).
      for (let i = 0; i < 50; i++) {
        filterTalentCandidates(SCAN_ROWS, scenario.filters);
      }
      const started = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        filterTalentCandidates(SCAN_ROWS, scenario.filters);
      }
      const elapsedMs = performance.now() - started;
      const perQueryMs = elapsedMs / ITERATIONS;
      const row = {
        scenario: scenario.name,
        iterations: ITERATIONS,
        totalMs: Number(elapsedMs.toFixed(1)),
        perQueryMs: Number(perQueryMs.toFixed(3)),
        queriesPerSecond: Math.round(1000 / perQueryMs),
      };
      rows.push(row);
      console.log(
        `[cpu] ${scenario.name.padEnd(26)} ${String(row.perQueryMs).padStart(7)} ms/consulta  ` +
          `${String(row.queriesPerSecond).padStart(8)} consultas/s`,
      );
    }

    writeJson(`${RESULTS_DIR}/filter-cpu.json`, {
      ...environment(),
      type: "cpu",
      rowsCount: SCAN_ROWS.length,
      scenarios: rows,
    });

    expect(rows).toHaveLength(CPU_SCENARIOS.length);
  });

  it("Stress Test — rampa 1 → 128 VUs + recuperação", async () => {
    const stages = [1, 2, 4, 8, 16, 32, 64, 128].map((concurrency) =>
      stage(`rampa ${String(concurrency)} VUs`, concurrency, 4),
    );

    const ramp: RampResult = await runRamp({
      stages,
      task: searchTask,
      health: HEALTH,
      stopOnBreak: false,
      onStage: logStage,
    });

    // Recuperação: mesmo regime do início da rampa, imediatamente após
    // o estágio mais pesado — mede a volta ao normal sem restart.
    const baseline = ramp.stages[0] as StageResult;
    const recovery = await runStage(stage("recuperação", 4, 8), searchTask);
    logStage(recovery);

    const rampa4 = ramp.stages[2] as StageResult;
    const recoveredFactor = Number(
      (recovery.p95 / Math.max(rampa4.p95, 0.001)).toFixed(2),
    );

    const payload = {
      ...environment(),
      type: "stress",
      health: HEALTH,
      stages: ramp.stages,
      saturation: ramp.saturation,
      breakingPoint: ramp.breakingPoint,
      recovery: {
        ...recovery,
        referenceStage: rampa4.name,
        referenceP95: rampa4.p95,
        factorialVsSameConcurrency: recoveredFactor,
        baselineP95: baseline.p95,
      },
      memory: {
        heapUsedMb: Number(
          (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
        ),
        rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
      },
    };
    writeJson(`${RESULTS_DIR}/stress-test.json`, payload);

    console.log(`\n### Stress Test\n\n${toMarkdownTable(ramp.stages)}`);
    if (ramp.breakingPoint !== null) {
      console.log(
        `\nPonto de quebra: ${ramp.breakingPoint.name} ` +
          `(p95 ${String(ramp.breakingPoint.p95)} ms, erros ${String(ramp.breakingPoint.errors)})`,
      );
    }
    if (ramp.saturation !== null) {
      console.log(
        `Saturação: ${ramp.saturation.name} com ${String(ramp.saturation.rps)} req/s`,
      );
    }
    console.log(
      `Recuperação (4 VUs): p95 ${String(recovery.p95)} ms ` +
        `(${String(recoveredFactor)}× o mesmo regime na rampa)\n`,
    );

    expect(ramp.stages).toHaveLength(stages.length);
    // Estabilidade pós-sobrecarga: erro zero e p95 dentro do SLA.
    expect(recovery.errorRatePct).toBe(0);
    expect(recovery.p95).toBeLessThanOrEqual(HEALTH.maxP95Ms);
  });
});