import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
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
import { Handshake, Inbox, TrendingUp } from "lucide-react";
import { EmptyState } from "../ui/emptyState";

/**
 * [REFACTOR_ALUNO Etapa 4] + visual:
 * KPIs como UMA faixa dividida por 1px (rótulo acima, valor em
 * algarismos tabulares) em vez de três cartões com ícone — cor vai só
 * nos dados e na ação; superfícies planas (borda sem sombra); ações de
 * linha em botão secundário (o dourado não aparece repetido em cada
 * card); o motivo de reprovação vira bloco de atenção com borda
 * semântica (legível também no modo escuro).
 */

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
  jobStatus: "aberta" | "fechada" | "encerrada" | "em_revisao" | "suspensa";
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">
          Minhas candidaturas
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          A etapa de cada candidatura e o % de compatibilidade, atualizados em
          tempo real com o painel do recrutador, com feedback claro do que aconteceu
          em cada processo.
        </p>
      </div>

      {/* Faixa de visão geral: uma superfície dividida por 1px — o rótulo
          fica acima do valor (lista semântica <dl>). */}
      <dl className="mb-6 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3">
        <div className="flex flex-col gap-1 p-6">
          <dt className="text-sm text-slate-500">Candidaturas</dt>
          <dd className="text-3xl font-semibold tabular-nums text-slate-900">
            {kpis.total}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-t border-slate-200 p-6 sm:border-l sm:border-t-0">
          <dt className="text-sm text-slate-500">Em andamento</dt>
          <dd className="text-3xl font-semibold tabular-nums text-slate-900">
            {kpis.active}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-t border-slate-200 p-6 sm:border-l sm:border-t-0">
          <dt className="text-sm text-slate-500">Melhor match</dt>
          <dd className="text-3xl font-semibold tabular-nums text-slate-900">
            {kpis.bestMatch !== null ? `${kpis.bestMatch}%` : "—"}
          </dd>
        </div>
      </dl>

      {/* [FINAL_UPGRADE Etapa 3] — Estatísticas do Meu Perfil: números do
          aluno calculados no backend (applications.myStats), em tom menor
          que a faixa acima para a hierarquia ficar clara. */}
      <section
        aria-label="Estatísticas do Meu Perfil"
        className="mb-6 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Estatísticas do Meu Perfil
          </h2>
          <p className="text-xs text-slate-500">
            Taxa de sucesso = (Entrevista + Aprovado) / Total × 100
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-100 sm:grid-cols-4">
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Taxa de Sucesso</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {myStats !== undefined && myStats !== null
                ? `${myStats.successRate}%`
                : "—"}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Total de Candidaturas</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {myStats !== undefined && myStats !== null ? myStats.total : "—"}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Visualizações do Perfil</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {myStats !== undefined && myStats !== null
                ? myStats.profileViews
                : "—"}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Média de Match</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {myStats !== undefined && myStats !== null
                ? `${myStats.averageMatch}%`
                : "—"}
            </dd>
          </div>
        </dl>
        {myStats !== undefined && myStats !== null ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Distribuição por etapa"
          >
            {Object.entries(myStats.byStage).map(([stage, count]) => (
              <span
                key={stage}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium tabular-nums text-slate-700"
              >
                {STAGE_LABELS[stage as ApplicationStage]}: {count}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Inbox className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          Todas as candidaturas
        </h2>

        <div className="mt-4">
          {myApplications === undefined ? (
            <p
              className="text-sm text-slate-500"
              role="status"
              aria-live="polite"
            >
              Carregando candidaturas…
            </p>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nenhuma candidatura ainda"
              description="Você ainda não se candidatou a nenhuma vaga. Explore o mural de Oportunidades e candidate-se com um clique."
            />
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
                    className="rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-slate-900">
                        {application.jobTitle}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
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

                    <p className="sr-only" aria-live="polite">
                      {formatApplicationStatusLabel({
                        jobTitle: application.jobTitle,
                        stage: application.stage,
                        appliedAt: application.appliedAt,
                      })}
                    </p>

                    <ol
                      className="mt-4 flex flex-wrap items-center gap-1"
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
                            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${STEP_CLASSES[step.state]}`}
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
                    <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {stageFeedback(application.stage)}
                    </p>

                    {/* [Etapa 4.3] reprovação amigável com conselho. */}
                    {rejected ? (
                      <div className="mt-3 rounded-md border border-danger bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-danger">
                          {feedback.headline}
                        </p>
                        {reason !== null ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Motivo (padronizado):{" "}
                            <strong>{REJECTION_REASON_LABELS[reason]}</strong>
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {feedback.advice}
                        </p>
                      </div>
                    ) : null}

                    {/* [R6] controle de contato por candidatura (LGPD). */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-600">
                        {application.processAccepted
                          ? "Contato liberado para esta vaga (aceite no processo)."
                          : "Contato ainda não liberado para esta vaga."}
                      </p>
                      <Button
                        variant="secondary"
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
                        <Handshake className="h-4 w-4" aria-hidden="true" />
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
        </div>
      </section>
    </div>
  );
}
