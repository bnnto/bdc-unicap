/**
 * Empresas/Vagas mais ativas (issue [S5-4]) — regras puras de ranking.
 *
 * CA 1 — Top N por vagas publicadas e volume de candidaturas:
 * - Vagas: ordenadas por candidatos atraídos (applicationsCount).
 * - Empresas: rollup de publicações + candidaturas por recrutador,
 *   ordenado por candidatos atraídos, desempatando por publicações.
 * Desempates determinísticos (candidaturas → publicações → nome/título)
 * garantem um ranking estável entre renders.
 *
 * Arquivo puro (sem I/O, sem React) — consumido pela query Convex
 * (`activeRankings`, fonte da verdade) e pela UI do painel.
 */

/** Linha de atividade de uma vaga (insumo dos rankings). */
export type JobActivityRow = {
  jobId: string;
  title: string;
  recruiterId: string;
  /** Volume de candidaturas atraídas pela vaga. */
  applicationsCount: number;
};

/** Linha de atividade agregada de uma empresa (recrutador). */
export type CompanyActivityRow = {
  recruiterId: string;
  companyName: string;
  /** Vagas publicadas pela empresa. */
  publishedJobs: number;
  /** Total de candidaturas atraídas por todas as vagas da empresa. */
  applicationsCount: number;
};

/**
 * Top N de vagas por volume de candidaturas (CA 1).
 * Empate: ordem alfabética pelo título. Não muta a lista de entrada.
 */
export function rankJobs(
  jobs: readonly JobActivityRow[],
  limit: number,
): JobActivityRow[] {
  if (limit <= 0) return [];
  return [...jobs]
    .sort((a, b) => {
      if (b.applicationsCount !== a.applicationsCount) {
        return b.applicationsCount - a.applicationsCount;
      }
      return a.title.localeCompare(b.title, "pt-BR");
    })
    .slice(0, limit);
}

/**
 * Top N de empresas por candidatos atraídos (CA 1).
 * Desempate: mais vagas publicadas; depois, ordem alfabética do nome.
 * Não muta a lista de entrada.
 */
export function rankCompanies(
  companies: readonly CompanyActivityRow[],
  limit: number,
): CompanyActivityRow[] {
  if (limit <= 0) return [];
  return [...companies]
    .sort((a, b) => {
      if (b.applicationsCount !== a.applicationsCount) {
        return b.applicationsCount - a.applicationsCount;
      }
      if (b.publishedJobs !== a.publishedJobs) {
        return b.publishedJobs - a.publishedJobs;
      }
      return a.companyName.localeCompare(b.companyName, "pt-BR");
    })
    .slice(0, limit);
}

/**
 * Rollup de atividade por empresa: soma publicações e candidaturas
 * por recrutador. Empresas com vagas publicadas e nenhuma candidatura
 * ainda aparecem (publicar também é atividade). `companyNameFor` resolve
 * o nome de exibição a partir do id do recrutador.
 */
export function aggregateCompanyActivity(
  jobs: readonly JobActivityRow[],
  companyNameFor: (recruiterId: string) => string,
): CompanyActivityRow[] {
  const byRecruiter = new Map<string, CompanyActivityRow>();
  for (const job of jobs) {
    const existing = byRecruiter.get(job.recruiterId);
    if (existing === undefined) {
      byRecruiter.set(job.recruiterId, {
        recruiterId: job.recruiterId,
        companyName: companyNameFor(job.recruiterId),
        publishedJobs: 1,
        applicationsCount: job.applicationsCount,
      });
    } else {
      existing.publishedJobs += 1;
      existing.applicationsCount += job.applicationsCount;
    }
  }
  return [...byRecruiter.values()];
}
