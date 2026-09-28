import { describe, expect, it } from "vitest";
import {
  BENCHMARK_UNIT_SIZE,
  TALENT_BENCHMARK_MIN_ROWS,
  TALENT_QUERY_SLA_MS,
  benchmarkScannedRows,
  benchmarkUnitCount,
  buildBenchmarkBatch,
  validateTalentBenchmark,
} from "../../src/lib/talentBenchmark";
import {
  chooseTalentScanPlan,
  TALENT_SCAN_BATCH,
  TALENT_SCAN_SCHEMA,
} from "../../src/lib/talentSearch";

const TOTAL_UNITS = benchmarkUnitCount();

/** Simula a base completa em memória (mesma regra do servidor). */
function simulatePopulation() {
  const rows = [];
  for (let unit = 0; unit < TOTAL_UNITS; unit++) {
    rows.push(...buildBenchmarkBatch({ runId: 1, unitIndex: unit }).rows);
  }
  return rows;
}

describe("S8-3 — parâmetros do benchmark (CA 1)", () => {
  it("base mínima semeada é 10k+ currículos", () => {
    expect(TALENT_BENCHMARK_MIN_ROWS).toBeGreaterThanOrEqual(10_000);
    expect(TOTAL_UNITS * BENCHMARK_UNIT_SIZE).toBeGreaterThanOrEqual(
      TALENT_BENCHMARK_MIN_ROWS,
    );
  });

  it("lote de seed tem tamanho unitário fixo (100)", () => {
    expect(BENCHMARK_UNIT_SIZE).toBe(100);
    const batch = buildBenchmarkBatch({ runId: 1, unitIndex: 0 });
    expect(batch.rows).toHaveLength(BENCHMARK_UNIT_SIZE);
  });

  it("SLA de query está definido (p99 <= 500 ms)", () => {
    expect(TALENT_QUERY_SLA_MS).toBe(500);
  });
});

describe("S8-3 — gerador determinístico de seed", () => {
  it("mesmo (runId, unitIndex) produz exatamente as mesmas linhas", () => {
    const a = buildBenchmarkBatch({ runId: 7, unitIndex: 42 });
    const b = buildBenchmarkBatch({ runId: 7, unitIndex: 42 });
    expect(a.rows).toEqual(b.rows);
    expect(a.generationMs).toBeGreaterThanOrEqual(0);
  });

  it("runId diferente muda matrícula e nomes (sem colisão entre execuções)", () => {
    const a = buildBenchmarkBatch({ runId: 1, unitIndex: 0 });
    const b = buildBenchmarkBatch({ runId: 2, unitIndex: 0 });
    const enrollA = a.rows.map((r) => r.enrollment).sort();
    const enrollB = b.rows.map((r) => r.enrollment).sort();
    expect(enrollA).not.toEqual(enrollB);
  });

  it("matrículas são únicas em toda a base semeada", () => {
    const all = simulatePopulation().map((r) => r.enrollment);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("S8-3 — população semeada mantém R1/R2 em escala (CA 2)", () => {
  it("10.500 linhas com inativos (R1) e privados (R2) segregados", () => {
    const rows = simulatePopulation();
    expect(rows.length).toBeGreaterThanOrEqual(TALENT_BENCHMARK_MIN_ROWS);
    const inativos = rows.filter((r) => r.status === "inativo");
    const privados = rows.filter(
      (r) => r.visibility === "somente_candidaturas",
    );
    const elegiveis = rows.filter(
      (r) => r.status !== "inativo" && r.visibility === "publico",
    );
    // Distribuição determinística: 20% inativos, 20% privados, 60% elegíveis.
    expect(inativos.length).toBe(2_100);
    expect(privados.length).toBe(2_100);
    expect(elegiveis.length).toBe(6_300);
  });

  it("cursos e disponibilidades variam (base realista, não uniforme)", () => {
    const rows = simulatePopulation();
    expect(new Set(rows.map((r) => r.course)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(rows.map((r) => r.availability)).size).toBe(4);
    expect(new Set(rows.map((r) => r.location)).size).toBeGreaterThanOrEqual(4);
    // Competências e idiomas preenchidos (filtros combináveis exercitados).
    expect(rows.every((r) => r.skills.length >= 2)).toBe(true);
    expect(rows.every((r) => r.languages.length === 1)).toBe(true);
  });
});

describe("S8-3 — validação dos CAs (regra pura)", () => {
  const okInput = {
    scenario: "padrao",
    seededRows: 10_500,
    elapsedMs: 120,
    scannedRows: benchmarkScannedRows(),
    indexUsed: chooseTalentScanPlan(undefined).index,
  };

  it("relatório válido quando todos os CAs são atendidos", () => {
    const report = validateTalentBenchmark(okInput);
    expect(report.ok).toBe(true);
    expect(report.failed).toEqual([]);
    expect(report.checks.baseSemeada).toBe(true);
    expect(report.checks.sla).toBe(true);
    expect(report.checks.semFullScan).toBe(true);
    expect(report.checks.indiceDeclarado).toBe(true);
  });

  it("falha quando a base semeada é menor que 10k", () => {
    const report = validateTalentBenchmark({ ...okInput, seededRows: 9_999 });
    expect(report.ok).toBe(false);
    expect(report.failed).toContain("base_semeada_insuficiente");
    expect(report.checks.baseSemeada).toBe(false);
  });

  it("falha quando a query estoura o SLA", () => {
    const report = validateTalentBenchmark({
      ...okInput,
      elapsedMs: TALENT_QUERY_SLA_MS + 1,
    });
    expect(report.ok).toBe(false);
    expect(report.failed).toContain("sla_excedido");
    expect(report.checks.sla).toBe(false);
  });

  it("falha quando a varredura lê a base inteira (full-scan)", () => {
    const report = validateTalentBenchmark({ ...okInput, scannedRows: 10_500 });
    expect(report.ok).toBe(false);
    expect(report.failed).toContain("full_scan_detectado");
    expect(report.checks.semFullScan).toBe(false);
  });

  it("falha quando o índice usado não está declarado no schema", () => {
    const report = validateTalentBenchmark({
      ...okInput,
      indexUsed: "by_user",
    });
    expect(report.ok).toBe(false);
    expect(report.failed).toContain("indice_nao_declarado");
  });

  it("varredura trincada lê no máximo 2 status × TALENT_SCAN_BATCH", () => {
    expect(benchmarkScannedRows()).toBe(2 * TALENT_SCAN_BATCH);
    expect(benchmarkScannedRows()).toBeLessThan(TALENT_BENCHMARK_MIN_ROWS);
  });

  it("índice de disponibilidade também está declarado no schema", () => {
    expect(chooseTalentScanPlan("integral").index).toBe(
      "by_status_availability",
    );
    expect(Object.keys(TALENT_SCAN_SCHEMA)).toContain("by_status_availability");
  });
});
