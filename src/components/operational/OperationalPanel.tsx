import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Lock,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  buildOperationalReport,
  formatEmployabilityRate,
} from "../../lib/operationalPanel";
import { downloadReport } from "../../lib/reportExport";
import { printOperationalReport } from "../../lib/reportPrint";
import type { FunnelStep } from "../../lib/funnel";
import {
  hasActiveFilters,
  normalizeDashboardFilters,
  type DashboardFilters,
} from "../../lib/dashboardFilters";
import { useStableQuery } from "../../lib/useStableQuery";

/**
 * Painel Operacional (issues [S5-1] a [S5-5]).
 * Cards de vagas, taxa de empregabilidade, Time-to-Hire, funil de
 * conversão e rankings — todos alimentados por queries agregadas no
 * servidor. [S5-5] A barra de filtros global (período, curso, empresa e
 * status) é COMBINÁVEL e atualiza todas as métricas reativamente:
 * cada mudança nos filtros muda os argumentos das queries e as
 * subscriptions do Convex entregam os novos valores em tempo real.
 * [S6-1] Botões de exportação (CSV/Excel): o relatório é montado a partir
 * do MESMO estado filtrado exibido — sem nova ida ao servidor.
 */

/** Início do dia no fuso LOCAL do usuário (e não em UTC). */
function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Início do dia local, `days` dias atrás (seguro contra mudança de horário). */
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

const SELECT_CLASS =
  "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke-width=%222%22%20stroke=%22%2394a3b8%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[size:1.25em_1.25em] h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

type KpiCardProps = {
  value: string | number;
  label: string;
  hint?: string;
  /** [RECRUITER_UX_UPGRADE] Ícone lucide que ancora a métrica. */
  icon?: React.ReactNode;
};

/**
 * [UX-P3] H1-4 — skeleton de carregamento: mantém o layout estável
 * enquanto a seção agrega no servidor (sem saltos de conteúdo).
 */
function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 rounded bg-slate-100"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

/** Contêiner de carga acessível com skeleton dentro. */
function LoadingSection({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <SkeletonBlock lines={3} />
    </div>
  );
}

