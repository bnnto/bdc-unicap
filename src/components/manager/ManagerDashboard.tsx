import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { buildManagerKpis, partnerStatus } from "../../lib/managerDashboard";
import { buildOperationalReport } from "../../lib/operationalPanel";
import { downloadReport } from "../../lib/reportExport";
import { printOperationalReport } from "../../lib/reportPrint";
import { normalizeDashboardFilters } from "../../lib/dashboardFilters";

/**
 * [REFACTOR_GESTOR] Etapa 4 — Painel Estratégico de Carreiras &
 * Empregabilidade (papel gestor), em CSS Grid de largura total.
 *
 * Fontes de dados:
 * - REAIS: `operational.operationalSummary` (vagas/empregabilidade),
 *   `operational.timeToHireStats`, `operational.pipelineFunnel`
 *   (funil de conversão) e `students.talentPoolCount`;
 * - [GESTOR_BACKEND] REAIS: motivos de reprovação (R5), radar de
 *   competências (demanda×oferta) e termômetro de engajamento — queries
 *   gestor-only de convex/manager.ts (`getRejectionInsights`,
 *   `getSkillsRadar`, `getEngagementMetrics`);
 * - [GESTOR_BACKEND_PT2] REAIS: empregabilidade por curso
 *   (`getEmployabilityByCourse`) e empresas parceiras
 *   (`getPartnerCompanies`) — o painel é 100% real, sem mocks.
 *
 * As exportações (CSV/XLSX/PDF) usam os dados REAIS carregados, igual ao
 * painel operacional do recrutador.
 */

const COURSE_OPTIONS = [
  "Ciência da Computação",
  "Sistemas para Internet",
  "Engenharia de Computação",
  "Direito",
  "Administração",
  "Psicologia",
];

const SEMESTER_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const PARTNER_STATUS_LABELS: Record<
  ReturnType<typeof partnerStatus>,
  { label: string; className: string }
> = {
  ativa: {
    label: "Ativa",
    className: "bg-[#ECFDF5] text-success font-semibold",
  },
  em_negociacao: {
    label: "Em negociação",
    className: "bg-secondary/10 text-slate-800 font-semibold",
  },
  inativa: {
    label: "Inativa",
    className: "bg-slate-100 text-slate-500",
  },
};

