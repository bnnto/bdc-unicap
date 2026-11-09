import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../../lib/toastMessages";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { JobForm } from "./JobForm";
import { CONTRACT_LABELS, formatSalaryRange, isVerifiablePrerequisite } from "../../../lib/job";
import { renewalWindow } from "../../../lib/jobExpiry";
import {
  Archive,
  Ban,
  Banknote,
  Briefcase,
  CalendarDays,
  Check,
  DoorOpen,
  FilterX,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { EmptyState } from "../../ui/emptyState";
import {
  CARD_HOVER,
  DIVIDER,
  IconTile,
  MotionStyles,
  PageHeader,
  PRESS,
  SURFACE,
  TOUCH_BTN,
} from "./jobsUi";

/* ------------------------------------------------------------------ */
/* Constantes                                                           */
/* ------------------------------------------------------------------ */

/** [UI_OVERHAUL] Ícone por mudança de status no botão dinâmico. */
const STATUS_BUTTON_ICON: Record<Doc<"jobs">["status"], ReactNode> = {
  aberta: <DoorOpen className="h-4 w-4" aria-hidden="true" />,
  fechada: <Lock className="h-4 w-4" aria-hidden="true" />,
  encerrada: <Ban className="h-4 w-4" aria-hidden="true" />,
  em_revisao: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
  suspensa: <Ban className="h-4 w-4" aria-hidden="true" />,
};

type SettableStatus = "aberta" | "fechada" | "encerrada";

const TONE_GREEN =
  "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300";
const TONE_AMBER =
  "border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300";
const TONE_ROSE =
  "border-rose-600/25 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300";

const STATUS_TONE: Record<Doc<"jobs">["status"], string> = {
  aberta: TONE_GREEN,
  fechada: TONE_AMBER,
  encerrada: TONE_ROSE,
  em_revisao: TONE_AMBER,
  suspensa: TONE_ROSE,
};

const STATUS_DOT: Record<Doc<"jobs">["status"], string> = {
  aberta: "bg-emerald-500",
  fechada: "bg-amber-500",
  encerrada: "bg-rose-500",
  em_revisao: "bg-amber-500",
  suspensa: "bg-rose-500",
};

const STATUS_LABELS: Record<Doc<"jobs">["status"], string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  encerrada: "Encerrada",
  em_revisao: "Em revisão",
  suspensa: "Suspensa",
};

const NEXT_STATUS: Record<
  Doc<"jobs">["status"],
  Array<{ value: SettableStatus; label: string }>
> = {
  aberta: [
    { value: "fechada", label: "Fechar" },
    { value: "encerrada", label: "Encerrar" },
  ],
  fechada: [{ value: "aberta", label: "Reabrir" }],
  encerrada: [],
  em_revisao: [],
  suspensa: [],
};

/** Curva forte de saída (skill: nunca ease-in em UI). */
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/**
 * Presets dos botões de ação do card (mesma altura/raio; sombra tingida por
 * variante). Responsivo: no mobile os botões ocupam a célula do grid de 2
 * colunas (`!w-full`); a partir de `sm` voltam ao tamanho natural.
 */
const ACTION_BASE = `group !h-11 !gap-2 !rounded-xl !px-3 min-w-[calc(50%-0.25rem)] !flex-1 sm:!flex-none sm:min-w-0 sm:!px-4 ${TOUCH_BTN}`;
/** Ação principal/longa: linha inteira no mobile. Os demais botões dividem a
 *  linha em 2 (`flex-1` + min-width 50%) e o último, se sobrar, se expande. */
const ACTION_WIDE = "!min-w-full sm:!min-w-0";
const ACTION_PRIMARY = `${ACTION_BASE} ${ACTION_WIDE} hover:!shadow-[0_12px_24px_-10px_rgba(107,20,38,0.2)]`;
const ACTION_ACCENT = `${ACTION_BASE} ${ACTION_WIDE} hover:!shadow-[0_12px_24px_-10px_rgba(200,157,60,0.25)]`;
const ACTION_SECONDARY = `${ACTION_BASE} shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:!shadow-[0_6px_16px_-8px_rgba(107,20,38,0.3)]`;
const ACTION_DANGER = `${ACTION_BASE} hover:!shadow-[0_6px_16px_-8px_rgba(220,38,38,0.4)]`;

