import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from "../src/lib/application";
import {
  averageTimeToHire,
  employabilityRate,
  filterSamplesByPeriod,
  formatEmployabilityRate,
  formatTimeToHire,
  hireSamples,
  summarizeJobs,
  type JobRow,
} from "../src/lib/operationalPanel";
import { buildFunnel } from "../src/lib/funnel";
import {
  aggregateCompanyActivity,
  rankCompanies,
  rankJobs,
  type CompanyActivityRow,
  type JobActivityRow,
} from "../src/lib/activeRanking";
import {
  filterApplicationsForDashboard,
  filterJobsForDashboard,
  normalizeDashboardFilters,
} from "../src/lib/dashboardFilters";
import { getCurrentUser } from "./lib/currentUser";

/**
 * Painel Operacional (issues [S5-1] a [S5-5]) — agregações no SERVIDOR.
 *
 * S5-1: cards de vagas por status + taxa de empregabilidade (CA 1/CA 2).
 * S5-2: time-to-hire médio (filledAt − appliedAt) por contratação.
 * S5-3: funil de conversão por etapa do pipeline.
 * S5-4: ranking de empresas/vagas mais ativas.
 * S5-5: FILTROS COMBINÁVEIS (período, curso, empresa e status) aplicados
 * a TODAS as métricas — as mesmas regras puras de dashboardFilters
 * rodam em cada query, e a UI reage via subscriptions do Convex.
 *
 * Guard (R7): usuário autenticado com consentimento vigente e papel
 * operacional (gestor, recrutador ou empresa) — dados globais do portal,
 * expostos apenas como contagens/médias agregadas (LGPD).
 */

/** Papéis autorizados a ver o painel operacional. */
function canViewOperationalPanel(
  role: string | null | undefined,
): role is "recrutador" | "gestor" {
  return role === "recrutador" || role === "gestor";
}

/** Guard comum (R7 + papel): autenticado, consentimento vigente, papel certo. */
async function requireOperationalViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const user = await getCurrentUser(ctx);
  if (user === null) throw new Error("Usuário não encontrado.");
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
  if (!active) {
    throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
  }
  if (!canViewOperationalPanel(user.role)) {
    throw new Error(
      "Painel operacional disponível apenas para gestores e recrutadores.",
    );
  }
  return user;
}

/** [S5-5] Argumentos de filtros combináveis — compartilhados pelas queries. */
const dashboardFiltersArgs = {
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  course: v.optional(v.string()),
  company: v.optional(v.string()),
  status: v.optional(
    v.union(v.literal("aberta"), v.literal("fechada"), v.literal("encerrada")),
  ),
};

/**
 * Contexto compartilhado dos filtros: mapa de curso por aluno, usado
 * pelas regras puras de S5-5 nas métricas de candidaturas. Filtros de
 * empresa/status/período são aplicados pelas regras puras diretamente.
 */
type FilterContext = {
  filters: ReturnType<typeof normalizeDashboardFilters>;
  studentCourseById: Map<string, string>;
};

/** Filtra candidaturas por curso (perfil do aluno) — regra S5-5. */
function filterAppsByCourseAndCompany(
  docs: readonly Doc<"applications">[],
  ctxOf: FilterContext,
): Doc<"applications">[] {
  const { filters, studentCourseById } = ctxOf;
  if (filters.course === undefined) return [...docs];
  return docs.filter(
    (doc) => studentCourseById.get(doc.studentId) === filters.course,
  );
}

/**
 * [S5-5] Conjunto de ids de vagas permitidos pelo filtro de empresa
 * (recrutador responsável — mesma convenção da S5-2/S5-4).
 */
function jobIdsForCompany(
  allJobs: readonly Doc<"jobs">[],
  filters: ReturnType<typeof normalizeDashboardFilters>,
  companyNameFor: (recruiterId: string) => string,
): Set<string> | null {
  if (filters.company === undefined) return null;
  return new Set(
    allJobs
      .filter((job) => companyNameFor(job.recruiterId) === filters.company)
      .map((job) => job._id),
  );
}

/**
 * S5-1 — Resumo operacional: vagas por status + candidaturas por etapa
 * + taxa de empregabilidade. Reativo e, desde S5-5, filtrável.
 */
