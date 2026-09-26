/**
 * Funil de conversão por etapa do pipeline (issue [S5-3]) — regras puras.
 *
 * CA 1 — contagem por etapa e conversão % entre etapas consecutivas
 * (Inscrito → Triagem → Entrevista → Aprovado). "Reprovado" é uma SAÍDA
 * do funil, não uma etapa de avanço — candidaturas reprovadas não entram
 * nas contagens (a taxa de reprovação já é coberta pela empregabilidade,
 * S5-1).
 * CA 2 — `buildFunnel` devolve as etapas na ordem de exibição, com rótulos
 * do pipeline (S4-1) prontos para a visualização no dashboard.
 *
 * Arquivo puro (sem I/O, sem React) — consumido pela query Convex
 * (`pipelineFunnel`, fonte da verdade) e pela UI do painel.
 */
import { STAGE_LABELS, type ApplicationStage } from "./application";

/** Etapas de AVANÇO do funil, na ordem de conversão (sem "reprovado"). */
export const FUNNEL_STAGES = [
  "inscrito",
  "triagem",
  "entrevista",
  "aprovado",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Linha mínima de candidatura (etapa do pipeline de 5 colunas, S4-1). */
export type FunnelApplicationRow = {
  stage: ApplicationStage;
};

/** Um degrau do funil: etapa, rótulo, contagem e conversão do degrau anterior. */
export type FunnelStep = {
  stage: FunnelStage;
  /** Rótulo do pipeline (S4-1): Inscrito, Em Triagem, Entrevista, Aprovado. */
  label: string;
  count: number;
  /**
   * % de candidaturas que chegaram a esta etapa em relação à etapa
   * anterior. `null` na primeira etapa (é a base do funil) ou quando a
   * etapa anterior está zerada (divisão indefinida — exibida como "—").
   */
  conversionFromPrevious: number | null;
};

/** Estreitamento: etapa de avanço do funil (exclui "reprovado"). */
function isFunnelStage(stage: ApplicationStage): stage is FunnelStage {
  return (FUNNEL_STAGES as readonly string[]).includes(stage);
}

/** Conta as candidaturas em cada etapa de avanço (reprovados ficam de fora). */
export function countFunnelStages(
  applications: readonly FunnelApplicationRow[],
): Record<FunnelStage, number> {
  const counts: Record<FunnelStage, number> = {
    inscrito: 0,
    triagem: 0,
    entrevista: 0,
    aprovado: 0,
  };
  for (const application of applications) {
    if (isFunnelStage(application.stage)) {
      counts[application.stage] += 1;
    }
  }
  return counts;
}

/**
 * Monta o funil completo para exibição: 4 degraus na ordem de avanço,
 * com contagem por etapa e conversão % sobre o degrau anterior
 * (arredondada para inteiro; `null` na base ou com degrau anterior vazio).
 */
export function buildFunnel(
  applications: readonly FunnelApplicationRow[],
): FunnelStep[] {
  const counts = countFunnelStages(applications);
  const steps: FunnelStep[] = [];
  let previousCount: number | null = null;
  for (const stage of FUNNEL_STAGES) {
    const count = counts[stage];
    const conversionFromPrevious =
      previousCount === null || previousCount === 0
        ? null
        : Math.round((count / previousCount) * 100);
    steps.push({
      stage,
      label: STAGE_LABELS[stage],
      count,
      conversionFromPrevious,
    });
    previousCount = count;
  }
  return steps;
}
