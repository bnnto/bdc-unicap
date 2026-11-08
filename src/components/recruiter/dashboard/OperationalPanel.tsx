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
 * - Entrada gradual: classe global `.rise` + `[animation-delay:...]`.
 *
 * Estratégia de responsividade (mobile-first):
 * - Estilos base pensados para ~320px; melhorias entram por conteúdo, não por aparelho.
 * - Tipografia e espaçamentos fluidos via `clamp()`.
 * - Container queries (`[@container(min-width:...)]`) para que KPIs, painéis e
 *   linhas de ranking reajam à largura REAL disponível (ex.: com sidebar aberta),
 *   e não à largura da janela. Requer Tailwind >= 3.1 e navegadores modernos
 *   (Chrome 105+, Safari 16+, Firefox 110+).
 * - Alvos de toque >= 44px em dispositivos de ponteiro grosseiro (`pointer:coarse`).
 * - Propriedades lógicas (`ms-*`, `border-s`) para suportar RTL/i18n.
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

function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [active, delayMs]);
  return show;
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

/** Superfície base. Raio menor no mobile para aproveitar melhor a largura. */
const SURFACE =
  "rounded-2xl sm:rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Padding fluido: ~20px em 320px, cresce suavemente até 28px. */
const FLUID_PADDING = "p-[clamp(1.25rem,0.9rem+1.2vw,1.75rem)]";

/** Marca o elemento como "container" para as container queries dos filhos. */
const CONTAINER = "[container-type:inline-size]";

/** Botões estilo Apple: sem elevação no hover, realce interno de 1px, press de 0.97. */
const APPLE_PRESS = "hover:!translate-y-0 active:!scale-[0.97]";

/**
 * Ação primária (Atualizar): bordô com brilho sutil no topo.
 * Altura de 44px (alvo de toque); ocupa a largura toda no mobile.
 */
const APPLE_PRIMARY = `${APPLE_PRESS} group !h-11 !w-full sm:!w-auto !justify-center !gap-2 !rounded-xl !px-4 !shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] !transition-[background-color,box-shadow,transform] !duration-200 !ease-[cubic-bezier(0.23,1,0.32,1)] hover:!translate-y-0 hover:!shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] active:!scale-[0.97] active:!duration-100`;

/**
 * Itens "fantasma" dentro do controle segmentado (CSV, Excel).
 * `flex-1` no mobile distribui os botões na linha; 44px em telas de toque.
 */
const APPLE_GHOST = `${APPLE_PRESS} flex-1 sm:flex-none !h-auto !min-h-9 [@media(pointer:coarse)]:!min-h-11 !justify-center !whitespace-nowrap !rounded-full !px-3.5 !py-1.5 !text-[0.8125rem] !border-transparent !bg-transparent !text-slate-700 !shadow-none hover:!bg-white hover:!shadow-[0_1px_3px_rgba(15,23,42,0.14)] dark:!text-slate-200 dark:hover:!bg-white/10 dark:hover:!shadow-none`;

