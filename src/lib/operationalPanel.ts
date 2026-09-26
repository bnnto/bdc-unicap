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