export const operationalSummary = query({
  args: { ...dashboardFiltersArgs },
  handler: async (ctx, rawArgs) => {
    await requireOperationalViewer(ctx);
    const filters = normalizeDashboardFilters(rawArgs);

    // Vagas por status (índice by_status) — base de todos os filtros.
    const [openJobs, closedJobs, filledJobs] = await Promise.all([
      ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "aberta"))
        .collect(),
      ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "fechada"))
        .collect(),
      ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "encerrada"))
        .collect(),
    ]);
    const allJobs = [...openJobs, ...closedJobs, ...filledJobs];

    // S5-5 — filtros de vaga: status + período de publicação.
    // A regra pura decide os IDs (projeção mínima); docs completos seguem.
    const visibleJobIds = new Set(
      filterJobsForDashboard(
        allJobs.map((job) => ({
          jobId: job._id,
          status: job.status,
          publishedAt: job.publishedAt,
        })),
        filters,
      ).map((row) => row.jobId),
    );
    const visibleJobs = allJobs.filter((job) => visibleJobIds.has(job._id));
    const jobRows: JobRow[] = visibleJobs.map((job) => ({
      jobId: job._id,
      status: job.status,
    }));
    const jobs = summarizeJobs(jobRows);

    // Contexto dos filtros de candidatura.
    const jobStatusById = new Map(allJobs.map((job) => [job._id, job.status]));
    const studentCourseById = new Map(
      (await ctx.db.query("students").collect()).map((s) => [s._id, s.course]),
    );
    const userById = new Map(
      (await ctx.db.query("users").collect()).map((u) => [u._id, u]),
    );
    const companyNameFor = (recruiterId: string): string => {
      const recruiter = userById.get(recruiterId as Doc<"users">["_id"]);
      return recruiter?.name ?? recruiter?.email ?? "Empresa";
    };
    const ctxOf: FilterContext = {
      filters,
      studentCourseById,
    };

    // Candidaturas por etapa (índice by_stage), com filtros combináveis:
    // curso → empresa (via vaga) → status (via vaga) → período (appliedAt).
    let stageDocs: Doc<"applications">[] = [];
    for (const stage of APPLICATION_STAGES) {
      const docs = await ctx.db
        .query("applications")
        .withIndex("by_stage", (q) => q.eq("stage", stage))
        .collect();
      stageDocs = stageDocs.concat(docs);
    }
    const companyJobIds = jobIdsForCompany(allJobs, filters, companyNameFor);
    let visibleApps = filterAppsByCourseAndCompany(stageDocs, ctxOf);
    if (companyJobIds !== null) {
      visibleApps = visibleApps.filter((doc) => companyJobIds.has(doc.jobId));
    }
    const filteredApps = filterApplicationsForDashboard(
      visibleApps.map((doc) => ({
        jobId: doc.jobId,
        stage: doc.stage,
        appliedAt: doc.appliedAt,
      })),
      jobStatusById,
      filters,
    );

    const stageCounts: Record<ApplicationStage, number> = {
      inscrito: 0,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
      reprovado: 0,
    };
    for (const app of filteredApps) {
      stageCounts[app.stage] += 1;
    }

    const approved = stageCounts.aprovado;
    const rejected = stageCounts.reprovado;
    const finalized = approved + rejected;
    const inProgress = filteredApps.length - finalized;
    const rate = employabilityRate(
      filteredApps
        .filter((app) => app.stage === "aprovado")
        .map((app) => ({ stage: app.stage })),
      filteredApps
        .filter((app) => app.stage === "reprovado")
        .map((app) => ({ stage: app.stage })),
    );

    return {
      jobs,
      applications: {
        total: filteredApps.length,
        inProgress,
        finalized,
        approved,
        rejected,
        byStage: stageCounts,
      },
      employability: {
        rate,
        label: formatEmployabilityRate(rate),
        approved,
        rejected,
      },
    };
  },
});

/**
 * S5-2 — Time-to-Hire médio: amostras por contratação
 * (candidatura aprovada em vaga preenchida). Filtros S5-5 combináveis.
 */
