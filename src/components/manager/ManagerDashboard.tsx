import { useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ClipboardList,
  Download,
  Filter,
  GraduationCap,
  Radar,
  RefreshCw,
  Thermometer,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { buildManagerKpis, partnerStatus } from "../../lib/managerDashboard";
import { buildOperationalReport } from "../../lib/operationalPanel";
import { downloadReport } from "../../lib/reportExport";
import { printOperationalReport } from "../../lib/reportPrint";
import { normalizeDashboardFilters } from "../../lib/dashboardFilters";

/**
 * Painel Estratégico de Carreiras & Empregabilidade (papel gestor).
 *
 * Refatoração visual (UI/UX) — a lógica de dados, as queries, as exportações
 * e os `data-testid` continuam os mesmos. Princípios aplicados:
 *
 * - Superfícies com anel semitransparente no lugar de borda sólida, cantos
 *   grandes (3xl) e muito respiro — hierarquia por espaço, não por caixas;
 * - KPIs numa única faixa, número grande em serifa, sem "azulejo" de ícone;
 * - Barras finas e arredondadas que crescem uma única vez ao entrar e
 *   continuam interruptíveis ao trocar o filtro (motion-reduce respeitado);
 * - Rótulos em sentence case (sem CAIXA ALTA espaçada) e números tabulares;
 * - Só utilidades já remapeadas pelo index.css, então claro, escuro e alto
 *   contraste continuam funcionando.
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

/** Superfície: anel semitransparente + sombra longa e suave (no alto
 *  contraste, volta uma borda sólida para manter a separação). */
const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const FIELD =
  "h-10 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

/** Barra que cresce ao montar e re-anima a partir do valor atual quando o
 *  percentual muda (transição CSS: interruptível, sem salto). */
function GrowBar({
  percent,
  className,
  testId,
}: {
  percent: number;
  className: string;
  testId?: string;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  return (
    <div
      data-testid={testId}
      data-percent={percent}
      className={`h-full w-full rounded-full will-change-transform transition-transform !duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${className}`}
      style={{ transform: `translateX(${progress - 100}%)` }}
    />
  );
}

function Track({ children, height = "h-2" }: { children: ReactNode; height?: string }) {
  return (
    <div
      className={`${height} overflow-hidden rounded-full bg-slate-100`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function Panel({
  testId,
  label,
  title,
  icon,
  aside,
  description,
  footnote,
  className = "",
  children,
}: {
  testId?: string;
  label: string;
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  description?: string;
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      aria-label={label}
      className={`${SURFACE} p-7 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-slate-900">
          <span aria-hidden="true" className="text-primary">
            {icon}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {description !== undefined ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
      {footnote !== undefined ? (
        <p className="mt-5 text-xs leading-relaxed text-a11y-slate-500">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function KpiCell({
  kpi,
  testId,
  unit,
  icon,
}: {
  kpi: {
    value: string | number;
    label: string;
    hint?: string;
    hasData?: boolean;
  };
  testId: string;
  unit?: string;
  icon: ReactNode;
}) {
  const empty = kpi.hasData === false;
  return (
    <div
      data-testid={testId}
      className="flex flex-col border-t border-slate-100 p-7 first:border-t-0 sm:even:border-l sm:[&:nth-child(2)]:border-t-0 xl:border-l xl:border-t-0 xl:first:border-l-0"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span aria-hidden="true" className="text-slate-400">
          {icon}
        </span>
        {kpi.label}
      </p>
      <p
        className={`mt-4 font-serif text-5xl font-bold leading-none tracking-tight tabular-nums ${
          empty ? "text-slate-300" : "text-primary"
        }`}
      >
        {kpi.value}
        {empty ? <span className="sr-only"> sem dados ainda</span> : null}
        {unit !== undefined && !empty ? (
          <span className="ml-1.5 text-base font-semibold tracking-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
      {kpi.hint !== undefined ? (
        <p className="mt-3 text-xs leading-relaxed text-a11y-slate-500">
          {kpi.hint}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="relative block">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
      </span>
    </label>
  );
}

/** Linha "rótulo + barra + percentual" usada por curso e reprovações. */
function BarRow({
  label,
  percent,
  scale,
  tone,
  testId,
}: {
  label: string;
  percent: number;
  scale: number;
  tone: string;
  testId?: string;
}) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-slate-700">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
          {percent}%
        </span>
      </div>
      <Track>
        <GrowBar
          testId={testId}
          percent={(percent / scale) * 100}
          className={tone}
        />
      </Track>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Carregando o Painel Estratégico…</span>
      <div className="h-10 w-2/3 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/2 rounded-full bg-slate-100" />
      <div className="h-24 rounded-3xl bg-slate-100" />
      <div className="h-48 rounded-3xl bg-slate-100" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-72 rounded-3xl bg-slate-100" />
        <div className="h-72 rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}

export function ManagerDashboard() {
  // Filtros: o curso alimenta TODAS as queries reais do servidor.
  const [draftCourse, setDraftCourse] = useState("");
  const [draftSemester, setDraftSemester] = useState("");
  const [applied, setApplied] = useState({ course: "", semester: "" });

  const filters = normalizeDashboardFilters({ course: applied.course });
  // As queries de insights aceitam apenas `course`.
  const managerFilters = { course: filters.course };

  const summary = useQuery(api.operational.operationalSummary, filters);
  const tth = useQuery(api.operational.timeToHireStats, filters);
  const funnel = useQuery(api.operational.pipelineFunnel, filters);
  const talentPool = useQuery(api.students.talentPoolCount, {});
  const rejectionsData = useQuery(
    api.manager.getRejectionInsights,
    managerFilters,
  );
  const skillsRadar = useQuery(api.manager.getSkillsRadar, managerFilters);
  const engagement = useQuery(api.manager.getEngagementMetrics, managerFilters);
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
    return <DashboardSkeleton />;
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
      className="space-y-8 px-1 pb-16 pt-6"
    >
      {/* Cabeçalho: título grande, subtítulo curto, exportações à direita. */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          <h2 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Painel estratégico
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Oportunidades, empregabilidade dos alunos e desempenho dos
            parceiros, com os dados do portal em tempo real.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Exportações do painel"
        >
          <Button
            variant="secondary"
            onClick={exportCsv}
            title="Planilha CSV com os indicadores filtrados"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Planilha (CSV)
          </Button>
          <Button
            variant="secondary"
            onClick={exportXlsx}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Excel
          </Button>
          <Button
            variant="accent"
            onClick={exportPdf}
            title="Relatório em PDF com o template institucional UNICAP"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Relatório PDF
          </Button>
        </div>
      </header>

      {/* Filtros: barra compacta, os campos ficam lado a lado com a ação. */}
      <div
        className={`${SURFACE} flex flex-wrap items-end gap-4 p-5`}
        role="group"
        aria-label="Filtros do painel estratégico"
      >
        <SelectField
          label="Curso"
          value={draftCourse}
          onChange={setDraftCourse}
          placeholder="Todos os cursos"
          options={COURSE_OPTIONS.map((c) => ({ value: c, label: c }))}
          className="w-full sm:w-64"
        />
        <SelectField
          label="Semestre"
          value={draftSemester}
          onChange={setDraftSemester}
          placeholder="Todos os semestres"
          options={SEMESTER_OPTIONS.map((s) => ({
            value: s,
            label: `${s}º semestre`,
          }))}
          className="w-full sm:w-52"
        />
        <Button
          className="h-10 shrink-0"
          variant="primary"
          onClick={() =>
            setApplied({ course: draftCourse, semester: draftSemester })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar
        </Button>
        {applied.semester !== "" ? (
          <p className="basis-full text-xs text-a11y-slate-500">
            O filtro de semestre ainda não recorta os dados; ele fica pronto
            para quando o backend suportar.
          </p>
        ) : null}
      </div>

      {/* KPIs: uma única faixa, números grandes. */}
      <div
        className={`${SURFACE} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`}
      >
        <KpiCell
          kpi={kpis.oportunidades}
          testId="kpi-oportunidades"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <KpiCell
          kpi={{
            value: kpis.empregabilidade.value,
            label: "Taxa de empregabilidade",
            hint: "Aprovados sobre finalizados",
            hasData: kpis.empregabilidade.hasData,
          }}
          testId="kpi-empregabilidade"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCell
          kpi={{
            value: kpis.tempoContratacao.value,
            label: "Tempo médio de contratação",
            hint: "Da candidatura ao preenchimento da vaga",
            hasData: kpis.tempoContratacao.hasData,
          }}
          testId="kpi-tempo-contratacao"
          unit={kpis.tempoContratacao.hasData ? "dias" : undefined}
          icon={<Timer className="h-4 w-4" />}
        />
        <KpiCell
          kpi={kpis.talentos}
          testId="kpi-talentos"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Funil + empregabilidade por curso. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          testId="manager-funnel"
          label="Funil de conversão"
          title="Funil de conversão"
          icon={<Filter className="h-5 w-5" />}
          aside={
            <span className="text-sm tabular-nums text-slate-500">
              {funnel.totalApplications} candidaturas
            </span>
          }
          footnote="O percentual de cada etapa é relativo à etapa anterior."
        >
          <ul className="flex flex-col gap-5">
            {funnelSteps.map((step) => (
              <li key={step.stage}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">
                    {step.label}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-serif text-lg font-bold tabular-nums text-slate-900">
                      {step.count}
                    </span>
                    {step.conversionFromPrevious !== null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                        {step.conversionFromPrevious}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <Track height="h-2.5">
                  <GrowBar
                    testId={`funnel-bar-${step.stage}`}
                    className="bg-primary"
                    percent={Math.max(
                      step.count === 0 ? 0 : 8,
                      (step.count / maxFunnel) * 100,
                    )}
                  />
                </Track>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          testId="manager-course-employability"
          label="Empregabilidade por curso"
          title="Empregabilidade por curso"
          icon={<GraduationCap className="h-5 w-5" />}
          footnote="Taxa = alunos do curso com ao menos uma aprovação ÷ alunos do curso."
        >
          {courseEmployability.length === 0 ? (
            <Empty>
              Ainda não há alunos elegíveis para calcular a empregabilidade.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-5">
              {courseEmployability.map((row, index) => (
                <BarRow
                  key={row.course}
                  label={row.course}
                  percent={row.percent}
                  scale={maxCourse}
                  tone="bg-secondary"
                  testId={`course-bar-${index}`}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Empresas parceiras. */}
      <Panel
        label="Empresas parceiras"
        title="Empresas parceiras"
        icon={<Building2 className="h-5 w-5" />}
      >
        {partnerCompanies.length === 0 ? (
          <Empty>Ainda não há empresas parceiras no portal.</Empty>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">
                Empresas parceiras com vagas publicadas, contratados e status
              </caption>
              <thead>
                <tr className="text-xs text-slate-500">
                  <th scope="col" className="px-2 pb-3 font-medium">
                    Empresa
                  </th>
                  <th scope="col" className="px-2 pb-3 font-medium">
                    Vagas publicadas
                  </th>
                  <th scope="col" className="px-2 pb-3 font-medium">
                    Contratados
                  </th>
                  <th scope="col" className="px-2 pb-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {partnerCompanies.map((partner) => {
                  const status = partnerStatus(
                    partner.hired,
                    partner.published,
                  );
                  const statusUi = PARTNER_STATUS_LABELS[status];
                  return (
                    <tr
                      key={partner.recruiterId}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <td className="px-2 py-3.5 font-semibold text-slate-900">
                        {partner.companyName}
                      </td>
                      <td className="px-2 py-3.5 tabular-nums text-slate-600">
                        {partner.published}
                      </td>
                      <td className="px-2 py-3.5 tabular-nums text-slate-600">
                        {partner.hired}
                      </td>
                      <td className="px-2 py-3.5">
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
          </div>
        )}
      </Panel>

      {/* Insights estratégicos. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          testId="manager-insight-rejections"
          label="Motivos de reprovação"
          title="Motivos de reprovação"
          icon={<ClipboardList className="h-5 w-5" />}
          description="Onde os alunos mais falham nos processos seletivos."
        >
          {rejections.length === 0 ? (
            <Empty>Nenhuma reprovação registrada com os filtros atuais.</Empty>
          ) : (
            <ul className="flex flex-col gap-5">
              {rejections.map((row) => (
                <BarRow
                  key={row.reason}
                  label={row.label}
                  percent={row.percent}
                  scale={maxRejection}
                  tone="bg-primary"
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          testId="manager-insight-skillgaps"
          label="Radar de competências"
          title="Radar de competências"
          icon={<Radar className="h-5 w-5" />}
          description="O que as vagas pedem em comparação ao que os alunos têm. Os maiores gargalos aparecem com demanda muito acima da oferta."
          footnote={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full bg-primary"
                />
                Demanda das vagas
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full bg-slate-300"
                />
                Oferta dos alunos
              </span>
            </span>
          }
        >
          {skillsRadar.length === 0 ? (
            <Empty>
              Sem vagas ou competências para comparar com os filtros atuais.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-5">
              {skillsRadar.map((gap) => (
                <li key={gap.skill}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-slate-700">
                      {gap.skill}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {gap.demand} pedem · {gap.supply} têm
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Track height="h-1.5">
                      <GrowBar
                        className="bg-primary"
                        percent={(gap.demand / maxSkill) * 100}
                      />
                    </Track>
                    <Track height="h-1.5">
                      <GrowBar
                        className="bg-slate-300"
                        percent={(gap.supply / maxSkill) * 100}
                      />
                    </Track>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          testId="manager-insight-engagement"
          label="Termômetro de engajamento"
          title="Termômetro de engajamento"
          icon={<Thermometer className="h-5 w-5" />}
          description="Alunos que precisam de um empurrão para completar o perfil."
          footnote="Perfil completo e currículo publicado são o que mais aumenta as chances de contratação."
        >
          <div className="grid grid-cols-2 rounded-2xl bg-slate-50 py-6">
            <div className="px-5 text-center">
              <p className="font-serif text-5xl font-bold leading-none tracking-tight tabular-nums text-primary">
                {engagement.incompleteProfiles}
              </p>
              <p className="mt-3 text-sm text-slate-600">Perfil incompleto</p>
            </div>
            <div className="border-l border-slate-200 px-5 text-center">
              <p className="font-serif text-5xl font-bold leading-none tracking-tight tabular-nums text-primary">
                {engagement.noResume}
              </p>
              <p className="mt-3 text-sm text-slate-600">Sem currículo</p>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}