function KpiCard({ value, label, hint, icon }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-level1 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-level2">
      {icon !== undefined ? (
        <span
          aria-hidden="true"
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF2F4] text-primary ring-1 ring-primary/20"
        >
          {icon}
        </span>
      ) : null}
      <p className="font-serif text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-a11y-slate-500">
        {label}
      </p>
      {hint !== undefined ? (
        <p className="mt-0.5 text-xs text-a11y-slate-500">{hint}</p>
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

/** Referência estável: evita recriar o objeto a cada render durante o carregamento. */
const EMPTY_FACETS: Facets = { courses: [], companies: [] };

type FilterBarProps = {
  state: FilterState;
  onChange: (next: FilterState) => void;
  facets: Facets;
  active: boolean;
};

/**
 * [S5-5] Barra de filtros combináveis: período + curso + empresa + status.
 * Qualquer combinação atualiza todas as métricas do painel (as queries
 * recebem os mesmos argumentos). Os filtros ativos aparecem como chips
 * removíveis logo abaixo dos selects.
 */
function FilterBar({ state, onChange, facets, active }: FilterBarProps) {
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });

  const chips: { key: keyof FilterState; label: string }[] = [];
  if (state.period !== "") {
    const label =
      PERIOD_OPTIONS.find((option) => option.value === state.period)?.label ??
      state.period;
    chips.push({ key: "period", label: `Período: ${label}` });
  }
  if (state.course !== "") {
    chips.push({ key: "course", label: `Curso: ${state.course}` });
  }
  if (state.company !== "") {
    chips.push({ key: "company", label: `Empresa: ${state.company}` });
  }
  if (state.status !== "") {
    const label =
      STATUS_OPTIONS.find((option) => option.value === state.status)?.label ??
      state.status;
    chips.push({ key: "status", label: `Status: ${label}` });
  }

  return (
    <section
      data-testid="dashboard-filters"
      aria-label="Filtros do dashboard"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-sm font-bold uppercase tracking-wide text-primary">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
        </h3>
        {active ? (
          <button
            type="button"
            data-testid="clear-filters"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[#FDF2F4] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            Limpar filtros
          </button>
        ) : (
          <span className="text-xs text-a11y-slate-500">
            aplicam-se a todas as métricas
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-a11y-slate-500">
            Período
          </span>
          <select
            value={state.period}
            onChange={(e) => set({ period: e.target.value })}
            className={SELECT_CLASS}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-a11y-slate-500">
            Curso
          </span>
          <select
            value={state.course}
            onChange={(e) => set({ course: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Todos os cursos</option>
            {facets.courses.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-a11y-slate-500">
            Empresa
          </span>
          <select
            value={state.company}
            onChange={(e) => set({ company: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Todas as empresas</option>
            {facets.companies.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-a11y-slate-500">
            Status da vaga
          </span>
          <select
            value={state.status}
            onChange={(e) => set({ status: e.target.value })}
            className={SELECT_CLASS}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 ? (
        <ul
          data-testid="active-filter-chips"
          aria-label="Filtros ativos"
          className="mt-4 flex flex-wrap gap-2"
        >
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => set({ [chip.key]: "" } as Partial<FilterState>)}
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
    </section>
  );
}

type TimeToHireStats = {
  averageDays: number | null;
  label: string;
  samplesCount: number;
  facets: Facets;
};

/** [S5-2] Time-to-Hire médio (métrica segue os filtros globais). */
function TimeToHireSection({ stats }: { stats: TimeToHireStats | undefined }) {
  return (
    <section
      data-testid="time-to-hire"
      className="min-w-0"
      aria-label="Time to hire"
    >
      <Card title="Time-to-Hire médio" accent="primary">
        {stats === undefined ? (
          <LoadingSection label="Carregando time-to-hire" />
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <p className="font-serif text-3xl font-bold text-primary">
                {stats.label}
              </p>
              <p className="text-xs text-a11y-slate-500">
                {stats.samplesCount === 0
                  ? "sem contratações no filtro selecionado"
                  : `${stats.samplesCount} ${stats.samplesCount === 1 ? "contratação" : "contratações"} no filtro`}
              </p>
            </div>
            <p className="mt-1 text-xs text-a11y-slate-500">
              Média de dias entre a candidatura do contratado e o preenchimento
              da vaga.
            </p>
          </>
        )}
      </Card>
    </section>
  );
}

type FunnelResult = {
  steps: FunnelStep[];
  totalApplications: number;
};

/** [S5-3] Funil de conversão (métrica segue os filtros globais). */
function FunnelSection({ funnel }: { funnel: FunnelResult | undefined }) {
  const steps = funnel?.steps ?? [];
  const maxCount = Math.max(1, ...steps.map((step) => step.count));

  return (
    <section
      data-testid="pipeline-funnel"
      className="min-w-0"
      aria-label="Funil de conversão"
    >
      <Card title="Funil de Conversão" accent="primary">
        {funnel === undefined ? (
          <LoadingSection label="Carregando funil" />
        ) : funnel.totalApplications === 0 ? (
          <div
            data-testid="funnel-empty"
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF2F4] text-primary ring-1 ring-primary/20"
            >
              <Layers className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-slate-800">
              Nenhuma candidatura no filtro atual
            </p>
            <p className="max-w-xs text-xs text-a11y-slate-500">
              Ajuste ou limpe os filtros para ver o funil de conversão por
              etapa do pipeline.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-a11y-slate-500">
              Candidaturas por etapa do pipeline e % de avanço entre degraus —{" "}
              {funnel.totalApplications} candidaturas no filtro atual.
            </p>
            <ul className="flex flex-col gap-2">
              {steps.map((step) => (
                <li key={step.stage} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-semibold text-slate-700">
                    {step.label}
                  </span>
                  <div
                    className="h-7 flex-1 overflow-hidden rounded bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      data-testid={`funnel-bar-${step.stage}`}
                      className="flex h-full items-center justify-end rounded bg-primary px-2 text-xs font-semibold text-white"
                      style={{
                        width: `${Math.max(
                          step.count === 0 ? 0 : 8,
                          (step.count / maxCount) * 100,
                        )}%`,
                      }}
                    >
                      {step.count > 0 ? step.count : ""}
                    </div>
                  </div>
                  <span
                    className="w-8 shrink-0 text-right text-sm font-bold text-primary"
                    aria-label={`${step.count} candidaturas em ${step.label}`}
                  >
                    {step.count}
                  </span>
                  <span
                    className="w-12 shrink-0 text-right text-xs text-a11y-slate-500"
                    aria-label={
                      step.conversionFromPrevious === null
                        ? "sem conversão anterior"
                        : `${step.conversionFromPrevious}% de conversão da etapa anterior`
                    }
                  >
                    {step.conversionFromPrevious === null
                      ? "—"
                      : `${step.conversionFromPrevious}%`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-a11y-slate-500">
              % = avanço em relação à etapa anterior (reprovados não compõem o
              funil).
            </p>
          </>
        )}
      </Card>
    </section>
  );
}

type RankingsResult = {
  limit: number;
  topCompanies: {
    recruiterId: string;
    companyName: string;
    publishedJobs: number;
    applicationsCount: number;
  }[];
  topJobs: {
    jobId: string;
    title: string;
    companyName: string;
    applicationsCount: number;
  }[];
};

/** [S5-4] Rankings (métricas seguem os filtros globais). */
function RankingSection({
  rankings,
}: {
  rankings: RankingsResult | undefined;
}) {
  return (
    <section
      data-testid="active-ranking"
      className="mt-3 grid gap-3 md:grid-cols-2"
      aria-label="Empresas e vagas mais ativas"
    >
      <Card title="Empresas mais ativas" accent="primary">
        {rankings === undefined ? (
          <LoadingSection label="Carregando ranking" />
        ) : rankings.topCompanies.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nenhuma vaga publicada no filtro atual.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rankings.topCompanies.map((company, index) => (
              <li
                key={company.recruiterId}
                className="flex items-center gap-3 rounded border border-slate-100 bg-white px-3 py-2"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] text-xs font-bold text-primary"
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
                  {company.applicationsCount === 1 ? "candidato" : "candidatos"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card title="Vagas mais procuradas" accent="primary">
        {rankings === undefined ? (
          <LoadingSection label="Carregando ranking" />
        ) : rankings.topJobs.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nenhuma candidatura no filtro atual.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rankings.topJobs.map((job, index) => (
              <li
                key={job.jobId}
                className="flex items-center gap-3 rounded border border-slate-100 bg-white px-3 py-2"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] text-xs font-bold text-primary"
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
                  {job.applicationsCount === 1 ? "candidato" : "candidatos"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}

export function OperationalPanel() {
  // [S5-5] Estado dos filtros combináveis — compartilhado por todas as
  // métricas do painel.
  const [filterState, setFilterState] = useState<FilterState>(EMPTY_FILTERS);

  // Início do dia local. Só muda quando o dia vira (o setState com o mesmo
  // valor não re-renderiza), mantendo os argumentos das queries estáveis e
  // ainda assim atualizando o período se o painel ficar aberto de um dia
  // para o outro.
  const [todayStart, setTodayStart] = useState<number>(() =>
    startOfLocalDay(Date.now()),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setTodayStart(startOfLocalDay(Date.now()));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // `from` depende apenas do filtro e do dia atual: sem Date.now() solto
  // no render, evitando resubscribe em loop.
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

  // Toda mudança de filtro muda os argumentos → resubscribe reativa.
  // useStableQuery segura o último valor enquanto o novo carrega.
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

  // Horário da última atualização recebida do servidor.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    if (summary !== undefined) setUpdatedAt(Date.now());
  }, [summary, tth, funnel, rankings]);

  if (summary === undefined) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-a11y-slate-500">Carregando indicadores…</p>
      </div>
    );
  }

  /**
   * [S6-1/S6-2] Exporta o relatório com os dados FILTRADOS vigentes:
   * monta as seções a partir do estado atual das 4 queries e entrega em
   * CSV (UTF-8+BOM), XLSX (OOXML) ou PDF (template UNICAP impresso pelo
   * navegador) — todos sem dependências externas.
   */
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

  // Só exporta com todas as seções carregadas e atualizadas — evita
  // arquivos incompletos ou com dados do filtro anterior.
  const exportReady =
    tth !== undefined &&
    funnel !== undefined &&
    rankings !== undefined &&
    !refreshing;

  const exportReport = (format: "csv" | "xlsx") => {
    downloadReport(report, format);
  };
  /** [S6-2] PDF institucional via impressão nativa do navegador. */
  const printPdf = () => {
    printOperationalReport(report);
  };

  // [S8-2]: role=region explícito — o main da página é único, no App (1.3.1).
  return (
    <section
      data-testid="operational-panel"
      role="region"
      aria-label="Painel operacional"
      aria-busy={refreshing}
    >
      {/* [S8-2]: div (não header) — evita banner aninhado dentro do main. */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary">
            Painel Operacional
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Visão geral das vagas e do desempenho dos processos seletivos,
            atualizado em tempo real com o banco do portal.
          </p>
          <p
            data-testid="live-indicator"
            className="mt-1 flex items-center gap-2 text-xs text-a11y-slate-500"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span
                className={`absolute inline-flex h-full w-full rounded-full bg-success opacity-60 ${
                  refreshing ? "animate-ping" : ""
                }`}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {refreshing
              ? "Atualizando…"
              : updatedAt !== null
                ? `Ao vivo · atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR")}`
                : "Ao vivo"}
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
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Baixar CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportReport("xlsx")}
            disabled={!exportReady}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar Excel
          </Button>
          <Button
            variant="secondary"
            onClick={printPdf}
            disabled={!exportReady}
            title="Relatório em PDF com o template institucional UNICAP (usa a impressão do navegador)"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Baixar PDF
          </Button>
        </div>
      </div>

      <FilterBar
        state={filterState}
        onChange={setFilterState}
        facets={tth?.facets ?? EMPTY_FACETS}
        active={filtersActive}
      />

      {/* Enquanto os novos dados chegam, os antigos ficam na tela
          levemente esmaecidos (sem piscar nem pular o layout). */}
      <div
        className={`transition-opacity duration-200 ${
          refreshing ? "opacity-60" : "opacity-100"
        }`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            value={summary.jobs.open}
            label="Vagas abertas"
            hint="recebendo candidaturas"
            icon={<Briefcase className="h-5 w-5" />}
          />
          <KpiCard
            value={summary.jobs.closed}
            label="Vagas fechadas"
            icon={<Lock className="h-5 w-5" />}
          />
          <KpiCard
            value={summary.jobs.filled}
            label="Vagas encerradas"
            hint="prazo vencido ou ciclo completo"
            icon={<BadgeCheck className="h-5 w-5" />}
          />
          <KpiCard
            value={summary.jobs.total}
            label="Total de vagas"
            icon={<Layers className="h-5 w-5" />}
          />
        </div>

        {/* [REFACTOR_UI] Painel executivo: cards e gráficos distribuídos em
            CSS Grid (sem empilhamento vertical de documento). */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card title="Taxa de Empregabilidade" accent="primary">
            <p className="font-serif text-3xl font-bold text-primary">
              {formatEmployabilityRate(summary.employability.rate)}
            </p>
            <p className="mt-1 text-xs text-a11y-slate-500">
              Aprovados sobre finalizados
            </p>
          </Card>
          <Card title="Candidaturas em andamento" accent="primary">
            <p className="font-serif text-3xl font-bold text-primary">
              {summary.applications.inProgress}
            </p>
            <p className="mt-1 text-xs text-a11y-slate-500">
              Inscrito, triagem e entrevista
            </p>
          </Card>
          <Card title="Resultados finais" accent="primary">
            <p className="font-serif text-3xl font-bold text-primary">
              {summary.applications.finalized}
            </p>
            <p className="mt-1 text-xs text-a11y-slate-500">
              {summary.applications.approved} aprovados ·{" "}
              {summary.applications.rejected} reprovados
            </p>
          </Card>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <TimeToHireSection stats={tth} />
          <FunnelSection funnel={funnel} />
        </div>
        <RankingSection rankings={rankings} />
      </div>
    </section>
  );
}