import { useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
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
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { CustomSelect } from "../../ui/CustomSelect";
import { buildManagerKpis, partnerStatus } from "../../../lib/managerDashboard";
import { buildOperationalReport } from "../../../lib/operationalPanel";
import { downloadReport } from "../../../lib/reportExport";
import { printOperationalReport } from "../../../lib/reportPrint";
import { normalizeDashboardFilters } from "../../../lib/dashboardFilters";
import { useStableQuery } from "../../../lib/useStableQuery";

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
 * - Responsividade (mobile-first): tipografia e espaçamentos fluidos via
 *   clamp(); KPIs, painéis e a tabela de parceiros reagem à largura REAL
 *   do bloco (container queries `[@container(min-width:...)]`), não à da
 *   janela; a tabela vira lista de cartões em containers estreitos (sem
 *   rolagem horizontal); alvos de toque >= 44px em `pointer:coarse`;
 *   propriedades lógicas (`ms-*`, `border-s`); safe-area no rodapé (iOS).
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
  "rounded-2xl sm:rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Padding fluido: ~20px em 320px, cresce suavemente até 28px. */
const FLUID_PADDING = "p-[clamp(1.25rem,0.9rem+1.2vw,1.75rem)]";

/** Marca o elemento como "container" para as container queries dos filhos. */
const CONTAINER = "[container-type:inline-size]";

/** Botões estilo Apple: sem elevação no hover, realce interno de 1px, press de 0.97. */
const APPLE_PRESS =
  "hover:!translate-y-0 active:!scale-[0.97]";

/**
 * Ação primária (Atualizar): bordô com brilho sutil no topo.
 * 44px de altura (alvo de toque); largura total no mobile.
 */
const APPLE_PRIMARY = `${APPLE_PRESS} group !h-11 !w-full sm:!w-auto !justify-center !gap-2 !rounded-xl !px-4 !shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] !transition-[background-color,box-shadow,transform] !duration-200 !ease-[cubic-bezier(0.23,1,0.32,1)] hover:!translate-y-0 hover:!shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] active:!scale-[0.97] active:!duration-100`;

/**
 * Itens "fantasma" do controle segmentado (CSV, Excel). `flex-1` distribui
 * os botões na linha no mobile; 44px em telas de toque.
 */
const APPLE_GHOST = `${APPLE_PRESS} flex-1 sm:flex-none !h-auto !min-h-9 [@media(pointer:coarse)]:!min-h-11 !justify-center !whitespace-nowrap !rounded-full !px-3.5 !py-1.5 !text-[0.8125rem] !border-transparent !bg-transparent !text-slate-700 !shadow-none hover:!bg-white hover:!shadow-[0_1px_3px_rgba(15,23,42,0.14)] dark:!text-slate-200 dark:hover:!bg-white/10 dark:hover:!shadow-none`;

/** Destaque dentro do controle segmentado (PDF): dourado com realce. */
const APPLE_GOLD = `${APPLE_PRESS} flex-1 sm:flex-none !h-auto !min-h-9 [@media(pointer:coarse)]:!min-h-11 !justify-center !whitespace-nowrap !rounded-full !px-4 !py-1.5 !text-[0.8125rem] bg-gradient-to-b from-white/25 to-transparent !shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(122,90,22,0.25)]`;

/** Barra que cresce ao montar e re-anima a partir do valor atual quando o
 *  percentual muda (transição CSS: interruptível, sem salto). */
function GrowBar({
  percent,
  className,
  testId,
  delay = 1000,
}: {
  percent: number;
  className: string;
  testId?: string;
  delay?: number;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setProgress(percent), delay);
    return () => window.clearTimeout(id);
  }, [percent, delay]);
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
      // O próprio painel é um container: o conteúdo interno (tabela,
      // contadores) reage à largura do painel, não à da janela.
      className={`${SURFACE} ${CONTAINER} min-w-0 ${FLUID_PADDING} ${className}`}
    >
      {/* `flex-wrap`: o "aside" desce para a linha de baixo em telas estreitas. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="flex min-w-0 items-center gap-2.5 font-serif text-lg font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-xl">
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

function KpiCell({
  kpi,
  testId,
  unit,
  icon,
  delay = 0,
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
  delay?: number;
}) {
  const empty = kpi.hasData === false;
  return (
    <div
      data-testid={testId}
      // Divisórias pela largura do container dos KPIs:
      //   1 coluna  (padrão)   -> linha no topo de cada célula
      //   2 colunas (>= 30rem) -> linha no início (RTL-safe) das células pares
      //   4 colunas (>= 60rem) -> linha no início de todas, exceto a primeira
      className={`rise flex min-w-0 flex-col border-t border-slate-100 ${FLUID_PADDING} first:border-t-0 [@container(min-width:30rem)]:even:border-s [@container(min-width:30rem)]:[&:nth-child(2)]:border-t-0 [@container(min-width:60rem)]:border-t-0 [@container(min-width:60rem)]:border-s [@container(min-width:60rem)]:first:border-s-0`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span aria-hidden="true" className="shrink-0 text-slate-400">
          {icon}
        </span>
        <span className="min-w-0 break-words">{kpi.label}</span>
      </p>
      <p
        className={`mt-3 font-serif text-[clamp(2.25rem,1.7rem+2vw,3rem)] font-bold leading-none tracking-tight tabular-nums sm:mt-4 ${
          empty ? "text-slate-300" : "text-primary"
        }`}
      >
        {kpi.value}
        {empty ? <span className="sr-only"> sem dados ainda</span> : null}
        {unit !== undefined && !empty ? (
          <span className="ms-1.5 text-base font-semibold tracking-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
      {kpi.hint !== undefined ? (
        <p className="mt-2.5 text-xs leading-relaxed text-a11y-slate-500 sm:mt-3">
          {kpi.hint}
        </p>
      ) : null}
    </div>
  );
}

/** Linha "rótulo + barra + percentual" usada por curso e reprovações. */
function BarRow({
  label,
  percent,
  scale,
  tone,
  testId,
  delay,
}: {
  label: string;
  percent: number;  
  scale: number;
  tone: string;
  testId?: string;
  delay?: number;
}) {
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 break-words text-sm text-slate-700">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
          {percent}%
        </span>
      </div>
      <Track>
        <GrowBar
          testId={testId}
          percent={(percent / scale) * 100}
          className={tone}
          delay={delay}
        />
      </Track>
    </li>
  );
}

