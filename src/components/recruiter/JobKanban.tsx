import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type DragEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Inbox,
  LayoutGrid,
  List as ListIcon,
  Mail, 
  Target,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { EmptyState } from "../ui/emptyState";
import { SuperSearch } from "../ui/SuperSearch";
import { CustomSelect } from "../ui/CustomSelect";
import {
  CARD_HOVER,
  CARD_SURFACE,
  IconTile,
  LABEL_CLASS,
  MotionStyles,
  PageHeader,
  PRESS,
  SELECT_CLASS,
  SURFACE,
  TextField,
} from "./jobsUi";

/** Cor de cada etapa (ponto da coluna e faixa de resumo). */
const STAGE_DOT: Record<string, string> = {
  inscrito: "bg-slate-400",
  triagem: "bg-amber-500",
  entrevista: "bg-sky-500",
  aprovado: "bg-emerald-500",
  reprovado: "bg-rose-500",
};
const dotOf = (stage: string): string => STAGE_DOT[stage] ?? "bg-slate-400";

/** Pílula de compatibilidade (tons explícitos para o dark mode). */
const MATCH_TONE: Record<ReturnType<typeof matchBand>, string> = {
  strong:
    "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  medium:
    "border-sky-600/25 bg-sky-50 text-sky-800 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-300",
  low: "border-rose-600/25 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300",
};
const MATCH_BAR: Record<ReturnType<typeof matchBand>, string> = {
  strong: "bg-emerald-500",
  medium: "bg-sky-500",
  low: "bg-rose-500",
};

/** Botão compacto das ações do card (hover só com ponteiro preciso). */
const CARD_BTN =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/40 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary";
const CARD_BTN_DANGER =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-rose-400/60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-50 [@media(hover:hover)_and_(pointer:fine)]:hover:text-rose-700 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-500/10 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:text-rose-300";

/** Voltar: contorno e texto na cor primária (o "secondary" some no claro). */
const BACK_BTN = `inline-flex h-10 items-center gap-2 rounded-xl border border-primary/40 bg-white px-4 text-sm font-semibold text-primary shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 dark:border-primary/50 dark:bg-primary/10 ${PRESS} [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#FDF2F4] dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/20`;

/** Chips de filtro (faixa de compatibilidade). */
const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";
const CHIP_ON =
  "border-primary/40 bg-[#FDF2F4] text-primary dark:bg-primary/15";
const CHIP_OFF =
  "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/30 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary";

type ViewMode = "board" | "list";
type SortMode = "match" | "recent";
type BandFilter = "all" | ReturnType<typeof matchBand>;

const BAND_FILTERS: { value: BandFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "strong", label: "Forte" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

const VIEW_STORAGE_KEY = "jobKanban:view";

/** Preferência por-visualizador; pode falhar (janela privada etc.). */
function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list"
      ? "list"
      : "board";
  } catch {
    return "board";
  }
}

const FILTERS_KEY = "jobKanban:filters";

type SavedView = {
  query: string;
  band: BandFilter;
  sort: SortMode;
  stage: ApplicationStage | "all";
  expanded: string[];
  rejectedOpen: boolean;
};

/** Filtros/expansões da última visita a esta vaga (sessionStorage; pode falhar). */
function readSavedView(jobId: string | null): SavedView {
  const empty: SavedView = {
    query: "",
    band: "all",
    sort: "match",
    stage: "all",
    expanded: [],
    rejectedOpen: false,
  };
  try {
    const raw = window.sessionStorage.getItem(
      `${FILTERS_KEY}:${jobId ?? "none"}`,
    );
    if (raw === null) return empty;
    const d = JSON.parse(raw) as Partial<Record<keyof SavedView, unknown>>;
    return {
      query: typeof d.query === "string" ? d.query : "",
      band:
        d.band === "strong" || d.band === "medium" || d.band === "low"
          ? d.band
          : "all",
      sort: d.sort === "recent" ? "recent" : "match",
      stage: APPLICATION_STAGES.find((s) => s === d.stage) ?? "all",
      expanded: Array.isArray(d.expanded)
        ? d.expanded.filter((x): x is string => typeof x === "string")
        : [],
      rejectedOpen: d.rejectedOpen === true,
    };
  } catch {
    return empty;
  }
}

