import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from "../src/lib/application";
import {
  employabilityRate,
  formatEmployabilityRate,
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
