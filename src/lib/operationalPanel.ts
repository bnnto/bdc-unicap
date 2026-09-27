/**
 * Painel Operacional (issue [S5-1]) — regras puras de agregação.
 *
 * CA 1 — cards com números consistentes com o banco: `summarizeJobs`
 * separa vagas por status (abertas, fechadas, encerradas/preenchidas).
 * CA 2 — taxa de empregabilidade calculada a partir de APROVAÇÕES:
 * aprovados / (aprovados + reprovados), ignorando candidaturas em
 * andamento (inscrito/triagem/entrevista) que não podem distorcer a taxa.
 *
 * Arquivo puro (sem I/O, sem React) — consumido pelo servidor Convex
 * (`convex/operational.ts`, fonte da verdade) e pela UI do painel,
 * garantindo que os cards exibam exatamente o que o banco responde.
 */
import type { ApplicationStage } from "./application";

/** Status possíveis de uma vaga (espelha convex/schema.ts — jobs.status). */
export type JobStatus = "aberta" | "fechada" | "encerrada";

/** Linha mínima de vaga para agregação (o que o servidor lê de `jobs`). */
export type JobRow = {
  jobId: string;
  status: JobStatus;
};

/** Linha mínima de candidatura (etapa do pipeline de 5 colunas, S4-1). */
export type ApplicationStageRow = {
  stage: ApplicationStage;
};

/** Resumo de vagas por status. "Preenchidas" = vagas encerradas (R4/cron). */
export type JobSummary = {
  /** Vagas recebendo candidaturas. */
  open: number;
  /** Vagas fechadas manualmente pelo recrutador. */
  closed: number;
  /** Vagas encerradas (preenchidas/expiradas — ciclo completo). */
  filled: number;
  /** Total de vagas — sempre a soma das três categorias. */
  total: number;
};

/**
 * CA 1 — agrega vagas por status. Total é sempre a soma das categorias,
 * o que mantém os cards matematicamente consistentes com o banco.
 */
export function summarizeJobs(jobs: readonly JobRow[]): JobSummary {
  let open = 0;
  let closed = 0;
  let filled = 0;
  for (const job of jobs) {
    if (job.status === "aberta") {
      open += 1;
    } else if (job.status === "fechada") {
      closed += 1;
    } else if (job.status === "encerrada") {
      filled += 1;
    }
  }
  return { open, closed, filled, total: jobs.length };
}

/** Contagem de candidaturas por etapa, para agregar sem mutação. */
function countByStage(
  rows: readonly ApplicationStageRow[],
): Record<ApplicationStage, number> {
  const counts: Record<ApplicationStage, number> = {
    inscrito: 0,
    triagem: 0,
    entrevista: 0,
    aprovado: 0,
    reprovado: 0,
  };
  for (const row of rows) {
    counts[row.stage] += 1;
  }
  return counts;
}

/**
 * CA 2 — taxa de empregabilidade a partir de aprovações.
 * Fórmula: aprovados / (aprovados + reprovados) × 100, arredondada para
 * inteiro (exibição direta). Candidaturas em andamento (inscrito, triagem,
 * entrevista) não entram no denominador — só resultados finais contam.
 * Sem nenhum resultado final, a taxa é indefinida (null — exibida como "—").
 *
 * `approvals` e `candidatures` são somados: o painel é global (todas as
 * vagas), e o servidor pode passar aprovações e o restante das candidaturas
 * em listas separadas conforme sua consulta.
 */
export function employabilityRate(
  approvals: readonly ApplicationStageRow[],
  candidatures: readonly ApplicationStageRow[],
): number | null {
  const approvalsByStage = countByStage(approvals);
  const candidaturesByStage = countByStage(candidatures);
  const approved = approvalsByStage.aprovado + candidaturesByStage.aprovado;
  const rejected = approvalsByStage.reprovado + candidaturesByStage.reprovado;
  const finalized = approved + rejected;
  if (finalized === 0) return null;
  return Math.round((approved / finalized) * 100);
}

/** Formata um percentual inteiro com sufixo (ex.: 50 → "50%"). */
export function formatPercent(value: number): string {
  return `${value}%`;
}

