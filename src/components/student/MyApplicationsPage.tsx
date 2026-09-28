import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  REJECTION_REASON_LABELS,
  STAGE_LABELS,
  formatApplicationStatusLabel,
  isRejectionReason,
  myApplicationsKpis,
  sortMyApplications,
  stageTimeline,
  type ApplicationStage,
  type TimelineStep,
} from "../../lib/application";
import { MATCH_BAND_LABELS, matchBand } from "../../lib/matching";

const MATCH_CHIP: Record<
  ReturnType<typeof matchBand>,
  "aprovado" | "andamento" | "reprovado"
> = {
  strong: "aprovado",
  medium: "andamento",
  low: "reprovado",
};

const STEP_CLASSES: Record<TimelineStep["state"], string> = {
  done: "border-success bg-white text-success",
  current: "border-primary bg-[#FDF2F4] font-semibold text-primary",
  upcoming: "border-slate-200 bg-white text-a11y-slate-500",
};

type ApplicationRow = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  jobStatus: "aberta" | "fechada" | "encerrada";
  stage: ApplicationStage;
  matchScore: number;
  appliedAt: number;
  processAccepted: boolean;
  rejectionReason: string | null;
};

/**
 * "Minhas Candidaturas" (issue [S4-4]).
 * CA 1 — lista por aluno, reativa (useQuery): qualquer movimentação do
 * recrutador no Kanban atualiza a etapa aqui em tempo real.
 * CA 2 — % de match por candidatura (chips por faixa do R8).
 */
export function MyApplicationsPage() {
  const myApplications = useQuery(api.applications.myApplications, {});

  const applications: ApplicationRow[] = myApplications ?? [];
  const sorted = sortMyApplications(applications);
  const kpis = myApplicationsKpis(applications);

  return (
    // [S8-2]: região nomeada em vez de <main> aninhado (o main da página é
    // único, no App — WCAG 1.3.1).
    <div
      role="region"
      aria-label="Minhas candidaturas"
      className="mx-auto max-w-4xl px-4 py-8"
    >
      {/* [S8-2]: div (não header) — evita banner aninhado dentro do main. */}
      <div className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Portal do Aluno
        </p>
        <h1 className="font-serif text-2xl font-bold text-primary">
          Minhas candidaturas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Acompanhe a etapa atual do pipeline e o % de compatibilidade de cada
          candidatura — atualizado em tempo real.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-level1">
          <p className="text-2xl font-bold text-primary">{kpis.total}</p>
          <p className="text-xs text-slate-500">Candidaturas</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-level1">
          <p className="text-2xl font-bold text-primary">{kpis.active}</p>
          <p className="text-xs text-slate-500">Em andamento</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-level1">
          <p className="text-2xl font-bold text-primary">
            {kpis.bestMatch !== null ? `${kpis.bestMatch}%` : "—"}
          </p>
          <p className="text-xs text-slate-500">Melhor match</p>
        </div>
      </div>

      <Card title="Todas as candidaturas" accent="secondary">
        {myApplications === undefined ? (
          <p
            className="text-sm text-slate-500"
            role="status"
            aria-live="polite"
          >
            Carregando candidaturas…
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-600">
            Você ainda não se candidatou a nenhuma vaga. Veja as oportunidades
            na página inicial do portal.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {sorted.map((application) => (
              <li
                key={application.applicationId}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-serif text-base font-bold text-primary">
                    {application.jobTitle}
                  </h3>
                  <Badge
                    variant={MATCH_CHIP[matchBand(application.matchScore)]}
                  >
                    {application.matchScore}% ·{" "}
                    {MATCH_BAND_LABELS[matchBand(application.matchScore)]}
                  </Badge>
                </div>

                <p className="sr-only" aria-live="polite">
                  {formatApplicationStatusLabel({
                    jobTitle: application.jobTitle,
                    stage: application.stage,
                    appliedAt: application.appliedAt,
                  })}
                </p>

                <ol
                  className="mt-3 flex flex-wrap items-center gap-1"
                  aria-label={`Etapa atual: ${STAGE_LABELS[application.stage]}`}
                >
                  {stageTimeline(application.stage).map((step, index) => (
                    <li key={step.stage} className="flex items-center gap-1">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-slate-300">
                          →
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${STEP_CLASSES[step.state]}`}
                        aria-current={
                          step.state === "current" ? "step" : undefined
                        }
                      >
                        {STAGE_LABELS[step.stage]}
                      </span>
                    </li>
                  ))}
                </ol>

                {application.stage === "reprovado" &&
                isRejectionReason(application.rejectionReason) ? (
                  <p className="mt-2 rounded border border-danger bg-white px-3 py-2 text-xs text-danger">
                    Motivo (padronizado):{" "}
                    <strong>
                      {REJECTION_REASON_LABELS[application.rejectionReason]}
                    </strong>
                  </p>
                ) : null}

                {application.processAccepted ? (
                  <p className="mt-2 text-xs text-success">
                    Contato liberado para esta vaga (aceite no processo).
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => {
            window.location.hash = "";
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ← Voltar ao portal
        </Button>
      </div>
    </div>
  );
}
