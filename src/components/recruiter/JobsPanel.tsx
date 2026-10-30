import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { JobForm } from "./JobForm";
import { CONTRACT_LABELS, formatSalaryRange, isVerifiablePrerequisite } from "../../lib/job";
import { renewalWindow } from "../../lib/jobExpiry";
import {
  Ban,
  Banknote,
  Briefcase,
  CalendarDays,
  Check,
  DoorOpen,
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
import { EmptyState } from "../ui/emptyState";
import {
  CARD_HOVER,
  DIVIDER,
  IconTile,
  MotionStyles,
  PageHeader,
  SURFACE,
} from "./jobsUi";

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

function formatDay(timestamp: number | undefined): string {
  if (timestamp === undefined) return "—";
  return new Date(timestamp).toLocaleDateString("pt-BR");
}

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

/** Indicador do resumo no topo da lista. */
function StatTile({
  label,
  value,
  dot,
}: {
  label: string;
  value: number | null;
  dot?: string;
}) {
  return (
    <div className={`${SURFACE} px-5 py-4`}>
      <p className="flex items-center gap-2 text-xs font-medium text-a11y-slate-500">
        {dot !== undefined ? (
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${dot}`}
          />
        ) : null}
        {label}
      </p>
      <p className="mt-1.5 font-serif text-3xl font-bold leading-none tracking-tight tabular-nums text-primary">
        {value ?? "—"}
      </p>
    </div>
  );
}

/** Esqueleto da lista: mesma silhueta do card, sem layout shift. */
function JobsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Carregando vagas…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`${SURFACE} animate-pulse p-7 motion-reduce:animate-none`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-5 w-1/3 rounded-full bg-slate-100 dark:bg-white/10" />
              <div className="h-3 w-1/2 rounded-full bg-slate-100 dark:bg-white/10" />
            </div>
            <div className="h-7 w-20 rounded-full bg-slate-100 dark:bg-white/10" />
          </div>
          <div className="mt-6 space-y-2.5">
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/10" />
            <div className="h-3 w-4/5 rounded-full bg-slate-100 dark:bg-white/10" />
          </div>
          <div className="mt-6 flex gap-2">
            <div className="h-10 w-36 rounded-xl bg-slate-100 dark:bg-white/10" />
            <div className="h-10 w-24 rounded-xl bg-slate-100 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Painel do recrutador (issues [S3-1]/[S3-2]): CRUD de vagas persistidas
 * em `jobs` (CA 1 de S3-1) com ciclo de vida aberta/fechada/encerrada,
 * prazo de expiração R4 (publicação, aviso e renovação de 30 dias).
 *
 * Visual: cabeçalho editorial, resumo por status e cards com hierarquia
 * clara (título serifado, metadados com ícone, prazo, pré-requisitos e
 * ações). Lógica, mutations e fluxos de confirmação inalterados.
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
      <div className="mx-auto w-full max-w-4xl pb-16 pt-2">
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

  const total = jobs?.length ?? null;
  const openCount =
    jobs !== undefined ? jobs.filter((j) => j.status === "aberta").length : null;
  const closedCount =
    jobs !== undefined
      ? jobs.filter((j) => j.status === "fechada").length
      : null;
  const otherCount =
    total !== null && openCount !== null && closedCount !== null
      ? total - openCount - closedCount
      : null;

  return (
    <div className="pb-16 pt-2">
      <MotionStyles />
      <PageHeader
        title="Minhas vagas"
        description="Publique oportunidades, acompanhe prazos e abra o pipeline de candidatos de cada vaga."
        actions={
          <Button variant="primary" onClick={() => setMode({ kind: "new" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Publicar nova vaga
          </Button>
        }
      />

      {jobs !== undefined && jobs.length > 0 ? (
        <div className="jb-fade mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Total de vagas" value={total} />
          <StatTile label="Abertas" value={openCount} dot="bg-emerald-500" />
          <StatTile label="Fechadas" value={closedCount} dot="bg-amber-500" />
          <StatTile
            label="Encerradas e outras"
            value={otherCount}
            dot="bg-rose-500"
          />
        </div>
      ) : null}

      {jobs === undefined ? (
        <JobsSkeleton />
      ) : jobs.length === 0 ? (
        /* [UX-P3] H4-2 — empty state com CTA real (não só instrução textual). */
        <div className={`${SURFACE} px-6 py-10`}>
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
      ) : (
        <ul className="flex flex-col gap-5">
          {jobs.map((job, index) => {
            const busy = actionPending === String(job._id);
            const underReview =
              job.status === "em_revisao" || job.status === "suspensa";
            return (
              <li
                key={job._id}
                className="jb-rise"
                style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
              >
                <article className={`${SURFACE} ${CARD_HOVER} p-6 sm:p-7`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <IconTile size="lg">
                        <Briefcase className="h-5 w-5" />
                      </IconTile>
                      <div className="min-w-0">
                        <h3 className="break-words font-serif text-xl font-bold leading-snug tracking-tight text-primary">
                          {job.title}
                        </h3>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-a11y-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase
                              className="h-3.5 w-3.5 text-primary"
                              aria-hidden="true"
                            />
                            {CONTRACT_LABELS[job.contractType]}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Banknote
                              className="h-3.5 w-3.5 text-primary"
                              aria-hidden="true"
                            />
                            {formatSalaryRange(
                              job.salaryMin ?? null,
                              job.salaryMax ?? null,
                            )}
                          </span>
                          {job.location !== undefined ? (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin
                                className="h-3.5 w-3.5 text-primary"
                                aria-hidden="true"
                              />
                              {job.location}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={job.status} />
                  </div>

                  <p className="mt-5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {job.description}
                  </p>

                  <p className="mt-4 flex flex-wrap items-center gap-x-1 text-xs text-a11y-slate-500">
                    <CalendarDays
                      className="mr-1 h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      Publicada em {formatDay(job.publishedAt)} · expira em{" "}
                      {formatDay(job.expiresAt)}
                      <ExpiryNote job={job} />
                    </span>
                  </p>

                  {underReview ? (
                    <div
                      role="status"
                      className="mt-4 flex w-fit max-w-full items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
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
                          <p className="mt-0.5 line-clamp-2 opacity-80">
                            Motivo: {job.moderationReason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <ul
                    className="mt-5 flex flex-wrap gap-2"
                    aria-label="Pré-requisitos"
                  >
                    {job.prerequisites.map((p, i) => (
                      <li key={`${p.item}-${i}`}>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
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

                  <div
                    className={`mt-6 flex flex-wrap items-center gap-2 border-t ${DIVIDER} pt-5`}
                  >
                    {/* [RECRUITER_UX_UPGRADE] Master-Detail: a lista é a tela;
                        o pipeline abre num clique, com a vaga já selecionada. */}
                    {onViewCandidates !== undefined ? (
                      <Button
                        variant="primary"
                        onClick={() => onViewCandidates(job._id)}
                      >
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Ver Candidatos
                      </Button>
                    ) : null}
                    {job.status === "aberta" || job.status === "fechada" ? (
                      <Button
                        variant="accent"
                        disabled={busy}
                        onClick={() => void handleRenew(job._id)}
                        title="Reativa o prazo de 30 dias desta vaga"
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Renovar (30 dias)
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setMode({ kind: "edit", job })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                    {NEXT_STATUS[job.status].map((option) => (
                      <Button
                        key={option.value}
                        variant={
                          option.value === "encerrada" ? "danger" : "secondary"
                        }
                        disabled={busy}
                        onClick={() => {
                          if (option.value === "aberta") {
                            // Reabrir é reversível — direto, sem confirmação.
                            void handleStatus(job._id, option.value);
                            return;
                          }
                          setPendingStatus({
                            jobId: job._id,
                            status: option.value,
                          });
                        }}
                      >
                        {STATUS_BUTTON_ICON[option.value]}
                        {option.label}
                      </Button>
                    ))}
                    {job.status === "encerrada" || job.status === "suspensa" ? (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => setPendingDelete(job._id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Excluir
                      </Button>
                    ) : null}
                  </div>

                  {pendingStatus !== null && pendingStatus.jobId === job._id ? (
                    <div
                      role="dialog"
                      aria-labelledby={`confirm-status-${job._id}`}
                      className="jb-rise mt-5 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-500/10"
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
                      <div className="mt-3 flex flex-wrap gap-2 sm:pl-12">
                        <Button
                          variant="primary"
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
                      className="jb-rise mt-5 rounded-2xl border border-rose-500/40 bg-rose-50 p-4 dark:border-rose-400/30 dark:bg-rose-500/10"
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
                      <div className="mt-3 flex flex-wrap gap-2 sm:pl-12">
                        <Button
                          variant="danger"
                          aria-label="Confirmar exclusão da vaga"
                          disabled={busy}
                          onClick={() => void handleDelete(job._id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Excluir
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setPendingDelete(null)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}