/** Só vira `true` se `active` durar mais que `delayMs` (evita flash de skeleton). */
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

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Carregando o Painel Estratégico…</span>
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

export function ManagerDashboard() {
  // Filtros: o curso alimenta TODAS as queries reais do servidor.
  const [draftCourse, setDraftCourse] = useState("");
  const [draftSemester, setDraftSemester] = useState("");
  const [applied, setApplied] = useState({ course: "", semester: "" });

  const filters = normalizeDashboardFilters({ course: applied.course });
  // As queries de insights aceitam apenas `course`.
  const managerFilters = { course: filters.course };

  const summaryQ = useStableQuery(
    useQuery(api.operational.operationalSummary, filters),
  );
  const tthQ = useStableQuery(
    useQuery(api.operational.timeToHireStats, filters),
  );
  const funnelQ = useStableQuery(
    useQuery(api.operational.pipelineFunnel, filters),
  );
  const talentPoolQ = useStableQuery(
    useQuery(api.students.talentPoolCount, {}),
  );
  const rejectionsQ = useStableQuery(
    useQuery(api.manager.getRejectionInsights, managerFilters),
  );
  const skillsRadarQ = useStableQuery(
    useQuery(api.manager.getSkillsRadar, managerFilters),
  );
  const engagementQ = useStableQuery(
    useQuery(api.manager.getEngagementMetrics, managerFilters),
  );
  const courseEmployabilityQ = useStableQuery(
    useQuery(api.manager.getEmployabilityByCourse, managerFilters),
  );
  const partnerCompaniesQ = useStableQuery(
    useQuery(api.manager.getPartnerCompanies, {}),
  );

  const summary = summaryQ.data;
  const tth = tthQ.data;
  const funnel = funnelQ.data;
  const talentPool = talentPoolQ.data;
  const rejectionsData = rejectionsQ.data;
  const skillsRadar = skillsRadarQ.data;
  const engagement = engagementQ.data;
  const courseEmployability = courseEmployabilityQ.data;
  const partnerCompanies = partnerCompaniesQ.data;

  const refreshing = [
    summaryQ,
    tthQ,
    funnelQ,
    talentPoolQ,
    rejectionsQ,
    skillsRadarQ,
    engagementQ,
    courseEmployabilityQ,
    partnerCompaniesQ,
  ].some((q) => q.stale);

  const showSkeleton = useDelayedFlag(
    [
      summary,
      tth,
      funnel,
      talentPool,
      rejectionsData,
      skillsRadar,
      engagement,
      courseEmployability,
      partnerCompanies,
    ].some((q) => q === undefined),
    300,
  );

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
    return showSkeleton ? <DashboardSkeleton /> : null;
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
      // `min-w-0 max-w-full` evita estouro horizontal dentro de flex/grid.
      // O padding inferior respeita a safe-area (iOS).
      className={`min-w-0 max-w-full space-y-6 px-1 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 transition-opacity duration-200 sm:space-y-8 sm:pb-16 sm:pt-6 ${
        refreshing ? "opacity-60" : "opacity-100"
      }`}
    >
      {/* Cabeçalho: título grande, subtítulo curto, exportações à direita. */}
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {/* basis de 20rem: o bloco de exportação desce quando falta espaço. */}
        <div className="min-w-0 max-w-3xl [flex:1_1_20rem]">
          <h2 className="font-serif text-[clamp(1.875rem,1.25rem+2.6vw,3rem)] font-bold leading-[1.1] tracking-tight text-primary [overflow-wrap:anywhere] [text-wrap:balance]">
            Painel estratégico
          </h2>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-slate-600 sm:mt-4 sm:text-base">
            Oportunidades, empregabilidade dos alunos e desempenho dos
            parceiros, com os dados do portal em tempo real.
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
          aria-label="Exportações do painel"
        >
          <Button
            variant="secondary"
            className={APPLE_GHOST}
            onClick={exportCsv}
            title="Planilha CSV com os indicadores filtrados"
          >
            <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Planilha (CSV)
          </Button>
          <Button
            variant="secondary"
            className={APPLE_GHOST}
            onClick={exportXlsx}
            title="Pasta de trabalho Excel (.xlsx) com os indicadores filtrados"
          >
            <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Excel
          </Button>
          <Button
            variant="accent"
            className={APPLE_GOLD}
            onClick={exportPdf}
            title="Relatório em PDF com o template institucional UNICAP"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Relatório PDF
          </Button>
        </div>
      </header>

      {/*
        Filtros: `relative z-20` garante que o dropdown dos selects fique por
        cima dos blocos seguintes. Os selects ficam num grid auto-fit (1 ou 2
        colunas conforme o espaço); a ação desce para baixo no mobile.
      */}
      <div
        className={`${SURFACE} relative z-20 flex flex-col gap-4 p-4 sm:p-5`}
        role="group"
        aria-label="Filtros do painel estratégico"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,12.5rem),1fr))] gap-4">
            <CustomSelect
              label="Curso"
              value={draftCourse}
              onChange={setDraftCourse}
              placeholder="Todos os cursos"
              options={[
                { value: "", label: "Todos os cursos" },
                ...COURSE_OPTIONS.map((c) => ({ value: c, label: c })),
              ]}
              className="w-full min-w-0"
            />
            <CustomSelect
              label="Semestre"
              value={draftSemester}
              onChange={setDraftSemester}
              placeholder="Todos os semestres"
              options={[
                { value: "", label: "Todos os semestres" },
                ...SEMESTER_OPTIONS.map((s) => ({ value: s, label: `${s}º semestre` })),
              ]}
              className="w-full min-w-0"
            />
          </div>
          <Button
            className={APPLE_PRIMARY}
            variant="primary"
            onClick={() =>
              setApplied({ course: draftCourse, semester: draftSemester })
            }
          >
            <RefreshCw
              className="h-4 w-4 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-180"
              aria-hidden="true"
            />
            Atualizar
          </Button>
        </div>
        {applied.semester !== "" ? (
          <p className="text-xs leading-relaxed text-a11y-slate-500">
            O filtro de semestre ainda não recorta os dados; ele fica pronto
            para quando o backend suportar.
          </p>
        ) : null}
      </div>

      {/* KPIs: uma única faixa, números grandes. */}
      {/*
        O próprio bloco é um container: 1 coluna (padrão) -> 2 (>= 30rem)
        -> 4 (>= 60rem), conforme a largura disponível.
      */}
      <div className={`${SURFACE} ${CONTAINER} overflow-hidden`}>
        <div className="grid grid-cols-1 [@container(min-width:30rem)]:grid-cols-2 [@container(min-width:60rem)]:grid-cols-4">
        <KpiCell
          kpi={kpis.oportunidades}
          testId="kpi-oportunidades"
          icon={<Briefcase className="h-4 w-4" />}
          delay={400}
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
          delay={520}
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
          delay={640}
        />
        <KpiCell
          kpi={kpis.talentos}
          testId="kpi-talentos"
          icon={<Users className="h-4 w-4" />}
          delay={760}
        />
        </div>
      </div>

      {/* Funil + empregabilidade por curso. */}
      <div className={CONTAINER}>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 [@container(min-width:60rem)]:grid-cols-2">
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
          className="rise [animation-delay:900ms]"
        >
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
                    delay={1300}
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
          className="rise [animation-delay:1050ms]"
        >
          {courseEmployability.length === 0 ? (
            <Empty>
              Ainda não há alunos elegíveis para calcular a empregabilidade.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-4 sm:gap-5">
              {courseEmployability.map((row, index) => (
                <BarRow
                  key={row.course}
                  label={row.course}
                  percent={row.percent}
                  scale={maxCourse}
                  tone="bg-secondary"
                  testId={`course-bar-${index}`}
                  delay={1450}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </div>

      {/* Empresas parceiras. */}
      <Panel
        label="Empresas parceiras"
        title="Empresas parceiras"
        icon={<Building2 className="h-5 w-5" />}
        className="rise [animation-delay:1200ms]"
      >
        {partnerCompanies.length === 0 ? (
          <Empty>Ainda não há empresas parceiras no portal.</Empty>
        ) : (
          // Container estreito (< 36rem): cada parceiro vira um cartão, sem
          // rolagem horizontal. Container largo: tabela tradicional. É o MESMO
          // DOM nos dois casos; os `role` explícitos mantêm a semântica de
          // tabela mesmo quando o CSS troca o `display`.
          <div className="[@container(min-width:36rem)]:-mx-2">
            <table
              role="table"
              className="block w-full text-left text-sm [@container(min-width:36rem)]:table"
            >
              <caption className="sr-only">
                Empresas parceiras com vagas publicadas, contratados e status
              </caption>
              <thead
                role="rowgroup"
                className="sr-only [@container(min-width:36rem)]:not-sr-only [@container(min-width:36rem)]:table-header-group"
              >
                <tr role="row" className="text-xs text-slate-500">
                  <th role="columnheader" scope="col" className="px-2 pb-3 font-medium">
                    Empresa
                  </th>
                  <th role="columnheader" scope="col" className="px-2 pb-3 font-medium">
                    Vagas publicadas
                  </th>
                  <th role="columnheader" scope="col" className="px-2 pb-3 font-medium">
                    Contratados
                  </th>
                  <th role="columnheader" scope="col" className="px-2 pb-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody
                role="rowgroup"
                className="block [@container(min-width:36rem)]:table-row-group"
              >
                {partnerCompanies.map((partner) => {
                  const status = partnerStatus(
                    partner.hired,
                    partner.published,
                  );
                  const statusUi = PARTNER_STATUS_LABELS[status];
                  const cellLabel =
                    "before:mb-0.5 before:block before:text-xs before:font-medium before:text-slate-500 before:content-[attr(data-label)] [@container(min-width:36rem)]:table-cell [@container(min-width:36rem)]:px-2 [@container(min-width:36rem)]:py-3.5 [@container(min-width:36rem)]:before:hidden";
                  return (
                    <tr
                      key={partner.recruiterId}
                      role="row"
                      className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-slate-50 p-4 first:mt-0 dark:bg-white/5 [@container(min-width:36rem)]:mt-0 [@container(min-width:36rem)]:table-row [@container(min-width:36rem)]:rounded-none [@container(min-width:36rem)]:border-t [@container(min-width:36rem)]:border-slate-100 [@container(min-width:36rem)]:bg-transparent [@container(min-width:36rem)]:p-0 [@container(min-width:36rem)]:transition-colors [@container(min-width:36rem)]:hover:bg-slate-50 dark:[@container(min-width:36rem)]:bg-transparent dark:[@container(min-width:36rem)]:hover:bg-white/5"
                    >
                      <td
                        role="cell"
                        className="col-span-2 min-w-0 break-words font-semibold text-slate-900 [@container(min-width:36rem)]:table-cell [@container(min-width:36rem)]:px-2 [@container(min-width:36rem)]:py-3.5"
                      >
                        {partner.companyName}
                      </td>
                      <td
                        role="cell"
                        data-label="Vagas publicadas"
                        className={`tabular-nums text-slate-600 ${cellLabel}`}
                      >
                        {partner.published}
                      </td>
                      <td
                        role="cell"
                        data-label="Contratados"
                        className={`tabular-nums text-slate-600 ${cellLabel}`}
                      >
                        {partner.hired}
                      </td>
                      <td
                        role="cell"
                        data-label="Status"
                        className={`col-span-2 ${cellLabel}`}
                      >
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
      {/*
        Insights: 1 coluna -> 2 (>= 44rem, o 3º painel ocupa a linha toda)
        -> 3 colunas (>= 66rem), pela largura do container.
      */}
      <div className={CONTAINER}>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 [@container(min-width:44rem)]:grid-cols-2 [@container(min-width:66rem)]:grid-cols-3">
        <Panel
          testId="manager-insight-rejections"
          label="Motivos de reprovação"
          title="Motivos de reprovação"
          icon={<ClipboardList className="h-5 w-5" />}
          description="Onde os alunos mais falham nos processos seletivos."
          className="rise [animation-delay:1350ms]"
        >
          {rejections.length === 0 ? (
            <Empty>Nenhuma reprovação registrada com os filtros atuais.</Empty>
          ) : (
            <ul className="flex flex-col gap-4 sm:gap-5">
              {rejections.map((row) => (
                <BarRow
                  key={row.reason}
                  label={row.label}
                  percent={row.percent}
                  scale={maxRejection}
                  tone="bg-primary"
                  delay={1750}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          testId="manager-insight-skillgaps"
          label="Radar de competências"
          className="rise [animation-delay:1500ms]"
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
            <ul className="flex flex-col gap-4 sm:gap-5">
              {skillsRadar.map((gap) => (
                <li key={gap.skill}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 break-words text-sm text-slate-700">
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
                        delay={1900}
                      />
                    </Track>
                    <Track height="h-1.5">
                      <GrowBar
                        className="bg-slate-300"
                        percent={(gap.supply / maxSkill) * 100}
                        delay={1900}
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
          className="rise [animation-delay:1650ms] [@container(min-width:44rem)]:col-span-2 [@container(min-width:66rem)]:col-span-1"
        >
          {/* 1 coluna em container < 16rem; 2 colunas a partir daí. */}
          <div className="grid grid-cols-1 rounded-2xl bg-slate-50 py-5 sm:py-6 [@container(min-width:16rem)]:grid-cols-2">
            <div className="px-4 text-center sm:px-5">
              <p className="font-serif text-[clamp(2.25rem,1.7rem+2vw,3rem)] font-bold leading-none tracking-tight tabular-nums text-primary">
                {engagement.incompleteProfiles}
              </p>
              <p className="mt-3 text-sm text-slate-600">Perfil incompleto</p>
            </div>
            <div className="mt-5 border-t border-slate-200 px-4 pt-5 text-center sm:px-5 [@container(min-width:16rem)]:mt-0 [@container(min-width:16rem)]:border-s [@container(min-width:16rem)]:border-t-0 [@container(min-width:16rem)]:pt-0">
              <p className="font-serif text-[clamp(2.25rem,1.7rem+2vw,3rem)] font-bold leading-none tracking-tight tabular-nums text-primary">
                {engagement.noResume}
              </p>
              <p className="mt-3 text-sm text-slate-600">Sem currículo</p>
            </div>
          </div>
        </Panel>
      </div>
      </div>
    </section>
  );
}