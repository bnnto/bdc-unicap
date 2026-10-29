import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  Ban,
  Briefcase,
  Check,
  ExternalLink,
  Flag,
  History,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { CONTRACT_LABELS, formatSalaryRange } from "../../lib/job";
import { REPORT_REASON_LABELS, type ReportReason } from "../../lib/jobReport";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/emptyState";
import { Modal } from "../ui/modal";

const CAUSE_LABELS = {
  regra: "Regras automáticas",
  gestor: "Motivo",
  recrutador: "Recrutador recusado/revogado",
  denuncia: "Denúncias de alunos",
} as const;

const ACTION_LABELS = {
  em_revisao: "Enviada para revisão",
  suspensa: "Suspensa",
  aprovada: "Aprovada",
  excluida: "Excluída pelo recrutador",
} as const;

const ACTION_BADGE = {
  em_revisao: "triagem",
  suspensa: "reprovado",
  aprovada: "aprovado",
  excluida: "andamento",
} as const;

type View = "pendencias" | "abertas" | "historico";

const VIEWS: Array<{ key: View; label: string; icon: typeof ShieldAlert }> = [
  { key: "pendencias", label: "Pendências", icon: ShieldAlert },
  { key: "abertas", label: "Vagas abertas", icon: Briefcase },
  { key: "historico", label: "Histórico", icon: History },
];

const MIN_REASON = 5;
const MAX_REASON = 500;

/** Mesma superfície do Painel Estratégico e da aba Recrutadores. */
const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const PRESS =
  "transition-[background-color,color,border-color,box-shadow,transform] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.985] active:duration-150 motion-reduce:[transition-property:background-color,color,border-color,opacity] motion-reduce:active:scale-100";

const LINK =
  "inline-flex items-center gap-1 rounded-md font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      {label}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

function RecruiterLine({
  name,
  email,
  linkedin,
  website,
}: {
  name: string;
  email: string;
  linkedin: string | null;
  website?: string | null;
}) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
      <span>
        {name} · {email}
      </span>
      {linkedin !== null ? <OutLink href={linkedin} label="LinkedIn" /> : null}
      {website != null && website.startsWith("https://") ? (
        <OutLink href={website} label="Site" />
      ) : null}
    </p>
  );
}

