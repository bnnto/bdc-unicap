/**
 * Harness de performance (loading + stress) — zero dependências externas.
 *
 * Modelo de execução: "virtual users" (VUs). Cada VU executa a tarefa em
 * laço até o deadline e registra a latência de CADA operação. A latência
 * inclui fila (trabalho de outros VUs no mesmo processo), exatamente como
 * um cliente real experimenta latência sob concorrência.
 *
 * Métricas por estágio: throughput (req/s), p50/p90/p95/p99, máximo, erro
 * e taxa de erro. As mesmas métricas são consumidas pelo relatório em
 * `docs/performance-tests-report.md`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Sample = { ms: number; ok: boolean; error?: string };

export type StageConfig = {
  /** Rótulo do estágio (aparece no relatório). */
  name: string;
  /** Usuários virtuais simultâneos. */
  concurrency: number;
  /** Duração do estágio em milissegundos. */
  durationMs: number;
};

export type StageResult = StageConfig & {
  requests: number;
  ok: number;
  errors: number;
  errorRatePct: number;
  rps: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  /** Amostra de mensagens de erro (até 3 distintas). */
  errorSamples: string[];
};

export type HealthCriteria = {
  /** Latência p95 máxima aceitável (SLA) em ms. */
  maxP95Ms: number;
  /** Taxa de erro máxima aceitável (%). */
  maxErrorRatePct: number;
};

export type RampResult = {
  stages: StageResult[];
  /** Estágio com maior throughput (ponto de saturação). */
  saturation: StageResult | null;
  /** Primeiro estágio que violou os critérios de saúde (ponto de quebra). */
  breakingPoint: StageResult | null;
  health: HealthCriteria;
};

/** Percentil por posto mais próximo (nearest-rank) sobre amostras ordenadas. */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedAsc.length - 1);
  return sortedAsc[index] as number;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function summarizeStage(
  config: StageConfig,
  samples: readonly Sample[],
): StageResult {
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const ok = samples.filter((s) => s.ok).length;
  const errors = samples.length - ok;
  const totalMs = latencies.reduce((sum, ms) => sum + ms, 0);
  const errorMessages = [
    ...new Set(
      samples
        .filter((s) => !s.ok && s.error !== undefined)
        .map((s) => s.error as string),
    ),
  ].slice(0, 3);

  return {
    ...config,
    requests: samples.length,
    ok,
    errors,
    errorRatePct: round(
      samples.length === 0 ? 0 : (errors / samples.length) * 100,
    ),
    rps: round((samples.length / config.durationMs) * 1000),
    p50: round(percentile(latencies, 50)),
    p90: round(percentile(latencies, 90)),
    p95: round(percentile(latencies, 95)),
    p99: round(percentile(latencies, 99)),
    max: round(latencies.length === 0 ? 0 : (latencies.at(-1) as number)),
    mean: round(samples.length === 0 ? 0 : totalMs / samples.length),
    errorSamples: errorMessages,
  };
}

/**
 * Executa um estágio: `concurrency` VUs em laço até o deadline.
 * A tarefa recebe o índice do VU e o número da iteração para variar o
 * cenário de entrada (mix realista de consultas).
 */
export async function runStage(
  config: StageConfig,
  task: (vuIndex: number, iteration: number) => Promise<unknown>,
): Promise<StageResult> {
  const samples: Sample[] = [];
  const deadline = performance.now() + config.durationMs;

  async function virtualUser(vuIndex: number): Promise<void> {
    let iteration = 0;
    while (performance.now() < deadline) {
      const started = performance.now();
      try {
        await task(vuIndex, iteration);
        samples.push({ ms: performance.now() - started, ok: true });
      } catch (error) {
        samples.push({
          ms: performance.now() - started,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      iteration += 1;
      // Cede o event loop periodicamente: sem isso o processo fica em
      // microtasks durante todo o estágio e o reporter do Vitest perde o
      // heartbeat (falso "Unhandled Error: onTaskUpdate").
      if (iteration % 8 === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  }

  await Promise.all(
    Array.from({ length: config.concurrency }, (_, index) =>
      virtualUser(index),
    ),
  );

  return summarizeStage(config, samples);
}

/** Estágio de fundo por `seconds` segundos (para medir recuperação). */
export function stage(
  name: string,
  concurrency: number,
  seconds: number,
): StageConfig {
  return { name, concurrency, durationMs: Math.round(seconds * 1000) };
}

function failsHealth(result: StageResult, health: HealthCriteria): boolean {
  return (
    result.errorRatePct > health.maxErrorRatePct || result.p95 > health.maxP95Ms
  );
}

/**
 * Roda os estágios em ordem (rampa crescente) e classifica:
 * - saturação: estágio de maior throughput;
 * - quebra: primeiro estágio que violou p95/erro;
 * - a rampa PARA no primeiro quebra (não adianta empurrar além disso) —
 *   `stopOnBreak: false` força a rampa completa.
 */
export async function runRamp(args: {
  stages: readonly StageConfig[];
  task: (vuIndex: number, iteration: number) => Promise<unknown>;
  health: HealthCriteria;
  stopOnBreak?: boolean;
  onStage?: (result: StageResult) => void;
}): Promise<RampResult> {
  const results: StageResult[] = [];
  for (const config of args.stages) {
    const result = await runStage(config, args.task);
    results.push(result);
    args.onStage?.(result);
    if (args.stopOnBreak !== false && failsHealth(result, args.health)) break;
  }

  const saturation = results.reduce<StageResult | null>(
    (best, current) =>
      best === null || current.rps > best.rps ? current : best,
    null,
  );
  const breakingPoint =
    results.find((r) => failsHealth(r, args.health)) ?? null;

  return {
    stages: results,
    saturation,
    breakingPoint,
    health: args.health,
  };
}

export function toMarkdownTable(stages: readonly StageResult[]): string {
  const header =
    "| Estágio | VUs | Req/s | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Máx (ms) | Erros | Taxa erro |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows = stages.map(
    (s) =>
      `| ${s.name} | ${s.concurrency} | ${s.rps} | ${s.p50} | ${s.p90} | ${s.p95} | ${s.p99} | ${s.max} | ${s.errors} | ${s.errorRatePct}% |`,
  );
  return [header, ...rows].join("\n");
}

/** Grava JSON de resultado (mkdir -p) e devolve o caminho. */
export function writeJson(path: string, data: unknown): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path;
}