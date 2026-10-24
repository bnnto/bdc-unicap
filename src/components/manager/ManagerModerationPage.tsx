import { useId, useState } from "react";
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
  gestor: "Coordenação",
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

function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
    >
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
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
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
    <div className="mt-2 w-fit max-w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
      <p className="flex items-center gap-1 font-semibold">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {count} denúncia(s) de alunos
      </p>
      <ul className="mt-1 list-disc pl-5">
        {breakdown.map((item) => (
          <li key={item.reason}>
            {REPORT_REASON_LABELS[item.reason]}: {item.count}
          </li>
        ))}
      </ul>
      {details.length > 0 ? (
        <details className="mt-1">
          <summary className="w-fit cursor-pointer font-semibold">
            Ver relatos
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {details.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * [MODERACAO_VAGA] Aba "Moderação": pendências (revisão/suspensas),
 * vagas abertas (com denúncias) e histórico de decisões.
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

  const suspendButton = (id: Id<"jobs">, title: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => setTarget({ id, title })}
      className="inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
    >
      <Ban className="h-4 w-4" aria-hidden="true" />
      Suspender
    </button>
  );

  const liveRows = (live ?? []).filter(
    (row) => !onlyReported || row.reportsCount > 0,
  );

  return (
    <section aria-label="Moderação" className="flex flex-col gap-6">
      <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        Moderação
      </h2>

      <div role="group" aria-label="Visão" className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={view === item.key}
            onClick={() => setView(item.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              view === item.key
                ? "border-primary bg-primary text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-primary hover:text-primary"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      {view === "pendencias" ? (
        pending === undefined ? (
          <p role="status" className="text-sm text-slate-500">
            Carregando…
          </p>
        ) : pending.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Nenhuma vaga em revisão"
            description="Vagas enviadas para revisão e vagas suspensas aparecerão aqui."
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Vagas em moderação">
            {pending.map((row) => (
              <li
                key={row.jobId}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-level1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-serif text-base font-bold text-primary">
                      {row.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {CONTRACT_LABELS[row.contractType]} ·{" "}
                      {formatSalaryRange(row.salaryMin, row.salaryMax)}
                      {row.location !== null ? ` · ${row.location}` : ""}
                    </p>
                  </div>
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
                  <p className="mt-2 w-fit max-w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    {row.cause !== null ? `${CAUSE_LABELS[row.cause]}: ` : ""}
                    {row.reason}
                  </p>
                ) : null}

                <ReportSummary
                  count={row.reportsCount}
                  breakdown={row.reportBreakdown}
                  details={row.reportDetails}
                />

                <details className="mt-2">
                  <summary className="w-fit cursor-pointer text-xs font-semibold text-primary hover:underline">
                    Ver descrição completa
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {row.description}
                  </p>
                </details>

                <div className="mt-4 flex flex-wrap gap-2">
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
                  {row.status === "em_revisao"
                    ? suspendButton(row.jobId, row.title)
                    : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {view === "abertas" ? (
        <>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyReported}
              onChange={(e) => setOnlyReported(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Só vagas com denúncias
          </label>
          {live === undefined ? (
            <p role="status" className="text-sm text-slate-500">
              Carregando…
            </p>
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
            <ul className="flex flex-col gap-3" aria-label="Vagas abertas">
              {liveRows.map((row) => (
                <li
                  key={row.jobId}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-level1"
                >
                  <div className="min-w-0">
                    <h3 className="font-serif text-base font-bold text-primary">
                      {row.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {CONTRACT_LABELS[row.contractType]} ·{" "}
                      {formatSalaryRange(row.salaryMin, row.salaryMax)}
                      {row.location !== null ? ` · ${row.location}` : ""}
                    </p>
                  </div>
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
                  <details className="mt-2">
                    <summary className="w-fit cursor-pointer text-xs font-semibold text-primary hover:underline">
                      Ver descrição completa
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {row.description}
                    </p>
                  </details>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suspendButton(row.jobId, row.title)}
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
          <p role="status" className="text-sm text-slate-500">
            Carregando…
          </p>
        ) : history.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhum registro ainda"
            description="Revisões, suspensões, aprovações e exclusões de vagas ficam registradas aqui, mesmo depois de a vaga ser apagada."
          />
        ) : (
          <ul
            className="flex flex-col gap-3"
            aria-label="Histórico de moderação"
          >
            {history.map((row) => (
              <li
                key={row.logId}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-level1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{row.jobTitle}</p>
                  <Badge variant={ACTION_BADGE[row.action]}>
                    {ACTION_LABELS[row.action]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(row.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {row.recruiterName} ({row.recruiterEmail})
                  {row.byGestor ? " · decisão da coordenação" : ""}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {row.cause !== null ? `${CAUSE_LABELS[row.cause]}: ` : ""}
                  {row.reason}
                  {row.reportsCount !== null && row.reportsCount > 0
                    ? ` (${row.reportsCount} denúncia(s))`
                    : ""}
                </p>
                <details className="mt-2">
                  <summary className="w-fit cursor-pointer text-xs font-semibold text-primary hover:underline">
                    Ver texto da vaga (cópia)
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {row.jobDescription}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {target !== null ? (
        <Modal titleId={titleId} onClose={closeModal}>
          <h3
            id={titleId}
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <Ban className="h-5 w-5" aria-hidden="true" />
            Suspender vaga
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            “{target.title}” ficará fora do ar e o recrutador verá o motivo.
          </p>
          <label className="mt-4 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              className="rounded-md border border-slate-300 p-2 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              disabled={busy || reason.trim().length < 5}
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
