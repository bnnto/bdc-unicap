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
  /**
   * [UX-P2] H9-1 — erro por item: a mensagem aparece junto à vaga que
   * originou a ação (não num bloco global), mesmo em listas longas.
   */
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  /**
   * [UX-P1] H3-1 — confirmação inline antes de Fechar/Encerrar:
   * "Encerrar" é permanente (sem reabertura) e "Fechar" impede novas
   * candidaturas; ambas exigem Confirmar antes de chamar a mutation.
   */
  const [pendingStatus, setPendingStatus] = useState<{
    jobId: Doc<"jobs">["_id"];
    status: Doc<"jobs">["status"];
  } | null>(null);
  /** [UX-P2] H1-1 — id da vaga com ação em voo (desabilita os botões dela). */
  const [actionPending, setActionPending] = useState<string | null>(null);

  async function handleStatus(
    jobId: Doc<"jobs">["_id"],
    next: Doc<"jobs">["status"],
  ) {
    const key = String(jobId);
    setItemErrors((prev) => {
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    // [UX-P2] H1-1 — trava as ações da vaga até a mutation terminar.
    setActionPending(key);
    try {
      await setJobStatus({ jobId, status: next });
    } catch (err) {
      setItemErrors((prev) => ({
        ...prev,
        [key]:
          err instanceof Error ? err.message : "Falha ao alterar o status.",
      }));
    } finally {
      setActionPending(null);
    }
  }

  async function handleRenew(jobId: Doc<"jobs">["_id"]) {
    const key = String(jobId);
    setItemErrors((prev) => {
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    setActionPending(key);
    try {
      await renewJob({ jobId });
    } catch (err) {
      setItemErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Falha ao renovar a vaga.",
      }));
    } finally {
      setActionPending(null);
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

      {jobs === undefined ? (
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Carregando vagas…
        </p>
      ) : jobs.length === 0 ? (
        /* [UX-P3] H4-2 — empty state com CTA real (não só instrução textual). */
        <div
          role="status"
          className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center"
        >
          <p className="text-sm font-semibold text-slate-700">
            Nenhuma vaga publicada ainda.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Publique a primeira vaga para receber candidaturas e acompanhar o
            pipeline.
          </p>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() => setMode({ kind: "new" })}
          >
            + Publicar nova vaga
          </Button>
        </div>
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
              {itemErrors[String(job._id)] !== undefined ? (
                <p
                  role="alert"
                  className="mt-2 rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
                >
                  {itemErrors[String(job._id)]}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {job.status !== "encerrada" ? (
                  <Button
                    variant="accent"
                    disabled={actionPending === String(job._id)}
                    onClick={() => void handleRenew(job._id)}
                    title="Reativa o prazo de 30 dias desta vaga"
                  >
                    Renovar (30 dias)
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={actionPending === String(job._id)}
                  onClick={() => setMode({ kind: "edit", job })}
                >
                  Editar
                </Button>
                {NEXT_STATUS[job.status].map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      option.value === "encerrada" ? "danger" : "secondary"
                    }
                    disabled={actionPending === String(job._id)}
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