function ReportSummary({
  count,
  breakdown,
  details,
}: {
  count: number;
  breakdown: Array<{ reason: ReportReason; count: number }>;
  details: string[];
}) {
  if (count === 0) return null;
  return (
    <div className="mt-4 w-fit max-w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-800 dark:text-red-200">
      <p className="flex items-center gap-1.5 font-semibold">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {count} denúncia(s) de alunos
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {breakdown.map((item) => (
          <li key={item.reason}>
            {REPORT_REASON_LABELS[item.reason]}: {item.count}
          </li>
        ))}
      </ul>
      {details.length > 0 ? (
        <details className="mt-2">
          <summary className="w-fit cursor-pointer rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Ver relatos
          </summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed">
            {details.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Título + linha de contrato/salário/local, comum às duas listas de vagas. */
function JobHeading({
  title,
  contractType,
  salaryMin,
  salaryMax,
  location,
}: {
  title: string;
  contractType: keyof typeof CONTRACT_LABELS;
  salaryMin: number | null | undefined;
  salaryMax: number | null | undefined;
  location: string | null;
}) {
  return (
    <div className="min-w-0">
      <h3 className="font-serif text-lg font-bold tracking-tight text-slate-900">
        {title}
      </h3>
      <p className="mt-0.5 text-sm text-slate-500">
        {CONTRACT_LABELS[contractType]} ·{" "}
        {formatSalaryRange(salaryMin ?? null, salaryMax ?? null)}
        {location !== null ? ` · ${location}` : ""}
      </p>
    </div>
  );
}

function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="mt-4">
      <summary className="w-fit cursor-pointer rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {summary}
      </summary>
      <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {children}
      </p>
    </details>
  );
}

function SuspendButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10 ${PRESS}`}
    >
      <Ban className="h-4 w-4" aria-hidden="true" />
      Suspender
    </button>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="[animation-duration:2.5s] animate-pulse space-y-4">
      <span className="sr-only">Carregando…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 rounded-3xl bg-slate-100" />
      ))}
    </div>
  );
}

/**
 * [MODERACAO_VAGA] Aba "Moderação": pendências (revisão/suspensas),
 * vagas abertas (com denúncias) e histórico de decisões.
 *
 * Visual alinhado ao Painel Estratégico e à aba Recrutadores: controle
 * segmentado, superfícies suaves, interruptor no filtro de denúncias e
 * modal com contador. Lógica e fluxos inalterados.
 */
export function ManagerModerationPage() {
  const [view, setView] = useState<View>("pendencias");
  const [onlyReported, setOnlyReported] = useState(false);
  const pending = useQuery(
    api.moderation.listJobsInModeration,
    view === "pendencias" ? {} : "skip",
  );
  const live = useQuery(
    api.moderation.listLiveJobs,
    view === "abertas" ? {} : "skip",
  );
  const history = useQuery(
    api.moderation.listModerationLog,
    view === "historico" ? {} : "skip",
  );
  const decide = useMutation(api.moderation.decideJob);
  const dismiss = useMutation(api.moderation.dismissReports);

  const [target, setTarget] = useState<{
    id: Id<"jobs">;
    title: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[view];
      setPill(
        el
          ? {
              left: el.offsetLeft,
              top: el.offsetTop,
              width: el.offsetWidth,
              height: el.offsetHeight,
            }
          : null,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    Object.values(tabRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    return () => ro.disconnect();
  }, [view]);

  function closeModal() {
    setTarget(null);
    setReason("");
  }

  async function approve(id: Id<"jobs">) {
    setBusy(true);
    try {
      await decide({ jobId: id, decision: "aprovar" });
      toast.success("Vaga publicada.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function archiveReports(id: Id<"jobs">) {
    setBusy(true);
    try {
      await dismiss({ jobId: id });
      toast.success("Denúncias arquivadas.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (target === null) return;
    setBusy(true);
    try {
      await decide({ jobId: target.id, decision: "suspender", reason });
      toast.success("Vaga suspensa.");
      closeModal();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const liveRows = (live ?? []).filter(
    (row) => !onlyReported || row.reportsCount > 0,
  );
  const reasonLength = reason.trim().length;

  return (
    <section aria-label="Moderação" className="flex flex-col gap-8 pb-16 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Moderação
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Revise vagas, acompanhe denúncias dos alunos e consulte o histórico
            de decisões.
          </p>
        </div>

        <div
          ref={tabsRef}
          role="group"
          aria-label="Visão"
          className="relative inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-[#e8ecf1] p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] dark:bg-[#242b3a] dark:shadow-none"
        >
          {/* Peça branca única que desliza entre as opções. */}
          {pill !== null ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.1)] will-change-transform transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
              style={{
                width: pill.width,
                height: pill.height,
                transform: `translate(${pill.left}px, ${pill.top}px)`,
              }}
            />
          ) : null}

          {VIEWS.map((item, index) => {
            const active = view === item.key;
            const prevActive = index > 0 && VIEWS[index - 1]?.key === view;
            const showDivider = index > 0 && !active && !prevActive;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  tabRefs.current[item.key] = el;
                }}
                type="button"
                aria-pressed={active}
                onClick={() => setView(item.key)}
                className={`relative z-10 inline-flex min-w-[10.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold before:absolute before:-left-[2.5px] before:bottom-2.5 before:top-2.5 before:w-px before:bg-slate-300 before:transition-opacity before:duration-[450ms] dark:before:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${PRESS} ${
                  showDivider ? "before:opacity-100" : "before:opacity-0"
                } ${
                  active
                    ? "text-primary"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-100"
                }`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>
    
    <div key={view} className="view-enter flex flex-col gap-8">
      {view === "pendencias" ? (
        pending === undefined ? (
          <ListSkeleton />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Nenhuma vaga em revisão"
            description="Vagas enviadas para revisão e vagas suspensas aparecerão aqui."
          />
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Vagas em moderação">
            {pending.map((row) => (
              <li key={row.jobId} className={`${SURFACE} p-6 [overflow-wrap:anywhere]`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <JobHeading
                    title={row.title}
                    contractType={row.contractType}
                    salaryMin={row.salaryMin}
                    salaryMax={row.salaryMax}
                    location={row.location}
                  />
                  <Badge
                    variant={
                      row.status === "em_revisao" ? "triagem" : "reprovado"
                    }
                  >
                    {row.status === "em_revisao" ? "Em revisão" : "Suspensa"}
                  </Badge>
                </div>

                <RecruiterLine
                  name={row.recruiterName}
                  email={row.recruiterEmail}
                  linkedin={row.recruiterLinkedin}
                  website={row.recruiterWebsite}
                />

                {row.reason !== null ? (
                  <p className="mt-4 w-fit max-w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    {row.cause !== null ? `${CAUSE_LABELS[row.cause]}: ` : ""}
                    {row.reason}
                  </p>
                ) : null}

                <ReportSummary
                  count={row.reportsCount}
                  breakdown={row.reportBreakdown}
                  details={row.reportDetails}
                />

                <Disclosure summary="Ver descrição completa">
                  {row.description}
                </Disclosure>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => void approve(row.jobId)}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {row.status === "em_revisao"
                      ? "Aprovar e publicar"
                      : "Reativar vaga"}
                  </Button>
                  {row.status === "em_revisao" ? (
                    <SuspendButton
                      busy={busy}
                      onClick={() =>
                        setTarget({ id: row.jobId, title: row.title })
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {view === "abertas" ? (
        <>
          {/* Interruptor: continua sendo um checkbox nativo (teclado e leitor
              de tela), só que desenhado como switch. */}
          <label className="group flex w-fit cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyReported}
              onChange={(e) => setOnlyReported(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors duration-[450ms] peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-[450ms] after:ease-[cubic-bezier(0.32,0.72,0,1)] peer-checked:after:translate-x-5"
            />
            Só vagas com denúncias
          </label>

          {live === undefined ? (
            <ListSkeleton />
          ) : liveRows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={
                onlyReported
                  ? "Nenhuma vaga aberta com denúncias"
                  : "Nenhuma vaga aberta"
              }
              description="As vagas abertas aparecem aqui, as mais denunciadas primeiro."
            />
          ) : (
            <ul className="flex flex-col gap-4" aria-label="Vagas abertas">
              {liveRows.map((row) => (
                <li key={row.jobId} className={`${SURFACE} p-6 [overflow-wrap:anywhere]`}>
                  <JobHeading
                    title={row.title}
                    contractType={row.contractType}
                    salaryMin={row.salaryMin}
                    salaryMax={row.salaryMax}
                    location={row.location}
                  />
                  <RecruiterLine
                    name={row.recruiterName}
                    email={row.recruiterEmail}
                    linkedin={row.recruiterLinkedin}
                  />
                  <ReportSummary
                    count={row.reportsCount}
                    breakdown={row.reportBreakdown}
                    details={row.reportDetails}
                  />
                  <Disclosure summary="Ver descrição completa">
                    {row.description}
                  </Disclosure>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <SuspendButton
                      busy={busy}
                      onClick={() =>
                        setTarget({ id: row.jobId, title: row.title })
                      }
                    />
                    {row.reportsCount > 0 ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void archiveReports(row.jobId)}
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        Arquivar denúncias
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {view === "historico" ? (
        history === undefined ? (
          <ListSkeleton />
        ) : history.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhum registro ainda"
            description="Revisões, suspensões, aprovações e exclusões de vagas ficam registradas aqui, mesmo depois de a vaga ser apagada."
          />
        ) : (
          <ul
            className="flex flex-col gap-4"
            aria-label="Histórico de moderação"
          >
            {history.map((row) => (
              <li key={row.logId} className={`${SURFACE} p-6 [overflow-wrap:anywhere]`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {row.jobTitle}
                  </p>
                  <Badge variant={ACTION_BADGE[row.action]}>
                    {ACTION_LABELS[row.action]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs tabular-nums text-slate-500">
                  {new Date(row.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {row.recruiterName} ({row.recruiterEmail})
                  {row.byGestor ? " · decisão da coordenação" : ""}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {row.cause !== null ? `${CAUSE_LABELS[row.cause]}: ` : ""}
                  {row.reason}
                  {row.reportsCount !== null && row.reportsCount > 0
                    ? ` (${row.reportsCount} denúncia(s))`
                    : ""}
                </p>
                <Disclosure summary="Ver texto da vaga (cópia)">
                  {row.jobDescription}
                </Disclosure>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
      {target !== null ? (
        <Modal titleId={titleId} onClose={closeModal}>
          <h3
            id={titleId}
            className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-slate-900"
          >
            <span aria-hidden="true" className="text-primary">
              <Ban className="h-5 w-5" />
            </span>
            Suspender vaga
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            “{target.title}” ficará fora do ar e o recrutador verá o motivo.
          </p>

          <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={MAX_REASON}
              aria-describedby={`${titleId}-hint`}
              className="resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </label>
          <p
            id={`${titleId}-hint`}
            className="mt-1.5 flex justify-between gap-3 text-xs text-a11y-slate-500"
          >
            <span>
              {reasonLength < MIN_REASON
                ? `Escreva pelo menos ${MIN_REASON} caracteres.`
                : "Pronto para confirmar."}
            </span>
            <span className="tabular-nums">
              {reason.length}/{MAX_REASON}
            </span>
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className={`rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${PRESS}`}
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              disabled={busy || reasonLength < MIN_REASON}
              onClick={() => void suspend()}
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Confirmar
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}