/** Formata a taxa para exibição: null (sem dados) vira travessão "—". */
export function formatEmployabilityRate(rate: number | null): string {
  return rate === null ? "—" : formatPercent(rate);
}

/**
 * Time-to-Hire (issue [S5-2]) — regras puras do indicador.
 *
 * CA 1 — cálculo em dias, agregado corretamente: o tempo é medido por
 * CONTRATAÇÃO (candidatura aprovada) desde a candidatura do contratado
 * até o preenchimento da vaga (`filledAt − appliedAt`), e a média é
 * feita sobre essas amostras — nunca sobre vagas sem contratação.
 * CA 2 — agregação por período (faixa de `filledAt`) para os filtros
 * do dashboard (curso/empresa filtram as amostras antes de chegar aqui).
 */

/** Amostra de uma contratação: candidatura aprovada em vaga preenchida. */
export type TimeToHireSample = {
  jobId: string;
  studentId: string;
  /** Dias entre a candidatura do contratado e o preenchimento da vaga. */
  days: number;
  /** Momento do preenchimento (base do filtro de período). */
  filledAt: number;
};

/**
 * Tempo de contratação em DIAS (CA 1): teto da diferença — um dia
 * parcial conta como dia completo decorrido; mínimo 1 quando há avanco
 * positivo; datas inconsistentes (preenchimento antes da candidatura)
 * valem 0 e são descartadas pela agregação.
 */
