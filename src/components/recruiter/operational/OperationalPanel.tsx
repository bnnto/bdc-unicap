import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Download,
  Filter,
  Layers,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { CustomSelect } from "../../ui/CustomSelect";
import {
  buildOperationalReport,
  formatEmployabilityRate,
} from "../../../lib/operationalPanel";
import { downloadReport } from "../../../lib/reportExport";
import { printOperationalReport } from "../../../lib/reportPrint";
import {
  hasActiveFilters,
  normalizeDashboardFilters,
  type DashboardFilters,
} from "../../../lib/dashboardFilters";
import { useStableQuery } from "../../../lib/useStableQuery";

/**
 * Dashboard de Métricas Operacionais.
 *
 * Refatoração visual (UI/UX) espelhando o painel do Gestor (ManagerDashboard).
 * - Superfícies semitransparentes (anel de borda);
 * - KPIs em linha contínua;
 * - Barras percentuais contínuas;
 * - Fontes Serifadas pesadas para títulos;
 * - Remoção do indicador "Ao vivo".
 */

function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function localDaysAgo(todayStart: number, days: number): number {
  const date = new Date(todayStart);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "aberta", label: "Abertas" },
  { value: "fechada", label: "Fechadas" },
  { value: "encerrada", label: "Encerradas" },
] as const;

