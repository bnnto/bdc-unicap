import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  groupApplicationsByStage,
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  type ApplicationStage,
  type RejectionReason,
} from "../../lib/application";
import { MATCH_BAND_LABELS, matchBand } from "../../lib/matching";
import { formatDay } from "../../lib/formatters";

const MATCH_CHIP: Record<
  ReturnType<typeof matchBand>,
  "aprovado" | "andamento" | "reprovado"
> = {
  strong: "aprovado",
  medium: "andamento",
  low: "reprovado",
};

type BoardApplication = {
  applicationId: string;
  studentId: string;
  fullName: string;
  course: string;
  stage: ApplicationStage;
  matchScore: number;
  appliedAt: number;
  /** [S4-3] R6 — liberação de contato projetada no servidor. */
  contactReleased: boolean;
  releaseReason: "autorizacao_geral" | "aceite_no_processo" | "sem_autorizacao";
  email?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
};

/**
 * Pipeline Kanban do recrutador (issue [S4-1]).
 * CA 1 — mover card atualiza `applications.stage` via mutation reativa
 * (todos os clientes na vaga re-renderizam em tempo real).
 * CA 2 — colunas por stage com contagem de cards.
 * CA 3 — teclado: botões ←/→ nos cards movem entre colunas com foco
 * mantido no card (alternativa acessível ao arrastar).
 */