export function timeToHireDays(filledAt: number, appliedAt: number): number {
  const diff = filledAt - appliedAt;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/** Vaga preenchida com momento do preenchimento (insumo do pareamento). */
export type FilledJobRow = {
  jobId: string;
  filledAt: number;
};

/** Aprovação com a data da candidatura (insumo do pareamento). */
export type ApprovalRow = {
  jobId: string;
  studentId: string;
  appliedAt: number;
};

/**
 * Pareia aprovações com vagas preenchidas: cada contratação é uma
 * amostra (vaga preenchida sem aprovado, ou aprovado sem vaga
 * preenchida, não medem tempo de contratação).
 */
export function hireSamples(
  filledJobs: readonly FilledJobRow[],
  approvals: readonly ApprovalRow[],
): TimeToHireSample[] {
  const filledByJob = new Map(filledJobs.map((j) => [j.jobId, j]));
  const samples: TimeToHireSample[] = [];
  for (const approval of approvals) {
    const job = filledByJob.get(approval.jobId);
    if (job === undefined) continue;
    const days = timeToHireDays(job.filledAt, approval.appliedAt);
    if (days <= 0) continue; // datas inconsistentes não medem tempo
    samples.push({
      jobId: approval.jobId,
      studentId: approval.studentId,
      days,
      filledAt: job.filledAt,
    });
  }
  return samples;
}

/** Filtro de período sobre a data de preenchimento (limites inclusivos). */
export type PeriodFilter = {
  from?: number;
  to?: number;
};

/** Filtra amostras por faixa de `filledAt` (agregado por período, CA 1). */
export function filterSamplesByPeriod(
  samples: readonly TimeToHireSample[],
  period: PeriodFilter,
): TimeToHireSample[] {
  return samples.filter((s) => {
    if (period.from !== undefined && s.filledAt < period.from) return false;
    if (period.to !== undefined && s.filledAt > period.to) return false;
    return true;
  });
}

/**
 * Média de dias das amostras, arredondada para inteiro (exibição direta).
 * Sem amostras não há contratação para medir: null (vira "—" na UI).
 */
export function averageTimeToHire(
  samples: readonly TimeToHireSample[],
): number | null {
  if (samples.length === 0) return null;
  const total = samples.reduce((sum, s) => sum + s.days, 0);
  return Math.round(total / samples.length);
}

/** Formata o TTH médio: null (sem dados) vira travessão, dias com sufixo. */
export function formatTimeToHire(days: number | null): string {
  if (days === null) return "—";
  return days === 1 ? "1 dia" : `${days} dias`;
}

/**
 * Exportação dos relatórios (issue [S6-1]) — mapeamento puro das métricas
 * JÁ FILTRADAS pelo painel (S5-5) para as seções do arquivo. A UI passa
 * o estado vigente das 4 queries; nada é rebuscado do servidor, então o
 * download reflete exatamente o que o usuário está vendo (CA 1).
 */
import type { ExportReport, ReportRow, ReportSection } from "./reportExport";
import type { FunnelStep } from "./funnel";

/** Entrada: estado vigente das métricas do painel (podem estar ausentes). */
export type OperationalReportInput = {
  summary: {
    jobs: JobSummary;
    applications: {
      total: number;
      inProgress: number;
      finalized: number;
      approved: number;
      rejected: number;
    };
    employability: { rate: number | null };
  };
  timeToHire?: { averageDays: number | null; samplesCount: number };
  funnel?: { steps: readonly FunnelStep[]; totalApplications: number };
  rankings?: {
    topCompanies: readonly {
      recruiterId?: string;
      companyName: string;
      publishedJobs: number;
      applicationsCount: number;
    }[];
    topJobs: readonly {
      jobId?: string;
      title: string;
      companyName: string;
      applicationsCount: number;
    }[];
  };
};

/** Linha de ranking com posição (1-based) na frente. */
function rankedRows(
  rows: readonly {
    label: string;
    secondary?: string;
    publishedJobs?: number;
    applicationsCount: number;
  }[],
): ReportRow[] {
  return rows.map((row, index) => [
    index + 1,
    row.label,
    row.secondary ?? row.publishedJobs ?? "",
    row.applicationsCount,
  ]);
}

/**
 * Monta o relatório operacional completo: 6 seções na mesma ordem de
 * exibição do painel (cards → candidaturas → funil → rankings → TTH).
 */
export function buildOperationalReport(
  input: OperationalReportInput,
): ExportReport {
  const { summary } = input;
  const sections: ReportSection[] = [
    {
      title: "Resumo de Vagas",
      columns: ["Métrica", "Valor"],
      rows: [
        ["Vagas abertas", summary.jobs.open],
        ["Vagas fechadas", summary.jobs.closed],
        ["Vagas preenchidas", summary.jobs.filled],
        ["Total de vagas", summary.jobs.total],
      ],
    },
    {
      title: "Candidaturas",
      columns: ["Métrica", "Valor"],
      rows: [
        ["Total de candidaturas", summary.applications.total],
        ["Em andamento", summary.applications.inProgress],
        ["Finalizadas", summary.applications.finalized],
        ["Aprovados", summary.applications.approved],
        ["Reprovados", summary.applications.rejected],
        ["Taxa de empregabilidade (%)", summary.employability.rate],
      ],
    },
  ];

  if (input.funnel !== undefined) {
    sections.push({
      title: "Funil de Conversão",
      columns: ["Etapa", "Candidaturas", "Conversão da etapa anterior (%)"],
      rows: input.funnel.steps.map((step): ReportRow => [
        step.label,
        step.count,
        step.conversionFromPrevious ?? "",
      ]),
    });
  }

  if (input.rankings !== undefined) {
    sections.push({
      title: "Empresas Mais Ativas",
      columns: ["#", "Empresa", "Vagas publicadas", "Candidatos"],
      rows: rankedRows(
        input.rankings.topCompanies.map((company) => ({
          label: company.companyName,
          publishedJobs: company.publishedJobs,
          applicationsCount: company.applicationsCount,
        })),
      ),
    });
    sections.push({
      title: "Vagas Mais Procuradas",
      columns: ["#", "Vaga", "Empresa", "Candidatos"],
      rows: rankedRows(
        input.rankings.topJobs.map((job) => ({
          label: job.title,
          secondary: job.companyName,
          applicationsCount: job.applicationsCount,
        })),
      ),
    });
  }

  if (input.timeToHire !== undefined) {
    sections.push({
      title: "Time to Hire",
      columns: ["Métrica", "Valor"],
      rows: [
        ["TTH médio (dias)", input.timeToHire.averageDays],
        ["Contratações na amostra", input.timeToHire.samplesCount],
      ],
    });
  }

  return { reportName: "Relatório Operacional UNICAP", sections };
}
