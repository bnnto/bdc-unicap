import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { JobForm } from "./JobForm";
import { CONTRACT_LABELS, formatSalaryRange } from "../../lib/job";
import { renewalWindow } from "../../lib/jobExpiry";

const STATUS_BADGE: Record<
  Doc<"jobs">["status"],
  "aprovado" | "triagem" | "reprovado"
> = {
  aberta: "aprovado",
  fechada: "triagem",
  encerrada: "reprovado",
};

const STATUS_LABELS: Record<Doc<"jobs">["status"], string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  encerrada: "Encerrada",
};

const NEXT_STATUS: Record<
  Doc<"jobs">["status"],
  Array<{ value: Doc<"jobs">["status"]; label: string }>
> = {
  aberta: [
    { value: "fechada", label: "Fechar" },
    { value: "encerrada", label: "Encerrar" },
  ],
  fechada: [{ value: "aberta", label: "Reabrir" }],
  encerrada: [],
};

/**
 * Painel do recrutador (issues [S3-1]/[S3-2]): CRUD de vagas persistidas
 * em `jobs` (CA 1 de S3-1) com ciclo de vida aberta/fechada/encerrada,
 * prazo de expiração R4 (publicação, aviso e renovação de 30 dias).
 */
export function JobsPanel() {
  const jobs = useQuery(api.jobs.myJobs, {});
  const setJobStatus = useMutation(api.jobs.setJobStatus);
  const renewJob = useMutation(api.jobs.renewJob);
  const [mode, setMode] = useState<
    { kind: "list" } | { kind: "new" } | { kind: "edit"; job: Doc<"jobs"> }
  >({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  /**
   * [UX-P1] H3-1 — confirmação inline antes de Fechar/Encerrar:
   * "Encerrar" é permanente (sem reabertura) e "Fechar" impede novas
   * candidaturas; ambas exigem Confirmar antes de chamar a mutation.
   */
  const [pendingStatus, setPendingStatus] = useState<{
    jobId: Doc<"jobs">["_id"];
    status: Doc<"jobs">["status"];
  } | null>(null);

  async function handleStatus(
    jobId: Doc<"jobs">["_id"],
    next: Doc<"jobs">["status"],
  ) {
    setError(null);
    try {
      await setJobStatus({ jobId, status: next });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao alterar o status.",
      );
    }
  }

  async function handleRenew(jobId: Doc<"jobs">["_id"]) {
    setError(null);
    try {
      await renewJob({ jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao renovar a vaga.");
    }
  }

  function formatDay(timestamp: number | undefined): string {
    if (timestamp === undefined) return "—";
    return new Date(timestamp).toLocaleDateString("pt-BR");
  }

  if (mode.kind === "new") {
    return (
      <Card title="Publicar nova vaga" accent="primary">
        <JobForm initial={null} onDone={() => setMode({ kind: "list" })} />
      </Card>
    );
  }

  if (mode.kind === "edit") {
    return (
      <Card title={`Editar vaga: ${mode.job.title}`} accent="primary">
        <JobForm initial={mode.job} onDone={() => setMode({ kind: "list" })} />
      </Card>
    );
  }

  return (
    <Card title="Minhas vagas" accent="primary">
      <div className="mb-4">
        <Button variant="primary" onClick={() => setMode({ kind: "new" })}>
          + Publicar nova vaga
        </Button>
      </div>

      {error !== null ? (
        <p
          role="alert"
          className="mb-3 rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {jobs === undefined ? (
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Carregando vagas…
        </p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-slate-600">
          Nenhuma vaga publicada ainda. Clique em “Publicar nova vaga”.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li
              key={job._id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-serif text-base font-bold text-primary">
                    {job.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {CONTRACT_LABELS[job.contractType]} ·{" "}
                    {formatSalaryRange(
                      job.salaryMin ?? null,
                      job.salaryMax ?? null,
                    )}
                    {job.location !== undefined ? ` · ${job.location}` : ""}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[job.status]}>
                  {STATUS_LABELS[job.status]}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {job.description}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Publicada em {formatDay(job.publishedAt)} · expira em{" "}
                {formatDay(job.expiresAt)}
                {job.expiresAt !== undefined && job.status === "aberta"
                  ? (() => {
                      const window = renewalWindow(
                        { status: job.status, expiresAt: job.expiresAt },
                        Date.now(),
                      );
                      if (window.expired) {
                        return (
                          <span className="font-semibold text-danger">
                            {" "}
                            · vencida — será encerrada pelo cron diário
                          </span>
                        );
                      }
                      if (window.expiring) {
                        return (
                          <span className="font-semibold text-warning">
                            {" "}
                            · {window.daysLeft} dia(s) restante(s) — renove para
                            reativar 30 dias
                          </span>
                        );
                      }
                      return ` · ${window.daysLeft} dia(s) restante(s)`;
                    })()
                  : null}
              </p>
              <ul
                className="mt-2 flex flex-wrap gap-2"
                aria-label="Pré-requisitos"
              >
                {job.prerequisites.map((p, i) => (
                  <li key={`${p.item}-${i}`}>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                        p.required
                          ? "border-primary bg-[#FDF2F4] text-primary"
                          : "border-secondary bg-white text-slate-700"
                      }`}
                    >
                      {p.item}
                      {p.required ? " · obrigatório" : " · opcional"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {job.status !== "encerrada" ? (
                  <Button
                    variant="accent"
                    onClick={() => void handleRenew(job._id)}
                  >
                    Renovar (30 dias)
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => setMode({ kind: "edit", job })}
                >
                  Editar
                </Button>
                {NEXT_STATUS[job.status].map((option) => (
                  <Button
                    key={option.value}
                    variant="secondary"
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
                    {option.label}
                  </Button>
                ))}
              </div>

              {pendingStatus !== null && pendingStatus.jobId === job._id ? (
                <div
                  role="dialog"
                  aria-labelledby={`confirm-status-${job._id}`}
                  className="mt-3 rounded border border-warning bg-white p-3"
                >
                  <p
                    id={`confirm-status-${job._id}`}
                    className="text-sm font-semibold text-slate-800"
                  >
                    {pendingStatus.status === "encerrada"
                      ? "Confirmar encerramento"
                      : "Confirmar fechamento"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {pendingStatus.status === "encerrada"
                      ? "O encerramento é permanente: esta vaga não poderá ser reaberta nem renovada."
                      : "A vaga deixará de receber novas candidaturas até ser reaberta."}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      aria-label="Confirmar mudança de status"
                      onClick={() => {
                        const target = pendingStatus;
                        setPendingStatus(null);
                        if (target !== null) {
                          void handleStatus(target.jobId, target.status);
                        }
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPendingStatus(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