export const timeToHireStats = query({
  args: { ...dashboardFiltersArgs },
  handler: async (ctx, rawArgs) => {
    await requireOperationalViewer(ctx);
    const filters = normalizeDashboardFilters(rawArgs);

    // Vagas preenchidas (encerradas) — `filledAt` gravado no encerramento
    // manual (setJobStatus) ou pelo cron R4. Filtro de status: se pediu
    // outro status, nenhuma vaga preenchida permanece.
    let filledJobs = (
      await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "encerrada"))
        .collect()
    ).filter(
      (job): job is Doc<"jobs"> & { filledAt: number } =>
        job.filledAt !== undefined,
    );
    if (filters.status !== undefined && filters.status !== "encerrada") {
      filledJobs = [];
    }

    // Perfis dos contratados e recrutadores (curso e empresa dos filtros).
    const studentCourseById = new Map(
      (await ctx.db.query("students").collect()).map((s) => [s._id, s.course]),
    );
    const userById = new Map(
      (await ctx.db.query("users").collect()).map((u) => [u._id, u]),
    );
    const companyNameFor = (recruiterId: string): string => {
      const recruiter = userById.get(recruiterId as Doc<"users">["_id"]);
      return recruiter?.name ?? recruiter?.email ?? "Empresa";
    };

    /** Empresa de uma vaga = recrutador responsável (fallback e-mail). */
    const companyNameForJob = (job: Doc<"jobs">): string =>
      companyNameFor(job.recruiterId);

    // Facets SEM filtro: opções para os dropdowns de curso/empresa da UI.
    const approvalDocs = await ctx.db
      .query("applications")
      .withIndex("by_stage", (q) => q.eq("stage", "aprovado"))
      .collect();
    const courses = [
      ...new Set(
        approvalDocs.flatMap((doc) => {
          const course = studentCourseById.get(doc.studentId);
          return course === undefined ? [] : [course];
        }),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const companies = [
      ...new Set(filledJobs.map(companyNameForJob).filter((n) => n !== "")),
    ].sort((a, b) => a.localeCompare(b));

    // Filtro de empresa (recrutador da vaga) sobre as vagas preenchidas.
    const visibleFilledJobs =
      filters.company === undefined
        ? filledJobs
        : filledJobs.filter(
            (job) => companyNameForJob(job) === filters.company,
          );
    const visibleByJobId = new Set(visibleFilledJobs.map((job) => job._id));

    // Pareamento aprovação × vaga preenchida (regra pura S5-2), com
    // filtros de curso/status aplicados antes da agregação de período.
    const samples = hireSamples(
      visibleFilledJobs.map((job) => ({
        jobId: job._id,
        filledAt: job.filledAt,
      })),
      approvalDocs
        .filter((doc) => {
          if (!visibleByJobId.has(doc.jobId)) return false;
          if (
            filters.course !== undefined &&
            studentCourseById.get(doc.studentId) !== filters.course
          ) {
            return false;
          }
          return true;
        })
        .map((doc) => ({
          jobId: doc.jobId,
          studentId: doc.studentId,
          appliedAt: doc.appliedAt,
        })),
    );

    const filtered = filterSamplesByPeriod(samples, {
      from: filters.from,
      to: filters.to,
    });
    const average = averageTimeToHire(filtered);

    return {
      averageDays: average,
      label: formatTimeToHire(average),
      samplesCount: filtered.length,
      facets: { courses, companies },
    };
  },
});

/**
 * S5-3 — Funil de conversão por etapa do pipeline, com filtros
 * combináveis S5-5 (status via vaga, empresa via recrutador, curso via
 * perfil do aluno e período por candidatura).
 */
