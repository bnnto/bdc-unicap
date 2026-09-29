/**
 * [REFACTOR_GESTOR] Etapa 4 — Painel Estratégico de Carreiras &
 * Empregabilidade (papel gestor).
 *
 * Regra PURA que consolida os KPIs do topo e as transformações dos
 * Insights Estratégicos. Os dados chegam prontos do servidor quando a
 * rota existe (operational/jobs/applications); onde ainda não há
 * agregação, o componente usa MANAGER_DASHBOARD_MOCKS — explicitamente
 * sinalizados com `source: "mock"` (Nota Técnica Visual do plano) —
 * prontos para serem plugados no banco depois.
 */

/** Rótulos do enum fixo de reprovação (R5, espelha convex/applications). */
export const REJECTION_LABELS: Record<string, string> = {
  requisitos_obrigatorios: "Requisitos obrigatórios",
  formacao_incompativel: "Formação incompatível",
  disponibilidade_incompativel: "Disponibilidade incompatível",
  idioma_insuficiente: "Idioma insuficiente",
  perfil_duplicado: "Perfil duplicado",
  vaga_preenchida: "Vaga preenchida",
  vaga_cancelada: "Vaga cancelada",
  outro: "Outros",
};

export type ManagerKpiInput = {
  /** Vagas abertas no período (jobs.status = "aberta"). */
  openJobs: number;
  /** % de empregabilidade (aprovados / finalizados) ou null sem amostra. */
  employabilityRate: number | null;
  /** Time-to-Hire médio em dias ou null sem amostra. */
  timeToHireDays: number | null;
  /** Talentos públicos com vínculo ativo (R1/R2). */
  availableTalents: number;
};

export type ManagerKpiValue = { value: string; hasData: boolean };

export type ManagerKpis = {
  oportunidades: { value: number; label: string; hint: string };
  empregabilidade: ManagerKpiValue;
  tempoContratacao: ManagerKpiValue & { unit: string };
  talentos: { value: number; label: string; hint: string };
};

/**
 * Consolida os 4 KPIs do topo. Métricas sem amostra exibem "—" (nunca
 * mascaramos a ausência de dados como 0% ou 0 dias).
 */
export function buildManagerKpis(input: ManagerKpiInput): ManagerKpis {
  return {
    oportunidades: {
      value: input.openJobs,
      label: "Vagas ativas no semestre",
      hint: "Oportunidades publicadas e abertas",
    },
    empregabilidade:
      input.employabilityRate === null
        ? { value: "—", hasData: false }
        : {
            value: `${Math.round(input.employabilityRate)}%`,
            hasData: true,
          },
    tempoContratacao:
      input.timeToHireDays === null
        ? { value: "—", hasData: false, unit: "dias" }
        : {
            value: String(Math.round(input.timeToHireDays)),
            hasData: true,
            unit: "dias",
          },
    talentos: {
      value: input.availableTalents,
      label: "Estudantes com perfil ativo",
      hint: "Banco de talentos (R1/R2)",
    },
  };
}

/**
 * Status da empresa parceira na tabela do Painel Estratégico:
 * com contratação no período → ativa; com vagas mas sem contratação →
 * em_negociacao; sem nenhuma atividade → inativa.
 */
export function partnerStatus(
  hiredCount: number,
  publishedJobs: number,
): "ativa" | "em_negociacao" | "inativa" {
  if (hiredCount > 0) return "ativa";
  if (publishedJobs > 0) return "em_negociacao";
  return "inativa";
}

export type RejectionShareRow = {
  reason: string;
  label: string;
  count: number;
  percent: number;
};

/**
 * Distribuição percentual dos motivos de reprovação (R5) — ordenada do
 * maior para o menor, para a universidade ver onde os alunos falham.
 */
export function rejectionShare(
  counts: ReadonlyArray<{ reason: string; count: number }>,
): RejectionShareRow[] {
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return [];
  return [...counts]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      reason: row.reason,
      label: REJECTION_LABELS[row.reason] ?? row.reason,
      count: row.count,
      percent: Math.round((row.count / total) * 100),
    }));
}

/**
 * [MOCK] Dados dos Insights Estratégicos enquanto as agregações de
 * backend não existem. `source: "mock"` deixa explícito na UI o que é
 * placeholder (Nota Técnica Visual) — trocar por queries reais depois.
 */
export const MANAGER_DASHBOARD_MOCKS = {
  source: "mock" as const,
  /** Empregabilidade por curso (%), ordenada do maior para o menor. */
  courseEmployability: [
    { course: "Ciência da Computação", percent: 78 },
    { course: "Sistemas para Internet", percent: 71 },
    { course: "Engenharia de Computação", percent: 66 },
    { course: "Administração", percent: 58 },
    { course: "Direito", percent: 52 },
    { course: "Psicologia", percent: 47 },
  ],
  /** Radar de competências: demanda das vagas vs oferta dos alunos. */
  skillGaps: [
    { skill: "React", demand: 42, supply: 31 },
    { skill: "SQL", demand: 35, supply: 28 },
    { skill: "Python", demand: 30, supply: 26 },
    { skill: "Inglês fluente", demand: 38, supply: 14 },
    { skill: "Power BI", demand: 22, supply: 9 },
    { skill: "Node.js", demand: 19, supply: 16 },
  ],
  /** Termômetro de engajamento do corpo discente. */
  incompleteProfiles: 37,
  noResume: 58,
  /**
   * Empresas parceiras (contratados por parceiro ainda sem agregação de
   * backend — colunas Contratados/Status derivadas via `partnerStatus`).
   */
  partners: [
    { company: "Alpha Tech", published: 8, hired: 5 },
    { company: "Beta Consultoria", published: 4, hired: 0 },
    { company: "Gama Mídia", published: 2, hired: 1 },
    { company: "Delta Sistemas", published: 3, hired: 0 },
    { company: "Epsilon Educação", published: 0, hired: 0 },
  ],
} as const;
