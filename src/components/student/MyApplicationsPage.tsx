import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  CalendarDays,
  Check,
  Eye,
  Handshake,
  Inbox,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/emptyState";
import {
  REJECTION_REASON_LABELS,
  STAGE_BADGE,
  STAGE_LABELS,
  formatApplicationStatusLabel,
  isRejectionReason,
  myApplicationsKpis,
  rejectionFeedback,
  sortMyApplications,
  stageFeedback,
  stageTimeline,
  type ApplicationStage,
  type TimelineStep,
} from "../../lib/application";
import { MATCH_BAND_LABELS, matchBand } from "../../lib/matching";
import { isContactPending } from "../../lib/usePendingContactRelease";
import { ContactNotice } from "./ContactNotice";

/**
 * "Minhas Candidaturas" — redesign (mesma linguagem do Dashboard Operacional):
 * superfícies com anel de borda, KPIs em linha contínua, barras que crescem,
 * títulos serifados e entrada em cascata (`.rise`).
 *
 * Regras de produto preservadas:
 * - [S4-4] lista reativa por aluno (useQuery);
 * - [Etapa 4.2] feedback claro por candidatura (badge, timeline, frase);
 * - [Etapa 4.3] reprovação amigável com motivo padronizado (R5);
 * - [R6] aceite/revogação de contato por vaga (LGPD).
 *
 * Novo: aviso + filtro + destaque em cada vaga com CONTATO NÃO LIBERADO.
 */

const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const MATCH_CHIP: Record<
  ReturnType<typeof matchBand>,
  "aprovado" | "andamento" | "reprovado"
> = {
  strong: "aprovado",
  medium: "andamento",
  low: "reprovado",
};

type ApplicationRow = {
  applicationId: Id<"applications">;
  jobId: string;
  jobTitle: string;
  jobStatus: "aberta" | "fechada" | "encerrada" | "em_revisao" | "suspensa";
  stage: ApplicationStage;
  matchScore: number;
  appliedAt: number;
  processAccepted: boolean;
  rejectionReason: string | null;
};

type Filter = "todas" | "pendentes";

/* ------------------------------------------------------------------ */
/* Peças de interface                                                  */
/* ------------------------------------------------------------------ */

/** Barra que cresce da esquerda (só transform → roda na GPU). */
function GrowBar({
  percent,
  className = "bg-primary",
  delay = 500,
}: {
  percent: number;
  className?: string;
  delay?: number;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setProgress(percent), delay);
    return () => window.clearTimeout(id);
  }, [percent, delay]);
  return (
    <div
      className={`h-full w-full rounded-full will-change-transform transition-transform !duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${className}`}
      style={{ transform: `translateX(${Math.min(Math.max(progress, 0), 100) - 100}%)` }}
    />
  );
}

function Track({ children }: { children: ReactNode }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      {children}
    </div>
  );
}