/** Destaque dentro do controle segmentado (PDF): dourado com realce. */
const APPLE_GOLD = `${APPLE_PRESS} flex-1 sm:flex-none !h-auto !min-h-9 [@media(pointer:coarse)]:!min-h-11 !justify-center !whitespace-nowrap !rounded-full !px-4 !py-1.5 !text-[0.8125rem] bg-gradient-to-b from-white/25 to-transparent !shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(122,90,22,0.25)]`;

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
  // Espera o painel terminar de aparecer (delay 600ms + subida) antes de
  // a barra começar a crescer.
  useEffect(() => {
    const id = window.setTimeout(() => setProgress(percent), 900);
    return () => window.clearTimeout(id);
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
      // O próprio painel é um container: o conteúdo interno (ex.: linhas de
      // ranking) reage à largura do painel, não à da janela.
      className={`${SURFACE} ${CONTAINER} min-w-0 ${FLUID_PADDING} ${className}`}
    >
      {/* `flex-wrap`: o "aside" desce para a linha de baixo em telas estreitas. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* Trocado de text-slate-900 para text-slate-600 para ficar igual ao rótulo das vagas abertas */}
        <h3 className="flex min-w-0 items-center gap-2.5 font-serif text-lg font-bold tracking-tight text-slate-600 [text-wrap:balance] dark:text-slate-200 sm:text-xl">
          <span aria-hidden="true" className="shrink-0 text-primary">
            {icon}
          </span>
          <span className="min-w-0 break-words">{title}</span>
        </h3>
        {aside}
      </div>
      {description !== undefined ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      <div className="mt-5 sm:mt-6">{children}</div>
      {footnote !== undefined ? (
        <p className="mt-4 text-xs leading-relaxed text-a11y-slate-500 sm:mt-5">
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

/**
 * Linha de ranking.
 * - Container estreito (< 22rem): posição à esquerda; nome em cima e métricas
 *   embaixo, permitindo que o nome use toda a largura (sem "espremer").
 * - Container largo: posição | nome | métricas na mesma linha.
 */
function RankingRow({
  position,
  title,
  subtitle,
  metrics,
}: {
  position: number;
  title: string;
  subtitle?: string;
  metrics: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 [@container(min-width:22rem)]:grid-cols-[1.75rem_minmax(0,1fr)_auto]">
      <span
        className="row-span-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 [@container(min-width:22rem)]:row-span-1"
        aria-hidden="true"
      >
        {position}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">
          {title}
        </span>
        {subtitle !== undefined ? (
          <span className="block truncate text-xs text-a11y-slate-500">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span className="text-xs text-a11y-slate-500 [@container(min-width:22rem)]:whitespace-nowrap">
        {metrics}
      </span>
    </li>
  );
}

function KpiCell({
  value,
  label,
  hint,
  icon,
  testId,
  unit,
  delay = 0,
}: {
  value: string | number | null;
  label: string;
  hint?: string;
  icon: ReactNode;
  testId: string;
  unit?: string;
  /** Atraso (ms) da entrada gradual desta célula. */
  delay?: number;
}) {
  return (
    <div
      data-testid={testId}
      // Divisórias baseadas na largura do container dos KPIs:
      //   1 coluna  (padrão)   -> linha no topo de cada célula
      //   2 colunas (>= 30rem) -> linha no início (RTL-safe) das células pares
      //   4 colunas (>= 60rem) -> linha no início de todas, exceto a primeira
      className={`rise flex min-w-0 flex-col border-t border-slate-100 ${FLUID_PADDING} first:border-t-0 [@container(min-width:30rem)]:even:border-s [@container(min-width:30rem)]:[&:nth-child(2)]:border-t-0 [@container(min-width:60rem)]:border-t-0 [@container(min-width:60rem)]:border-s [@container(min-width:60rem)]:first:border-s-0`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {/* Ícone agora fica em bordô (text-primary) */}
        <span aria-hidden="true" className="shrink-0 text-primary">
          {icon}
        </span>
        <span className="min-w-0 break-words">{label}</span>
      </p>
      {/* Número fluido: 36px em telas pequenas, até 48px em telas grandes. */}
      <p className="mt-3 font-serif text-[clamp(2.25rem,1.7rem+2vw,3rem)] font-bold leading-none tracking-tight tabular-nums text-primary sm:mt-4">
        {value === null || value === "" ? "—" : value}
        {unit !== undefined && value !== null && value !== "" ? (
          <span className="ms-1.5 text-base font-semibold tracking-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
      {hint !== undefined ? (
        <p className="mt-2.5 text-xs leading-relaxed text-a11y-slate-500 sm:mt-3">
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
      <div className="h-10 w-full max-w-md rounded-xl bg-slate-100" />
      <div className="h-4 w-full max-w-sm rounded-full bg-slate-100" />
      <div className="h-24 rounded-2xl bg-slate-100 sm:rounded-3xl" />
      <div className="h-48 rounded-2xl bg-slate-100 sm:rounded-3xl" />
      <div className={CONTAINER}>
        <div className="grid gap-4 sm:gap-6 [@container(min-width:60rem)]:grid-cols-2">
          <div className="h-72 rounded-2xl bg-slate-100 sm:rounded-3xl" />
          <div className="h-72 rounded-2xl bg-slate-100 sm:rounded-3xl" />
        </div>
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
  const showSkeleton = useDelayedFlag(summary === undefined, 300);
  const refreshing =
    summaryQuery.stale ||
    tthQuery.stale ||
    funnelQuery.stale ||
    rankingsQuery.stale;

  if (summary === undefined) {
    return showSkeleton ? <DashboardSkeleton /> : null;
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
      // `min-w-0 max-w-full` evita estouro horizontal quando o painel é filho
      // de um flex/grid. O padding inferior respeita a safe-area (iOS).
      className="min-w-0 max-w-full space-y-6 px-1 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 sm:space-y-8 sm:pb-16 sm:pt-6"
    >
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {/* basis de 20rem: o bloco de exportação desce quando falta espaço. */}
        <div className="min-w-0 max-w-3xl [flex:1_1_20rem]">
          <h2 className="font-serif text-[clamp(1.875rem,1.25rem+2.6vw,3rem)] font-bold leading-[1.1] tracking-tight text-primary [overflow-wrap:anywhere] [text-wrap:balance]">
            Dashboard de métricas
          </h2>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-slate-600 sm:mt-4 sm:text-base">
            Visão geral das vagas e do desempenho dos processos seletivos,
            atualizado em tempo real com o banco do portal.
          </p>
        </div>
        {/*
          Controle segmentado: no mobile ocupa a largura toda e os botões se
          distribuem (flex-1), quebrando de linha se necessário; de `sm` em
          diante volta a ser uma "pílula" compacta.
        */}
        <div
          className="flex w-full flex-wrap items-center gap-1 rounded-3xl bg-slate-100/80 p-1 ring-1 ring-black/[0.04] backdrop-blur dark:bg-white/5 dark:ring-white/10 sm:inline-flex sm:w-auto sm:flex-nowrap sm:rounded-full"
          role="group"
          aria-label="Exportar relatório com os filtros atuais"
        >
          <Button
            variant="secondary"
            className={APPLE_GHOST}
            onClick={() => exportReport("csv")}
            disabled={!exportReady}
            title="Planilha CSV (Excel/LibreOffice) com os indicadores filtrados"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Planilha (CSV)
          </Button>
          <Button
            variant="secondary"
            className={APPLE_GHOST}
            onClick={() => exportReport("xlsx")}
            disabled={!exportReady}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Excel
          </Button>
          <Button
            variant="accent"
            className={APPLE_GOLD}
            onClick={printPdf}
            disabled={!exportReady}
            title="Relatório em PDF com o template institucional UNICAP"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Relatório PDF
          </Button>
        </div>
      </header>

      <div
        className={`${SURFACE} rise relative z-20 [animation-delay:200ms] flex flex-col gap-4 p-4 transition-opacity duration-200 sm:p-5 ${
          refreshing ? "opacity-60" : "opacity-100"
        }`}
        role="group"
        aria-label="Filtros do dashboard"
      >
        {/*
          Selects em grid auto-fit: o número de colunas se ajusta sozinho ao
          espaço (1, 2, 3 ou 4), sem larguras fixas nem breakpoints de aparelho.
          Em telas largas (xl) as ações ficam na mesma linha dos selects.
        */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,12.5rem),1fr))] gap-4">
            <CustomSelect
              label="Período"
              value={draftState.period}
              onChange={(val) => setDraftState({ ...draftState, period: val })}
              placeholder="Todo o período"
              options={PERIOD_OPTIONS}
              className="w-full min-w-0"
            />

            <CustomSelect
              label="Curso"
              value={draftState.course}
              onChange={(val) => setDraftState({ ...draftState, course: val })}
              placeholder="Todos os cursos"
              options={[
                { value: "", label: "Todos os cursos" },
                ...facets.courses.map((c) => ({ value: c, label: c })),
              ]}
              className="w-full min-w-0"
            />

            <CustomSelect
              label="Empresa"
              value={draftState.company}
              onChange={(val) => setDraftState({ ...draftState, company: val })}
              placeholder="Todas as empresas"
              options={[
                { value: "", label: "Todas as empresas" },
                ...facets.companies.map((c) => ({ value: c, label: c })),
              ]}
              className="w-full min-w-0"
            />

            <CustomSelect
              label="Status da vaga"
              value={draftState.status}
              onChange={(val) => setDraftState({ ...draftState, status: val })}
              placeholder="Todos os status"
              options={STATUS_OPTIONS}
              className="w-full min-w-0"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:shrink-0">
            <Button
              className={APPLE_PRIMARY}
              variant="primary"
              onClick={applyFilters}
            >
              <RefreshCw
                className="h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-180"
                aria-hidden="true"
              />
              Atualizar
            </Button>
            {filtersActive ? (
              <Button
                className="!h-11 !w-full shrink-0 !justify-center sm:!w-auto"
                variant="secondary"
                onClick={clearFilters}
              >
                Limpar
              </Button>
            ) : null}
          </div>
        </div>

        {chips.length > 0 ? (
          <ul
            data-testid="active-filter-chips"
            aria-label="Filtros ativos"
            className="flex flex-wrap gap-2 border-t border-slate-100 pt-3"
          >
            {chips.map((chip) => (
              <li key={chip.key} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => {
                    const newState = { ...filterState, [chip.key]: "" };
                    setFilterState(newState);
                    setDraftState(newState);
                  }}
                  aria-label={`Remover filtro ${chip.label}`}
                  // 44px de altura em dispositivos de toque; compacto com mouse.
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-4"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
        {/*
          KPIs: o próprio bloco é um container. Quantidade de colunas conforme
          a largura disponível: 1 (padrão) -> 2 (>= 30rem) -> 4 (>= 60rem).
        */}
        <div className={`${SURFACE} ${CONTAINER} overflow-hidden`}>
          <div className="grid grid-cols-1 [@container(min-width:30rem)]:grid-cols-2 [@container(min-width:60rem)]:grid-cols-4">
            <KpiCell
              delay={400}
              value={summary.jobs.open}
              label="Vagas abertas"
              hint="recebendo candidaturas"
              testId="kpi-vagas-abertas"
              icon={<Briefcase className="h-4 w-4" />}
            />
            <KpiCell
              delay={520}
              value={formatEmployabilityRate(summary.employability.rate)}
              label="Taxa de empregabilidade"
              hint="Aprovados sobre finalizados"
              testId="kpi-empregabilidade"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCell
              delay={640}
              value={tth?.averageDays ?? null}
              label="Tempo médio de contratação"
              hint="Da candidatura ao preenchimento da vaga"
              testId="kpi-tempo-contratacao"
              unit={
                tth?.averageDays !== null && tth?.averageDays !== undefined
                  ? "dias"
                  : undefined
              }
              icon={<Timer className="h-4 w-4" />}
            />
            <KpiCell
              delay={760}
              value={summary.applications.finalized}
              label="Resultados finais"
              hint={`${summary.applications.approved} aprovados · ${summary.applications.rejected} reprovados`}
              testId="kpi-resultados-finais"
              icon={<Users className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Painéis: 1 coluna até o container ter >= 60rem; depois 2 colunas. */}
        <div className={`mt-6 sm:mt-8 ${CONTAINER}`}>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 [@container(min-width:60rem)]:grid-cols-2">
            <Panel
              testId="manager-funnel"
              label="Funil de conversão"
              title="Funil de conversão"
              icon={<Filter className="h-5 w-5" />}
              className="rise [animation-delay:900ms]"
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
                <ul className="flex flex-col gap-4 sm:gap-5">
                  {funnelSteps.map((step) => (
                    <li key={step.stage}>
                      {/* `flex-wrap`: rótulos longos não empurram os números para fora. */}
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="min-w-0 break-words text-sm font-semibold text-slate-800">
                          {step.label}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
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

            <div className="rise flex min-w-0 flex-col gap-4 [animation-delay:1100ms] sm:gap-6">
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
                      <RankingRow
                        key={company.recruiterId}
                        position={index + 1}
                        title={company.companyName}
                        metrics={
                          <>
                            {company.publishedJobs}{" "}
                            {company.publishedJobs === 1 ? "vaga" : "vagas"} ·{" "}
                            <strong className="text-primary">
                              {company.applicationsCount}
                            </strong>{" "}
                            {company.applicationsCount === 1 ? "cand." : "cands."}
                          </>
                        }
                      />
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
                      <RankingRow
                        key={job.jobId}
                        position={index + 1}
                        title={job.title}
                        subtitle={job.companyName}
                        metrics={
                          <>
                            <strong className="text-primary">
                              {job.applicationsCount}
                            </strong>{" "}
                            {job.applicationsCount === 1 ? "cand." : "cands."}
                          </>
                        }
                      />
                    ))}
                  </ol>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}