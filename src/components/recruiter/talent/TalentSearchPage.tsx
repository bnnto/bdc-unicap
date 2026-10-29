import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { Combobox } from "../../ui/Combobox";
import { CustomSelect } from "../../ui/CustomSelect";
import { SuperSearch } from "../../ui/SuperSearch";
import { AVAILABILITY, type Availability } from "../../../lib/studentProfile";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  SKILLS_GROUPS,
  type LanguageLevel,
} from "../../../lib/skills";
import {
  TALENT_PAGE_SIZE,
  type TalentSortOption,
} from "../../../lib/talentSearch";
import { COURSES } from "../../../lib/talentBenchmark";
import { candidateProfilePath, navigateTo } from "../../../lib/router";
import { friendlyErrorMessage } from "../../../lib/toastMessages";
import { useStableQuery } from "../../../lib/useStableQuery";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FilterX,
  GraduationCap,
  Languages,
  MapPin,
  SearchX,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type SearchArgs = {
  search?: string;
  course?: string;
  status?: "ativo" | "egresso";
  availability?: Availability[];
  location?: string;
  skills?: string[];
  language?: string;
  languageLevel?: LanguageLevel;
  graduationYearFrom?: number;
  graduationYearTo?: number;
  sort?: TalentSortOption;
  page: number;
};

const AVAILABILITY_LABELS: Record<Availability, string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

const SORT_LABELS: Record<TalentSortOption, string> = {
  relevancia: "Mais relevantes",
  nome: "Nome (A–Z)",
  conclusao_proxima: "Conclusão mais próxima",
};

const STATUS_LABELS = {
  ativo: "Alunos ativos",
  egresso: "Egressos",
} as const;

/** Anos exibidos como atalhos: ano atual + 5 (sempre atualizado). */
const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

/** Competências visíveis por card; o restante vira o chip "+N". */
const MAX_VISIBLE_SKILLS = 6;

/* ------------------------------------------------------------------ */
/* Tokens visuais                                                       */
/* ------------------------------------------------------------------ */

/** Mesma superfície do Painel Estratégico / Recrutadores: anel
 *  semitransparente + sombra longa e suave; no alto contraste volta uma
 *  borda sólida. */
const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Mesmo "press" do projeto: feedback imediato (150ms) e retorno suave. */
const PRESS =
  "transition-[background-color,color,border-color,box-shadow,transform] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.985] active:duration-150 motion-reduce:[transition-property:background-color,color,border-color,opacity] motion-reduce:active:scale-100";

/** Hover do card: só aprofunda a sombra (sem mover), e só em dispositivos
 *  com ponteiro preciso — o card não é clicável por inteiro, então o
 *  movimento seria uma falsa promessa. */
const CARD_HOVER =
  "transition-shadow duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgba(15,23,42,0.1),0_2px_4px_rgba(15,23,42,0.05),0_24px_48px_-20px_rgba(15,23,42,0.22)]";

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition-colors duration-150 placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

const FIELD_LABEL_CLASS = "text-xs font-medium tracking-[0.01em] text-a11y-slate-500";

const LEGEND_CLASS =
  "mb-4 flex items-center gap-2.5 p-0 text-sm font-semibold text-slate-900";

