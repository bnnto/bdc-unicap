/**
 * [FINAL_UPGRADE Etapa 3] — cálculos matemáticos PUROS do Dashboard de
 * Analytics do aluno (TDD, sem I/O). Consumidos pela query Convex
 * `applications.myStats` (fonte da verdade no servidor) e testáveis
 * isoladamente aqui.
 *
 * Especificação (FINAL_UPGRADE.md):
 *  - Total de Candidaturas: contagem real.
 *  - Taxa de Sucesso: (Candidaturas em Entrevista ou Aprovado / Total) × 100.
 *  - Visualizações do Perfil: contador simples gravado no perfil.
 */
import { APPLICATION_STAGES, type ApplicationStage } from "./application";

/** Mínimo necessário de uma candidatura para as métricas. */
export type AnalyticsApplication = {
  stage: ApplicationStage;
  matchScore: number;
};

/** Agregado exibido no dashboard do aluno (serializável p/ Convex). */
export type StudentAnalytics = {
  total: number;
  /** 0–100 com 1 casa decimal; 0 quando não há candidaturas. */
  successRate: number;
  byStage: Record<ApplicationStage, number>;
  profileViews: number;
  /** Média de matchScore 0–100 (1 casa decimal); 0 sem candidaturas. */
  averageMatch: number;
};

/**
 * Sucesso = candidatura em "Entrevista" ou "Aprovado"
 * (FINAL_UPGRADE.md — Taxa de Sucesso).
 */
export function isSuccessStage(stage: ApplicationStage): boolean {
  return stage === "entrevista" || stage === "aprovado";
}

/** Arredonda para 1 casa decimal (evita 33.333333333333336 na UI). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Taxa de Sucesso = (Entrevista + Aprovado) / Total × 100.
 * Sem candidaturas retorna 0 (nunca NaN/Infinity).
 */
export function computeSuccessRate(
  applications: ReadonlyArray<{ stage: ApplicationStage }>,
): number {
  if (applications.length === 0) return 0;
  const successes = applications.filter((a) => isSuccessStage(a.stage)).length;
  return round1((successes / applications.length) * 100);
}

/** Distribuição real por coluna do Kanban (todas as 5, inclusive zeros). */
export function countApplicationsByStage(
  applications: ReadonlyArray<{ stage: ApplicationStage }>,
): Record<ApplicationStage, number> {
  const counts = {
    inscrito: 0,
    triagem: 0,
    entrevista: 0,
    aprovado: 0,
    reprovado: 0,
  } as Record<ApplicationStage, number>;
  for (const application of applications) {
    counts[application.stage] += 1;
  }
  return counts;
}

/** Agrega tudo que o dashboard do aluno exibe em um único objeto. */
export function computeStudentAnalytics(
  applications: ReadonlyArray<AnalyticsApplication>,
  profileViews: number,
): StudentAnalytics {
  const total = applications.length;
  const averageMatch =
    total === 0
      ? 0
      : round1(applications.reduce((sum, a) => sum + a.matchScore, 0) / total);
  return {
    total,
    successRate: computeSuccessRate(applications),
    byStage: countApplicationsByStage(applications),
    profileViews,
    averageMatch,
  };
}

/** Ordem do funil — reexportada para conferência de cobertura nos testes. */
export const ANALYTICS_STAGES = APPLICATION_STAGES;
