import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Combobox } from "../../ui/Combobox";
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
  Search,
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
  availability?: Availability;
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

const SELECT_CLASS =
  "w-full appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke-width=%222%22%20stroke=%22%2394a3b8%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[size:1.25em_1.25em] h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition-colors placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

const FIELD_LABEL_CLASS = "text-xs font-medium text-a11y-slate-500";

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

/* ------------------------------------------------------------------ */
/* Modal de convite                                                     */
/* ------------------------------------------------------------------ */

const SUBJECT_MAX = 120;
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;

type InviteModalProps = {
  talent: { studentId: string; fullName: string };
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
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
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-level3"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="font-serif text-lg font-bold text-primary"
            >
              Convidar talento
            </h3>
            <p className="mt-0.5 truncate text-sm text-a11y-slate-500">
              Para: <strong className="text-slate-800">{talent.fullName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          id={hintId}
          className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-a11y-slate-500"
        >
          A mensagem é enviada ao e-mail do aluno em seu nome. O endereço dele
          não é exibido, e as respostas chegam ao seu e-mail.
        </p>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={subjectId} className={FIELD_LABEL_CLASS}>
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

          <div className="flex flex-col gap-1">
            <label htmlFor={messageId} className={FIELD_LABEL_CLASS}>
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
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
            <p
              className="text-right text-xs text-a11y-slate-500"
              aria-live="polite"
            >
              {message.trim().length < MESSAGE_MIN
                ? `Mínimo de ${MESSAGE_MIN} caracteres · `
                : ""}
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>

          <div className="flex justify-end gap-2">
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

function TalentCard({ talent, selectedSkills, onInvite }: TalentCardProps) {
  // Mesma regra do servidor: igualdade sem acento e sem maiúsculas.
  const selectedFolded = new Set(selectedSkills.map(foldText));
  const isMatch = (skill: string) => selectedFolded.has(foldText(skill));
  const matchedCount = talent.skillMatches;

  // Competências que batem com a busca vêm primeiro (e nunca ficam no "+N").
  const sortedSkills = [...talent.skills].sort(
    (a, b) => Number(isMatch(b)) - Number(isMatch(a)),
  );
  const visibleSkills = sortedSkills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkills = sortedSkills.slice(MAX_VISIBLE_SKILLS);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-level1 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-level2">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] font-serif text-base font-bold text-primary ring-1 ring-primary/20"
        >
          {initialsOf(talent.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 break-words font-serif text-lg font-bold text-primary">
              {talent.fullName}
            </h3>
            {talent.status === "ativo" ? (
              <Badge variant="andamento">Ativo</Badge>
            ) : talent.status === "egresso" ? (
              <Badge variant="aprovado">Egresso</Badge>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-a11y-slate-600">
                Inativo
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-a11y-slate-600">
            {talent.course}
            {talent.semester !== null ? ` · ${talent.semester}º semestre` : ""}
            {" · "}
            {talent.graduationYear}
          </p>
        </div>
      </div>

      {selectedSkills.length > 0 ? (
        <p
          data-testid="skill-match"
          className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            matchedCount === selectedSkills.length
              ? "border-success text-success"
              : "border-slate-300 text-a11y-slate-600"
          }`}
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Combina {matchedCount} de {selectedSkills.length}{" "}
          {selectedSkills.length === 1 ? "competência" : "competências"}
        </p>
      ) : null}

      {talent.headline !== null ? (
        <p className="mt-2 text-sm italic text-a11y-slate-500">
          “{talent.headline}”
        </p>
      ) : null}
      <p className="mt-2 line-clamp-2 text-sm text-a11y-slate-600">
        {talent.summary}
      </p>

      {visibleSkills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Competências">
          {visibleSkills.map((skill) => (
            <li key={skill}>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  isMatch(skill)
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-primary bg-[#FDF2F4] text-primary"
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
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-a11y-slate-600"
              >
                +{hiddenSkills.length}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="mb-1 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-a11y-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {talent.availability
            .map((entry) => AVAILABILITY_LABELS[entry])
            .join(" · ")}
        </span>
        {talent.location !== null ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {talent.location}
          </span>
        ) : null}
        <span
          className={`inline-flex items-center gap-1 ${
            talent.contactAllowed ? "font-semibold text-success" : ""
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
      </p>

      {talent.languages.length > 0 ? (
        <p className="mb-4 mt-1 flex items-center gap-1 text-xs text-a11y-slate-600">
          <Languages className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Idiomas:{" "}
          {talent.languages
            .map((l) => `${l.name} (${LEVEL_LABELS[l.level]})`)
            .join(", ")}
        </p>
      ) : null}

      {/* [RECRUITER_VIEW_PROFILE] "Visualizar Perfil & CV" abre a página
          dedicada (somente leitura). "Convidar" abre o modal de e-mail e só
          fica ativo se o aluno autorizou contato (R2). */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
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
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

/**
 * Banco de Talentos (issue [S2-3]; layout [REFACTOR_UI] Etapa 3).
 *
 * 1. Barra de busca superior larga (contagem e botão "Limpar");
 * 2. Duas colunas: sidebar de filtros (recolhível no mobile) + conteúdo
 *    com chips dos filtros ativos e dropdown "Ordenar por";
 * 3. Cards em grid de 2 colunas ("Visualizar Perfil & CV" e "Convidar");
 * 4. Paginação centralizada no rodapé.
 *
 * R1 (ativo/egresso) e R2 (apenas públicos) permanecem no servidor.
 * A página volta para 0 automaticamente quando os filtros mudam
 * (`filtersKey`), sem precisar de `setPage(0)` em cada handler.
 */
export function TalentSearchPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<"ativo" | "egresso" | "">("");
  const [availability, setAvailability] = useState<Availability | "">("");
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
  } | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

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
      ...(availability !== "" ? { availability } : {}),
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
    setAvailability("");
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
  if (availability !== "") {
    activeChips.push({
      key: "availability",
      label: `Disponibilidade: ${AVAILABILITY_LABELS[availability]}`,
      onRemove: () => setAvailability(""),
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
    <div role="region" aria-label="Busca de talentos" className="px-6 py-8">
      {/* 1 — Barra de busca superior larga. */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary">
          Banco de Talentos
        </h2>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-level1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <label htmlFor="talent-search" className="sr-only">
              Buscar talentos por nome, curso, competência ou cidade
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="talent-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, curso, competência (ex.: React), cidade ou idioma…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 transition-colors placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p
              className="flex items-center gap-1.5 text-sm text-a11y-slate-600"
              aria-live="polite"
            >
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-slate-900">
                  {result === undefined ? "…" : result.total}
                </strong>{" "}
                Estudantes Disponíveis
              </span>
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
        className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>

      {/* 2 — Duas colunas: sidebar de filtros + conteúdo. */}
      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        <form
          id="talent-filters"
          aria-label="Filtros do Banco de Talentos"
          className={`${
            filtersOpen ? "flex" : "hidden"
          } flex-col gap-6 self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-level1 lg:flex`}
          onSubmit={(e) => e.preventDefault()}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="flex items-center gap-2 pb-3 text-sm font-semibold text-slate-700">
              <GraduationCap
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              Área &amp; Curso
            </legend>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>Curso</span>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Todos os cursos</option>
                {COURSES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>Formação</span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "ativo" | "egresso" | "")
                }
                className={SELECT_CLASS}
              >
                <option value="">Todas</option>
                <option value="ativo">Alunos ativos</option>
                <option value="egresso">Egressos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>Disponibilidade</span>
              <select
                value={availability}
                onChange={(e) =>
                  setAvailability(e.target.value as Availability | "")
                }
                className={SELECT_CLASS}
              >
                <option value="">Todas</option>
                {AVAILABILITY.map((value) => (
                  <option key={value} value={value}>
                    {AVAILABILITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>Cidade/UF</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex.: Recife/PE"
                className={INPUT_CLASS}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLASS}>Idioma</span>
              <div className="flex gap-2">
                <Combobox
                  ariaLabel="Idioma"
                  groups={[{ label: "Idiomas", items: KNOWN_LANGUAGES }]}
                  value={language}
                  onSelect={setLanguage}
                  placeholder="Ex.: Inglês"
                />
                <select
                  value={languageLevel}
                  onChange={(e) =>
                    setLanguageLevel(e.target.value as LanguageLevel)
                  }
                  aria-label="Nível mínimo do idioma"
                  className={SELECT_CLASS}
                >
                  {LANGUAGE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="flex items-center gap-2 pb-3 text-sm font-semibold text-slate-700">
              <CalendarDays
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
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
                className={INPUT_CLASS}
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
                className={INPUT_CLASS}
              />
            </div>
            {yearRangeInvalid ? (
              <p role="alert" className="text-xs font-medium text-danger">
                O ano inicial é maior que o final — o intervalo não está sendo
                aplicado.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1">
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
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
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

          <fieldset className="flex flex-col gap-2">
            <legend className="flex items-center gap-2 pb-3 text-sm font-semibold text-slate-700">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
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
            <p className="text-xs text-a11y-slate-500">
              Quem tiver mais das competências escolhidas aparece primeiro.
            </p>
            {skills.length > 0 ? (
              <ul
                className="flex flex-wrap gap-2"
                aria-label="Competências selecionadas"
              >
                {skills.map((chip) => (
                  <li key={chip}>
                    <button
                      type="button"
                      onClick={() =>
                        setSkills((current) => current.filter((c) => c !== chip))
                      }
                      aria-label={`Remover competência ${chip}`}
                      className="inline-flex items-center gap-1 rounded-full border border-primary bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {chip}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>
        </form>

        {/* Conteúdo principal — chips, ordenação e grid de cards. */}
        <div ref={listTopRef} className="min-w-0 scroll-mt-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      <span className="truncate">{chip.label}</span>
                      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor="talent-sort"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-a11y-slate-600"
              >
                <ArrowUpDown
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                Ordenar por
              </label>
              <select
                id="talent-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as TalentSortOption)}
                className={`${SELECT_CLASS} !w-auto`}
              >
                {(Object.keys(SORT_LABELS) as TalentSortOption[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {result === undefined ? (
            <p
              className="text-sm text-a11y-slate-500"
              role="status"
              aria-live="polite"
            >
              Buscando talentos…
            </p>
          ) : result.items.length === 0 ? (
            /* [UX-P3] H4-2 — empty state explica e oferece o próximo passo. */
            <div
              role="status"
              className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center"
            >
              <SearchX
                className="mx-auto h-10 w-10 text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {hasAnyFilter
                  ? "Nenhum talento encontrado com os filtros atuais."
                  : "Nenhum talento disponível no momento."}
              </p>
              {hasAnyFilter ? (
                <p className="mt-1 text-xs text-a11y-slate-500">
                  Tente remover algum dos filtros ativos:{" "}
                  {activeLabels.join(" · ")}.
                </p>
              ) : null}
              {hasAnyFilter ? (
                <Button variant="secondary" className="mt-3" onClick={clearAll}>
                  <FilterX className="h-4 w-4" aria-hidden="true" />
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <div
              aria-busy={stale}
              className={`transition-opacity duration-200 ${
                stale ? "opacity-60" : "opacity-100"
              }`}
            >
              <ul
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                aria-label="Talentos encontrados"
              >
                {result.items.map((talent) => (
                  <li key={talent.studentId}>
                    <TalentCard
                      talent={talent}
                      selectedSkills={skills}
                      onInvite={() =>
                        setInviteTarget({
                          studentId: talent.studentId,
                          fullName: talent.fullName,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>

              {/* 4 — Rodapé: paginação centralizada. */}
              <nav
                className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
                aria-label="Paginação de resultados"
              >
                <Button
                  variant="secondary"
                  disabled={!result.hasPrev || stale}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>
                <p className="text-sm text-a11y-slate-600">
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