const LEGEND_ICON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-lg bg-[#FDF2F4] text-primary";

const CHIP_REMOVE_CLASS =
  "inline-flex max-w-[200px] sm:max-w-[280px] items-center gap-1.5 rounded-full bg-[#FDF2F4] py-1 pl-3 pr-2 text-xs font-semibold text-primary ring-1 ring-primary/20 dark:bg-primary/10 dark:text-primary dark:ring-primary/30 hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";

/**
 * Keyframes locais (curva `cubic-bezier(0.23, 1, 0.32, 1)`, ease-out forte).
 * - `ts-rise`: entrada dos cards (8px + opacidade, stagger curto);
 * - `ts-fade`: fundo do modal;
 * - `ts-pop`: modal (scale 0.96 → 1, nunca de 0; modais mantêm origem central).
 * Movimento reduzido vira um fade curto; transparência reduzida tira o blur.
 * Se preferir, mova este bloco para o CSS global ao lado de `.view-enter`.
 */
const MOTION_CSS = `
@keyframes ts-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes ts-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ts-pop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: none; } }
.ts-rise { animation: ts-rise 260ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.ts-fade { animation: ts-fade 200ms ease-out both; }
.ts-pop  { animation: ts-pop 220ms cubic-bezier(0.23, 1, 0.32, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .ts-rise, .ts-pop { animation-name: ts-fade; animation-duration: 150ms; }
}
@media (prefers-reduced-transparency: reduce) {
  .ts-backdrop { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; background-color: rgb(15 23 42 / 0.72) !important; }
}
`;

type SearchResult = {
  items: Array<{
    studentId: string;
    fullName: string;
    course: string;
    status: "ativo" | "egresso" | "inativo";
    graduationYear: number;
    semester: number | null;
    location: string | null;
    /** [QUICK_WIN_MULTI] multi-seleção custodada pelo aluno (cards em " · "). */
    availability: Availability[];
    summary: string;
    skills: string[];
    languages: Array<{ name: string; level: LanguageLevel }>;
    headline: string | null;
    imageUrl: string | null;
    contactAllowed: boolean;
    skillMatches: number;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
  }>;
  total: number;
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Talent = SearchResult["items"][number];

/** Atrasa a propagação de um valor (evita uma query por tecla). */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Iniciais: primeira + segunda palavra, ignorando espaços duplicados. */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Texto minúsculo e sem acentos (mesma regra do servidor). */
function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function Avatar({
  name,
  imageUrl,
  size = "lg",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-primary/20 ${box}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FDF2F4] to-white font-serif font-bold text-primary ring-1 ring-primary/20 dark:bg-none dark:bg-primary dark:text-white dark:ring-white/15 ${box}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de convite                                                     */
/* ------------------------------------------------------------------ */

const SUBJECT_MAX = 120;
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;

type InviteModalProps = {
  talent: { studentId: string; fullName: string; imageUrl?: string | null };
  onClose: () => void;
};

/**
 * Convite por e-mail. O envio acontece no servidor (mutation
 * `invitations.sendInvite`): o e-mail do aluno nunca chega ao navegador
 * e o servidor reconfere `contactAllowed` (R2/LGPD).
 */
function InviteModal({ talent, onClose }: InviteModalProps) {
  const sendInvite = useMutation(api.invitations.sendInvite);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const subjectId = useId();
  const messageId = useId();
  const hintId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Foco inicial, trava de scroll do fundo e devolução do foco ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const canSend =
    !pending &&
    subject.trim().length >= 3 &&
    message.trim().length >= MESSAGE_MIN;

  const messageReady = message.trim().length >= MESSAGE_MIN;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !pending) {
      event.stopPropagation();
      onClose();
      return;
    }
    // Focus trap: Tab circula apenas dentro do diálogo.
    if (event.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], select:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  async function handleSubmit() {
    if (!canSend) return;
    setPending(true);
    try {
      await sendInvite({
        studentId: talent.studentId as Id<"students">,
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success(`Convite enviado para ${talent.fullName}.`);
      onClose();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return createPortal(
    <div
      className="ts-backdrop ts-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onKeyDown={handleKeyDown}
        className="ts-pop max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-transparent bg-white p-7 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_8px_16px_-8px_rgba(15,23,42,0.12),0_40px_80px_-24px_rgba(15,23,42,0.35)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={talent.fullName} imageUrl={talent.imageUrl} />
            <div className="min-w-0">
              <h3
                id={titleId}
                className="font-serif text-2xl font-bold leading-tight tracking-tight text-primary"
              >
                Convidar talento
              </h3>
              <p className="mt-1 truncate text-sm text-a11y-slate-500">
                Para:{" "}
                <strong className="font-semibold text-slate-800">
                  {talent.fullName}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar"
            className={`-mr-2 -mt-2 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${PRESS}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          id={hintId}
          className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-[0.8125rem] leading-relaxed text-a11y-slate-600 ring-1 ring-slate-200/70"
        >
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span>
            A mensagem é enviada ao e-mail do aluno em seu nome. O endereço dele
            não é exibido, e as respostas chegam ao seu e-mail.
          </span>
        </p>

        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={subjectId}
              className="text-sm font-medium text-slate-700"
            >
              Assunto
            </label>
            <input
              ref={firstFieldRef}
              id={subjectId}
              type="text"
              required
              maxLength={SUBJECT_MAX}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Oportunidade de estágio em desenvolvimento"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={messageId}
              className="text-sm font-medium text-slate-700"
            >
              Mensagem
            </label>
            <textarea
              id={messageId}
              required
              rows={7}
              minLength={MESSAGE_MIN}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Apresente a empresa, a vaga e o próximo passo…"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 transition-colors duration-150 placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
            <p
              className={`text-right text-xs tabular-nums transition-colors duration-150 ${
                messageReady
                  ? "font-medium text-success"
                  : "text-a11y-slate-500"
              }`}
              aria-live="polite"
            >
              {message.trim().length < MESSAGE_MIN
                ? `Mínimo de ${MESSAGE_MIN} caracteres · `
                : ""}
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!canSend}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {pending ? "Enviando…" : "Enviar convite"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Card de talento                                                      */
/* ------------------------------------------------------------------ */

type TalentCardProps = {
  talent: Talent;
  selectedSkills: string[];
  onInvite: () => void;
};

function StatusBadge({ status }: { status: "ativo" | "egresso" | "inativo" }) {
  const tone =
    status === "ativo"
      ? "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "egresso"
        ? "border-blue-600/25 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-300"
        : "border-slate-300 bg-slate-100 text-a11y-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {status === "ativo" ? "Estudante" : status === "egresso" ? "Egresso" : "Inativo"}
    </span>
  );
}

function TalentCard({ talent, selectedSkills, onInvite }: TalentCardProps) {
  // Mesma regra do servidor: igualdade sem acento e sem maiúsculas.
  const selectedFolded = new Set(selectedSkills.map(foldText));
  const isMatch = (skill: string) => selectedFolded.has(foldText(skill));
  const matchedCount = talent.skillMatches;
  const fullMatch =
    selectedSkills.length > 0 && matchedCount === selectedSkills.length;

  // Competências que batem com a busca vêm primeiro (e nunca ficam no "+N").
  const sortedSkills = [...talent.skills].sort(
    (a, b) => Number(isMatch(b)) - Number(isMatch(a)),
  );
  const visibleSkills = sortedSkills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkills = sortedSkills.slice(MAX_VISIBLE_SKILLS);

  // Medidor decorativo de aderência: até 8 segmentos, proporcional.
  const meterSegments = Math.min(selectedSkills.length, 8);
  const meterFilled =
    selectedSkills.length <= 8
      ? matchedCount
      : Math.round((matchedCount / selectedSkills.length) * meterSegments);

  return (
    <article
      className={`${SURFACE} ${CARD_HOVER} flex h-full min-w-0 flex-col p-6 [overflow-wrap:anywhere] sm:p-7`}
    >
      <div className="flex items-start gap-4">
        <Avatar name={talent.fullName} imageUrl={talent.imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words font-serif text-xl font-bold leading-snug tracking-tight text-primary">
              {talent.fullName}
            </h3>
            <span className="mt-0.5 shrink-0">
              <StatusBadge status={talent.status} />
            </span>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-sm leading-snug text-a11y-slate-600">
            <GraduationCap
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>
              {talent.course}
              {talent.semester !== null
                ? ` · ${talent.semester}º semestre`
                : ""}
              {" · "}
              {talent.graduationYear}
            </span>
          </p>
        </div>
      </div>

      {selectedSkills.length > 0 ? (
        <div className="mt-5 flex items-center gap-3">
          <p
            data-testid="skill-match"
            className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              fullMatch
                ? "border-success bg-emerald-50 text-success dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-slate-300 text-a11y-slate-600 dark:border-white/15 dark:text-slate-300"
            }`}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Combina {matchedCount} de {selectedSkills.length}{" "}
            {selectedSkills.length === 1 ? "competência" : "competências"}
          </p>
          <span
            aria-hidden="true"
            className="flex h-1.5 min-w-0 flex-1 gap-1"
          >
            {Array.from({ length: meterSegments }, (_, i) => (
              <span
                key={i}
                className={`h-full flex-1 rounded-full transition-colors duration-200 ${
                  i < meterFilled
                    ? fullMatch
                      ? "bg-success"
                      : "bg-primary"
                    : "bg-slate-200 dark:bg-white/10"
                }`}
              />
            ))}
          </span>
        </div>
      ) : null}

      {talent.headline !== null ? (
        <p className="mt-5 border-l-2 border-primary/25 pl-3.5 text-sm italic leading-relaxed text-a11y-slate-600">
          “{talent.headline}”
        </p>
      ) : null}

      {visibleSkills.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Competências">
          {visibleSkills.map((skill) => (
            <li key={skill}>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  isMatch(skill)
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-600/40 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/40"
                    : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10"
                }`}
              >
                {isMatch(skill) ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {skill}
                {isMatch(skill) ? (
                  <span className="sr-only"> (combina com a busca)</span>
                ) : null}
              </span>
            </li>
          ))}
          {hiddenSkills.length > 0 ? (
            <li>
              <span
                title={hiddenSkills.join(", ")}
                aria-label={`Mais ${hiddenSkills.length} competências: ${hiddenSkills.join(", ")}`}
                className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-a11y-slate-600 ring-1 ring-dashed ring-slate-300 dark:bg-transparent dark:text-slate-300 dark:ring-white/20"
              >
                +{hiddenSkills.length}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 text-[0.8125rem] text-a11y-slate-600">
        <ul aria-label="Disponibilidade" className="flex flex-wrap items-center gap-1.5">
          {talent.availability.map((entry) => (
            <li
              key={entry}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF2F4] px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/15"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {AVAILABILITY_LABELS[entry]}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {talent.location !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {talent.location}
            </span>
          ) : null}
          {talent.languages.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Idiomas:{" "}
              {talent.languages
                .map((l) => `${l.name} (${LEVEL_LABELS[l.level]})`)
                .join(", ")}
            </span>
          ) : null}
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            talent.contactAllowed
              ? "bg-emerald-50 text-success ring-emerald-600/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25"
              : "bg-slate-50 text-a11y-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
          }`}
        >
          {talent.contactAllowed ? (
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />  
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {talent.contactAllowed
            ? "Contato autorizado pelo aluno"
            : "Contato não autorizado"}
        </span>
      </div>

      {/* [RECRUITER_VIEW_PROFILE] "Visualizar Perfil & CV" abre a página
          dedicada (somente leitura). "Convidar" abre o modal de e-mail e só
          fica ativo se o aluno autorizou contato (R2). */}
      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5 dark:border-white/10">
          <Button
            variant="secondary"
            onClick={() => navigateTo(candidateProfilePath(talent.studentId))}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Visualizar Perfil &amp; CV
          </Button>
          <Button
            variant="primary"
            disabled={!talent.contactAllowed}
            title={
              talent.contactAllowed ? undefined : "O aluno não autorizou contato"
            }
            onClick={onInvite}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Convidar
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Esqueleto dos resultados: mesma silhueta do card, sem layout shift. */
function ResultsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid grid-cols-1 gap-5 xl:grid-cols-2"
    >
      <span className="sr-only">Buscando talentos…</span>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`${SURFACE} animate-pulse p-7 motion-reduce:animate-none`}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-2/3 rounded-full bg-slate-100" />
              <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-6 space-y-2.5">
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-4/5 rounded-full bg-slate-100" />
          </div>
          <div className="mt-6 flex gap-2">
            <div className="h-7 w-20 rounded-full bg-slate-100" />
            <div className="h-7 w-16 rounded-full bg-slate-100" />
            <div className="h-7 w-24 rounded-full bg-slate-100" />
          </div>
          <div className="mt-8 flex gap-2 border-t border-slate-100 pt-5">
            <div className="h-10 w-40 rounded-xl bg-slate-100" />
            <div className="h-10 w-28 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

/**
 * Banco de Talentos (issue [S2-3]; layout [REFACTOR_UI] Etapa 3).
 *
 * 1. Cabeçalho editorial + barra de busca larga (contagem e "Limpar");
 * 2. Duas colunas: sidebar de filtros (recolhível no mobile) + conteúdo
 *    com chips dos filtros ativos e dropdown "Ordenar por";
 * 3. Cards em grid (1 coluna até `xl`, 2 a partir de `xl`) com
 *    "Visualizar Perfil & CV" e "Convidar";
 * 4. Paginação centralizada no rodapé.
 *
 * Visual alinhado ao Painel Estratégico / Recrutadores (superfícies
 * suaves, serifada nos títulos, sans nos textos, movimento contido).
 * Atalho "/" foca a busca (sem animação: ação de teclado).
 *
 * R1 (ativo/egresso) e R2 (apenas públicos) permanecem no servidor.
 * A página volta para 0 automaticamente quando os filtros mudam
 * (`filtersKey`), sem precisar de `setPage(0)` em cada handler.
 * Lógica, queries e fluxos inalterados — mudança 100% visual.
 */
export function TalentSearchPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<"ativo" | "egresso" | "">("");
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  // Muda a cada competência adicionada: remonta o combobox (campo vazio).
  const [skillBoxKey, setSkillBoxKey] = useState(0);
  const [language, setLanguage] = useState("");
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("basico");
  const [yearFrom, setYearFrom] = useState<number | "">("");
  const [yearTo, setYearTo] = useState<number | "">("");
  const [sort, setSort] = useState<TalentSortOption>("relevancia");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<{
    studentId: string;
    fullName: string;
    imageUrl?: string | null;
  } | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atalho "/" foca a busca (ignora campos de texto e diálogos abertos).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounce nos campos de texto/número: uma query por pausa, não por tecla.
  const dSearch = useDebouncedValue(search);
  const dLocation = useDebouncedValue(location);
  const dYearFrom = useDebouncedValue(yearFrom, 500);
  const dYearTo = useDebouncedValue(yearTo, 500);

  const yearRangeInvalid =
    yearFrom !== "" && yearTo !== "" && yearFrom > yearTo;
  const queryRangeInvalid =
    dYearFrom !== "" && dYearTo !== "" && dYearFrom > dYearTo;

  // Chave dos filtros efetivos: quando muda, a página volta a 0 sozinha.
  const filtersKey = useMemo(
    () =>
      JSON.stringify([
        dSearch.trim(),
        course,
        status,
        availability,
        dLocation.trim(),
        skills,
        language,
        languageLevel,
        queryRangeInvalid ? "" : dYearFrom,
        queryRangeInvalid ? "" : dYearTo,
        sort,
      ]),
    [
      dSearch,
      course,
      status,
      availability,
      dLocation,
      skills,
      language,
      languageLevel,
      dYearFrom,
      dYearTo,
      queryRangeInvalid,
      sort,
    ],
  );
  const [pageState, setPageState] = useState({ key: "", value: 0 });
  const page = pageState.key === filtersKey ? pageState.value : 0;

  function goToPage(next: number) {
    setPageState({ key: filtersKey, value: Math.max(0, next) });
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const args: SearchArgs = useMemo(
    () => ({
      page,
      ...(dSearch.trim().length > 0 ? { search: dSearch } : {}),
      ...(course !== "" ? { course } : {}),
      ...(status !== "" ? { status } : {}),
      ...(availability.length > 0 ? { availability } : {}),
      ...(dLocation.trim().length > 0 ? { location: dLocation } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(language.trim().length > 0 ? { language, languageLevel } : {}),
      ...(!queryRangeInvalid && dYearFrom !== ""
        ? { graduationYearFrom: dYearFrom }
        : {}),
      ...(!queryRangeInvalid && dYearTo !== ""
        ? { graduationYearTo: dYearTo }
        : {}),
      ...(sort !== "relevancia" ? { sort } : {}),
    }),
    [
      page,
      dSearch,
      course,
      status,
      availability,
      dLocation,
      skills,
      language,
      languageLevel,
      dYearFrom,
      dYearTo,
      queryRangeInvalid,
      sort,
    ],
  );

  const query: SearchResult | undefined = useQuery(
    api.students.searchTalent,
    args,
  );
  // Mantém a lista anterior na tela enquanto a nova carrega (sem piscar).
  const { data: result, stale } = useStableQuery(query);

  function clearAll() {
    setSearch("");
    setCourse("");
    setStatus("");
    setAvailability([]);  
    setLocation("");
    setSkills([]);
    setLanguage("");
    setLanguageLevel("basico");
    setYearFrom("");
    setYearTo("");
  }

  function addSkill(term: string) {
    const value = term.trim();
    if (value.length === 0) return;
    setSkills((current) =>
      current.some((s) => s.toLowerCase() === value.toLowerCase())
        ? current
        : [...current, value],
    );
    // Remonta o combobox: campo vazio e lista fechada após cada escolha.
    setSkillBoxKey((key) => key + 1);
  }

  // Filtro de competências: as já selecionadas (chips) saem das opções.
  const availableSkillGroups = SKILLS_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter(
      (item) =>
        !skills.some((skill) => skill.toLowerCase() === item.toLowerCase()),
    ),
  })).filter((group) => group.items.length > 0);

  // Chips dos filtros ativos (as competências têm chips próprios na sidebar).
  const activeChips: { key: string; label: string; onRemove: () => void }[] =
    [];
  if (search.trim().length > 0) {
    activeChips.push({
      key: "search",
      label: `Busca: ${search.trim()}`,
      onRemove: () => setSearch(""),
    });
  }
  if (course !== "") {
    activeChips.push({
      key: "course",
      label: `Curso: ${course}`,
      onRemove: () => setCourse(""),
    });
  }
  if (status !== "") {
    activeChips.push({
      key: "status",
      label: `Formação: ${STATUS_LABELS[status]}`,
      onRemove: () => setStatus(""),
    });
  }
  if (availability.length > 0) {
    activeChips.push({
      key: "availability",
      label: `Disponibilidade: ${availability.map((a) => AVAILABILITY_LABELS[a]).join(", ")}`,
      onRemove: () => setAvailability([]),
    });
  }
  if (location.trim().length > 0) {
    activeChips.push({
      key: "location",
      label: `Cidade/UF: ${location.trim()}`,
      onRemove: () => setLocation(""),
    });
  }
  if (language.trim().length > 0) {
    activeChips.push({
      key: "language",
      label: `Idioma: ${language} (${LEVEL_LABELS[languageLevel]} ou mais)`,
      onRemove: () => {
        setLanguage("");
        setLanguageLevel("basico");
      },
    });
  }
  if (yearFrom !== "" || yearTo !== "") {
    activeChips.push({
      key: "years",
      label: `Conclusão: ${yearFrom === "" ? "…" : yearFrom}–${yearTo === "" ? "…" : yearTo}`,
      onRemove: () => {
        setYearFrom("");
        setYearTo("");
      },
    });
  }

  const hasAnyFilter = activeChips.length > 0 || skills.length > 0;
  const activeFilterCount = activeChips.length + skills.length;
  const activeLabels = [
    ...activeChips.map((chip) => chip.label),
    ...(skills.length > 0 ? [`Competências: ${skills.join(", ")}`] : []),
  ];

  return (
    // [S8-2]: região nomeada em vez de <main> aninhado (o main da página é
    // único, no App — WCAG 1.3.1). Layout full-width (REFACTOR_UI Etapa 2).
    <div
      role="region"
      aria-label="Busca de talentos"
      className="px-6 pb-16 pt-8"
    >
      <style>{MOTION_CSS}</style>

      {/* 1 — Cabeçalho editorial. */}
      <header className="mb-8 max-w-2xl">
        <h2 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
          Banco de Talentos
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Encontre estudantes e egressos por competências, idiomas,
          disponibilidade e previsão de conclusão.
        </p>
      </header>

      {/* Barra de busca larga + contagem + limpar. */}
      <div className={`${SURFACE} relative z-20 mb-8 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex-1">
            <SuperSearch
              id="talent-search"
              ariaLabel="Buscar talentos por nome, curso, competência ou cidade"
              placeholder="Buscar por nome, curso, competência (ex.: React), cidade ou idioma…"
              value={search}
              onChange={setSearch}
              inputRef={searchInputRef}
              sources={[
                {
                  id: "skill",
                  label: "Competências",
                  icon: Sparkles,
                  items: availableSkillGroups.flatMap((g) =>
                    g.items.map((i) => ({ value: i, label: i })),
                  ),
                },
                {
                  id: "course",
                  label: "Cursos",
                  icon: GraduationCap,
                  items: COURSES.map((c) => ({ value: c, label: c })),
                },
                {
                  id: "language",
                  label: "Idiomas",
                  icon: Languages,
                  items: KNOWN_LANGUAGES.map((l) => ({ value: l, label: l })),
                },
                {
                  id: "availability",
                  label: "Disponibilidade",
                  icon: Clock,
                  items: AVAILABILITY.map((a) => ({
                    value: a,
                    label: AVAILABILITY_LABELS[a],
                  })),
                },
                {
                  id: "status",
                  label: "Formação",
                  icon: Users,
                  items: [
                    { value: "ativo", label: STATUS_LABELS.ativo },
                    { value: "egresso", label: STATUS_LABELS.egresso },
                  ],
                },
              ]}
              actions={[
                {
                  id: "city",
                  icon: MapPin,
                  label: (q) => `Filtrar por cidade: “${q}”`,
                  run: (q) => setLocation(q),
                },
              ]}
              onPick={(source, value) => {
                if (source === "skill") addSkill(value);
                else if (source === "course") setCourse(value);
                else if (source === "language") setLanguage(value);
                else if (source === "status") setStatus(value as "ativo" | "egresso");
                else if (source === "availability")
                  setAvailability((cur) =>
                    cur.includes(value as Availability)
                      ? cur
                      : [...cur, value as Availability],
                  );
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-5 lg:justify-end">
            <p
              className="flex items-baseline gap-1.5 text-sm text-a11y-slate-600"
              aria-live="polite"
            >
              <strong className="font-serif text-xl font-bold leading-none tracking-tight tabular-nums text-primary">
                {result === undefined ? "…" : result.total}
              </strong>{" "}
              <span className="font-medium">Estudantes Disponíveis</span>
            </p>
            <Button
              variant="secondary"
              onClick={clearAll}
              disabled={!hasAnyFilter}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: botão que abre/fecha a sidebar de filtros. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
        aria-controls="talent-filters"
        className={`mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden ${PRESS}`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>

      {/* 2 — Duas colunas: sidebar de filtros + conteúdo. */}
      <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
        <form
          id="talent-filters"
          aria-label="Filtros do Banco de Talentos"
          className={`${SURFACE} ${
            filtersOpen ? "ts-pop flex" : "hidden"
          } flex-col gap-6 p-6 lg:flex`}
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-serif text-xl font-bold tracking-tight text-slate-900">
              Refinar busca
            </p>
            {activeFilterCount > 0 ? (
              <span
                aria-hidden="true"
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-white"
              >
                {activeFilterCount}
              </span>
            ) : null}
          </div>
          
          <div className="border-t border-slate-100 pt-2">
            <fieldset className="flex min-w-0 flex-col gap-4">
              <legend className={LEGEND_CLASS}>
                <span className={LEGEND_ICON_CLASS}>
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                </span>
                Área &amp; Curso
              </legend>
              <CustomSelect
                label="Curso"
                value={course}
                onChange={setCourse}
                placeholder="Todos os cursos"
                options={[
                  { value: "", label: "Todos os cursos" },
                  ...COURSES.map((name) => ({ value: name, label: name })),
                ]}
              />
              <CustomSelect
                label="Formação"
                value={status}
                onChange={(v) => setStatus(v as "ativo" | "egresso" | "")}
                placeholder="Todas"
                options={[
                  { value: "", label: "Todas" },
                  { value: "ativo", label: "Alunos ativos" },
                  { value: "egresso", label: "Egressos" },
                ]}
              />
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Disponibilidade</span>
                <div role="group" aria-label="Disponibilidade" className="flex flex-wrap gap-1.5">
                  {AVAILABILITY.map((value) => {
                    const selected = availability.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setAvailability((cur) =>
                            selected ? cur.filter((v) => v !== value) : [...cur, value],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${PRESS} ${
                          selected
                            ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                            : "border-slate-300 bg-white text-a11y-slate-600 hover:border-primary hover:text-primary"
                        }`}
                      >
                        {AVAILABILITY_LABELS[value]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Cidade/UF</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex.: Recife/PE"
                  className={INPUT_CLASS}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>Idioma</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <Combobox
                      ariaLabel="Idioma"
                      groups={[{ label: "Idiomas", items: KNOWN_LANGUAGES }]}
                      value={language}
                      onSelect={setLanguage}
                      placeholder="Ex.: Inglês"
                    />
                  </div>
                  <CustomSelect
                    label=""
                    className="min-w-0"
                    value={languageLevel}
                    onChange={(v) => setLanguageLevel(v as LanguageLevel)}
                    placeholder="Nível mínimo do idioma"
                    options={LANGUAGE_LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-2">
              <legend className={LEGEND_CLASS}>
                <span className={LEGEND_ICON_CLASS}>
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                Previsão de Conclusão
              </legend>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={yearFrom}
                  onChange={(e) => {
                    const value = e.target.value;
                    setYearFrom(value === "" ? "" : Number(value));
                  }}
                  placeholder="De"
                  aria-label="Conclusão a partir de"
                  aria-invalid={yearRangeInvalid}
                  className={`${INPUT_CLASS} tabular-nums aria-[invalid=true]:border-danger`}
                />
                <span aria-hidden="true" className="text-slate-400">
                  –
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={yearTo}
                  onChange={(e) => {
                    const value = e.target.value;
                    setYearTo(value === "" ? "" : Number(value));
                  }}
                  placeholder="Até"
                  aria-label="Conclusão até"
                  aria-invalid={yearRangeInvalid}
                  className={`${INPUT_CLASS} tabular-nums aria-[invalid=true]:border-danger`}
                />
              </div>
              {yearRangeInvalid ? (
                <p role="alert" className="text-xs font-medium text-danger">
                  O ano inicial é maior que o final — o intervalo não está sendo
                  aplicado.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {GRADUATION_YEARS.map((year) => {
                  const selected = yearFrom === year && yearTo === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        // Clicar de novo no ano selecionado desmarca.
                        setYearFrom(selected ? "" : year);
                        setYearTo(selected ? "" : year);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${PRESS} ${
                        selected
                          ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                          : "border-slate-300 bg-white text-a11y-slate-600 hover:border-primary hover:text-primary"
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-1">
              <legend className={LEGEND_CLASS}>
                <span className={LEGEND_ICON_CLASS}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                Competências
              </legend>
              {/* [DICIONARIO_FECHADO] combobox pesquisável sem texto livre:
                  a lista só aparece ao digitar (openOnFocus=false) e o termo
                  entra ao ser escolhido, já virando chip. */}
              <Combobox
                key={skillBoxKey}
                ariaLabel="Nova competência"
                groups={availableSkillGroups}
                value=""
                onSelect={addSkill}
                openOnFocus={false}
                autoConfirmExact={false}
                placeholder="Digite para buscar (ex.: Next, React)…"
              />
              <p className="text-xs leading-relaxed text-a11y-slate-500">
                Quem tiver mais das competências escolhidas aparece primeiro.
              </p>
              {skills.length > 0 ? (
                <ul
                  className="flex flex-wrap gap-2"
                  aria-label="Competências selecionadas"
                >
                  {skills.map((chip) => (
                    <li key={chip} className="max-w-full">
                      <button
                        type="button"
                        onClick={() =>
                          setSkills((current) => current.filter((c) => c !== chip))
                        }
                        aria-label={`Remover competência ${chip}`}
                        className={`${CHIP_REMOVE_CLASS} ${PRESS}`}
                      >
                        {/* E aqui também! */}
                        <span className="truncate flex-1 text-left min-w-0">{chip}</span>
                        <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </button> 
                    </li>
                  ))}
                </ul>
              ) : null}
            </fieldset>
          </div>

        </form>

        {/* Conteúdo principal — chips, ordenação e grid de cards. */}
        <div ref={listTopRef} className="min-w-0 scroll-mt-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {activeChips.length > 0 ? (
              <ul
                data-testid="active-filter-chips"
                aria-label="Filtros ativos"
                className="flex min-w-0 flex-1 flex-wrap gap-2"
              >
                {activeChips.map((chip) => (
                  <li key={chip.key} className="max-w-full">
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`Remover filtro ${chip.label}`}
                      className={`${CHIP_REMOVE_CLASS} ${PRESS}`}
                    >
                      {/* O segredo está aqui: flex-1 e min-w-0 forçam o truncate a funcionar */}
                      <span className="truncate flex-1 text-left min-w-0">{chip.label}</span>
                      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-a11y-slate-600">
                <ArrowUpDown
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                Ordenar por
              </span>
              <CustomSelect
                label=""
                className="w-56"
                value={sort}
                onChange={(v) => setSort(v as TalentSortOption)}
                placeholder="Mais relevantes"
                options={(Object.keys(SORT_LABELS) as TalentSortOption[]).map((k) => ({
                  value: k,
                  label: SORT_LABELS[k],
                }))}
              />
            </div>
          </div>

          {result === undefined ? (
            <ResultsSkeleton />
          ) : result.items.length === 0 ? (
            /* CORREÇÃO AQUI: Fundo transparente escuro e borda suave no dark mode */
            <div
              role="status"
              className="ts-rise rounded-3xl border border-dashed border-slate-300 bg-white/60 dark:border-white/10 dark:bg-white/5 px-6 py-16 text-center"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FDF2F4] text-primary ring-1 ring-primary/15 dark:bg-primary/20 dark:ring-primary/40">
                <SearchX className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="mx-auto mt-5 max-w-md font-serif text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {hasAnyFilter
                  ? "Nenhum talento encontrado com os filtros atuais."
                  : "Nenhum talento disponível no momento."}
              </p>
              {hasAnyFilter ? (
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-a11y-slate-500 dark:text-slate-400 break-all line-clamp-3">
                  Tente remover algum dos filtros ativos:{" "}
                  {activeLabels.join(" · ")}.
                </p>
              ) : null}
              {hasAnyFilter ? (
                <Button variant="secondary" className="mt-6" onClick={clearAll}>
                  <FilterX className="h-4 w-4" aria-hidden="true" />
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <div
              aria-busy={stale}
              className={`transition-opacity duration-200 ease-out ${
                stale ? "opacity-60" : "opacity-100"
              }`}
            >
              <ul
                className="grid grid-cols-1 gap-5 xl:grid-cols-2"
                aria-label="Talentos encontrados"
              >
                {result.items.map((talent, index) => (
                  <li
                    key={talent.studentId}
                    className="ts-rise"
                    style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
                  >
                    <TalentCard
                      talent={talent}
                      selectedSkills={skills}
                      onInvite={() =>
                        setInviteTarget({
                          studentId: talent.studentId,
                          fullName: talent.fullName,
                          imageUrl: talent.imageUrl,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>

              {/* 4 — Rodapé: paginação centralizada. */}
              <nav
                className="mt-10 flex justify-center"
                aria-label="Paginação de resultados"
              >
                <div
                  className={`${SURFACE} flex flex-wrap items-center justify-center gap-x-5 gap-y-2 p-2`}
                >
                  <Button
                    variant="secondary"
                    disabled={!result.hasPrev || stale}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Anterior
                  </Button>
                  <p className="px-1 text-sm tabular-nums text-a11y-slate-600">
                    Página {result.page + 1} de {result.pageCount} ·{" "}
                    {result.page * TALENT_PAGE_SIZE + 1}–
                    {result.page * TALENT_PAGE_SIZE + result.items.length} de{" "}
                    {result.total}
                  </p>
                  <Button
                    variant="secondary"
                    disabled={!result.hasNext || stale}
                    onClick={() => goToPage(page + 1)}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </div>

      {inviteTarget !== null ? (
        <InviteModal
          talent={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      ) : null}
    </div>
  );
}