export function JobKanban() {
  // [RECRUITER_WORKFLOW] Vagas do recrutador logado (getMyJobs).
  const jobs = useQuery(api.jobs.getMyJobs, {});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  /**
   * [UX-P2] H9-1 — erro por card: a mensagem aparece junto ao card que
   * originou a ação (não no topo do board), mesmo com muitas candidaturas.
   */
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ApplicationStage | null>(null);
  /**
   * [RECRUITER_WORKFLOW] Etapa 4.3 — Modal de Reprovação: o card em
   * processo de reprovação e o motivo escolhido (obrigatório para
   * disparar a mutation — R5). Substitui o painel inline da S4-2.
   */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<RejectionReason | "">("");

  const boardJobId = selectedJobId as Id<"jobs"> | null;
  const board =
    useQuery(
      api.applications.jobBoard,
      boardJobId !== null ? { jobId: boardJobId } : "skip",
    ) ?? undefined;
  const moveApplication = useMutation(api.applications.moveApplication);
  const rejectApplication = useMutation(api.applications.rejectApplication);

  async function handleMove(applicationId: string, to: ApplicationStage) {
    setCardErrors((prev) => {
      const rest = { ...prev };
      delete rest[applicationId];
      return rest;
    });
    if (to === "reprovado") {
      // [UX-P1] H3-2/H5-1 — a reprovação exige motivo padronizado (R5):
      // arrastar até a coluna Reprovado (ou usar a seta →) abre o painel
      // de motivo em vez de mover direto, mantendo a trilha auditável.
      setRejectingId(applicationId);
      setReasonDraft("");
      return;
    }
    try {
      await moveApplication({
        applicationId: applicationId as Id<"applications">,
        to,
      });
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [applicationId]:
          err instanceof Error ? err.message : "Falha ao mover a candidatura.",
      }));
    }
  }

  // [S4-2] R5 — reprovação só acontece COM motivo do enum fixo; sem
  // motivo o botão nem dispara a mutation (aviso claro na UI).
  async function handleReject(
    applicationId: string,
    reason: RejectionReason | "",
  ) {
    setCardErrors((prev) => {
      const rest = { ...prev };
      delete rest[applicationId];
      return rest;
    });
    if (reason === "") {
      setCardErrors((prev) => ({
        ...prev,
        [applicationId]:
          "Selecione o motivo da reprovação — ele é obrigatório para a auditoria do processo.",
      }));
      return;
    }
    try {
      await rejectApplication({
        applicationId: applicationId as Id<"applications">,
        reason,
      });
      setRejectingId(null);
      setReasonDraft("");
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [applicationId]:
          err instanceof Error
            ? err.message
            : "Falha ao reprovar a candidatura.",
      }));
    }
  }

  if (jobs === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando vagas…
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card title="Pipeline de candidaturas" accent="primary">
        <p className="text-sm text-slate-600">
          Publique uma vaga para acompanhar o pipeline de candidaturas.
        </p>
      </Card>
    );
  }

  if (selectedJobId === null) {
    return (
      <Card title="Pipeline de candidaturas" accent="primary">
        <p className="mb-3 text-sm text-slate-600">
          Escolha a vaga para visualizar o pipeline Kanban:
        </p>
        <ul className="flex flex-col gap-2">
          {jobs.map((job: Doc<"jobs">) => (
            <li key={job._id}>
              <Button
                variant="secondary"
                onClick={() => setSelectedJobId(String(job._id))}
              >
                {job.title}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const applications: BoardApplication[] = board?.items ?? [];
  // [RECRUITER_WORKFLOW] Card em reprovação (dados para o modal).
  const rejectingApplication =
    applications.find(
      (application) => application.applicationId === rejectingId,
    ) ?? null;
  const grouped = groupApplicationsByStage(applications);
  const selectedJobTitle =
    board?.job.title ??
    jobs.find((j) => String(j._id) === selectedJobId)?.title ??
    "";

  return (
    <Card title={`Pipeline — ${selectedJobTitle}`} accent="primary">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => setSelectedJobId(null)}>
          ← Trocar vaga
        </Button>
        <p className="text-xs text-slate-500">
          Arraste os cards ou use as setas do teclado; para reprovar, escolha o
          motivo — ele fica registrado para auditoria.
        </p>
      </div>

      {board === undefined ? (
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Carregando pipeline…
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5 sm:grid-cols-2">
          {APPLICATION_STAGES.map((stage) => (
            <section
              key={stage}
              aria-label={`${STAGE_LABELS[stage]} — ${grouped[stage].length} candidatura(s)`}
              className={`flex min-h-40 flex-col gap-2 rounded-lg border p-3 transition-colors ${
                dropTarget === stage
                  ? "border-secondary bg-[#FDF2F4]"
                  : "border-slate-200 bg-slate-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage);
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (id !== null && id.length > 0) {
                  void handleMove(id, stage);
                }
                setDraggingId(null);
              }}
            >
              <h3 className="flex items-center justify-between font-serif text-sm font-bold text-primary">
                {STAGE_LABELS[stage]}
                <span
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700"
                  aria-label={`Contagem: ${grouped[stage].length}`}
                >
                  {grouped[stage].length}
                </span>
              </h3>

              {grouped[stage].length === 0 ? (
                <p className="text-xs text-a11y-slate-500">Sem cards</p>
              ) : null}

              {grouped[stage].map((application) => {
                const currentIndex = APPLICATION_STAGES.indexOf(stage);
                const prevStage: ApplicationStage | null =
                  currentIndex > 0
                    ? (APPLICATION_STAGES[currentIndex - 1] ?? null)
                    : null;
                const nextStage: ApplicationStage | null =
                  currentIndex < APPLICATION_STAGES.length - 1
                    ? (APPLICATION_STAGES[currentIndex + 1] ?? null)
                    : null;
                return (
                  <article
                    key={application.applicationId}
                    draggable
                    tabIndex={0}
                    aria-label={`${application.fullName}, ${STAGE_LABELS[application.stage]}. Use as setas do teclado para mover.`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/plain",
                        application.applicationId,
                      );
                      setDraggingId(application.applicationId);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" && prevStage !== null) {
                        e.preventDefault();
                        void handleMove(application.applicationId, prevStage);
                      }
                      if (e.key === "ArrowRight" && nextStage !== null) {
                        e.preventDefault();
                        void handleMove(application.applicationId, nextStage);
                      }
                    }}
                    className="cursor-grab rounded border border-slate-200 bg-white p-3 shadow-level1 focus-visible:ring-2 focus-visible:ring-secondary active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {application.fullName}
                      </p>
                      <Badge
                        variant={MATCH_CHIP[matchBand(application.matchScore)]}
                      >
                        {application.matchScore}%
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {application.course} ·{" "}
                      {MATCH_BAND_LABELS[matchBand(application.matchScore)]}
                    </p>
                    {/* [UX-P3] H6-2 — idade do processo no próprio card. */}
                    <p className="mt-0.5 text-xs text-a11y-slate-500">
                      Candidatou-se em {formatDay(application.appliedAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold">
                      {application.contactReleased ? (
                        <span className="text-success">Contato liberado</span>
                      ) : (
                        <span className="text-slate-500">
                          Contato não liberado
                        </span>
                      )}
                    </p>
                    {cardErrors[application.applicationId] !== undefined ? (
                      <p
                        role="alert"
                        className="mt-2 rounded border border-danger bg-white px-2 py-1 text-xs text-danger"
                      >
                        {cardErrors[application.applicationId]}
                      </p>
                    ) : null}
                    {application.contactReleased ? (
                      <p className="mt-1 text-xs text-primary">
                        {application.email ?? "E-mail não cadastrado"}
                        {application.linkedinUrl !== undefined ? (
                          <>
                            {" · "}
                            <a
                              href={application.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              LinkedIn
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-1">
                      {prevStage !== null ? (
                        <Button
                          variant="secondary"
                          aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[prevStage]}`}
                          onClick={() =>
                            void handleMove(
                              application.applicationId,
                              prevStage,
                            )
                          }
                        >
                          ←
                        </Button>
                      ) : null}
                      {nextStage !== null ? (
                        <Button
                          variant="secondary"
                          aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[nextStage]}`}
                          onClick={() =>
                            void handleMove(
                              application.applicationId,
                              nextStage,
                            )
                          }
                        >
                          →
                        </Button>
                      ) : null}
                      {stage !== "reprovado" ? (
                        <Button
                          variant="secondary"
                          aria-label={`Reprovar ${application.fullName} com motivo padronizado`}
                          onClick={() => {
                            setRejectingId((current) =>
                              current === application.applicationId
                                ? null
                                : application.applicationId,
                            );
                            setReasonDraft("");
                          }}
                        >
                          Reprovar
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {rejectingApplication !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          aria-describedby="reject-modal-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
          onClick={(e) => {
            // Clique no backdrop fecha (não é o conteúdo do diálogo).
            if (e.target === e.currentTarget) {
              setRejectingId(null);
              setReasonDraft("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-level1">
            <h3
              id="reject-modal-title"
              className="font-serif text-lg font-bold text-primary"
            >
              Reprovar candidatura
            </h3>
            <p
              id="reject-modal-description"
              className="mt-1 text-sm text-slate-600"
            >
              {rejectingApplication.fullName} — {rejectingApplication.course}.
              Escolha o motivo padronizado: ele fica registrado para auditoria
              do processo (R5) e aparece para o candidato.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <label
                htmlFor="reject-reason-select"
                className="text-sm font-semibold text-slate-700"
              >
                Motivo da reprovação (obrigatório)
              </label>
              <select
                id="reject-reason-select"
                value={reasonDraft}
                onChange={(e) =>
                  setReasonDraft(e.target.value as RejectionReason | "")
                }
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="">Selecione…</option>
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {REJECTION_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </div>
            {cardErrors[rejectingApplication.applicationId] !== undefined ? (
              <p
                role="alert"
                className="mt-2 rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
              >
                {cardErrors[rejectingApplication.applicationId]}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectingId(null);
                  setReasonDraft("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                aria-label="Confirmar reprovação com o motivo selecionado"
                disabled={reasonDraft === ""}
                onClick={() =>
                  void handleReject(
                    rejectingApplication.applicationId,
                    reasonDraft,
                  )
                }
              >
                Confirmar reprovação
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