/** Botões das caixas de confirmação: lado a lado no mobile (2 colunas). */
const CONFIRM_BTN = `w-full sm:w-auto ${TOUCH_BTN}`;

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

function formatDay(timestamp: number | undefined): string {
  if (timestamp === undefined) return "—";
  return new Date(timestamp).toLocaleDateString("pt-BR");
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

/** `true` após `delayMs` do mount — dispara transições de entrada (barras). */
function useMountedFlag(delayMs: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return ready;
}

type JobFilter = "all" | "aberta" | "fechada" | "outras";

function matchesFilter(status: Doc<"jobs">["status"], filter: JobFilter) {
  if (filter === "all") return true;
  if (filter === "outras") return status !== "aberta" && status !== "fechada";
  return status === filter;
}

/* ------------------------------------------------------------------ */
/* Peças pequenas                                                       */
/* ------------------------------------------------------------------ */

/** Aviso de expiração/renovação (R4) exibido ao lado da data de expiração. */
function ExpiryNote({ job }: { job: Doc<"jobs"> }) {
  if (job.expiresAt === undefined || job.status !== "aberta") return null;
  const renewal = renewalWindow(
    { status: job.status, expiresAt: job.expiresAt },
    Date.now(),
  );
  if (renewal.expired) {
    return (
      <span className="font-semibold text-danger">
        {" "}
        · vencida — será encerrada pelo cron diário
      </span>
    );
  }
  if (renewal.expiring) {
    return (
      <span className="font-semibold text-warning">
        {" "}
        · {renewal.daysLeft} dia(s) restante(s) — renove para reativar 30 dias
      </span>
    );
  }
  return <>{` · ${renewal.daysLeft} dia(s) restante(s)`}</>;
}

/**
 * Medidor de "vida útil" da vaga: a barra representa o tempo que ainda
 * resta até a expiração (esvazia com o tempo). Muda de tom perto do fim.
 * Anima só `transform` (scaleX), a partir de 0, depois que a lista entra.
 */
function LifecycleMeter({ job }: { job: Doc<"jobs"> }) {
  const ready = useMountedFlag(900);
  if (
    job.status !== "aberta" ||
    job.publishedAt === undefined ||
    job.expiresAt === undefined
  ) {
    return null;
  }
  const now = Date.now();
  const span = job.expiresAt - job.publishedAt;
  const remaining =
    span > 0 ? Math.min(1, Math.max(0, (job.expiresAt - now) / span)) : 0;
  const renewal = renewalWindow(
    { status: job.status, expiresAt: job.expiresAt },
    now,
  );
  const tone = renewal.expired
    ? "bg-rose-500"
    : renewal.expiring
      ? "bg-amber-500"
      : "bg-primary";

  return (
    <div
      aria-hidden="true"
      className="mt-3 h-1 max-w-md overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
    >
      <div
        className={`h-full w-full origin-left rounded-full ${tone} will-change-transform transition-transform !duration-[900ms] ${EASE_OUT} motion-reduce:transition-none`}
        style={{ transform: `scaleX(${ready ? remaining : 0})` }}
      />
    </div>
  );
}

/** Pílula de status com ponto colorido (tons explícitos para o dark mode). */
function StatusPill({ status }: { status: Doc<"jobs">["status"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Metadado em pílula discreta (contrato, salário, local). Quebra linha
 *  em textos longos (ex.: localização) em vez de estourar o card. */
function MetaChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-slate-50 px-2.5 py-1 text-xs font-medium text-a11y-slate-600 ring-1 ring-slate-200/70 [overflow-wrap:anywhere] dark:bg-white/5 dark:ring-white/10">
      <span aria-hidden="true" className="mt-px shrink-0 text-primary">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

const STAT_ICON_TONE = {
  primary:
    "bg-[#FDF2F4] text-primary ring-primary/15 dark:bg-primary/15",
  green:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  amber:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
} as const;

/**
 * Indicador do resumo no topo da lista — e também o filtro: clicar
 * filtra a lista por status (aria-pressed). Resposta imediata no press.
 */
function StatTile({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: keyof typeof STAT_ICON_TONE;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${SURFACE} ${PRESS} flex w-full min-w-0 flex-col items-start gap-2.5 px-3.5 py-3.5 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-[440px]:flex-row min-[440px]:items-center min-[440px]:gap-3.5 min-[440px]:px-4 sm:px-5 sm:py-4 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px ${
        active ? "!border-primary" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-10 sm:w-10 ${STAT_ICON_TONE[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium leading-tight text-a11y-slate-500">
          {label}
        </span>
        <span className="mt-1 block font-serif text-2xl font-bold leading-none tracking-tight tabular-nums text-primary sm:text-3xl">
          {value}
        </span>
      </span>
    </button>
  );
}

/**
 * Entrada de cada item da lista. Na primeira carga: cascata lenta
 * (jb-rise, 70ms entre itens). Depois (filtros, novas vagas): entrada
 * rápida (jb-quick, 300ms, sem atraso). O modo é decidido UMA vez no
 * mount, para a classe não mudar e reiniciar a animação.
 */
function Reveal({
  intro,
  index,
  children,
}: {
  intro: boolean;
  index: number;
  children: ReactNode;
}) {
  const [isIntro] = useState(intro);
  return (
    <li
      className={`min-w-0 ${isIntro ? "jb-rise" : "jb-quick"}`}
      style={
        isIntro
          ? { animationDelay: `${300 + Math.min(index, 6) * 70}ms` }
          : undefined
      }
    >
      {children}
    </li>
  );
}

/** Esqueleto da lista: mesma silhueta do card, sem layout shift. */
function JobsSkeleton() {
  const bone = "bg-slate-100 dark:bg-white/10";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 sm:gap-5"
    >
      <span className="sr-only">Carregando vagas…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`${SURFACE} animate-pulse p-4 min-[400px]:p-5 sm:p-7 motion-reduce:animate-none`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 items-start gap-3 sm:gap-4">
              <div className={`h-11 w-11 shrink-0 rounded-2xl ${bone}`} />
              <div className="flex-1 space-y-3">
                <div className={`h-5 w-1/2 rounded-full sm:w-1/3 ${bone}`} />
                <div className="flex flex-wrap gap-2">
                  <div className={`h-6 w-24 rounded-full ${bone}`} />
                  <div className={`h-6 w-28 rounded-full ${bone}`} />
                </div>
              </div>
            </div>
            <div className={`h-7 w-20 shrink-0 rounded-full ${bone}`} />
          </div>
          <div className="mt-6 space-y-2.5">
            <div className={`h-3 w-full rounded-full ${bone}`} />
            <div className={`h-3 w-4/5 rounded-full ${bone}`} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
            <div className={`h-11 rounded-xl sm:w-36 ${bone}`} />
            <div className={`h-11 rounded-xl sm:w-24 ${bone}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                               */
/* ------------------------------------------------------------------ */

/**
 * Painel do recrutador (issues [S3-1]/[S3-2]): CRUD de vagas persistidas
 * em `jobs` (CA 1 de S3-1) com ciclo de vida aberta/fechada/encerrada,
 * prazo de expiração R4 (publicação, aviso e renovação de 30 dias).
 *
 * Visual: cabeçalho editorial, resumo clicável por status (filtro) com
 * barra de distribuição, cards com trilho de status, medidor de prazo,
 * metadados em pílulas e ações agrupadas (seguras à esquerda, destrutivas
 * à direita). Lógica, mutations e fluxos de confirmação inalterados.
 *
 * Responsividade: paddings e tipografia fluidos; ações do card em grid de
 * 2 colunas no mobile (principal em largura total) e em linha a partir de
 * `sm`; caixas de confirmação com botões lado a lado; alvos de toque de
 * 44px em touch; textos longos (título, local, pré-requisitos) quebram em
 * vez de estourar; propriedades lógicas (`start`, `ps`, `ms`, `me`).
 */
export function JobsPanel({
  onViewCandidates,
}: {
  /** [RECRUITER_UX_UPGRADE] Master-Detail: abre o Kanban da vaga escolhida. */
  onViewCandidates?: (jobId: Doc<"jobs">["_id"]) => void;
} = {}) {
  // [RECRUITER_WORKFLOW] Etapa 3 — a lista de vagas do recrutador logado
  // (`getMyJobs`, índice by_recruiter — nunca as de outro recrutador).
  const jobs = useQuery(api.jobs.getMyJobs, {});
  const setJobStatus = useMutation(api.jobs.setJobStatus);
  const renewJob = useMutation(api.jobs.renewJob);
  const [mode, setMode] = useState<
    { kind: "list" } | { kind: "new" } | { kind: "edit"; job: Doc<"jobs"> }
  >({ kind: "list" });
  /**
   * [UX-P1] H3-1 — confirmação inline antes de Fechar/Encerrar:
   * "Encerrar" é permanente (sem reabertura) e "Fechar" impede novas
   * candidaturas; ambas exigem Confirmar antes de chamar a mutation.
   */
  const [pendingStatus, setPendingStatus] = useState<{
    jobId: Doc<"jobs">["_id"];
    status: SettableStatus;
  } | null>(null);
  /** [UX-P2] H1-1 — id da vaga com ação em voo (desabilita os botões dela). */
  const [actionPending, setActionPending] = useState<string | null>(null);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const [pendingDelete, setPendingDelete] = useState<Doc<"jobs">["_id"] | null>(
    null,
  );
  const [filter, setFilter] = useState<JobFilter>("all");

  // Skeleton só aparece se o carregamento realmente demorar.
  const showSkeleton = useDelayedFlag(jobs === undefined, 300);

  // Janela da cascata de entrada: depois dela, itens novos entram rápido.
  const [introActive, setIntroActive] = useState(true);
  const jobsLoaded = jobs !== undefined;
  useEffect(() => {
    if (!jobsLoaded) return;
    const id = window.setTimeout(() => setIntroActive(false), 1800);
    return () => window.clearTimeout(id);
  }, [jobsLoaded]);

  async function handleStatus(
    jobId: Doc<"jobs">["_id"],
    next: SettableStatus,
  ) {
    const key = String(jobId);
    // [UX-P2] H1-1 — trava as ações da vaga até a mutation terminar.
    setActionPending(key);
    try {
      await setJobStatus({ jobId, status: next });
    } catch (err) {
      // [UX_REFINEMENT] H9-1 — Toast amigável, sem bloco de erro no card.
      toast.error(friendlyErrorMessage(err));
    } finally {
      setActionPending(null);
    }
  }

  function requestStatus(jobId: Doc<"jobs">["_id"], next: SettableStatus) {
    if (next === "aberta") {
      // Reabrir é reversível — direto, sem confirmação.
      void handleStatus(jobId, next);
      return;
    }
    setPendingStatus({ jobId, status: next });
  }

  async function handleDelete(jobId: Doc<"jobs">["_id"]) {
    setActionPending(String(jobId));
    try {
      await deleteJob({ jobId });
      toast.success("Vaga excluída.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setActionPending(null);
      setPendingDelete(null);
    }
  }

  async function handleRenew(jobId: Doc<"jobs">["_id"]) {
    const key = String(jobId);
    setActionPending(key);
    try {
      await renewJob({ jobId });
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setActionPending(null);
    }
  }

  if (mode.kind === "new" || mode.kind === "edit") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl pb-16 pt-2">
        <MotionStyles />
        <PageHeader
          title={
            mode.kind === "new"
              ? "Publicar nova vaga"
              : `Editar vaga: ${mode.job.title}`
          }
          description={
            mode.kind === "new"
              ? "Descreva a oportunidade, defina os pré-requisitos e publique para os alunos."
              : "Ajuste as informações da vaga. As mudanças valem para novas candidaturas."
          }
        />
        <JobForm
          initial={mode.kind === "edit" ? mode.job : null}
          onDone={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }

  const counts =
    jobs !== undefined
      ? {
          total: jobs.length,
          open: jobs.filter((j) => j.status === "aberta").length,
          closed: jobs.filter((j) => j.status === "fechada").length,
        }
      : null;
  const otherCount =
    counts !== null ? counts.total - counts.open - counts.closed : 0;
  const visibleJobs =
    jobs !== undefined ? jobs.filter((j) => matchesFilter(j.status, filter)) : [];

  return (
    <div className="min-w-0 pb-16 pt-2">
      <MotionStyles />
      <PageHeader
        title="Minhas vagas"
        description="Publique oportunidades, acompanhe prazos e abra o pipeline de candidatos de cada vaga."
        actions={
          <Button
            variant="primary"
            className={`group !h-12 !w-full !justify-center !gap-2.5 !rounded-xl !ps-3 !pe-5 !text-[0.9375rem] shadow-[0_8px_20px_-8px_rgba(107,20,38,0.55)] hover:shadow-[0_12px_24px_-8px_rgba(107,20,38,0.6)] sm:!w-auto`}
            onClick={() => setMode({ kind: "new" })}
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-90"
            >
              <Plus className="h-4 w-4" />
            </span>
            Publicar nova vaga
          </Button>
        }
      />

      {counts !== null && counts.total > 0 ? (
        <div
          className="jb-rise mb-6 sm:mb-8"
          style={{ animationDelay: "200ms" }}
        >
          <div
            role="group"
            aria-label="Filtrar vagas por status"
            className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
          >
            <StatTile
              label="Total de vagas"
              value={counts.total}
              icon={<Briefcase className="h-[18px] w-[18px]" />}
              tone="primary"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <StatTile
              label="Abertas"
              value={counts.open}
              icon={<DoorOpen className="h-[18px] w-[18px]" />}
              tone="green"
              active={filter === "aberta"}
              onClick={() =>
                setFilter((cur) => (cur === "aberta" ? "all" : "aberta"))
              }
            />
            <StatTile
              label="Fechadas"
              value={counts.closed}
              icon={<Lock className="h-[18px] w-[18px]" />}
              tone="amber"
              active={filter === "fechada"}
              onClick={() =>
                setFilter((cur) => (cur === "fechada" ? "all" : "fechada"))
              }
            />
            <StatTile
              label="Encerradas e outras"
              value={otherCount}
              icon={<Archive className="h-[18px] w-[18px]" />}
              tone="rose"
              active={filter === "outras"}
              onClick={() =>
                setFilter((cur) => (cur === "outras" ? "all" : "outras"))
              }
            />
          </div>
        </div>
      ) : null}

      {jobs === undefined ? (
        showSkeleton ? (
          <JobsSkeleton />
        ) : null
      ) : jobs.length === 0 ? (
        /* [UX-P3] H4-2 — empty state com CTA real (não só instrução textual). */
        <div className={`jb-fade ${SURFACE} px-4 py-8 sm:px-6 sm:py-10`}>
          <EmptyState
            icon={Plus}
            title="Nenhuma vaga publicada ainda"
            description="Publique a primeira vaga para receber candidaturas e acompanhar o pipeline em tempo real."
            action={{
              label: "Publicar nova vaga",
              onClick: () => setMode({ kind: "new" }),
            }}
          />
        </div>
      ) : visibleJobs.length === 0 ? (
        <div
          role="status"
          className={`jb-quick ${SURFACE} flex flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-14`}
        >
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF2F4] text-primary ring-1 ring-primary/15 dark:bg-primary/15"
          >
            <FilterX className="h-6 w-6" />
          </span>
          <p className="mt-4 font-serif text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-slate-100">
            Nenhuma vaga neste filtro
          </p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-a11y-slate-500">
            Você não tem vagas com esse status no momento.
          </p>
          <Button
            variant="secondary"
            className={`mt-5 w-full sm:w-auto ${TOUCH_BTN}`}
            onClick={() => setFilter("all")}
          >
            Ver todas as vagas
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-4 sm:gap-5" aria-label="Minhas vagas">
          {visibleJobs.map((job, index) => {
            const busy = actionPending === String(job._id);
            const underReview =
              job.status === "em_revisao" || job.status === "suspensa";
            const options = NEXT_STATUS[job.status];
            const safeOptions = options.filter((o) => o.value !== "encerrada");
            const dangerOptions = options.filter((o) => o.value === "encerrada");
            const canDelete =
              job.status === "encerrada" || job.status === "suspensa";
            const hasDanger = dangerOptions.length > 0 || canDelete;

            return (
              <Reveal key={job._id} intro={introActive} index={index}>
                <article
                  className={`${SURFACE} ${CARD_HOVER} relative min-w-0 overflow-hidden p-4 min-[400px]:p-5 sm:p-7`}
                >
                  {/* Trilho de status: leitura instantânea na varredura. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-6 start-1.5 w-[3px] rounded-full sm:inset-y-7 sm:start-2.5 ${STATUS_DOT[job.status]} opacity-50`}
                  />

                  {/* Linha 1: ícone + título + status. Os metadados ficam numa
                      linha própria, com a largura TOTAL do card (no mobile a
                      coluna do título é estreita e espremia as chips). A partir
                      de `sm` eles se alinham ao título (ícone 44px + gap 16px). */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <IconTile size="lg">
                      <Briefcase className="h-5 w-5" />
                    </IconTile>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="font-serif text-lg font-bold leading-snug tracking-tight text-primary [overflow-wrap:anywhere] sm:text-xl">
                        {job.title}
                      </h3>
                    </div>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:ps-[3.75rem]">
                    <MetaChip icon={<Briefcase className="h-3.5 w-3.5" />}>
                      {CONTRACT_LABELS[job.contractType]}
                    </MetaChip>
                    <MetaChip icon={<Banknote className="h-3.5 w-3.5" />}>
                      {formatSalaryRange(
                        job.salaryMin ?? null,
                        job.salaryMax ?? null,
                      )}
                    </MetaChip>
                    {job.location !== undefined ? (
                      <MetaChip icon={<MapPin className="h-3.5 w-3.5" />}>
                        {job.location}
                      </MetaChip>
                    ) : null}
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600 sm:mt-5 sm:line-clamp-2 dark:text-slate-400">
                    {job.description}
                  </p>

                  <div className="mt-4 sm:mt-5">
                    <p className="flex items-start gap-x-1 text-xs text-a11y-slate-500">
                      <CalendarDays
                        className="me-1 mt-px h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 tabular-nums">
                        Publicada em {formatDay(job.publishedAt)} · expira em{" "}
                        {formatDay(job.expiresAt)}
                        <ExpiryNote job={job} />
                      </span>
                    </p>
                    <LifecycleMeter job={job} />
                  </div>

                  {underReview ? (
                    <div
                      role="status"
                      className="mt-5 flex w-fit max-w-full items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 sm:px-4 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {job.status === "em_revisao"
                            ? "Em análise pela coordenação"
                            : "Suspensa pela coordenação"}
                        </p>
                        <p className="mt-0.5 opacity-90">
                          {job.status === "em_revisao"
                            ? "Ainda não aparece para os alunos."
                            : "Fora do ar e sem novas candidaturas."}
                        </p>
                        {job.moderationReason ? (
                          <p className="mt-0.5 line-clamp-2 opacity-80 [overflow-wrap:anywhere]">
                            Motivo: {job.moderationReason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {job.prerequisites.length > 0 ? (
                    <div className="mt-5 sm:mt-6">
                      <p
                        aria-hidden="true"
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-a11y-slate-500"
                      >
                        Pré-requisitos
                      </p>
                      <ul
                        className="mt-2.5 flex flex-wrap gap-1.5 sm:gap-2"
                        aria-label="Pré-requisitos"
                      >
                        {job.prerequisites.map((p, i) => (
                          <li key={`${p.item}-${i}`} className="max-w-full">
                            <span
                              className={`inline-flex max-w-full items-center rounded-2xl px-2.5 py-1 text-xs font-semibold ring-1 [overflow-wrap:anywhere] sm:px-3 ${
                                p.required && isVerifiablePrerequisite(p)
                                  ? "bg-[#FDF2F4] text-primary ring-primary/25 dark:bg-primary/15"
                                  : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
                              }`}
                            >
                              {p.item}
                              {!isVerifiablePrerequisite(p)
                                ? " · informativo"
                                : p.required
                                  ? " · obrigatório"
                                  : " · opcional"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Ações: no mobile, grid de 2 colunas (ação principal e
                      "Renovar" em largura total); a partir de `sm`, em linha,
                      com as destrutivas isoladas à direita. */}
                  <div
                    className={`mt-5 flex flex-wrap gap-2 border-t ${DIVIDER} pt-4 sm:mt-6 sm:items-center sm:pt-5`}
                  >
                    {/* [RECRUITER_UX_UPGRADE] Master-Detail: a lista é a tela;
                        o pipeline abre num clique, com a vaga já selecionada. */}
                    {onViewCandidates !== undefined ? (
                      <Button
                        variant="primary"
                        className={ACTION_PRIMARY}
                        onClick={() => onViewCandidates(job._id)}
                      >
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Ver Candidatos
                      </Button>
                    ) : null}
                    {job.status === "aberta" || job.status === "fechada" ? (
                      <Button
                        variant="accent"
                        className={ACTION_ACCENT}
                        disabled={busy}
                        onClick={() => void handleRenew(job._id)}
                        title="Reativa o prazo de 30 dias desta vaga"
                      >
                        <RefreshCw
                          className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-180"
                          aria-hidden="true"
                        />
                        Renovar (30 dias)
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={busy}
                      className={ACTION_SECONDARY}
                      onClick={() => setMode({ kind: "edit", job })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                    {safeOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant="secondary"
                        className={ACTION_SECONDARY}
                        disabled={busy}
                        onClick={() => requestStatus(job._id, option.value)}
                      >
                        {STATUS_BUTTON_ICON[option.value]}
                        {option.label}
                      </Button>
                    ))}

                    {/* Ações destrutivas isoladas à direita, longe do clique rápido. */}
                    {hasDanger ? (
                      <div className="flex w-full gap-2 sm:ms-auto sm:w-auto sm:flex-wrap sm:items-center">
                        {dangerOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant="danger"
                            className={ACTION_DANGER}
                            disabled={busy}
                            onClick={() => requestStatus(job._id, option.value)}
                          >
                            {STATUS_BUTTON_ICON[option.value]}
                            {option.label}
                          </Button>
                        ))}
                        {canDelete ? (
                          <Button
                            variant="danger"
                            className={ACTION_DANGER}
                            disabled={busy}
                            onClick={() => setPendingDelete(job._id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Excluir
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {pendingStatus !== null && pendingStatus.jobId === job._id ? (
                    <div
                      role="dialog"
                      aria-labelledby={`confirm-status-${job._id}`}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setPendingStatus(null);
                        }
                      }}
                      className="jb-quick mt-5 rounded-2xl border border-amber-500/40 bg-amber-50 p-3.5 sm:p-4 dark:border-amber-400/30 dark:bg-amber-500/10"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p
                            id={`confirm-status-${job._id}`}
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                          >
                            {pendingStatus.status === "encerrada"
                              ? "Confirmar encerramento"
                              : "Confirmar fechamento"}
                          </p>
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate-600 dark:text-slate-300">
                            {pendingStatus.status === "encerrada"
                              ? "O encerramento é permanente: esta vaga não poderá ser reaberta nem renovada."
                              : "A vaga deixará de receber novas candidaturas até ser reaberta."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:ps-12">
                        <Button
                          variant="primary"
                          className={CONFIRM_BTN}
                          aria-label="Confirmar mudança de status"
                          disabled={busy}
                          onClick={() => {
                            const target = pendingStatus;
                            setPendingStatus(null);
                            if (target !== null) {
                              void handleStatus(target.jobId, target.status);
                            }
                          }}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Confirmar
                        </Button>
                        <Button
                          variant="secondary"
                          className={CONFIRM_BTN}
                          onClick={() => setPendingStatus(null)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {pendingDelete === job._id ? (
                    <div
                      role="dialog"
                      aria-labelledby={`confirm-delete-${job._id}`}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setPendingDelete(null);
                        }
                      }}
                      className="jb-quick mt-5 rounded-2xl border border-rose-500/40 bg-rose-50 p-3.5 sm:p-4 dark:border-rose-400/30 dark:bg-rose-500/10"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p
                            id={`confirm-delete-${job._id}`}
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                          >
                            Excluir vaga definitivamente
                          </p>
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate-600 dark:text-slate-300">
                            A vaga e todas as candidaturas dela serão apagadas.
                            Esta ação não pode ser desfeita.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:ps-12">
                        <Button
                          variant="danger"
                          className={CONFIRM_BTN}
                          aria-label="Confirmar exclusão da vaga"
                          disabled={busy}
                          onClick={() => void handleDelete(job._id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Excluir
                        </Button>
                        <Button
                          variant="secondary"
                          className={CONFIRM_BTN}
                          onClick={() => setPendingDelete(null)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}