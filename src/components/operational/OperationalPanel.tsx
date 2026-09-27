import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../ui/card";
import { formatEmployabilityRate } from "../../lib/operationalPanel";
import type { FunnelStep } from "../../lib/funnel";
import {
  hasActiveFilters,
  normalizeDashboardFilters,
  type DashboardFilters,
} from "../../lib/dashboardFilters";

/**
 * Painel Operacional (issues [S5-1] a [S5-5]).
 * Cards de vagas, taxa de empregabilidade, Time-to-Hire, funil de
 * conversão e rankings — todos alimentados por queries agregadas no
 * servidor. [S5-5] A barra de filtros global (período, curso, empresa e
 * status) é COMBINÁVEL e atualiza todas as métricas reativamente:
 * cada mudança nos filtros muda os argumentos das queries e as
 * subscriptions do Convex entregam os novos valores em tempo real.
 */

const DAY = 24 * 60 * 60 * 1000;

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
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

type KpiCardProps = {
  value: string | number;
  label: string;
  hint?: string;
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

function KpiCard({ value, label, hint }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1">
      <p className="font-serif text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {hint !== undefined ? (
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
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

type FilterBarProps = {
  state: FilterState;
  onChange: (next: FilterState) => void;
  facets: { courses: string[]; companies: string[] };
  active: boolean;
};

/**
 * [S5-5] Barra de filtros combináveis: período + curso + empresa + status.
 * Qualquer combinação atualiza todas as métricas do painel (as queries
 * recebem os mesmos argumentos).
 */
function FilterBar({ state, onChange, facets, active }: FilterBarProps) {
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });

  return (
    <section
      data-testid="dashboard-filters"
      aria-label="Filtros do dashboard"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-serif text-sm font-bold uppercase tracking-wide text-primary">
          Filtros
        </h3>
        {active ? (
          <button
            type="button"
            data-testid="clear-filters"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[#FDF2F4] focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            Limpar filtros
          </button>
        ) : (
          <span className="text-xs text-slate-400">
            aplicam-se a todas as métricas
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    </section>
  );
}

type TimeToHireStats = {
  averageDays: number | null;
  label: string;
  samplesCount: number;
  facets: { courses: string[]; companies: string[] };
};

/** [S5-2] Time-to-Hire médio (métrica segue os filtros globais). */
function TimeToHireSection({ stats }: { stats: TimeToHireStats | undefined }) {
  return (
    <section
      data-testid="time-to-hire"
      className="mt-3"
      aria-label="Time to hire"
    >
      <Card title="Time-to-Hire médio" accent="secondary">
        {stats === undefined ? (
          <LoadingSection label="Carregando time-to-hire" />
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <p className="font-serif text-3xl font-bold text-primary">
                {stats.label}
              </p>
              <p className="text-xs text-slate-500">
                {stats.samplesCount === 0
                  ? "sem contratações no filtro selecionado"
                  : `${stats.samplesCount} ${stats.samplesCount === 1 ? "contratação" : "contratações"} no filtro`}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-400">
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
      className="mt-3"
      aria-label="Funil de conversão"
    >
      <Card title="Funil de Conversão" accent="primary">
        {funnel === undefined ? (
          <LoadingSection label="Carregando funil" />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
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
                    className="w-12 shrink-0 text-right text-xs text-slate-500"
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
            <p className="mt-2 text-xs text-slate-400">
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
      <Card title="Empresas mais ativas" accent="secondary">
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
                <span className="shrink-0 text-xs text-slate-500">
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

      <Card title="Vagas mais procuradas">
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
                  <span className="block truncate text-xs text-slate-400">
                    {job.companyName}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
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

  const filters: DashboardFilters = normalizeDashboardFilters({
    from:
      filterState.period !== ""
        ? Date.now() - Number(filterState.period) * DAY
        : undefined,
    course: filterState.course,
    company: filterState.company,
    status: filterState.status,
  });
  const filtersActive = hasActiveFilters(filters);

  // Toda mudança de filtro muda os argumentos → resubscribe reativa.
  const summary = useQuery(api.operational.operationalSummary, filters);
  const tth = useQuery(api.operational.timeToHireStats, filters);
  const funnel = useQuery(api.operational.pipelineFunnel, filters);
  const rankings = useQuery(api.operational.activeRankings, {
    limit: 5,
    ...filters,
  });

  if (summary === undefined) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-500">Carregando indicadores…</p>
      </div>
    );
  }

  return (
    <section data-testid="operational-panel" aria-label="Painel operacional">
      <header className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-secondary">
          Indicadores
        </p>
        <h2 className="font-serif text-2xl font-bold text-primary">
          Painel Operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Visão geral das vagas e do desempenho dos processos seletivos —
          atualizado em tempo real com o banco do portal.
        </p>
      </header>

      <FilterBar
        state={filterState}
        onChange={setFilterState}
        facets={tth?.facets ?? { courses: [], companies: [] }}
        active={filtersActive}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          value={summary.jobs.open}
          label="Vagas abertas"
          hint="recebendo candidaturas"
        />
        <KpiCard value={summary.jobs.closed} label="Vagas fechadas" />
        <KpiCard
          value={summary.jobs.filled}
          label="Vagas preenchidas"
          hint="encerradas (prazo ou ciclo completo)"
        />
        <KpiCard value={summary.jobs.total} label="Total de vagas" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card title="Taxa de Empregabilidade" accent="secondary">
          <p className="font-serif text-3xl font-bold text-primary">
            {formatEmployabilityRate(summary.employability.rate)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aprovados sobre finalizados
          </p>
        </Card>
        <Card title="Candidaturas em andamento">
          <p className="font-serif text-3xl font-bold text-primary">
            {summary.applications.inProgress}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inscrito, triagem e entrevista
          </p>
        </Card>
        <Card title="Resultados finais">
          <p className="font-serif text-3xl font-bold text-primary">
            {summary.applications.finalized}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.applications.approved} aprovados ·{" "}
            {summary.applications.rejected} reprovados
          </p>
        </Card>
      </div>

      <TimeToHireSection stats={tth} />
      <FunnelSection funnel={funnel} />
      <RankingSection rankings={rankings} />
    </section>
  );
}