function KpiCard({
  kpi,
  testId,
  unit,
}: {
  kpi: {
    value: string | number;
    label: string;
    hint?: string;
    hasData?: boolean;
  };
  testId: string;
  unit?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {kpi.label}
      </p>
      <p className="mt-2 font-serif text-4xl font-bold text-primary">
        {kpi.value}
        {unit !== undefined && kpi.hasData !== false ? (
          <span className="ml-1 text-base font-semibold text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
      {kpi.hint !== undefined ? (
        <p className="mt-1 text-xs text-a11y-slate-500">{kpi.hint}</p>
      ) : null}
    </div>
  );
}

export function ManagerDashboard() {
  // Filtros: o curso alimenta TODAS as queries reais do servidor
  // (agregações gestor + painel operacional).
  const [draftCourse, setDraftCourse] = useState("");
  const [draftSemester, setDraftSemester] = useState("");
  const [applied, setApplied] = useState({ course: "", semester: "" });

  const filters = normalizeDashboardFilters({
    course: applied.course,
  });

  // [GESTOR_BACKEND] As queries de insights aceitam apenas `course` —
  // os demais filtros do dashboard não se aplicam a estas agregações.
  const managerFilters = { course: filters.course };

  const summary = useQuery(api.operational.operationalSummary, filters);
  const tth = useQuery(api.operational.timeToHireStats, filters);
  const funnel = useQuery(api.operational.pipelineFunnel, filters);
  const talentPool = useQuery(api.students.talentPoolCount, {});
  // Insights Estratégicos — agregações reais (exclusivas do gestor).
  const rejectionsData = useQuery(
    api.manager.getRejectionInsights,
    managerFilters,
  );
  const skillsRadar = useQuery(api.manager.getSkillsRadar, managerFilters);
  const engagement = useQuery(api.manager.getEngagementMetrics, managerFilters);
  // [GESTOR_BACKEND_PT2] Empregabilidade por curso e empresas parceiras
  // (a tabela de parceiras não é recortada por curso — empresas não têm
  // curso; a regra de status fica na regra pura `partnerStatus`).
  const courseEmployability = useQuery(
    api.manager.getEmployabilityByCourse,
    managerFilters,
  );
  const partnerCompanies = useQuery(api.manager.getPartnerCompanies, {});

  if (
    summary === undefined ||
    tth === undefined ||
    funnel === undefined ||
    talentPool === undefined ||
    rejectionsData === undefined ||
    skillsRadar === undefined ||
    engagement === undefined ||
    courseEmployability === undefined ||
    partnerCompanies === undefined
  ) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-500">
          Carregando o Painel Estratégico…
        </p>
      </div>
    );
  }

  const kpis = buildManagerKpis({
    openJobs: summary.jobs.open,
    employabilityRate: summary.employability.rate,
    timeToHireDays: tth.averageDays,
    availableTalents: talentPool.total,
  });

  const rejections = rejectionsData.rows;
  const maxRejection = Math.max(1, ...rejections.map((r) => r.percent));
  const maxCourse = Math.max(1, ...courseEmployability.map((c) => c.percent));
  const maxSkill = Math.max(
    1,
    ...skillsRadar.flatMap((s) => [s.demand, s.supply]),
  );
  const funnelSteps = funnel.steps;
  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.count));

  // Exportações com os dados REAIS carregados (mesma bateria do painel
  // operacional — CSV/Excel/PDF institucional).
  const report = buildOperationalReport({
    summary: {
      jobs: summary.jobs,
      applications: summary.applications,
      employability: { rate: summary.employability.rate },
    },
    timeToHire: {
      averageDays: tth.averageDays,
      samplesCount: tth.samplesCount,
    },
    funnel: {
      steps: funnel.steps,
      totalApplications: funnel.totalApplications,
    },
  });
  const exportCsv = () => downloadReport(report, "csv");
  const exportXlsx = () => downloadReport(report, "xlsx");
  const exportPdf = () => printOperationalReport(report);

  return (
    <section
      data-testid="manager-dashboard"
      role="region"
      aria-label="Painel estratégico"
      className="px-1"
    >
      {/* 1 — Header do dashboard. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
            Gestão
          </p>
          <h2 className="font-serif text-3xl font-bold text-primary">
            Painel Estratégico de Carreiras &amp; Empregabilidade
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Visão executiva das oportunidades, da empregabilidade dos alunos e
            do desempenho dos parceiros — atualizado em tempo real com o banco
            do portal.
          </p>
        </div>
        <div
          className="flex gap-2"
          role="group"
          aria-label="Exportações do painel"
        >
          <Button
            variant="secondary"
            onClick={exportCsv}
            title="Planilha CSV com os indicadores filtrados"
          >
            Exportar Planilha (CSV)
          </Button>
          <Button
            variant="secondary"
            onClick={exportXlsx}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            Exportar Excel
          </Button>
          <Button
            variant="accent"
            onClick={exportPdf}
            title="Relatório em PDF com o template institucional UNICAP"
          >
            Exportar Relatório PDF
          </Button>
        </div>
      </div>

      {/* 2 — Barra de filtros. */}
      <div
        className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
        role="group"
        aria-label="Filtros do painel estratégico"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Curso
          </span>
          <select
            aria-label="Curso"
            value={draftCourse}
            onChange={(e) => setDraftCourse(e.target.value)}
            className="w-56 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            <option value="">Todos os Cursos</option>
            {COURSE_OPTIONS.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Semestre
          </span>
          <select
            aria-label="Semestre"
            value={draftSemester}
            onChange={(e) => setDraftSemester(e.target.value)}
            className="w-48 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            <option value="">Todos os semestres</option>
            {SEMESTER_OPTIONS.map((semester) => (
              <option key={semester} value={semester}>
                {semester}º semestre
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="primary"
          onClick={() =>
            setApplied({ course: draftCourse, semester: draftSemester })
          }
        >
          Atualizar
        </Button>
        {applied.semester !== "" ? (
          <p className="text-xs text-a11y-slate-500">
            Filtro de semestre disponível para recortes futuros do backend.
          </p>
        ) : null}
      </div>

      {/* 3 — KPIs (4 colunas). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard kpi={kpis.oportunidades} testId="kpi-oportunidades" />
        <KpiCard
          kpi={{
            value: kpis.empregabilidade.value,
            label: "Taxa de Empregabilidade",
            hint: "Aprovados sobre finalizados",
            hasData: kpis.empregabilidade.hasData,
          }}
          testId="kpi-empregabilidade"
        />
        <KpiCard
          kpi={{
            value: kpis.tempoContratacao.value,
            label: "Tempo Médio de Contratação",
            hint: "Da candidatura ao preenchimento da vaga",
            hasData: kpis.tempoContratacao.hasData,
          }}
          testId="kpi-tempo-contratacao"
          unit={kpis.tempoContratacao.hasData ? "dias" : undefined}
        />
        <KpiCard kpi={kpis.talentos} testId="kpi-talentos" />
      </div>

      {/* 4 — Sessão central: funil + empregabilidade por curso (reais). */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section
          data-testid="manager-funnel"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          aria-label="Funil de conversão"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Funil de Conversão
            </h3>
            <span className="text-xs text-slate-500">
              {funnel.totalApplications} candidaturas
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {funnelSteps.map((step) => (
              <li key={step.stage} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-semibold text-slate-700">
                  {step.label}
                </span>
                <div
                  className="h-8 flex-1 overflow-hidden rounded bg-slate-100"
                  aria-hidden="true"
                >
                  <div
                    data-testid={`funnel-bar-${step.stage}`}
                    className="flex h-full items-center justify-end rounded bg-primary px-2 text-xs font-semibold text-white"
                    style={{
                      width: `${Math.max(
                        step.count === 0 ? 0 : 8,
                        (step.count / maxFunnel) * 100,
                      )}%`,
                    }}
                  >
                    {step.count > 0 ? step.count : ""}
                  </div>
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-slate-500">
                  {step.conversionFromPrevious === null
                    ? "—"
                    : `${step.conversionFromPrevious}%`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-a11y-slate-500">
            Conversão % em relação à etapa anterior — dados reais do portal.
          </p>
        </section>

        <section
          data-testid="manager-course-employability"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          aria-label="Empregabilidade por curso"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Empregabilidade por Curso
            </h3>
          </div>
          {courseEmployability.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há alunos elegíveis para calcular a taxa de
              empregabilidade.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {courseEmployability.map((row, index) => (
                <li key={row.course} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 truncate text-sm text-slate-700">
                    {row.course}
                  </span>
                  <div
                    className="h-6 flex-1 overflow-hidden rounded bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      data-testid={`course-bar-${index}`}
                      className="h-full rounded bg-secondary"
                      style={{ width: `${(row.percent / maxCourse) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-bold text-primary">
                    {row.percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-a11y-slate-500">
            Taxa = alunos do curso com pelo menos uma aprovação ÷ alunos do
            curso — dados reais do portal.
          </p>
        </section>
      </div>

      {/* 5 — Tabela de empresas parceiras (dados reais). */}
      <section
        className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
        aria-label="Empresas parceiras"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-primary">
            Empresas Parceiras
          </h3>
        </div>
        {partnerCompanies.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ainda não há empresas parceiras no portal.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Empresas parceiras com vagas publicadas, contratados e status
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Empresa
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Vagas Publicadas
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Contratados
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {partnerCompanies.map((partner) => {
                const status = partnerStatus(partner.hired, partner.published);
                const statusUi = PARTNER_STATUS_LABELS[status];
                return (
                  <tr
                    key={partner.recruiterId}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {partner.companyName}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {partner.published}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {partner.hired}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${statusUi.className}`}
                      >
                        {statusUi.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 6 — Insights Estratégicos (3 colunas). */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section
          data-testid="manager-insight-rejections"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          aria-label="Motivos de reprovação"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Motivos de Reprovação
            </h3>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Onde os alunos mais falham nos processos seletivos (R5) — dados
            reais de todas as candidaturas reprovadas.
          </p>
          {rejections.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma reprovação registrada com os filtros atuais.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rejections.map((row) => (
                <li key={row.reason} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-sm text-slate-700">
                    {row.label}
                  </span>
                  <div
                    className="h-5 flex-1 overflow-hidden rounded bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded bg-primary"
                      style={{
                        width: `${(row.percent / maxRejection) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-bold text-primary">
                    {row.percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          data-testid="manager-insight-skillgaps"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          aria-label="Radar de competências"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Radar de Competências
            </h3>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            O que as vagas mais pedem vs. o que os alunos mais têm — dados reais
            dos pré-requisitos e dos perfis; os maiores gargalos ficam com
            demanda ≫ oferta.
          </p>
          {skillsRadar.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sem vagas ou competências para comparar com os filtros atuais.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {skillsRadar.map((gap) => (
                <li key={gap.skill} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-sm text-slate-700">
                    {gap.skill}
                  </span>
                  <div className="flex flex-1 flex-col gap-1">
                    <div
                      className="h-3.5 rounded bg-primary"
                      style={{ width: `${(gap.demand / maxSkill) * 100}%` }}
                      aria-hidden="true"
                    />
                    <div
                      className="h-3.5 rounded bg-slate-300"
                      style={{ width: `${(gap.supply / maxSkill) * 100}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] text-slate-500">
                    {gap.demand} pedem · {gap.supply} têm
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-4 rounded bg-primary"
              />
              demanda das vagas
            </span>
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-4 rounded bg-slate-300"
              />
              oferta dos alunos
            </span>
          </p>
        </section>

        <section
          data-testid="manager-insight-engagement"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          aria-label="Termômetro de engajamento"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-primary">
              Termômetro de Engajamento
            </h3>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Alunos que precisam de um empurrão para completar o perfil.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-[#FDF2F4] p-4 text-center">
              <p className="font-serif text-3xl font-bold text-primary">
                {engagement.incompleteProfiles}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Perfil incompleto
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="font-serif text-3xl font-bold text-primary">
                {engagement.noResume}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Sem currículo
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-a11y-slate-500">
            Meta de engajamento: perfil completo + currículo publicado é o que
            multiplica as chances de contratação.
          </p>
        </section>
      </div>
    </section>
  );
}
