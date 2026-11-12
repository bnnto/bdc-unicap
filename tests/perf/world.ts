/**
 * Seed determinístico compartilhado pelos cenários de performance.
 *
 * Usa a MESMA `internalMutation` de produção/testes
 * (`students.seedTalentBenchmarkBatch`) e o mock oficial do backend
 * (convex-test), então as medições incluem o custo real de índice,
 * autorização (R7), projeção R6 e paginação do `searchTalent`.
 */
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";
import { benchmarkUnitCount } from "../../src/lib/talentBenchmark";

const modules = import.meta.glob("../../convex/**/*.*s");

type Backend = ReturnType<typeof convexTest>;

/** Argumentos aceitos pela query medida. */
export type TalentSearchArgs = FunctionArgs<typeof api.students.searchTalent>;

export type PerfWorld = {
  /** Backend em memória com 10.500 currículos + 1 recrutador consentido. */
  asRecruiter: ReturnType<Backend["withIdentity"]>;
  seededRows: number;
  seedMs: number;
  /** Alias para o backend (reuso em asserções de sanidade). */
  backend: Backend;
};

/**
 * Semeia a base do benchmark (10.500 perfis) e devolve um cliente
 * autenticado como recrutador (papel exigido pelo `searchTalent`).
 */
export async function createPerfWorld(): Promise<PerfWorld> {
  const backend = convexTest(schema, modules);
  const seededStart = performance.now();

  let seededRows = 0;
  for (let unit = 0; unit < benchmarkUnitCount(); unit++) {
    seededRows += await backend.mutation(
      internal.students.seedTalentBenchmarkBatch,
      { runId: 1, unitIndex: unit },
    );
  }

  const recruiterId = await backend.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      email: "perf-recruiter@unicap.br",
      name: "Recrutador Performance",
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

  const asRecruiter = backend.withIdentity({
    email: "perf-recruiter@unicap.br",
    subject: `perf-recruiter-${String(recruiterId)}`,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${String(recruiterId)}`,
  });

  // Sanidade: a base está visível e a query responde (evita medir vazio).
  const probe = await asRecruiter.query(api.students.searchTalent, {
    page: 0,
  });
  if (probe.items.length === 0) {
    throw new Error("Seed de performance não produziu resultados elegíveis.");
  }

  return {
    asRecruiter,
    seededRows,
    seedMs: Math.round(performance.now() - seededStart),
    backend,
  };
}

/** Cenários de tráfego do Banco de Talentos (mix realista de recrutadores). */
export const TALENT_SCENARIOS: ReadonlyArray<{
  name: string;
  args: TalentSearchArgs;
}> = [
  {
    name: "padrao (pagina 0)",
    args: { page: 0 },
  },
  {
    name: "busca textual",
    args: { search: "Aluno B1 00010", page: 0 },
  },
  {
    name: "chips + curso + ordenacao",
    args: {
      skills: ["React", "TypeScript", "SQL"],
      course: "Ciência da Computação",
      sort: "nome",
      page: 0,
    },
  },
  {
    name: "disponibilidade + idioma",
    args: {
      availability: ["estagio"],
      language: "Inglês",
      languageLevel: "avancado",
      page: 0,
    },
  },
  {
    name: "faixa de conclusao + local",
    args: {
      graduationYearFrom: 2024,
      graduationYearTo: 2024,
      location: "Recife",
      page: 1,
    },
  },
];

export type TalentScenario = (typeof TALENT_SCENARIOS)[number];