/**
 * [REFACTOR_GESTOR] Etapa 4 — Painel Estratégico de Carreiras &
 * Empregabilidade (papel gestor).
 *
 * Regras PURAS do painel: KPIs do topo, agregações dos Insights
 * Estratégicos (reprovações R5, radar de competências demanda×oferta,
 * engajamento) e as transformações restantes. [GESTOR_BACKEND] — as
 * agregações dos Insights rodam NO SERVIDOR (convex/manager.ts, fonte da
 * verdade); a UI apenas exibe o que as queries respondem.
 *
 * Onde ainda não há agregação de backend, o componente usa
 * MANAGER_DASHBOARD_MOCKS — explicitamente sinalizados com
 * `source: "mock"` (Nota Técnica Visual do plano).
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
 * [MOCK] Seções do painel que ainda não têm agregação de backend:
 * empregabilidade por curso e empresas parceiras. `source: "mock"`
 * deixa explícito na UI o que é placeholder (Nota Técnica Visual) —
 * reprovações, radar de competências e engajamento já são REAIS
 * (queries gestor-only de convex/manager.ts).
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

/* ------------------------------------------------------------------ */
/* [GESTOR_BACKEND] Agregações dos Insights Estratégicos — regras      */
/* puras executadas no servidor (convex/manager.ts) e testadas aqui.   */
/* ------------------------------------------------------------------ */

/** Linha mínima de candidatura para a agregação de reprovações (R5). */
export type RejectionCountRow = {
  stage: string;
  rejectionReason?: string | null;
};

/**
 * Conta candidaturas REPROVADAS por motivo (R5): apenas stage =
 * "reprovado" entra; motivo ausente (legado) cai em "outro" — defensivo,
 * nunca derruba a contagem. Ordenado por contagem desc, desempate
 * alfabético (exibição determinística).
 */
export function countRejectionReasons(
  applications: readonly RejectionCountRow[],
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const app of applications) {
    if (app.stage !== "reprovado") continue;
    const reason =
      app.rejectionReason !== undefined && app.rejectionReason !== null
        ? app.rejectionReason
        : "outro";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** Documento mínimo para contagem de presença de competências. */
type SkillPresenceDoc = { items: readonly string[] };

type SkillPresence = { label: string; count: number; capitalized: boolean };

function startsUpper(label: string): boolean {
  return /^[A-ZÀ-Þ]/.test(label);
}

/**
 * Conta em QUANTOS documentos cada competência aparece (uma vez por
 * documento, mesmo repetida dentro dele). Case-insensitive; rótulo de
 * exibição prefere a grafia capitalizada quando ela aparece em algum
 * documento (determinístico, independente da ordem de leitura).
 */
function skillPresenceCounts(
  docs: readonly SkillPresenceDoc[],
): { skill: string; count: number }[] {
  const counts = new Map<string, SkillPresence>();
  for (const doc of docs) {
    const seen = new Set<string>();
    for (const item of doc.items) {
      const trimmed = item.trim().replace(/\s+/g, " ");
      if (trimmed.length === 0) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry === undefined) {
        counts.set(key, {
          label: trimmed,
          count: 1,
          capitalized: startsUpper(trimmed),
        });
      } else {
        entry.count += 1;
        if (!entry.capitalized && startsUpper(trimmed)) {
          entry.label = trimmed;
          entry.capitalized = true;
        }
      }
    }
  }
  return [...counts.values()]
    .map(({ label, count }) => ({ skill: label, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
}

/** Linha mínima de vaga para a agregação de demanda. */
export type JobPrerequisitesRow = {
  prerequisites: readonly { item: string; required: boolean }[];
};

/**
 * DEMANDA — em quantas VAGAS cada competência é pedida (pré-requisito
 * exigido ou não: ambas sinalizam a tecnologia que a empresa procura).
 */
export function skillDemandCounts(
  jobs: readonly JobPrerequisitesRow[],
): { skill: string; demand: number }[] {
  return skillPresenceCounts(
    jobs.map((job) => ({
      items: job.prerequisites.map((prereq) => prereq.item),
    })),
  ).map(({ skill, count }) => ({ skill, demand: count }));
}

/** Linha mínima de aluno para a agregação de oferta. */
export type StudentSkillsRow = {
  skills?: readonly string[] | null;
};

/** OFERTA — em quantos PERFIS de aluno cada competência aparece. */
export function skillSupplyCounts(
  students: readonly StudentSkillsRow[],
): { skill: string; supply: number }[] {
  return skillPresenceCounts(
    students.map((student) => ({ items: student.skills ?? [] })),
  ).map(({ skill, count }) => ({ skill, supply: count }));
}

/** Linha do radar de competências (demanda × oferta). */
export type SkillsRadarRow = {
  skill: string;
  /** Quantas vagas pedem a competência. */
  demand: number;
  /** Quantos perfis de aluno têm a competência. */
  supply: number;
};

/** Top N padrão do radar (exibição compacta). */
export const SKILLS_RADAR_LIMIT = 6;

/**
 * Radar demanda × oferta: mescla as duas contagens case-insensitive
 * (rótulo segue a demanda quando ambas existem), ordena por demanda
 * desc → oferta desc → alfabético e limita ao Top N. Competência só
 * pedida pelas vagas entra com oferta 0 (maior gargalo); só-oferta
 * entra com demanda 0.
 */
export function buildSkillsRadar(
  demand: readonly { skill: string; demand: number }[],
  supply: readonly { skill: string; supply: number }[],
  limit: number = SKILLS_RADAR_LIMIT,
): SkillsRadarRow[] {
  const byKey = new Map<string, SkillsRadarRow>();
  for (const row of demand) {
    byKey.set(row.skill.toLowerCase(), {
      skill: row.skill,
      demand: row.demand,
      supply: 0,
    });
  }
  for (const row of supply) {
    const existing = byKey.get(row.skill.toLowerCase());
    if (existing === undefined) {
      byKey.set(row.skill.toLowerCase(), {
        skill: row.skill,
        demand: 0,
        supply: row.supply,
      });
    } else {
      existing.supply = row.supply;
    }
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.demand - a.demand ||
        b.supply - a.supply ||
        a.skill.localeCompare(b.skill),
    )
    .slice(0, Math.max(0, limit));
}

/** Linha mínima de aluno para o termômetro de engajamento. */
export type EngagementStudentRow = {
  status: string;
  skills?: readonly string[] | null;
  resumeData?: unknown;
};

export type EngagementMetrics = {
  /** Alunos com vínculo elegíveis (R1: inativo nunca conta). */
  total: number;
  /** Perfil incompleto = sem competências registradas. */
  incompleteProfiles: number;
  /** Sem currículo = `resumeData` ausente. */
  noResume: number;
};

/**
 * Termômetro de engajamento sobre alunos com vínculo (ativo/egresso —
 * R1: inativo nunca aparece). Critérios objetivos: perfil incompleto é
 * o que fica invisível nos filtros por competência do Banco de Talentos;
 * sem currículo é o que o matching (R8) não consegue avaliar bem.
 */
export function engagementCounts(
  students: readonly EngagementStudentRow[],
): EngagementMetrics {
  let total = 0;
  let incompleteProfiles = 0;
  let noResume = 0;
  for (const student of students) {
    if (student.status !== "ativo" && student.status !== "egresso") continue;
    total += 1;
    const skills = student.skills;
    if (skills === undefined || skills === null || skills.length === 0) {
      incompleteProfiles += 1;
    }
    if (student.resumeData === undefined || student.resumeData === null) {
      noResume += 1;
    }
  }
  return { total, incompleteProfiles, noResume };
}
