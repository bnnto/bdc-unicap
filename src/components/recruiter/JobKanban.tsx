import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { Select } from "../ui/select";
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
import { candidateProfilePath, navigateTo } from "../../lib/router";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CalendarPlus,
  Eye,
  Inbox,
  Target,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { EmptyState } from "../ui/emptyState";

/** [UI_OVERHAUL] Iniciais do candidato para o avatar circular do card. */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

const MATCH_CHIP: Record<
  ReturnType<typeof matchBand>,
  "aprovado" | "andamento" | "reprovado"
> = {
  strong: "aprovado",
  medium: "andamento",
  low: "reprovado",
};

/** [UX_UPGRADE] timestamp → valor de input `yyyy-mm-dd` (fuso local). */
function toDateInputValue(ts?: number): string {
  if (ts === undefined || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** [UX_UPGRADE] timestamp → valor de input `HH:MM` (fuso local). */
function toTimeInputValue(ts?: number): string {
  if (ts === undefined || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

type BoardApplication = {
  applicationId: string;
  studentId: string;
  fullName: string;
  course: string;
  stage: ApplicationStage;
  matchScore: number;
  appliedAt: number;
  /** [UX_UPGRADE] dados auditáveis (prefill dos modais de progressão). */
  interviewDate?: number;
  interviewLink?: string;
  expectedStartDate?: number;
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
export function JobKanban({
  initialJobId = null,
  onBack,
}: {
  /** [RECRUITER_UX_UPGRADE] Master-Detail: abre direto no board da vaga. */
  initialJobId?: Id<"jobs"> | null;
  /** [RECRUITER_UX_UPGRADE] Master-Detail: volta à lista "Minhas vagas". */
  onBack?: () => void;
} = {}) {
  // [RECRUITER_WORKFLOW] Vagas do recrutador logado (getMyJobs).
  const jobs = useQuery(api.jobs.getMyJobs, {});
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(
    initialJobId,
  );
  // Se o pai trocar `initialJobId` sem remontar o componente (Master-Detail),
  // o board acompanha a nova vaga em vez de ficar preso na anterior.
  useEffect(() => {
    setSelectedJobId(initialJobId);
  }, [initialJobId]);
  /**
   * [UX-P2] H9-1 — erro por card: a mensagem aparece junto ao card que
   * originou a ação (não no topo do board), mesmo com muitas candidaturas.
   */
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ApplicationStage | null>(null);
  /**
   * Trava de ações em voo: o ref bloqueia cliques repetidos antes do
   * re-render; o state desabilita os botões na UI.
   */
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  /**
   * [RECRUITER_WORKFLOW] Etapa 4.3 — Modal de Reprovação: o card em
   * processo de reprovação e o motivo escolhido (obrigatório para
   * disparar a mutation — R5). Substitui o painel inline da S4-2.
   */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<RejectionReason | "">("");
  /**
   * [UX_UPGRADE] Etapa 3 — modal de progressão pendente: Entrevista e
   * Aprovado são INTERCEPTADOS antes da mutation. `interviewDraft`
   * guarda Data/Hora/Link e `startDraft` a data de início prevista;
   * cancelar não dispara mutation (rollback visual — o card não sai da
   * coluna de origem).
   */
  const [pendingMove, setPendingMove] = useState<{
    applicationId: string;
    to: "entrevista" | "aprovado";
  } | null>(null);
  const [interviewDraft, setInterviewDraft] = useState({
    date: "",
    time: "",
    link: "",
  });
  const [startDraft, setStartDraft] = useState("");

  const boardResult = useQuery(
    api.applications.jobBoard,
    selectedJobId !== null ? { jobId: selectedJobId } : "skip",
  );
  // `undefined` = carregando; `null` = vaga inexistente/sem acesso.
  const board = boardResult ?? undefined;
  const boardNotFound = selectedJobId !== null && boardResult === null;
  const moveApplication = useMutation(api.applications.moveApplication);
  const rejectApplication = useMutation(api.applications.rejectApplication);
  // [FINAL_UPGRADE Etapa 3] — contador (mock) de Visualizações do Perfil:
  // disparado quando o recrutador clica no contato/LinkedIn do aluno.
  const trackProfileView = useMutation(api.applications.trackProfileView);

  function setCardError(applicationId: string, message: string) {
    setCardErrors((prev) => ({ ...prev, [applicationId]: message }));
  }

  function clearCardError(applicationId: string) {
    setCardErrors((prev) => {
      if (!(applicationId in prev)) return prev;
      const rest = { ...prev };
      delete rest[applicationId];
      return rest;
    });
  }

  /**
   * Executa uma mutation com trava anti duplo clique e Toast amigável em
   * caso de falha (H9-1). Retorna `true` se concluiu com sucesso.
   */
  async function runMutation(action: () => Promise<unknown>): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await action();
      return true;
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function openReject(applicationId: string) {
    clearCardError(applicationId);
    setRejectingId(applicationId);
    setReasonDraft("");
  }

  /** Fecha o modal de reprovação limpando rascunho e erro. */
  function closeReject() {
    if (rejectingId !== null) clearCardError(rejectingId);
    setRejectingId(null);
    setReasonDraft("");
  }

  /** Fecha o modal de progressão sem deixar rascunhos nem erros pendentes. */
  function closePendingMove() {
    if (pendingMove !== null) clearCardError(pendingMove.applicationId);
    setPendingMove(null);
    setInterviewDraft({ date: "", time: "", link: "" });
    setStartDraft("");
  }

  async function handleMove(applicationId: string, to: ApplicationStage) {
    if (savingRef.current) return;
    clearCardError(applicationId);
    const current = board?.items.find(
      (item) => item.applicationId === applicationId,
    );
    // Soltar o card na própria coluna (ou usar uma seta que leva ao mesmo
    // estágio) não é uma movimentação: evita mutation/modais desnecessários,
    // inclusive abrir o modal de reprovação para quem já está reprovado.
    if (current !== undefined && current.stage === to) return;
    if (to === "reprovado") {
      // [UX-P1] H3-2/H5-1 — a reprovação exige motivo padronizado (R5):
      // arrastar até a coluna Reprovado (ou usar a seta →) abre o painel
      // de motivo em vez de mover direto, mantendo a trilha auditável.
      openReject(applicationId);
      return;
    }
    // [UX_UPGRADE] Etapa 3 — interceptação ANTES da mutation: os modais
    // de Entrevista e Contratação coletam os dados auditáveis e só aí a
    // mutation dispara; cancelar = rollback visual (nada foi gravado).
    if (current !== undefined && (to === "entrevista" || to === "aprovado")) {
      if (to === "entrevista") {
        setInterviewDraft({
          date: toDateInputValue(current.interviewDate),
          time: toTimeInputValue(current.interviewDate),
          link: current.interviewLink ?? "",
        });
      } else {
        setStartDraft(toDateInputValue(current.expectedStartDate));
      }
      setPendingMove({ applicationId, to });
      return;
    }
    await runMutation(() =>
      moveApplication({
        applicationId: applicationId as Id<"applications">,
        to,
      }),
    );
  }

  /** [UX_UPGRADE] Salva a entrevista e SÓ ENTÃO dispara a mutation. */
  async function handleInterviewSave(applicationId: string) {
    if (savingRef.current) return;
    if (interviewDraft.date === "" || interviewDraft.time === "") return;
    const link = interviewDraft.link.trim();
    if (link === "") {
      setCardError(
        applicationId,
        "Link ou local da entrevista é obrigatório (até 500 caracteres).",
      );
      return;
    }
    const interviewDate = new Date(
      `${interviewDraft.date}T${interviewDraft.time}`,
    ).getTime();
    if (!Number.isFinite(interviewDate)) {
      setCardError(applicationId, "Data e hora da entrevista inválidas.");
      return;
    }
    clearCardError(applicationId);
    const ok = await runMutation(() =>
      moveApplication({
        applicationId: applicationId as Id<"applications">,
        to: "entrevista",
        interviewDate,
        interviewLink: link,
      }),
    );
    if (ok) closePendingMove();
  }

  /** [UX_UPGRADE] Salva a contratação e SÓ ENTÃO dispara a mutation. */
  async function handleHireSave(applicationId: string) {
    if (savingRef.current) return;
    if (startDraft === "") return;
    const expectedStartDate = new Date(`${startDraft}T00:00:00`).getTime();
    if (!Number.isFinite(expectedStartDate)) {
      setCardError(applicationId, "Data de início prevista inválida.");
      return;
    }
    clearCardError(applicationId);
    const ok = await runMutation(() =>
      moveApplication({
        applicationId: applicationId as Id<"applications">,
        to: "aprovado",
        expectedStartDate,
      }),
    );
    if (ok) closePendingMove();
  }

  // [S4-2] R5 — reprovação só acontece COM motivo do enum fixo; sem
  // motivo o botão nem dispara a mutation (aviso claro na UI).
  async function handleReject(
    applicationId: string,
    reason: RejectionReason | "",
  ) {
    if (savingRef.current) return;
    clearCardError(applicationId);
    if (reason === "") {
      setCardError(
        applicationId,
        "Selecione o motivo da reprovação — ele é obrigatório para a auditoria do processo.",
      );
      return;
    }
    const ok = await runMutation(() =>
      rejectApplication({
        applicationId: applicationId as Id<"applications">,
        reason,
      }),
    );
    if (ok) closeReject();
  }

  function handleBack() {
    if (onBack !== undefined) {
      onBack();
    } else {
      setSelectedJobId(null);
    }
  }

  if (jobs === undefined && selectedJobId === null) {
    return (
      <p
        className="text-sm text-a11y-slate-500"
        role="status"
        aria-live="polite"
      >
        Carregando vagas…
      </p>
    );
  }

  if (jobs?.length === 0 && selectedJobId === null) {
    return (
      <Card title="Pipeline de candidaturas" accent="primary">
        <EmptyState
          icon={Briefcase}
          title="Nenhuma vaga publicada"
          description="Publique uma vaga para começar a acompanhar o pipeline de candidaturas em tempo real."
        />
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
          {(jobs ?? []).map((job: Doc<"jobs">) => (
            <li key={job._id}>
              <Button
                variant="secondary"
                onClick={() => setSelectedJobId(job._id)}
              >
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                {job.title}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (boardNotFound) {
    return (
      <Card title="Pipeline de candidaturas" accent="primary">
        <EmptyState
          icon={Briefcase}
          title="Vaga não encontrada"
          description="Esta vaga não existe mais ou você não tem acesso a ela."
          action={{ label: "Voltar", onClick: handleBack }}
        />
      </Card>
    );
  }

  const applications: BoardApplication[] = board?.items ?? [];
  // [RECRUITER_WORKFLOW] Card em reprovação (dados para o modal).
  const rejectingApplication =
    applications.find(
      (application) => application.applicationId === rejectingId,
    ) ?? null;
  // [UX_UPGRADE] Card do modal de progressão pendente (entrevista/contratação).
  const pendingApplication =
    pendingMove !== null
      ? (applications.find(
          (application) =>
            application.applicationId === pendingMove.applicationId,
        ) ?? null)
      : null;
  const grouped = groupApplicationsByStage(applications);
  const selectedJobTitle =
    board?.job.title ?? jobs?.find((j) => j._id === selectedJobId)?.title ?? "";

  return (
    <Card title={`Pipeline — ${selectedJobTitle}`} accent="primary">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {onBack !== undefined ? (
            <Button variant="primary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar para Minhas Vagas
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setSelectedJobId(null)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Trocar vaga
            </Button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
            {selectedJobTitle}
          </span>
        </div>
        <p className="text-xs text-a11y-slate-500">
          Arraste os cards ou use as setas do teclado; clique no nome ou em Ver
          Perfil para abrir o currículo completo do candidato; para reprovar,
          escolha o motivo, ele fica registrado para auditoria.
        </p>
      </div>

      {board === undefined ? (
        <p
          className="text-sm text-a11y-slate-500"
          role="status"
          aria-live="polite"
        >
          Carregando pipeline…
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {APPLICATION_STAGES.map((stage) => (
            <section
              key={stage}
              aria-label={`${STAGE_LABELS[stage]} — ${grouped[stage].length} candidatura(s)`}
              className={`flex max-h-[68vh] min-h-40 flex-col gap-4 rounded-xl border p-6 transition-colors ${
                dropTarget === stage
                  ? "border-secondary bg-[#FDF2F4]"
                  : "border-slate-200 bg-slate-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage);
              }}
              onDragLeave={(e) => {
                // dragleave também dispara ao entrar em elementos filhos;
                // só limpa o destaque ao sair de fato da coluna.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTarget(null);
                }
              }}
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

              {/* [RECRUITER_UX_UPGRADE] Muitos candidatos não partem o
                  ecrã: a coluna cresce até max-h e o corpo rola. */}
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                {grouped[stage].length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300/80 px-2 py-6 text-center">
                    <Inbox
                      className="h-5 w-5 text-slate-300"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-a11y-slate-500">Sem cards</p>
                  </div>
                ) : null}

                {grouped[stage].map((application) => {
                  const currentIndex = APPLICATION_STAGES.indexOf(stage);
                  // [UX_UPGRADE] reentrada de Reprovado só em "inscrito"
                  // (caminho obrigatório — o retrocesso direto para
                  // Aprovado seria bloqueado no servidor).
                  const prevStage: ApplicationStage | null =
                    stage === "reprovado"
                      ? "inscrito"
                      : currentIndex > 0
                        ? (APPLICATION_STAGES[currentIndex - 1] ?? null)
                        : null;
                  const nextStage: ApplicationStage | null =
                    currentIndex < APPLICATION_STAGES.length - 1
                      ? (APPLICATION_STAGES[currentIndex + 1] ?? null)
                      : null;
                  // Dica de teclado explícita (destino de cada seta).
                  const keyboardHint = [
                    prevStage !== null
                      ? `Seta para a esquerda move para ${STAGE_LABELS[prevStage]}.`
                      : null,
                    nextStage !== null
                      ? `Seta para a direita move para ${STAGE_LABELS[nextStage]}.`
                      : null,
                  ]
                    .filter((hint): hint is string => hint !== null)
                    .join(" ");
                  return (
                    <article
                      key={application.applicationId}
                      draggable
                      tabIndex={0}
                      aria-label={`${application.fullName}, ${STAGE_LABELS[application.stage]}. ${keyboardHint}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "text/plain",
                          application.applicationId,
                        );
                        setDraggingId(application.applicationId);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onKeyDown={(e) => {
                        // Campos de formulário dentro do card mantêm o
                        // comportamento nativo das setas.
                        if (
                          (e.target as HTMLElement).closest(
                            "input, textarea, select, [contenteditable='true']",
                          ) !== null
                        ) {
                          return;
                        }
                        if (e.key === "ArrowLeft" && prevStage !== null) {
                          e.preventDefault();
                          void handleMove(application.applicationId, prevStage);
                        }
                        if (e.key === "ArrowRight" && nextStage !== null) {
                          e.preventDefault();
                          void handleMove(application.applicationId, nextStage);
                        }
                      }}
                      className="cursor-grab rounded-lg border border-slate-200 bg-white p-6 shadow-level1 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-level2 focus-visible:ring-2 focus-visible:ring-secondary active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary ring-1 ring-primary/20"
                          >
                            {initialsOf(application.fullName)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Ver perfil de ${application.fullName}`}
                            title="Ver currículo completo (somente leitura)"
                            onClick={() =>
                              navigateTo(
                                candidateProfilePath(application.studentId),
                              )
                            }
                            className="truncate rounded text-left text-sm font-semibold text-slate-800 transition-colors hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                          >
                            {application.fullName}
                          </button>
                        </div>
                        <Badge
                          variant={
                            MATCH_CHIP[matchBand(application.matchScore)]
                          }
                        >
                          <Target className="h-3 w-3" aria-hidden="true" />
                          {application.matchScore}%
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-a11y-slate-500">
                        {application.course} ·{" "}
                        {MATCH_BAND_LABELS[matchBand(application.matchScore)]}
                      </p>
                      {/* [UX-P3] H6-2 — idade do processo no próprio card. */}
                      <p className="mt-1 text-xs text-a11y-slate-500">
                        Candidatou-se em {formatDay(application.appliedAt)}
                      </p>
                      <p className="mt-2 text-xs font-semibold">
                        {application.contactReleased ? (
                          <span className="text-success">Contato liberado</span>
                        ) : (
                          <span className="text-a11y-slate-500">
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
                        <p className="mt-2 text-xs text-primary">
                          {application.email !== undefined ? (
                            <a
                              href={`mailto:${application.email}`}
                              onClick={() =>
                                void trackProfileView({
                                  applicationId:
                                    application.applicationId as Id<"applications">,
                                }).catch(() => undefined)
                              }
                            >
                              {application.email}
                            </a>
                          ) : (
                            "E-mail não cadastrado"
                          )}
                          {application.linkedinUrl !== undefined ? (
                            <>
                              {" · "}
                              <a
                                href={application.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() =>
                                  void trackProfileView({
                                    applicationId:
                                      application.applicationId as Id<"applications">,
                                  }).catch(() => undefined)
                                }
                              >
                                LinkedIn
                              </a>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {prevStage !== null ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[prevStage]}`}
                            onClick={() =>
                              void handleMove(
                                application.applicationId,
                                prevStage,
                              )
                            }
                          >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                        {nextStage !== null ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[nextStage]}`}
                            onClick={() =>
                              void handleMove(
                                application.applicationId,
                                nextStage,
                              )
                            }
                          >
                            <ArrowRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </Button>
                        ) : null}
                        {stage !== "reprovado" ? (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            aria-label={`Reprovar ${application.fullName} com motivo padronizado`}
                            onClick={() => openReject(application.applicationId)}
                          >
                            <UserX className="h-4 w-4" aria-hidden="true" />
                            Reprovar
                          </Button>
                        ) : null}
                        {/* [RECRUITER_VIEW_PROFILE] Etapa 3 — acesso à
                          página dedicada (currículo somente leitura). */}
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigateTo(
                              candidateProfilePath(application.studentId),
                            )
                          }
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver Perfil
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {rejectingApplication !== null ? (
        <Modal
          titleId="reject-modal-title"
          descriptionId="reject-modal-description"
          onClose={closeReject}
        >
          <h3
            id="reject-modal-title"
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <UserX className="h-4 w-4" aria-hidden="true" />
            Reprovar candidatura
          </h3>
          <p
            id="reject-modal-description"
            className="mt-1 text-sm text-slate-600"
          >
            {rejectingApplication.fullName} — {rejectingApplication.course}.
            Escolha o motivo padronizado: ele fica registrado para auditoria do
            processo e aparece para o candidato.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <label
              htmlFor="reject-reason-select"
              className="text-sm font-semibold text-slate-700"
            >
              Motivo da reprovação (obrigatório)
            </label>
            <Select
              id="reject-reason-select"
              className="w-full"
              value={reasonDraft}
              onChange={(e) =>
                setReasonDraft(e.target.value as RejectionReason | "")
              }
            >
              <option value="">Selecione…</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REJECTION_REASON_LABELS[reason]}
                </option>
              ))}
            </Select>
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
            <Button variant="secondary" onClick={closeReject}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button
              variant="danger"
              aria-label="Confirmar reprovação com o motivo selecionado"
              disabled={reasonDraft === "" || saving}
              onClick={() =>
                void handleReject(
                  rejectingApplication.applicationId,
                  reasonDraft,
                )
              }
            >
              <UserX className="h-4 w-4" aria-hidden="true" />
              Confirmar reprovação
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* [UX_UPGRADE] Etapa 3 — Modal de Entrevista: Data, Hora e
          Link/Local são exigidos ANTES de disparar a mutation; cancelar
          (Esc ou clique no backdrop) mantém o card na coluna de origem. */}
      {pendingApplication !== null && pendingMove?.to === "entrevista" ? (
        <Modal
          titleId="interview-modal-title"
          descriptionId="interview-modal-description"
          onClose={closePendingMove}
        >
          <h3
            id="interview-modal-title"
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Agendar entrevista
          </h3>
          <p
            id="interview-modal-description"
            className="mt-1 text-sm text-slate-600"
          >
            {pendingApplication.fullName} — {pendingApplication.course}. Data,
            hora e link/local ficam registrados para auditoria do processo
            seletivo; a mudança só acontece após salvar.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Input
              label="Data da entrevista"
              type="date"
              required
              value={interviewDraft.date}
              onChange={(e) =>
                setInterviewDraft((draft) => ({
                  ...draft,
                  date: e.target.value,
                }))
              }
            />
            <Input
              label="Hora da entrevista"
              type="time"
              required
              value={interviewDraft.time}
              onChange={(e) =>
                setInterviewDraft((draft) => ({
                  ...draft,
                  time: e.target.value,
                }))
              }
            />
            <Input
              label="Link ou local da entrevista"
              type="text"
              required
              maxLength={500}
              placeholder="https://meet.example.com/… ou Auditório do Bloco 2"
              value={interviewDraft.link}
              onChange={(e) =>
                setInterviewDraft((draft) => ({
                  ...draft,
                  link: e.target.value,
                }))
              }
            />
          </div>
          {cardErrors[pendingApplication.applicationId] !== undefined ? (
            <p
              role="alert"
              className="mt-3 rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
            >
              {cardErrors[pendingApplication.applicationId]}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closePendingMove}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button
              variant="primary"
              aria-label="Salvar entrevista e mover o card"
              disabled={
                saving ||
                interviewDraft.date === "" ||
                interviewDraft.time === "" ||
                interviewDraft.link.trim() === ""
              }
              onClick={() =>
                void handleInterviewSave(pendingApplication.applicationId)
              }
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Salvar entrevista
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* [UX_UPGRADE] Etapa 3 — Modal de Contratação: a Data de Início
          Prevista é exigida ANTES de disparar a mutation; cancelar
          mantém o card em "Entrevista". */}
      {pendingApplication !== null && pendingMove?.to === "aprovado" ? (
        <Modal
          titleId="hire-modal-title"
          descriptionId="hire-modal-description"
          onClose={closePendingMove}
        >
          <h3
            id="hire-modal-title"
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Confirmar contratação
          </h3>
          <p
            id="hire-modal-description"
            className="mt-1 text-sm text-slate-600"
          >
            {pendingApplication.fullName} — {pendingApplication.course}. A data
            de início prevista fica registrada para auditoria do processo; o
            card só é aprovado após salvar.
          </p>
          <div className="mt-3">
            <Input
              label="Data de início prevista"
              type="date"
              required
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
            />
          </div>
          {cardErrors[pendingApplication.applicationId] !== undefined ? (
            <p
              role="alert"
              className="mt-3 rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
            >
              {cardErrors[pendingApplication.applicationId]}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closePendingMove}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button
              variant="primary"
              aria-label="Confirmar contratação com a data de início"
              disabled={saving || startDraft === ""}
              onClick={() =>
                void handleHireSave(pendingApplication.applicationId)
              }
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Confirmar contratação
            </Button>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}