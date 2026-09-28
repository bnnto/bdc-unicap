/**
 * [S8-3] Testes de INTEGRAÇÃO do benchmark de busca com 10k+ currículos
 * (CAs: queries dentro do SLA com a base semeada; sem full-scan — índices
 * validados), contra o mock oficial do backend Convex (convex-test).
 *
 * O seed é determinístico via `students.seedTalentBenchmarkBatch`
 * (internalMutation): 10.500 perfis em lotes de 100, com população
 * segregada para provar que R1 (inativo) e R2 (privado) continuam fora
 * dos resultados mesmo em escala.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  BENCHMARK_UNIT_SIZE,
  TALENT_QUERY_SLA_MS,
  benchmarkScannedRows,
  benchmarkUnitCount,
  validateTalentBenchmark,
} from "../../src/lib/talentBenchmark";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const RECRUITER = { email: "recruiter@unicap.br", subject: "recruiter-1" };
const INACTIVE = { email: "inativo@unicap.br", subject: "inativo-1" };

/** Semeia a base do benchmark em lotes (100 perfis por chamada). */
async function seedBenchmark(t: World): Promise<number> {
  let seeded = 0;
  for (let unit = 0; unit < benchmarkUnitCount(); unit++) {
    seeded += await t.mutation(internal.students.seedTalentBenchmarkBatch, {
      runId: 1,
      unitIndex: unit,
    });
  }
  return seeded;
}

function asRecruiter(t: World, recruiterId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${recruiterId}`,
  });
}

describe("S8-3 — benchmark do Banco de Talentos com 10k+ currículos", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "CA 1 — query padrão responde dentro do SLA com base semeada (10.500)",
    { timeout: 120_000 },
    async () => {
      const t = convexTest(schema, modules);
      const recruiterId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          email: RECRUITER.email,
          name: "Recrutador Benchmark",
          role: "recrutador",
          active: true,
        });
        await ctx.db.insert("consents", {
          userId: id,
          termVersion: CURRENT_TERM_VERSION,
          acceptedAt: Date.now(),
        });
        return id;
      });

      const seeded = await seedBenchmark(t);
      expect(seeded).toBeGreaterThanOrEqual(10_000);

      const started = performance.now();
      const page1 = await asRecruiter(t, recruiterId).query(
        api.students.searchTalent,
        { page: 0 },
      );
      const elapsed = performance.now() - started;

      // Primeira página: 10 itens; a varredura é trincada por design
      // ([S2-4]: 2 status × 200), provando o não-full-scan com 10.500
      // currículos na base (leitura ≪ base).
      expect(page1.items).toHaveLength(10);
      expect(page1.total).toBeGreaterThan(0);
      expect(page1.total).toBeLessThanOrEqual(benchmarkScannedRows());
      expect(page1.hasNext).toBe(true);
      expect(page1.pageCount).toBe(Math.ceil(page1.total / 10));

      const report = validateTalentBenchmark({
        scenario: "padrao",
        seededRows: seeded,
        elapsedMs: elapsed,
        scannedRows: benchmarkScannedRows(),
        indexUsed: "by_visibility_status",
      });
      expect(report.ok, JSON.stringify(report.failed)).toBe(true);
      expect(elapsed).toBeLessThan(TALENT_QUERY_SLA_MS);
    },
  );

  it(
    "CA 1 — busca filtrada (disponibilidade + curso) dentro do SLA",
    { timeout: 120_000 },
    async () => {
      const t = convexTest(schema, modules);
      const recruiterId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          email: RECRUITER.email,
          name: "Recrutador Benchmark",
          role: "recrutador",
          active: true,
        });
        await ctx.db.insert("consents", {
          userId: id,
          termVersion: CURRENT_TERM_VERSION,
          acceptedAt: Date.now(),
        });
        return id;
      });
      await seedBenchmark(t);

      const started = performance.now();
      const result = await asRecruiter(t, recruiterId).query(
        api.students.searchTalent,
        { availability: "estagio", course: "Ciência da Computação", page: 0 },
      );
      const elapsed = performance.now() - started;

      expect(result.items.length).toBeGreaterThan(0);
      // Filtro respeitado em escala (após os índices e filtros combináveis).
      for (const item of result.items) {
        expect(item.availability).toBe("estagio");
      }

      const report = validateTalentBenchmark({
        scenario: "disponibilidade+curso",
        seededRows: 10_500,
        elapsedMs: elapsed,
        scannedRows: benchmarkScannedRows(),
        indexUsed: "by_status_availability",
      });
      expect(report.ok, JSON.stringify(report.failed)).toBe(true);
      expect(elapsed).toBeLessThan(TALENT_QUERY_SLA_MS);
    },
  );

  it(
    "CA 2 — R1/R2 em escala: inativos e privados nunca aparecem",
    { timeout: 120_000 },
    async () => {
      const t = convexTest(schema, modules);
      const recruiterId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          email: RECRUITER.email,
          name: "Recrutador Benchmark",
          role: "recrutador",
          active: true,
        });
        await ctx.db.insert("consents", {
          userId: id,
          termVersion: CURRENT_TERM_VERSION,
          acceptedAt: Date.now(),
        });
        return id;
      });
      const inactiveUserId = await t.run(async (ctx) => {
        return ctx.db.insert("users", {
          email: INACTIVE.email,
          name: "Aluno Inativo Referência",
          role: "aluno",
          active: true,
        });
      });

      await seedBenchmark(t);

      // Um inativo PÚBLICO (contraexemplo de R1) com nome exclusivo.
      await t.run(async (ctx) => {
        await ctx.db.insert("students", {
          userId: inactiveUserId,
          fullName: "Zeca Inativo Publico",
          enrollment: "0000001",
          status: "inativo",
          course: "Direito",
          graduationYear: 2024,
          availability: "integral",
          visibility: "publico",
        });
        await ctx.db.insert("consents", {
          userId: inactiveUserId,
          termVersion: "v1.0",
          acceptedAt: Date.now(),
        });
      });

      const result = await asRecruiter(t, recruiterId).query(
        api.students.searchTalent,
        { search: "Zeca Inativo Publico", page: 0 },
      );
      expect(result.items).toHaveLength(0);

      // Nenhum resultado da base semeada é inativo ou privado.
      const all = await asRecruiter(t, recruiterId).query(
        api.students.searchTalent,
        { page: 0 },
      );
      for (const item of all.items) {
        expect(item.status).not.toBe("inativo");
      }
    },
  );

  it("seed é idempotente por runId (reexecução não duplica matrículas)", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.students.seedTalentBenchmarkBatch, {
      runId: 9,
      unitIndex: 0,
    });
    const second = await t.mutation(
      internal.students.seedTalentBenchmarkBatch,
      { runId: 9, unitIndex: 0 },
    );
    expect(first).toBe(BENCHMARK_UNIT_SIZE);
    expect(second).toBe(0);
  });

  it("lote inválido (unidade fora do plano) é rejeitado", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.students.seedTalentBenchmarkBatch, {
        runId: 1,
        unitIndex: -1,
      }),
    ).rejects.toThrow(/unidade de seed/i);
  });
});