const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const FIELD =
  "h-10 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

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
        {/* Trocado de text-slate-900 para text-slate-600 para ficar igual ao rótulo das vagas abertas */}
        <h3 className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-slate-600 dark:text-slate-200">
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
  value,
  label,
  hint,
  icon,
  testId,
  unit,
}: {
  value: string | number | null;
  label: string;
  hint?: string;
  icon: ReactNode;
  testId: string;
  unit?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col border-t border-slate-100 p-7 first:border-t-0 sm:even:border-l sm:[&:nth-child(2)]:border-t-0 xl:border-l xl:border-t-0 xl:first:border-l-0"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {/* Ícone agora fica em bordô (text-primary) */}
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
        {label}
      </p>
      {/* O número agora assume sempre text-primary com destaque forte, eliminando o cinza claro */}
      <p className="mt-4 font-serif text-5xl font-bold leading-none tracking-tight tabular-nums text-primary">
        {value === null || value === "" ? "—" : value}
        {unit !== undefined && value !== null && value !== "" ? (
          <span className="ml-1.5 text-base font-semibold tracking-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
      {hint !== undefined ? (
        <p className="mt-3 text-xs leading-relaxed text-a11y-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type FilterState = {
  period: string;
  course: string;
  company: string;
  status: string;
};

const EMPTY_FILTERS: FilterState = {
  period: "",
  course: "",
  company: "",
  status: "",
};

type Facets = { courses: string[]; companies: string[] };
const EMPTY_FACETS: Facets = { courses: [], companies: [] };

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Carregando o Dashboard de métricas…</span>
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

export function OperationalPanel() {
  const [filterState, setFilterState] = useState<FilterState>(EMPTY_FILTERS);
  const [draftState, setDraftState] = useState<FilterState>(EMPTY_FILTERS);

  const [todayStart, setTodayStart] = useState<number>(() =>
    startOfLocalDay(Date.now()),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setTodayStart(startOfLocalDay(Date.now()));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const filters: DashboardFilters = useMemo(
    () =>
      normalizeDashboardFilters({
        from:
          filterState.period !== ""
            ? localDaysAgo(todayStart, Number(filterState.period))
            : undefined,
        course: filterState.course,
        company: filterState.company,
        status: filterState.status,
      }),
    [filterState, todayStart],
  );

  const filtersActive = hasActiveFilters(filters);

  const summaryQuery = useStableQuery(
    useQuery(api.operational.operationalSummary, filters),
  );
  const tthQuery = useStableQuery(
    useQuery(api.operational.timeToHireStats, filters),
  );
  const funnelQuery = useStableQuery(
    useQuery(api.operational.pipelineFunnel, filters),
  );
  const rankingsQuery = useStableQuery(
    useQuery(api.operational.activeRankings, { limit: 5, ...filters }),
  );

  const summary = summaryQuery.data;
  const tth = tthQuery.data;
  const funnel = funnelQuery.data;
  const rankings = rankingsQuery.data;
  const refreshing =
    summaryQuery.stale ||
    tthQuery.stale ||
    funnelQuery.stale ||
    rankingsQuery.stale;

  if (summary === undefined) {
    return <DashboardSkeleton />;
  }

  const report = buildOperationalReport({
    summary: {
      jobs: summary.jobs,
      applications: summary.applications,
      employability: { rate: summary.employability.rate },
    },
    timeToHire:
      tth === undefined
        ? undefined
        : { averageDays: tth.averageDays, samplesCount: tth.samplesCount },
    funnel:
      funnel === undefined
        ? undefined
        : {
            steps: funnel.steps,
            totalApplications: funnel.totalApplications,
          },
    rankings:
      rankings === undefined
        ? undefined
        : {
            topCompanies: rankings.topCompanies,
            topJobs: rankings.topJobs,
          },
  });

  const exportReady =
    tth !== undefined &&
    funnel !== undefined &&
    rankings !== undefined &&
    !refreshing;

  const exportReport = (format: "csv" | "xlsx") => downloadReport(report, format);
  const printPdf = () => printOperationalReport(report);

  const facets = tth?.facets ?? EMPTY_FACETS;

  const funnelSteps = funnel?.steps ?? [];
  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.count));

  const applyFilters = () => setFilterState(draftState);
  const clearFilters = () => {
    setFilterState(EMPTY_FILTERS);
    setDraftState(EMPTY_FILTERS);
  };

  const chips: { key: keyof FilterState; label: string }[] = [];
  if (filterState.period !== "") {
    const label =
      PERIOD_OPTIONS.find((option) => option.value === filterState.period)?.label ??
      filterState.period;
    chips.push({ key: "period", label: `Período: ${label}` });
  }
  if (filterState.course !== "") {
    chips.push({ key: "course", label: `Curso: ${filterState.course}` });
  }
  if (filterState.company !== "") {
    chips.push({ key: "company", label: `Empresa: ${filterState.company}` });
  }
  if (filterState.status !== "") {
    const label =
      STATUS_OPTIONS.find((option) => option.value === filterState.status)?.label ??
      filterState.status;
    chips.push({ key: "status", label: `Status: ${label}` });
  }


  return (
    <section
      data-testid="operational-panel"
      role="region"
      aria-label="Dashboard de métricas"
      className="space-y-8 px-1 pb-16 pt-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          <h2 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Dashboard de métricas
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Visão geral das vagas e do desempenho dos processos seletivos,
            atualizado em tempo real com o banco do portal.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Exportar relatório com os filtros atuais"
        >
          <Button
            variant="secondary"
            onClick={() => exportReport("csv")}
            disabled={!exportReady}
            title="Planilha CSV (Excel/LibreOffice) com os indicadores filtrados"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Planilha (CSV)
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportReport("xlsx")}
            disabled={!exportReady}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Excel
          </Button>
          <Button
            variant="accent"
            onClick={printPdf}
            disabled={!exportReady}
            title="Relatório em PDF com o template institucional UNICAP"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Relatório PDF
          </Button>
        </div>
      </header>

      <div
        className={`${SURFACE} flex flex-col gap-4 p-5 transition-opacity duration-200 ${
            refreshing ? "opacity-60" : "opacity-100"
          }`}
        role="group"
        aria-label="Filtros do dashboard"
      >
        <div className="flex flex-wrap items-end gap-4">
            <CustomSelect
              label="Período"
              value={draftState.period}
              onChange={(val) => setDraftState({ ...draftState, period: val })}
              placeholder="Todo o período"
              options={PERIOD_OPTIONS}
              className="w-full sm:w-52"
            />

            <CustomSelect
              label="Curso"
              value={draftState.course}
              onChange={(val) => setDraftState({ ...draftState, course: val })}
              placeholder="Todos os cursos"
              options={[
                { value: "", label: "Todos os cursos" },
                ...facets.courses.map((c) => ({ value: c, label: c }))
              ]}
              className="w-full sm:w-64"
            />

            <CustomSelect
              label="Empresa"
              value={draftState.company}
              onChange={(val) => setDraftState({ ...draftState, company: val })}
              placeholder="Todas as empresas"
              options={[
                { value: "", label: "Todas as empresas" },
                ...facets.companies.map((c) => ({ value: c, label: c }))
              ]}
              className="w-full sm:w-64"
            />

            <CustomSelect
              label="Status da vaga"
              value={draftState.status}
              onChange={(val) => setDraftState({ ...draftState, status: val })}
              placeholder="Todos os status"
              options={STATUS_OPTIONS}
              className="w-full sm:w-52"
            />
            <Button
                className="h-10 shrink-0"
                variant="primary"
                onClick={applyFilters}
            >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Atualizar
            </Button>
            {filtersActive ? (
                 <Button
                    className="h-10 shrink-0"
                    variant="secondary"
                    onClick={clearFilters}
                >
                    Limpar
                </Button>
            ) : null}
        </div>
        {chips.length > 0 ? (
        <ul
          data-testid="active-filter-chips"
          aria-label="Filtros ativos"
          className="flex flex-wrap gap-2 pt-2 border-t border-slate-100"
        >
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => {
                    const newState = { ...filterState, [chip.key]: "" };
                    setFilterState(newState);
                    setDraftState(newState);
                }}
                aria-label={`Remover filtro ${chip.label}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      </div>

      <div
        className={`transition-opacity duration-200 ${
          refreshing ? "opacity-60" : "opacity-100"
        }`}
      >
        <div
            className={`${SURFACE} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`}
        >
            <KpiCell
                value={summary.jobs.open}
                label="Vagas abertas"
                hint="recebendo candidaturas"
                testId="kpi-vagas-abertas"
                icon={<Briefcase className="h-4 w-4" />}
            />
            <KpiCell
                value={formatEmployabilityRate(summary.employability.rate)}
                label="Taxa de empregabilidade"
                hint="Aprovados sobre finalizados"
                testId="kpi-empregabilidade"
                icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCell
                value={tth?.averageDays ?? null}
                label="Tempo médio de contratação"
                hint="Da candidatura ao preenchimento da vaga"
                testId="kpi-tempo-contratacao"
                unit={tth?.averageDays !== null && tth?.averageDays !== undefined ? "dias" : undefined}
                icon={<Timer className="h-4 w-4" />}
            />
             <KpiCell
                value={summary.applications.finalized}
                label="Resultados finais"
                hint={`${summary.applications.approved} aprovados · ${summary.applications.rejected} reprovados`}
                testId="kpi-resultados-finais"
                icon={<Users className="h-4 w-4" />}
            />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel
                testId="manager-funnel"
                label="Funil de conversão"
                title="Funil de conversão"
                icon={<Filter className="h-5 w-5" />}
                aside={
                    <span className="text-sm tabular-nums text-slate-500">
                    {funnel?.totalApplications ?? 0} candidaturas
                    </span>
                }
                footnote="O percentual de cada etapa é relativo à etapa anterior."
            >
                {funnel === undefined ? (
                    <Empty>Carregando funil...</Empty>
                ) : funnel.totalApplications === 0 ? (
                     <Empty>Nenhuma candidatura no filtro atual.</Empty>
                ) : (
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
                )}
            </Panel>
            
            <div className="flex flex-col gap-6">
                <Panel
                    testId="active-ranking-companies"
                    label="Empresas mais ativas"
                    title="Empresas mais ativas"
                    icon={<Building2 className="h-5 w-5" />}
                >
                     {rankings === undefined ? (
                         <Empty>Carregando ranking...</Empty>
                     ) : rankings.topCompanies.length === 0 ? (
                         <Empty>Nenhuma vaga publicada no filtro atual.</Empty>
                     ) : (
                         <ol className="flex flex-col gap-4">
                            {rankings.topCompanies.map((company, index) => (
                            <li
                                key={company.recruiterId}
                                className="flex items-center gap-3"
                            >
                                <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
                                aria-hidden="true"
                                >
                                {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                {company.companyName}
                                </span>
                                <span className="shrink-0 text-xs text-a11y-slate-500">
                                {company.publishedJobs}{" "}
                                {company.publishedJobs === 1 ? "vaga" : "vagas"} ·{" "}
                                <strong className="text-primary">
                                    {company.applicationsCount}
                                </strong>{" "}
                                {company.applicationsCount === 1 ? "cand." : "cands."}
                                </span>
                            </li>
                            ))}
                        </ol>
                     )}
                </Panel>
                
                 <Panel
                    testId="active-ranking-jobs"
                    label="Vagas mais procuradas"
                    title="Vagas mais procuradas"
                    icon={<Layers className="h-5 w-5" />}
                >
                    {rankings === undefined ? (
                         <Empty>Carregando ranking...</Empty>
                     ) : rankings.topJobs.length === 0 ? (
                         <Empty>Nenhuma candidatura no filtro atual.</Empty>
                     ) : (
                         <ol className="flex flex-col gap-4">
                            {rankings.topJobs.map((job, index) => (
                            <li
                                key={job.jobId}
                                className="flex items-center gap-3"
                            >
                                <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
                                aria-hidden="true"
                                >
                                {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-800">
                                    {job.title}
                                </span>
                                <span className="block truncate text-xs text-a11y-slate-500">
                                    {job.companyName}
                                </span>
                                </span>
                                <span className="shrink-0 text-xs text-a11y-slate-500">
                                <strong className="text-primary">
                                    {job.applicationsCount}
                                </strong>{" "}
                                {job.applicationsCount === 1 ? "cand." : "cands."}
                                </span>
                            </li>
                            ))}
                        </ol>
                     )}
                </Panel>
            </div>
        </div>
      </div>
    </section>
  );
}