/** Busca sem acento e sem diferença de caixa. */
function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Melhores no topo (desempate: quem se candidatou antes) ou mais recentes. */
function sortApplications<T extends { matchScore: number; appliedAt: number }>(
  items: readonly T[],
  mode: SortMode,
): T[] {
  return [...items].sort((a, b) =>
    mode === "match"
      ? b.matchScore - a.matchScore || a.appliedAt - b.appliedAt
      : b.appliedAt - a.appliedAt,
  );
}

function CardButton({
  danger = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={`${danger ? CARD_BTN_DANGER : CARD_BTN} ${PRESS} ${className}`}
      {...props}
    />
  );
}

/** Título de modal: ícone em ladrilho + serifada (ids/textos preservados). */
function ModalTitle({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className="flex items-center gap-3 font-serif text-xl font-bold tracking-tight text-primary"
    >
      <IconTile>{icon}</IconTile>
      {children}
    </h3>
  );
}

function ModalError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-danger/40 bg-rose-50 px-3.5 py-2.5 text-sm text-danger dark:bg-rose-500/10"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Esqueleto do board: mesma silhueta das colunas e dos cards. */
function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex gap-4 overflow-hidden">
      <span className="sr-only">Carregando pipeline…</span>
      {[0, 1, 2, 3, 4].map((col) => (
        <div
          key={col}
          aria-hidden="true"
          className="min-h-72 min-w-[272px] flex-1 animate-pulse rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4 motion-reduce:animate-none dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="mb-4 h-4 w-1/2 rounded-full bg-slate-200/80 dark:bg-white/10" />
          {[0, 1].map((card) => (
            <div
              key={card}
              className="mb-3 h-16 rounded-2xl bg-white dark:bg-white/5"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** [UI_OVERHAUL] Iniciais do candidato para o avatar circular do card. */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

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
 *
 * [SCALE_UPGRADE] Pensado para vagas com muitos candidatos:
 * 1. card compacto (2 linhas) que expande ao clicar;
 * 2. ordenação por compatibilidade + busca + filtro por faixa;
 * 3. coluna "Reprovado" recolhida (continua aceitando soltar);
 * 4. alternância Quadro/Lista (lista com menu de etapa por linha).
 * A lógica de mover/reprovar/agendar não mudou.
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

  // [SCALE_UPGRADE] Estado de visualização (nada disso toca o servidor).
  // Restaurado do sessionStorage: sobrevive a "Ver Perfil" → voltar e a F5.
  const [saved] = useState(() => readSavedView(initialJobId));
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(saved.expanded),
  );
  const [query, setQuery] = useState(saved.query);
  const [bandFilter, setBandFilter] = useState<BandFilter>(saved.band);
  const [sortMode, setSortMode] = useState<SortMode>(saved.sort);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [stageFilter, setStageFilter] = useState<ApplicationStage | "all">(
    saved.stage,
  );
  const [rejectedOpen, setRejectedOpen] = useState(saved.rejectedOpen);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        `${FILTERS_KEY}:${initialJobId ?? "none"}`,
        JSON.stringify({
          query,
          band: bandFilter,
          sort: sortMode,
          stage: stageFilter,
          expanded: [...expandedIds],
          rejectedOpen,
        }),
      );
    } catch {
      // Só conveniência; ignorar falha de storage.
    }
  }, [initialJobId, query, bandFilter, sortMode, stageFilter, expandedIds, rejectedOpen]);

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

  function toggleExpanded(applicationId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  }

  function changeView(next: ViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Preferência é só uma conveniência; ignorar falha de storage.
    }
  }

  function clearFilters() {
    setQuery("");
    setBandFilter("all");
    setStageFilter("all");
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
      <div className="pb-16 pt-2">
        <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Carregando vagas…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`${SURFACE} h-24 animate-pulse motion-reduce:animate-none`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (jobs?.length === 0 && selectedJobId === null) {
    return (
      <div className="pb-16 pt-2">
        <MotionStyles />
        <PageHeader
          title="Pipeline de candidaturas"
          description="Acompanhe cada candidato da inscrição à contratação."
        />
        <div className={`${SURFACE} px-6 py-10`}>
          <EmptyState
            icon={Briefcase}
            title="Nenhuma vaga publicada"
            description="Publique uma vaga para começar a acompanhar o pipeline de candidaturas em tempo real."
          />
        </div>
      </div>
    );
  }

  if (selectedJobId === null) {
    return (
      <div className="pb-16 pt-2">
        <MotionStyles />
        <PageHeader
          title="Pipeline de candidaturas"
          description="Escolha a vaga para visualizar o pipeline Kanban:"
        />
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(jobs ?? []).map((job: Doc<"jobs">, index) => (
            <li
              key={job._id}
              className="jb-rise"
              style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
            >
              <button
                type="button"
                onClick={() => setSelectedJobId(job._id)}
                className={`${SURFACE} ${PRESS} flex w-full items-center gap-4 p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/30`}
              >
                <IconTile size="lg">
                  <Briefcase className="h-5 w-5" />
                </IconTile>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-slate-100">
                  {job.title}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (boardNotFound) {
    return (
      <div className="pb-16 pt-2">
        <MotionStyles />
        <PageHeader title="Pipeline de candidaturas" />
        <div className={`${SURFACE} px-6 py-10`}>
          <EmptyState
            icon={Briefcase}
            title="Vaga não encontrada"
            description="Esta vaga não existe mais ou você não tem acesso a ela."
            action={{ label: "Voltar", onClick: handleBack }}
          />
        </div>
      </div>
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
  const selectedJobTitle =
    board?.job.title ?? jobs?.find((j) => j._id === selectedJobId)?.title ?? "";

  // [SCALE_UPGRADE] Filtros: busca (nome/curso), faixa de match e, só no
  // modo lista, etapa. O resumo do topo continua contando TODOS.
  const normalizedQuery = normalizeText(query);
  const stageFilterActive = viewMode === "list" && stageFilter !== "all";
  const filtersActive =
    normalizedQuery !== "" || bandFilter !== "all" || stageFilterActive;
  const visible = applications.filter((application) => {
    if (
      normalizedQuery !== "" &&
      !normalizeText(`${application.fullName} ${application.course}`).includes(
        normalizedQuery,
      )
    ) {
      return false;
    }
    if (bandFilter !== "all" && matchBand(application.matchScore) !== bandFilter) {
      return false;
    }
    if (stageFilterActive && application.stage !== stageFilter) return false;
    return true;
  });
  const groupedAll = groupApplicationsByStage(applications);
  const grouped = groupApplicationsByStage(visible);
  // Durante a digitação o filtro muda a cada tecla: sem animação de entrada.
  const enterClass = filtersActive ? "" : "jb-rise";

  /** Destaque da coluna sob o card arrastado. */
  const columnTone = (stage: ApplicationStage): string =>
    dropTarget === stage
      ? "border-primary/40 bg-[#FDF2F4] dark:bg-primary/10"
      : "border-slate-200/80 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]";

  /** Handlers de soltar — compartilhados por colunas abertas e recolhidas. */
  const columnDropProps = (stage: ApplicationStage) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDropTarget(stage);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      // dragleave também dispara ao entrar em elementos filhos;
      // só limpa o destaque ao sair de fato da coluna.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDropTarget(null);
      }
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDropTarget(null);
      const id = e.dataTransfer.getData("text/plain") || draggingId;
      if (id !== null && id.length > 0) {
        void handleMove(id, stage);
      }
      setDraggingId(null);
    },
  });

  /** Card compacto (2 linhas) que expande ao clicar. */
  const renderCard = (
    application: BoardApplication,
    stage: ApplicationStage,
    cardIndex: number,
  ) => {
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
    const band = matchBand(application.matchScore);
    const open = expandedIds.has(application.applicationId);
    const detailsId = `card-details-${application.applicationId}`;
    return (
      <article
        key={application.applicationId}
        draggable
        tabIndex={0}
        aria-label={`${application.fullName}, ${STAGE_LABELS[application.stage]}. ${keyboardHint}`}
        style={{
          animationDelay: `${Math.min(cardIndex, 5) * 30}ms`,
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", application.applicationId);
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
          // Enter/Espaço no próprio card (não nos botões internos) expande.
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            toggleExpanded(application.applicationId);
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
        className={`${CARD_SURFACE} ${CARD_HOVER} ${enterClass} shrink-0 cursor-grab p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing ${
          draggingId === application.applicationId ? "opacity-50" : ""
        }`}
      >
        {/* Cabeçalho = botão de expandir: avatar, nome/curso e match. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => toggleExpanded(application.applicationId)}
          className="flex w-full items-center gap-2.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] font-serif text-xs font-bold text-primary ring-1 ring-primary/20 dark:bg-primary/15"
          >
            {initialsOf(application.fullName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {application.fullName}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-a11y-slate-500">
              {application.contactReleased ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  />
                  <span className="sr-only">Contato liberado.</span>
                </>
              ) : null}
              <span className="truncate">{application.course}</span>
            </span>
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${MATCH_TONE[band]}`}
          >
            <Target className="h-3 w-3" aria-hidden="true" />
            {application.matchScore}%
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {cardErrors[application.applicationId] !== undefined ? (
          <p
            role="alert"
            className="mt-2.5 rounded-lg border border-danger/40 bg-rose-50 px-2.5 py-1.5 text-xs text-danger dark:bg-rose-500/10"
          >
            {cardErrors[application.applicationId]}
          </p>
        ) : null}

        {/* Detalhes: grid 0fr→1fr (único caso tolerado de animar altura) +
            opacity; `visibility` sai do tab/leitor de tela quando fechado.
            Reduced motion: só o fade. */}
        <div
          id={detailsId}
          className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:[transition-property:opacity,visibility] ${
            open
              ? "visible grid-rows-[1fr] opacity-100"
              : "invisible grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="-mx-1 -mb-1 min-h-0 overflow-hidden px-1 pb-1">
            <div
              aria-hidden="true"
              className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
            >
              <div
                className={`h-full w-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${MATCH_BAR[band]}`}
                style={{
                  transform: `scaleX(${Math.min(Math.max(application.matchScore, 0), 100) / 100})`,
                }}
              />
            </div>

            <p className="mt-2.5 text-xs leading-snug text-a11y-slate-500">
              {MATCH_BAND_LABELS[band]}
            </p>
            {/* [UX-P3] H6-2 — idade do processo no próprio card. */}
            <p className="mt-1 flex items-center gap-1.5 text-xs text-a11y-slate-500">
              <CalendarDays
                className="h-3 w-3 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              Candidatou-se em {formatDay(application.appliedAt)}
            </p>
            <p className="mt-2.5 text-xs font-semibold">
              {application.contactReleased ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                  Contato liberado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-a11y-slate-500">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-500"
                  />
                  Contato não liberado
                </span>
              )}
            </p>
            {application.contactReleased ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-primary">
                {application.email !== undefined ? (
                  <a
                    href={`mailto:${application.email}`}
                    className="inline-flex min-w-0 items-center gap-1 break-all hover:underline"
                    onClick={() =>
                      void trackProfileView({
                        applicationId:
                          application.applicationId as Id<"applications">,
                      }).catch(() => undefined)
                    }
                  >
                    <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
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
                      className="inline-flex items-center gap-1 hover:underline"
                      onClick={() =>
                        void trackProfileView({
                          applicationId:
                            application.applicationId as Id<"applications">,
                        }).catch(() => undefined)
                      }
                    >
                      LinkedIn
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-white/10">
              {prevStage !== null ? (
                <CardButton
                  className="w-8 px-0"
                  disabled={saving}
                  aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[prevStage]}`}
                  onClick={() =>
                    void handleMove(application.applicationId, prevStage)
                  }
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </CardButton>
              ) : null}
              {nextStage !== null ? (
                <CardButton
                  className="w-8 px-0"
                  disabled={saving}
                  aria-label={`Mover ${application.fullName} para ${STAGE_LABELS[nextStage]}`}
                  onClick={() =>
                    void handleMove(application.applicationId, nextStage)
                  }
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CardButton>
              ) : null}
              {/* [RECRUITER_VIEW_PROFILE] Etapa 3 — acesso à
                  página dedicada (currículo somente leitura). */}
              <CardButton
                className="ml-auto"
                onClick={() =>
                  navigateTo(candidateProfilePath(application.studentId))
                }
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Ver Perfil
              </CardButton>
              {stage !== "reprovado" ? (
                <CardButton
                  danger
                  disabled={saving}
                  aria-label={`Reprovar ${application.fullName} com motivo padronizado`}
                  onClick={() => openReject(application.applicationId)}
                >
                  <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                  Reprovar
                </CardButton>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  };

  /** Coluna do quadro; "Reprovado" vira uma faixa estreita quando recolhida. */
  const renderColumn = (stage: ApplicationStage) => {
    const cards = sortApplications(grouped[stage], sortMode);
    const count = cards.length;
    const isRejected = stage === "reprovado";

    if (isRejected && !rejectedOpen) {
      return (
        <section
          key={`${stage}-collapsed`}
          aria-label={`${STAGE_LABELS[stage]} — ${count} candidatura(s), recolhida`}
          className={`flex max-h-[70vh] min-h-48 w-14 shrink-0 flex-col rounded-3xl border transition-colors duration-200 ${columnTone(stage)}`}
          {...columnDropProps(stage)}
        >
          <button
            type="button"
            aria-expanded={false}
            aria-label={`Expandir coluna ${STAGE_LABELS[stage]}, ${count} candidatura(s). Também aceita cards soltos aqui.`}
            onClick={() => setRejectedOpen(true)}
            className="flex h-full w-full flex-col items-center gap-3 rounded-3xl px-2 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
              aria-hidden="true"
            >
              {count}
            </span>
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${dotOf(stage)}`}
            />
            <span
              aria-hidden="true"
              className="font-serif text-[0.9375rem] font-bold text-primary [writing-mode:vertical-rl]"
            >
              {STAGE_LABELS[stage]}
            </span>
            <ChevronRight
              className="mt-auto h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
          </button>
        </section>
      );
    }

    return (
      <section
        key={stage}
        aria-label={`${STAGE_LABELS[stage]} — ${count} candidatura(s)`}
        className={`flex max-h-[70vh] min-h-48 min-w-[272px] flex-1 flex-col gap-4 rounded-3xl border p-4 transition-colors duration-200 ${
          isRejected ? "jb-fade" : ""
        } ${columnTone(stage)}`}
        {...columnDropProps(stage)}
      >
        <h3 className="flex items-center justify-between gap-2 px-1 font-serif text-[0.9375rem] font-bold text-primary">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${dotOf(stage)}`}
            />
            {STAGE_LABELS[stage]}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
              aria-label={`Contagem: ${count}`}
            >
              {count}
            </span>
            {isRejected ? (
              <button
                type="button"
                aria-expanded
                aria-label={`Recolher coluna ${STAGE_LABELS[stage]}`}
                onClick={() => setRejectedOpen(false)}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${PRESS} [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary`}
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        </h3>

        {/* [RECRUITER_UX_UPGRADE] Muitos candidatos não partem o
            ecrã: a coluna cresce até max-h e o corpo rola. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-0.5">
          {count === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-slate-300/80 px-2 py-8 text-center dark:border-white/15">
              <Inbox
                className="h-5 w-5 text-slate-300 dark:text-slate-500"
                aria-hidden="true"
              />
              <p className="text-xs text-a11y-slate-500">Sem cards</p>
            </div>
          ) : null}
          {cards.map((application, cardIndex) =>
            renderCard(application, stage, cardIndex),
          )}
        </div>
      </section>
    );
  };

  /** Modo lista: uma linha por candidato com menu para mudar a etapa. */
  const renderList = () => {
    const rows = sortApplications(visible, sortMode);
    if (rows.length === 0) {
      return (
        <div className={`${SURFACE} px-6 py-10`}>
          <EmptyState
            icon={Inbox}
            title={
              filtersActive
                ? "Nenhum candidato com esses filtros"
                : "Nenhum candidato ainda"
            }
            description={
              filtersActive
                ? "Ajuste a busca ou limpe os filtros para ver todos."
                : "Quando alguém se candidatar, aparece aqui."
            }
            action={
              filtersActive
                ? { label: "Limpar filtros", onClick: clearFilters }
                : undefined
            }
          />
        </div>
      );
    }
    return (
      <ul className="jb-fade flex flex-col gap-2">
        {rows.map((application) => {
          const band = matchBand(application.matchScore);
          // Reprovado só reentra em "inscrito" (mesma regra do quadro).
          const stageOptions: readonly ApplicationStage[] =
            application.stage === "reprovado"
              ? ["reprovado", "inscrito"]
              : APPLICATION_STAGES;
          return (
            <li
              key={application.applicationId}
              className={`${CARD_SURFACE} flex flex-wrap items-center gap-x-4 gap-y-3 p-3`}
            >
              <div className="flex min-w-0 flex-1 basis-64 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] font-serif text-xs font-bold text-primary ring-1 ring-primary/20 dark:bg-primary/15"
                >
                  {initialsOf(application.fullName)}
                </span>
                <div className="min-w-0">
                  <button
                    type="button"
                    aria-label={`Ver perfil de ${application.fullName}`}
                    title="Ver currículo completo (somente leitura)"
                    onClick={() =>
                      navigateTo(candidateProfilePath(application.studentId))
                    }
                    className="block max-w-full truncate rounded text-left text-sm font-semibold text-slate-900 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-100 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                  >
                    {application.fullName}
                  </button>
                  <p className="truncate text-xs text-a11y-slate-500">
                    {application.course} · Candidatou-se em{" "}
                    {formatDay(application.appliedAt)}
                    {application.contactReleased ? " · Contato liberado" : ""}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${MATCH_TONE[band]}`}
              >
                <Target className="h-3 w-3" aria-hidden="true" />
                {application.matchScore}%
              </span>
              <CustomSelect
                className="w-40 shrink-0"
                label=""
                placeholder={`Etapa de ${application.fullName}`}
                value={application.stage}
                onChange={(v) =>
                  void handleMove(application.applicationId, v as ApplicationStage)
                }
                options={stageOptions.map((o) => ({ value: o, label: STAGE_LABELS[o] }))}
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <CardButton
                  onClick={() =>
                    navigateTo(candidateProfilePath(application.studentId))
                  }
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver Perfil
                </CardButton>
                {application.stage !== "reprovado" ? (
                  <CardButton
                    danger
                    disabled={saving}
                    aria-label={`Reprovar ${application.fullName} com motivo padronizado`}
                    onClick={() => openReject(application.applicationId)}
                  >
                    <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                    Reprovar
                  </CardButton>
                ) : null}
              </div>
              {cardErrors[application.applicationId] !== undefined ? (
                <p
                  role="alert"
                  className="w-full rounded-lg border border-danger/40 bg-rose-50 px-2.5 py-1.5 text-xs text-danger dark:bg-rose-500/10"
                >
                  {cardErrors[application.applicationId]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="pb-16 pt-2">
      <MotionStyles />
      <PageHeader
        leading={
          <button
            type="button"
            onClick={onBack ?? (() => setSelectedJobId(null))}
            className={BACK_BTN}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {onBack !== undefined ? "Voltar para Minhas Vagas" : "Trocar vaga"}
          </button>
        }
        title={
          <>
            <span className="mb-2 block font-sans text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pipeline<span className="sr-only">: </span>
            </span>
            {selectedJobTitle}
          </>
        }
        description="Arraste os cards ou use as setas do teclado. Reprovar exige um motivo, registrado para auditoria."
      />

      {board === undefined ? (
        <BoardSkeleton />
      ) : (
        <>
          {/* Resumo: total + distribuição por etapa (decorativo, aria-hidden). */}
          <div className="jb-fade mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {applications.length === 1
                ? "1 candidato"
                : `${applications.length} candidatos`}
            </p>
            <ul
              aria-label="Candidatos por etapa"
              className="flex flex-wrap items-center gap-1.5"
            >
              {APPLICATION_STAGES.map((stage) => {
                const n = groupedAll[stage].length;
                return (
                  <li
                    key={stage}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold tabular-nums ${
                      n > 0
                        ? "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        : "border-transparent text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        n > 0 ? dotOf(stage) : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    />
                    {STAGE_LABELS[stage]} {n}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* [SCALE_UPGRADE] Barra de controle: busca, faixa de match,
              ordenação, etapa (só lista) e alternância Quadro/Lista. */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1 sm:max-w-sm">
              <SuperSearch
                ariaLabel="Buscar candidato por nome ou curso"
                placeholder="Buscar por nome ou curso"
                value={query}
                onChange={setQuery}
                sources={[]}
                onPick={() => undefined}
              />
            </div>

            <div
              role="group"
              aria-label="Filtrar por compatibilidade"
              className="flex flex-wrap items-center gap-1.5"
            >
              {BAND_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={bandFilter === filter.value}
                  onClick={() => setBandFilter(filter.value)}
                  className={`${CHIP} ${PRESS} ${
                    bandFilter === filter.value ? CHIP_ON : CHIP_OFF
                  }`}
                >
                  {filter.value !== "all" ? (
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${MATCH_BAR[filter.value]}`}
                    />
                  ) : null}
                  {filter.label}
                </button>
              ))}
            </div>

            <CustomSelect
              className="w-52"
              label=""
              placeholder="Ordenar candidatos"
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              options={[
                { value: "match", label: "Maior compatibilidade" },
                { value: "recent", label: "Mais recentes" },
              ]}
            />

            {viewMode === "list" ? (
              <CustomSelect
                className="w-48"
                label=""
                placeholder="Filtrar por etapa"
                value={stageFilter}
                onChange={(v) => setStageFilter(v as ApplicationStage | "all")}
                options={[
                  { value: "all", label: "Todas as etapas" },
                  ...APPLICATION_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
                ]}
              />
            ) : null}

            <div
              role="group"
              aria-label="Modo de visualização"
              className="ml-auto flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5"
            >
              {(
                [
                  ["board", "Quadro", LayoutGrid],
                  ["list", "Lista", ListIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={viewMode === value}
                  onClick={() => changeView(value)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${PRESS} ${
                    viewMode === value
                      ? "bg-[#FDF2F4] text-primary dark:bg-primary/15"
                      : "text-slate-600 dark:text-slate-300 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={
              filtersActive
                ? "-mt-2 mb-4 flex items-center gap-3 text-xs text-a11y-slate-500"
                : "sr-only"
            }
          >
            <p aria-live="polite">
              {filtersActive
                ? `${visible.length} de ${applications.length} candidatos`
                : `${applications.length} candidatos`}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded font-semibold text-primary underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:underline"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          {viewMode === "board" ? (
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
              {APPLICATION_STAGES.map((stage) => renderColumn(stage))}
            </div>
          ) : (
            renderList()
          )}
        </>
      )}

      {rejectingApplication !== null ? (
        <Modal
          titleId="reject-modal-title"
          descriptionId="reject-modal-description"
          onClose={closeReject}
        >
          <ModalTitle
            id="reject-modal-title"
            icon={<UserX className="h-4 w-4" />}
          >
            Reprovar candidatura
          </ModalTitle>
          <p
            id="reject-modal-description"
            className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {rejectingApplication.fullName} — {rejectingApplication.course}.
            Escolha o motivo padronizado: ele fica registrado para auditoria do
            processo e aparece para o candidato.
          </p>
          <div className="mt-5 flex flex-col gap-1.5">
            <label
              htmlFor="reject-reason-select"
              className={`${LABEL_CLASS} after:ml-0.5 after:text-danger after:content-['*']`}
            >
              Motivo da reprovação (obrigatório)
            </label>
            <select
              id="reject-reason-select"
              className={SELECT_CLASS}
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
            </select>
          </div>
          {cardErrors[rejectingApplication.applicationId] !== undefined ? (
            <ModalError>
              {cardErrors[rejectingApplication.applicationId]}
            </ModalError>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
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
          <ModalTitle
            id="interview-modal-title"
            icon={<CalendarPlus className="h-4 w-4" />}
          >
            Agendar entrevista
          </ModalTitle>
          <p
            id="interview-modal-description"
            className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {pendingApplication.fullName} — {pendingApplication.course}. Data,
            hora e link/local ficam registrados para auditoria do processo
            seletivo; a mudança só acontece após salvar.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
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
              <TextField
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
            </div>
            <TextField
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
            <ModalError>
              {cardErrors[pendingApplication.applicationId]}
            </ModalError>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
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
          <ModalTitle
            id="hire-modal-title"
            icon={<UserCheck className="h-4 w-4" />}
          >
            Confirmar contratação
          </ModalTitle>
          <p
            id="hire-modal-description"
            className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            {pendingApplication.fullName} — {pendingApplication.course}. A data
            de início prevista fica registrada para auditoria do processo; o
            card só é aprovado após salvar.
          </p>
          <div className="mt-5">
            <TextField
              label="Data de início prevista"
              type="date"
              required
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
            />
          </div>
          {cardErrors[pendingApplication.applicationId] !== undefined ? (
            <ModalError>
              {cardErrors[pendingApplication.applicationId]}
            </ModalError>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
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
    </div>
  );
}