export const pipelineFunnel = query({
  args: { ...dashboardFiltersArgs },
  handler: async (ctx, rawArgs) => {
    await requireOperationalViewer(ctx);
    const filters = normalizeDashboardFilters(rawArgs);

    const allJobs = await ctx.db.query("jobs").collect();
    const jobStatusById = new Map(allJobs.map((job) => [job._id, job.status]));
    const studentCourseById = new Map(
      (await ctx.db.query("students").collect()).map((s) => [s._id, s.course]),
    );
    const userById = new Map(
      (await ctx.db.query("users").collect()).map((u) => [u._id, u]),
    );
    const companyNameFor = (recruiterId: string): string => {
      const recruiter = userById.get(recruiterId as Doc<"users">["_id"]);
      return recruiter?.name ?? recruiter?.email ?? "Empresa";
    };
    const ctxOf: FilterContext = {
      filters,
      studentCourseById,
    };
    const companyJobIds = jobIdsForCompany(allJobs, filters, companyNameFor);

    // Candidaturas por etapa via índice by_stage + filtros combináveis.
    let stageDocs: Doc<"applications">[] = [];
    for (const stage of APPLICATION_STAGES) {
      const docs = await ctx.db
        .query("applications")
        .withIndex("by_stage", (q) => q.eq("stage", stage))
        .collect();
      stageDocs = stageDocs.concat(docs);
    }
    let visibleDocs = filterAppsByCourseAndCompany(stageDocs, ctxOf);
    if (companyJobIds !== null) {
      visibleDocs = visibleDocs.filter((doc) => companyJobIds.has(doc.jobId));
    }
    const visibleRows = filterApplicationsForDashboard(
      visibleDocs.map((doc) => ({
        jobId: doc.jobId,
        stage: doc.stage,
        appliedAt: doc.appliedAt,
      })),
      jobStatusById,
      filters,
    );

    // CA 1 — contagem e conversão % entre degraus (regra pura S5-3);
    // CA 2 — etapas sem candidatura aparecem zeradas, na ordem de exibição.
    const steps = buildFunnel(visibleRows);

    return { steps, totalApplications: visibleRows.length };
  },
});

/**
 * S5-4 — Empresas/Vagas mais ativas: Top N por publicações e candidatos
 * atraídos, com filtros combináveis S5-5 (vagas filtradas por status/
 * período/empresa; candidaturas contadas por curso/período).
 */
export const activeRankings = query({
  args: { limit: v.optional(v.number()), ...dashboardFiltersArgs },
  handler: async (ctx, rawArgs) => {
    await requireOperationalViewer(ctx);
    const { limit: rawLimit, ...filterArgs } = rawArgs;
    const filters = normalizeDashboardFilters(filterArgs);
    const limit = rawLimit ?? 5;

    const allJobs = await ctx.db.query("jobs").collect();
    const studentCourseById = new Map(
      (await ctx.db.query("students").collect()).map((s) => [s._id, s.course]),
    );
    const userById = new Map(
      (await ctx.db.query("users").collect()).map((u) => [u._id, u]),
    );
    const companyNameFor = (recruiterId: string): string => {
      const recruiter = userById.get(recruiterId as Doc<"users">["_id"]);
      return recruiter?.name ?? recruiter?.email ?? "Empresa";
    };

    // S5-5 — vagas visíveis: status + período de publicação + empresa.
    // A regra pura decide os IDs; os docs completos seguem para o ranking.
    const visibleJobIds = new Set(
      filterJobsForDashboard(
        allJobs.map((job) => ({
          jobId: job._id,
          status: job.status,
          publishedAt: job.publishedAt,
        })),
        filters,
      ).map((row) => row.jobId),
    );
    const visibleJobs = allJobs.filter(
      (job) =>
        visibleJobIds.has(job._id) &&
        (filters.company === undefined ||
          companyNameFor(job.recruiterId) === filters.company),
    );

    // Volume de candidaturas por vaga (índice by_job), contando apenas
    // candidaturas que passam pelos filtros de curso e período.
    const jobRows: JobActivityRow[] = [];
    for (const job of visibleJobs) {
      const docs = await ctx.db
        .query("applications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      const counted = filterApplicationsForDashboard(
        docs.filter(
          (doc) =>
            filters.course === undefined ||
            studentCourseById.get(doc.studentId) === filters.course,
        ),
        new Map(),
        { from: filters.from, to: filters.to },
      );
      jobRows.push({
        jobId: job._id,
        title: job.title,
        recruiterId: job.recruiterId,
        applicationsCount: counted.length,
      });
    }

    // CA 1 — rankings com as regras puras (desempates determinísticos).
    const companyRows: CompanyActivityRow[] = aggregateCompanyActivity(
      jobRows,
      companyNameFor,
    );
    const topCompanies = rankCompanies(companyRows, limit).map((company) => ({
      recruiterId: company.recruiterId,
      companyName: company.companyName,
      publishedJobs: company.publishedJobs,
      applicationsCount: company.applicationsCount,
    }));
    const topJobs = rankJobs(jobRows, limit).map((job) => ({
      jobId: job.jobId,
      title: job.title,
      companyName: companyNameFor(job.recruiterId),
      applicationsCount: job.applicationsCount,
    }));

    return { limit, topCompanies, topJobs };
  },
});