function Panel({
  title,
  icon,
  aside,
  footnote,
  className = "",
  children,
}: {
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  footnote?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`${SURFACE} p-7 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-slate-600 dark:text-slate-200">
          <span aria-hidden="true" className="text-primary">
            {icon}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
      {footnote !== undefined ? (
        <p className="mt-5 text-xs leading-relaxed text-a11y-slate-500">{footnote}</p>
      ) : null}
    </section>
  );
}

function KpiCell({
  value,
  label,
  hint,
  icon,
  tone = "primary",
  delay,
}: {
  value: string | number;
  label: string;
  hint: string;
  icon: ReactNode;
  tone?: "primary" | "warning";
  delay: number;
}) {
  return (
    <div
      className="rise flex flex-col border-t border-slate-100 p-7 first:border-t-0 sm:even:border-l sm:[&:nth-child(2)]:border-t-0 xl:border-l xl:border-t-0 xl:first:border-l-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span aria-hidden="true" className={tone === "warning" ? "text-warning" : "text-primary"}>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={`mt-4 font-serif text-5xl font-bold leading-none tracking-[-0.02em] tabular-nums ${
          tone === "warning" ? "text-warning" : "text-primary"
        }`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-a11y-slate-500">{hint}</p>
    </div>
  );
}

/** Linha do tempo: pontos surgem em cascata e os conectores "enchem". */
function Stepper({
  stage,
  steps,
  delay,
}: {
  stage: ApplicationStage;
  steps: TimelineStep[];
  delay: number;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  const rejected = stage === "reprovado";

  return (
    <ol
      aria-label={`Etapa atual: ${STAGE_LABELS[stage]}`}
      className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {steps.map((step, index) => {
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";
        const last = index === steps.length - 1;
        const stagger = { transitionDelay: `${index * 70}ms` };
        return (
          <li key={step.stage} className="flex shrink-0 items-center gap-2">
            <span className="relative flex h-6 w-6 items-center justify-center">
              {isCurrent && on ? (
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 animate-ping rounded-full motion-reduce:hidden ${
                    rejected ? "bg-danger/40" : "bg-primary/40"
                  }`}
                  style={{ animationIterationCount: 2 }}
                />
              ) : null}
              <span
                aria-current={isCurrent ? "step" : undefined}
                style={stagger}
                className={`relative flex h-6 w-6 items-center justify-center rounded-full transition-[transform,opacity] !duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                  on ? "scale-100 opacity-100" : "scale-90 opacity-0"
                } ${
                  isDone
                    ? "bg-success text-white"
                    : isCurrent
                      ? rejected
                        ? "bg-danger text-white"
                        : "bg-primary text-white"
                      : "border-2 border-slate-300 bg-white"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {isCurrent ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
            </span>
            <span
              className={`text-xs ${
                isCurrent
                  ? rejected
                    ? "font-bold text-danger"
                    : "font-bold text-primary"
                  : isDone
                    ? "font-medium text-slate-600"
                    : "text-a11y-slate-500"
              }`}
            >
              {STAGE_LABELS[step.stage]}
            </span>
            {!last ? (
              <span
                aria-hidden="true"
                className="mx-1 h-0.5 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200 sm:w-12"
              >
                <span
                  style={{ transitionDelay: `${index * 70 + 120}ms` }}
                  className={`block h-full w-full origin-left bg-success transition-transform !duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                    on && isDone ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Controle segmentado com indicador deslizante (só transform). */
function FilterToggle({
  value,
  onChange,
  pending,
  total,
}: {
  value: Filter;
  onChange: (value: Filter) => void;
  pending: number;
  total: number;
}) {
  const options: Array<{ key: Filter; label: string; count: number }> = [
    { key: "todas", label: "Todas", count: total },
    { key: "pendentes", label: "Contato pendente", count: pending },
  ];
  return (
    <div
      role="group"
      aria-label="Filtrar candidaturas"
      className="relative grid grid-cols-2 rounded-full bg-slate-100 p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition-transform !duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:bg-[#3a1f29] dark:shadow-[0_0_0_1px_rgba(233,184,195,0.25)] [.high-contrast_&]:border [.high-contrast_&]:border-black [.dark.high-contrast_&]:border-white"
        style={{ transform: value === "todas" ? "translateX(0)" : "translateX(100%)" }}
      />
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={`relative z-10 inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-[transform,color] !duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            value === option.key
              ? "text-primary dark:!text-white"
              : "text-slate-600"
          }`}
        >
          {option.label}
          <span
            className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
              option.key === "pendentes" && option.count > 0
                ? "bg-secondary text-slate-900"
                : value === option.key
                  ? "bg-primary/10 text-primary dark:bg-white/15 dark:!text-white"
                  : "bg-slate-200/80 text-slate-700 dark:bg-white/10 dark:!text-slate-200"
            }`}
          >
            {option.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Bloco de contato dentro do card: pendente (âmbar) ou liberado (verde). */
function ContactBlock({
  row,
  busy,
  onToggle,
}: {
  row: ApplicationRow;
  busy: boolean;
  onToggle: () => void;
}) {
  const released = row.processAccepted;
  // Reprovado e sem contato liberado: nada a cobrar do aluno.
  if (!released && row.stage === "reprovado") return null;

  return (
    <div
      // `key` troca o bloco com um fade quando o aluno libera/revoga.
      key={released ? "liberado" : "pendente"}
      className={`mt-5 flex animate-[view-enter-fade_260ms_ease-out_both] flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between motion-reduce:animate-none ${
        released
          ? "border-emerald-200 bg-[#ECFDF5] dark:border-emerald-400/25 dark:bg-emerald-400/10"
          : "border-amber-200 bg-[#FFFBEB] dark:border-amber-400/25 dark:bg-[#26200f]"
      } [.high-contrast_&]:border-black [.high-contrast_&]:bg-white [.dark.high-contrast_&]:border-white [.dark.high-contrast_&]:bg-black`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 ${released ? "text-success" : "text-warning"}`}
        >
          {released ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ShieldAlert className="h-5 w-5" />
          )}
        </span>
        <div>
          <p
            className={`text-sm font-bold ${released ? "text-success" : "text-warning"}`}
          >
            {released ? "Contato liberado" : "Contato não liberado"}
          </p>
          <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-slate-600">
            {released
              ? "O recrutador pode entrar em contato com você sobre esta vaga. Você pode revogar quando quiser."
              : "O recrutador ainda não vê seus dados de contato e não consegue te chamar para a próxima etapa."}
          </p>
        </div>
      </div>
      <Button
        variant={released ? "secondary" : "accent"}
        disabled={busy}
        aria-label={
          released
            ? `Revogar contato de ${row.jobTitle}`
            : `Liberar contato para ${row.jobTitle}`
        }
        onClick={onToggle}
      >
        <Handshake className="h-4 w-4" aria-hidden="true" />
        {busy ? "Salvando…" : released ? "Revogar contato" : "Liberar contato"}
      </Button>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function MyApplicationsPage() {
  const myApplications = useQuery(api.applications.myApplications, {});
  // Métricas calculadas NO SERVIDOR (src/lib/analytics.ts).
  const myStats = useQuery(api.applications.myStats, {});
  const acceptProcess = useMutation(api.applications.acceptProcess);
  const revokeProcessAcceptance = useMutation(api.applications.revokeProcessAcceptance);

  const [filter, setFilter] = useState<Filter>("todas");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applications: ApplicationRow[] = myApplications ?? [];
  const sorted = useMemo(() => sortMyApplications(applications), [myApplications]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpis = myApplicationsKpis(applications);

  const pendingRows = sorted.filter(isContactPending);
  const pendingCount = pendingRows.length;
  const visible = filter === "pendentes" ? pendingRows : sorted;

  // Sem pendências, o filtro "pendentes" não faz mais sentido.
  useEffect(() => {
    if (pendingCount === 0 && filter === "pendentes") setFilter("todas");
  }, [pendingCount, filter]);

  const goToFirstPending = () => {
    const first = pendingRows[0];
    if (first === undefined) return;
    setFilter("pendentes");
    window.setTimeout(() => {
      const el = document.getElementById(`application-${first.applicationId}`);
      if (el === null) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }, 60);
  };

  const toggleContact = async (row: ApplicationRow) => {
    setBusyId(row.applicationId);
    setError(null);
    try {
      if (row.processAccepted) {
        await revokeProcessAcceptance({ applicationId: row.applicationId });
      } else {
        await acceptProcess({ applicationId: row.applicationId });
      }
    } catch {
      setError("Não foi possível atualizar o contato agora. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const statsReady = myStats !== undefined && myStats !== null;
  const stageEntries = statsReady ? Object.entries(myStats.byStage) : [];
  const maxStage = Math.max(1, ...stageEntries.map(([, count]) => Number(count)));

  return (
    // Região nomeada (o <main> é único, no shell — WCAG 1.3.1).
    <div
      role="region"
      aria-label="Minhas candidaturas"
      className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8"
    >
      {/* Cabeçalho */}
      <div className="max-w-3xl">
        <h1 className="rise mt-3 font-serif text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-primary [animation-delay:70ms] sm:text-5xl">
          Minhas candidaturas
        </h1>
        <p className="rise mt-3 text-sm leading-relaxed text-slate-600 [animation-delay:140ms]">
          A etapa de cada candidatura e o % de compatibilidade, atualizados em
          tempo real com o painel do recrutador, com feedback claro do que
          aconteceu em cada processo.
        </p>
      </div>

      {/* Aviso de contato não liberado */}
      <ContactNotice
        count={pendingCount}
        action={{ label: "Ver vagas pendentes", onClick: goToFirstPending }}
      />

      {/* KPIs em linha contínua */}
      <div className={`${SURFACE} mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`}>
        <KpiCell
          delay={200}
          value={kpis.total}
          label="Candidaturas"
          hint="vagas em que você se candidatou"
          icon={<Inbox className="h-4 w-4" />}
        />
        <KpiCell
          delay={270}
          value={kpis.active}
          label="Em andamento"
          hint="processos ainda abertos"
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiCell
          delay={340}
          value={kpis.bestMatch !== null ? `${kpis.bestMatch}%` : "—"}
          label="Melhor match"
          hint="maior compatibilidade com uma vaga"
          icon={<Target className="h-4 w-4" />}
        />
        <KpiCell
          delay={410}
          value={pendingCount}
          tone={pendingCount > 0 ? "warning" : "primary"}
          label="Contato pendente"
          hint={
            pendingCount > 0
              ? "vagas aguardando a sua liberação"
              : "tudo liberado, nada pendente"
          }
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {/* Estatísticas do perfil */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Estatísticas do meu perfil"
          icon={<TrendingUp className="h-5 w-5" />}
          className="rise [animation-delay:480ms]"
          footnote="Taxa de sucesso = (Entrevista + Aprovado) / Total × 100"
        >
          <ul className="flex flex-col gap-6">
            <li>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">Taxa de sucesso</span>
                <span className="font-serif text-lg font-bold tabular-nums text-primary">
                  {statsReady ? `${myStats.successRate}%` : "—"}
                </span>
              </div>
              <Track>
                <GrowBar percent={statsReady ? myStats.successRate : 0} delay={900} />
              </Track>
            </li>
            <li>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">Média de match</span>
                <span className="font-serif text-lg font-bold tabular-nums text-primary">
                  {statsReady ? `${myStats.averageMatch}%` : "—"}
                </span>
              </div>
              <Track>
                <GrowBar
                  percent={statsReady ? myStats.averageMatch : 0}
                  className="bg-secondary"
                  delay={980}
                />
              </Track>
            </li>
            <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
                Visualizações do perfil
              </span>
              <span className="font-serif text-lg font-bold tabular-nums text-primary">
                {statsReady ? myStats.profileViews : "—"}
              </span>
            </li>
          </ul>
        </Panel>

        <Panel
          title="Distribuição por etapa"
          icon={<Activity className="h-5 w-5" />}
          className="rise [animation-delay:560ms]"
          aside={
            <span className="text-sm tabular-nums text-slate-500">
              {statsReady ? myStats.total : 0} no total
            </span>
          }
        >
          {!statsReady ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Carregando…
            </p>
          ) : (
            <ul className="flex flex-col gap-4" aria-label="Distribuição por etapa">
              {stageEntries.map(([stage, count], index) => (
                <li key={stage}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                      {STAGE_LABELS[stage as ApplicationStage]}
                    </span>
                    <span className="font-serif text-lg font-bold tabular-nums text-slate-900">
                      {count}
                    </span>
                  </div>
                  <Track>
                    <GrowBar
                      percent={Number(count) === 0 ? 0 : Math.max(8, (Number(count) / maxStage) * 100)}
                      delay={950 + index * 60}
                    />
                  </Track>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Lista de candidaturas */}
      <section aria-label="Todas as candidaturas" className="mt-10">
        <div className="rise flex flex-wrap items-center justify-between gap-4 [animation-delay:640ms]">
          <h2 className="flex items-center gap-2.5 font-serif text-2xl font-bold tracking-tight text-slate-600 dark:text-slate-200">
            Todas as candidaturas
          </h2>
          {sorted.length > 0 && pendingCount > 0 ? (
            <FilterToggle
              value={filter}
              onChange={setFilter}
              pending={pendingCount}
              total={sorted.length}
            />
          ) : null}
        </div>

        {error !== null ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-danger bg-white px-4 py-3 text-sm font-medium text-danger"
          >
            {error}
          </p>
        ) : null}

        {myApplications === undefined ? (
          <p
            className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
            role="status"
            aria-live="polite"
          >
            Carregando candidaturas…
          </p>
        ) : sorted.length === 0 ? (
          <div className={`${SURFACE} rise mt-6 p-7 [animation-delay:700ms]`}>
            <EmptyState
              icon={Inbox}
              title="Nenhuma candidatura ainda"
              description="Você ainda não se candidatou a nenhuma vaga. Explore o mural de Oportunidades e candidate-se com um clique."
            />
          </div>
        ) : (
          <ul
            // `key` reinicia a cascata quando o filtro muda.
            key={filter}
            aria-label="Todas as candidaturas"
            className="mt-6 flex flex-col gap-5"
          >
            {visible.map((application, index) => {
              const rejected = application.stage === "reprovado";
              const pending = isContactPending(application);
              const reason = isRejectionReason(application.rejectionReason)
                ? application.rejectionReason
                : null;
              const feedback =
                reason !== null
                  ? rejectionFeedback(reason)
                  : {
                      headline: "Processo encerrado",
                      advice: stageFeedback("reprovado"),
                    };
              const band = matchBand(application.matchScore);
              // 60ms entre cartões, com teto para listas longas.
              const delay = 700 + Math.min(index, 6) * 60;
              return (
                <li
                  key={application.applicationId}
                  id={`application-${application.applicationId}`}
                  tabIndex={-1}
                  style={{ animationDelay: `${delay}ms` }}
                  className={`${SURFACE} rise group relative p-7 outline-none transition-transform !duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5`}
                >
                  {pending ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-7 left-0 w-1 rounded-r-full bg-warning"
                    />
                  ) : null}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl font-bold tracking-tight text-primary">
                        {application.jobTitle}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={STAGE_BADGE[application.stage]}>
                          {STAGE_LABELS[application.stage]}
                        </Badge>
                        <Badge variant={MATCH_CHIP[band]}>
                          {application.matchScore}% · {MATCH_BAND_LABELS[band]}
                        </Badge>
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-a11y-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Candidatura em {formatDate(application.appliedAt)}
                    </p>
                  </div>

                  <p className="sr-only" aria-live="polite">
                    {formatApplicationStatusLabel({
                      jobTitle: application.jobTitle,
                      stage: application.stage,
                      appliedAt: application.appliedAt,
                    })}
                  </p>

                  <Stepper
                    stage={application.stage}
                    steps={stageTimeline(application.stage)}
                    delay={delay + 250}
                  />

                  {/* [Etapa 4.2] feedback claro por candidatura. */}
                  <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {stageFeedback(application.stage)}
                  </p>

                  {/* [Etapa 4.3] reprovação amigável com conselho. */}
                  {rejected ? (
                    <div className="mt-3 rounded-2xl border border-danger bg-white px-4 py-3">
                      <p className="text-sm font-bold text-danger">{feedback.headline}</p>
                      {reason !== null ? (
                        <p className="mt-0.5 text-xs text-slate-600">
                          Motivo (padronizado):{" "}
                          <strong>{REJECTION_REASON_LABELS[reason]}</strong>
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {feedback.advice}
                      </p>
                    </div>
                  ) : null}

                  {/* [R6] controle de contato por candidatura (LGPD). */}
                  <ContactBlock
                    row={application}
                    busy={busyId === application.applicationId}
                    onToggle={() => void toggleContact(application)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}