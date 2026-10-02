import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
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
  applicationId: Id<"applications">;
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
 * "Minhas Candidaturas" (issue [S4-4] + REFACTOR_ALUNO Etapa 4).
 * CA 1 — lista por aluno, reativa (useQuery): qualquer movimentação do
 * recrutador no Kanban atualiza a etapa aqui em tempo real.
 * [Etapa 4.2] — feedback claro por candidatura: badge da etapa, timeline
 * com a etapa atual e uma frase dizendo o que aconteceu/o que esperar.
 * [Etapa 4.3] — quando reprovado, o motivo padronizado (R5) vira um
 * conselho amigável de onde melhorar.
 * R6 — o aceite/revogação de contato por vaga também mora aqui.
 */
export function MyApplicationsPage() {
  const myApplications = useQuery(api.applications.myApplications, {});
  // [FINAL_UPGRADE Etapa 3] — métricas calculadas NO SERVIDOR (TDD em
  // src/lib/analytics.ts): taxa de sucesso, totais, média e visualizações.
  const myStats = useQuery(api.applications.myStats, {});
  const acceptProcess = useMutation(api.applications.acceptProcess);
  const revokeProcessAcceptance = useMutation(
    api.applications.revokeProcessAcceptance,
  );

  const applications: ApplicationRow[] = myApplications ?? [];
  const sorted = sortMyApplications(applications);
  const kpis = myApplicationsKpis(applications);

  return (
    // [S8-2]: região nomeada em vez de <main> aninhado (o main da página é
    // único, no App — WCAG 1.3.1).
    <div
      role="region"
      aria-label="Minhas candidaturas"
      className="mx-auto w-full max-w-[1440px] px-6 py-6"
    >
      {/* [S8-2]: div (não header) — evita banner aninhado dentro do main. */}
      <div className="mb-5 border-b border-slate-200 pb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Acompanhamento
        </p>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Minhas candidaturas
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          A etapa de cada candidatura e o % de compatibilidade, atualizados em
          tempo pelo painel do recrutador — com feedback claro do que aconteceu
          em cada processo.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1">
          <p className="text-3xl font-bold text-primary">{kpis.total}</p>
          <p className="text-xs text-slate-500">Candidaturas</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1">
          <p className="text-3xl font-bold text-primary">{kpis.active}</p>
          <p className="text-xs text-slate-500">Em andamento</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1">
          <p className="text-3xl font-bold text-primary">
            {kpis.bestMatch !== null ? `${kpis.bestMatch}%` : "—"}
          </p>
          <p className="text-xs text-slate-500">Melhor match</p>
        </div>
      </div>

      {/* [FINAL_UPGRADE Etapa 3] — Estatísticas do Meu Perfil: cards
          estilo SaaS com a Taxa de Sucesso e os números do aluno
          (dados calculados no backend via applications.myStats). */}
      <section
        aria-label="Estatísticas do meu perfil"
        className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-base font-bold text-primary">
            Estatísticas do Meu Perfil
          </h2>
          <p className="text-xs text-slate-500">
            Taxa de sucesso = (Entrevista + Aprovado) / Total × 100
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-primary/20 bg-[#FDF2F4] p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {myStats !== undefined && myStats !== null
                ? `${myStats.successRate}%`
                : "—"}
            </p>
            <p className="text-xs text-slate-500">Taxa de Sucesso</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {myStats !== undefined && myStats !== null ? myStats.total : "—"}
            </p>
            <p className="text-xs text-slate-500">Total de Candidaturas</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {myStats !== undefined && myStats !== null
                ? myStats.profileViews
                : "—"}
            </p>
            <p className="text-xs text-slate-500">Visualizações do Perfil</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {myStats !== undefined && myStats !== null
                ? `${myStats.averageMatch}%`
                : "—"}
            </p>
            <p className="text-xs text-slate-500">Média de Match</p>
          </div>
        </div>
        {myStats !== undefined && myStats !== null ? (
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Distribuição por etapa"
          >
            {Object.entries(myStats.byStage).map(([stage, count]) => (
              <span
                key={stage}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {STAGE_LABELS[stage as ApplicationStage]}: {count}
              </span>
            ))}
          </div>
        ) : null}
      </section>

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
            na aba Oportunidades do portal.
          </p>
        ) : (
          <ul
            aria-label="Todas as candidaturas"
            className="flex flex-col gap-4"
          >
            {sorted.map((application) => {
              const rejected = application.stage === "reprovado";
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
              return (
                <li
                  key={application.applicationId}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-serif text-base font-bold text-primary">
                        {application.jobTitle}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={STAGE_BADGE[application.stage]}>
                          {STAGE_LABELS[application.stage]}
                        </Badge>
                        <Badge
                          variant={
                            MATCH_CHIP[matchBand(application.matchScore)]
                          }
                        >
                          {application.matchScore}% ·{" "}
                          {MATCH_BAND_LABELS[matchBand(application.matchScore)]}
                        </Badge>
                      </div>
                    </div>
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

                  {/* [Etapa 4.2] feedback claro por candidatura. */}
                  <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {stageFeedback(application.stage)}
                  </p>

                  {/* [Etapa 4.3] reprovação amigável com conselho. */}
                  {rejected ? (
                    <div className="mt-3 rounded border border-danger bg-white px-3 py-2">
                      <p className="text-sm font-bold text-danger">
                        {feedback.headline}
                      </p>
                      {reason !== null ? (
                        <p className="mt-0.5 text-xs text-slate-600">
                          Motivo (padronizado):{" "}
                          <strong>{REJECTION_REASON_LABELS[reason]}</strong>
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-600">
                        {feedback.advice}
                      </p>
                    </div>
                  ) : null}

                  {/* [R6] controle de contato por candidatura (LGPD). */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-600">
                      {application.processAccepted
                        ? "Contato liberado para esta vaga (aceite no processo)."
                        : "Contato ainda não liberado para esta vaga."}
                    </p>
                    <Button
                      variant={
                        application.processAccepted ? "secondary" : "accent"
                      }
                      aria-label={
                        application.processAccepted
                          ? `Revogar contato de ${application.jobTitle}`
                          : `Liberar contato para ${application.jobTitle}`
                      }
                      onClick={() => {
                        void (application.processAccepted
                          ? revokeProcessAcceptance({
                              applicationId: application.applicationId,
                            })
                          : acceptProcess({
                              applicationId: application.applicationId,
                            }));
                      }}
                    >
                      {application.processAccepted
                        ? "Revogar contato"
                        : "Liberar contato"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
