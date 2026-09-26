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

/**
 * Painel Operacional (issue [S5-1]) — agregações no SERVIDOR.
 *
 * CA 1 — os números dos cards são calculados aqui, direto do banco
 * (jobs por status via índice `by_status`; candidaturas por etapa via
 * índice `by_stage`), nunca na UI — o painel exibe exatamente o que o
 * banco responde.
 * CA 2 — a taxa de empregabilidade é calculada a partir de APROVAÇÕES
 * com a regra pura de S5-1 (aprovados / finalizados).
 *
 * Guard (R7): usuário autenticado com consentimento vigente e papel
 * operacional (gestor, recrutador ou empresa) — dados globais do portal.
 */

/** Papéis autorizados a ver o painel operacional. */
function canViewOperationalPanel(
  role: string | null | undefined,
): role is "recrutador" | "gestor" | "empresa" {
  return role === "recrutador" || role === "gestor" || role === "empresa";
}

/** Guard comum (R7 + papel): autenticado, consentimento vigente, papel certo. */
async function requireOperationalViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const email = identity.email ?? identity.tokenIdentifier;
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
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

/**
 * Resumo operacional global: vagas por status + candidaturas por etapa
 * + taxa de empregabilidade (aprovações). Reativo: qualquer movimentação
 * no Kanban ou mudança de status de vaga atualiza os cards em tempo real.
 */
export const operationalSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireOperationalViewer(ctx);

    // CA 1 — vagas por status, uma consulta por valor do índice `by_status`.
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
    const jobRows: JobRow[] = [openJobs, closedJobs, filledJobs]
      .flat()
      .map((job) => ({ jobId: job._id, status: job.status }));
    const jobs = summarizeJobs(jobRows);

    // Candidaturas por etapa (pipeline de 5 colunas, S4-1), via índice
    // `by_stage`. Escala de MVP: uma leitura por etapa mantém os números
    // consistentes sem varredura completa da tabela.
    const stageCounts: Record<ApplicationStage, number> = {
      inscrito: 0,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
      reprovado: 0,
    };
    let totalApplications = 0;
    let approvedRows: ApplicationStage[] = [];
    let rejectedRows: ApplicationStage[] = [];
    for (const stage of APPLICATION_STAGES) {
      const rows = await ctx.db
        .query("applications")
        .withIndex("by_stage", (q) => q.eq("stage", stage))
        .collect();
      stageCounts[stage] = rows.length;
      totalApplications += rows.length;
      // CA 2 — só resultados finais alimentam a taxa (regra pura S5-1).
      if (stage === "aprovado") {
        approvedRows = rows.map((r) => r.stage);
      } else if (stage === "reprovado") {
        rejectedRows = rows.map((r) => r.stage);
      }
    }

    const approved = stageCounts.aprovado;
    const rejected = stageCounts.reprovado;
    const finalized = approved + rejected;
    const inProgress = totalApplications - finalized;
    const rate = employabilityRate(
      approvedRows.map((stage) => ({ stage })),
      rejectedRows.map((stage) => ({ stage })),
    );

    return {
      jobs,
      applications: {
        total: totalApplications,
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
 * [S5-2] Time-to-Hire médio — CA 1: cálculo em dias agregado no
 * SERVIDOR; CA 2: filtros de período/curso/empresa aplicados aos dados
 * antes da agregação. Cada amostra é uma contratação (candidatura
 * aprovada em vaga preenchida) com `filledAt − appliedAt`.
 *
 * R7: mesmo guard da visão operacional. Aluno/egresso nunca expõe
 * dado além do que o papel autoriza (LGPD: só contagens e médias,
 * sem dados pessoais dos contratados).
 */
export const timeToHireStats = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    course: v.optional(v.string()),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperationalViewer(ctx);

    // Vagas preenchidas (encerradas) — `filledAt` gravado no encerramento
    // manual (setJobStatus) ou pelo cron R4.
    const filledJobs = (
      await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "encerrada"))
        .collect()
    ).filter(
      (job): job is Doc<"jobs"> & { filledAt: number } =>
        job.filledAt !== undefined,
    );
    const filledByJobId = new Map(filledJobs.map((j) => [j._id, j]));

    // Aprovações (pipeline S4-1) — via índice by_stage.
    const approvals = await ctx.db
      .query("applications")
      .withIndex("by_stage", (q) => q.eq("stage", "aprovado"))
      .collect();

    // Perfis dos contratados e recrutadores (curso e empresa dos filtros).
    const studentById = new Map(
      (await ctx.db.query("students").collect()).map((s) => [s._id, s]),
    );
    const userById = new Map(
      (await ctx.db.query("users").collect()).map((u) => [u._id, u]),
    );

    /** Empresa de uma vaga = recrutador responsável (fallback e-mail). */
    const companyNameFor = (job: Doc<"jobs">): string => {
      const recruiter = userById.get(job.recruiterId);
      return recruiter?.name ?? recruiter?.email ?? "";
    };

    // Facets SEM filtro: opções para os dropdowns de curso/empresa da UI.
    const courses = [
      ...new Set(
        approvals.flatMap((a) => {
          const student = studentById.get(a.studentId);
          return student === undefined ? [] : [student.course];
        }),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const companies = [
      ...new Set(filledJobs.map(companyNameFor).filter((n) => n !== "")),
    ].sort((a, b) => a.localeCompare(b));

    // Pareamento aprovação × vaga preenchida (regra pura S5-2) com os
    // filtros de curso/empresa aplicados antes da agregação.
    const samples = hireSamples(
      filledJobs.map((job) => ({
        jobId: job._id,
        filledAt: job.filledAt,
      })),
      approvals
        .filter((a) => {
          const job = filledByJobId.get(a.jobId);
          if (job === undefined) return false;
          const student = studentById.get(a.studentId);
          if (args.course !== undefined && student?.course !== args.course) {
            return false;
          }
          if (
            args.company !== undefined &&
            companyNameFor(job) !== args.company
          ) {
            return false;
          }
          return true;
        })
        .map((a) => ({
          jobId: a.jobId,
          studentId: a.studentId,
          appliedAt: a.appliedAt,
        })),
    );

    const filtered = filterSamplesByPeriod(samples, {
      from: args.from,
      to: args.to,
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
