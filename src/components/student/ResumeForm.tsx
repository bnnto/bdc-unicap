mport {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Combobox, type ComboboxGroup } from "../ui/Combobox";
import {
  MAX_ACADEMIC,
  MAX_CERTIFICATE_BYTES,
  MAX_CERTIFICATIONS,
  MAX_EXPERIENCES,
  PROJECTS_TEXT_MAX,
  SUMMARY_MAX,
  SUMMARY_MIN,
  normalizeCertifications,
  validateResumeData,
  type AcademicEntry,
} from "../../lib/resume";
import {
  AVAILABILITY,
  ENROLLMENT_STATUS,
  isValidUrl,
  validateStudentProfile,
  type Availability,
  type EnrollmentStatus,
} from "../../lib/studentProfile";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  MAX_LANGUAGES,
  MAX_SKILLS,
  SKILLS_GROUPS,
  addSkill,
  removeSkill,
  validateLanguages,
  type LanguageEntry,
} from "../../lib/skills";
import { ResumeBlockContent } from "./ResumeView";
import { CertificateViewer } from "./CertificateViewer";
import {
  BLOCK_LABELS,
  BLOCO_IDS,
  LEVEL_LABELS,
  type ResumeBlockData,
} from "./resumeBlocks";
import {
  AlertTriangle,
  Award,
  Briefcase,
  Check,
  Code,
  GraduationCap,
  Languages,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { CustomSelect } from "../ui/CustomSelect";

/* ==========================================================================
   Tokens de design e movimento
   --------------------------------------------------------------------------
   Mesma linguagem da ProfilePage (SURFACE, curvas e ritmo do SKILL.md):
   - ease-out forte  → entradas e feedback  (0.23, 1, 0.32, 1)
   - ease-drawer     → morfismos de estado  (0.32, 0.72, 0, 1)
   - ease-in-out     → movimento na tela    (0.77, 0, 0.175, 1)
   Tudo que é transição de estado usa CSS transition (interrompível);
   entradas pontuais usam WAAPI (roda fora da main thread).
   ========================================================================== */

/** Distância do topo para os elementos sticky (abaixo da navbar do portal). */
const STICKY_TOP = "top-24";

const SURFACE_BASE =
  "rounded-3xl border border-transparent bg-white transition-shadow duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const SURFACE = `${SURFACE_BASE} shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]`;

/** Bloco em edição: anel bordô + sombra tingida — "este é o foco agora". */
const SURFACE_EDITING = `${SURFACE_BASE} shadow-[0_0_0_2px_#6b1426,0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-20px_rgba(107,20,38,0.35)] dark:shadow-[0_0_0_2px_#e9b8c3]`;

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/** Pressionável: feedback imediato no :active, retorno suave. */
const PRESS = `transition-[background-color,border-color,color,box-shadow,transform,scale] duration-[450ms] ${EASE_OUT} active:scale-[0.97] active:duration-100 motion-reduce:[transition-property:background-color,border-color,color,opacity] motion-reduce:active:scale-100`;

const NAV_INDICATOR =
  "transition-[transform,width,height] duration-[450ms] ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none";

/** Campo de texto/textarea/select — alinhado ao raio e foco do design system. */
const FIELD = `w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-[border-color,box-shadow] duration-[300ms] ${EASE_OUT} hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`;

/** Cartão de item repetível (histórico, experiência, idioma, certificação). */
const ITEM =
  "rounded-2xl bg-slate-50 p-5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]";

/** Cross-fade de ícones (lápis ⇄ X): opacidade + rotação + blur leve. */
const SWAP = `absolute inset-0 h-4 w-4 transition-[opacity,transform,rotate,scale,filter] duration-[450ms] ${EASE_OUT} motion-reduce:[transition-property:opacity]`;

const BLOCK_DESCRIPTIONS = [
  "Seus dados pessoais e sua apresentação profissional",
  "Dados acadêmicos do cadastro e seu histórico",
  "Todos os links são editados aqui: LinkedIn, portfólio, GitHub e Lattes",
  "As mesmas competências usadas no matching com vagas",
  "Contam para o bônus de idioma do matching quando a vaga exige",
  "Experiências em cards e projetos de extensão em um único campo",
  "Cursos, certificados e atividades que reforçam seu perfil",
];

/** [UI_OVERHAUL] Ícone contextual de cada bloco do currículo. */
const BLOCK_ICONS: LucideIcon[] = [
  User, // 0 · Dados Pessoais
  GraduationCap, // 1 · Formação
  Link2, // 2 · Links
  Code, // 3 · Competências
  Languages, // 4 · Idiomas
  Briefcase, // 5 · Experiências
  Award, // 6 · Certificações
];

// [UX COMBOBOX] Competências e idiomas usam o Combobox pesquisável de
// `../ui/Combobox` — dicionário com centenas de termos não cabe num select
// nativo. O nível de idioma mantém o <select> nativo (teclado e leitor de
// tela de graça), agora com chevron próprio.

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ativo: "Aluno ativo",
  egresso: "Egresso (formado)",
  inativo: "Inativo",
};

const AVAILABILITY_LABELS: Record<Availability, string> = {
  estagio: "Estágio",
  integral: "Integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

type ExperienceDraft = {
  company: string;
  role: string;
  period: string;
  description: string;
};

type AcademicDraft = {
  item: string;
  year: string;
};

/**
 * [CERT_PDF] Rascunho de certificação: nome + PDF opcional. `key` é um id
 * estável de UI (o upload é assíncrono e não pode depender do índice);
 * `url` serve só para pré-visualizar o PDF já anexado.
 */
type CertificationDraft = {
  key: string;
  name: string;
  storageId?: Id<"_storage">;
  url?: string | null;
};

let certificationSeq = 0;
function nextCertificationKey(): string {
  certificationSeq += 1;
  return `cert-${certificationSeq}`;
}

function toCertificationDrafts(
  items:
    | ReadonlyArray<{
        name: string;
        storageId?: Id<"_storage">;
        url?: string | null;
      }>
    | undefined,
): CertificationDraft[] {
  return (items ?? []).map((item) => ({
    key: nextCertificationKey(),
    name: item.name,
    storageId: item.storageId,
    url: item.url ?? null,
  }));
}

const EMPTY_EXPERIENCE: ExperienceDraft = {
  company: "",
  role: "",
  period: "",
  description: "",
};

const EMPTY_ACADEMIC: AcademicDraft = { item: "", year: "" };

/* ==========================================================================
   Primitivos de movimento
   ========================================================================== */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Entrada pontual (WAAPI): opacidade + subida curta + escala a partir de
 * 0.985 (nunca scale(0)). `fill: backwards` segura o estado inicial durante
 * o delay. Reduced motion → só um fade curto (gentil, não zero).
 */
type EnterProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  delay?: number;
  y?: number;
};

function Enter({ as: Tag = "div", delay = 0, y = 10, ...rest }: EnterProps) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || typeof el.animate !== "function") return;
    const reduce = prefersReducedMotion();
    const animation = el.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${y}px) scale(0.985)` },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
      {
        duration: reduce ? 150 : 560,
        delay: reduce ? 0 : delay,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "backwards",
      },
    );
    return () => animation.cancel();
    // Só na montagem: reordenar a lista não deve reanimar os irmãos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Tag ref={ref} {...rest} />;
}

/** Valor que "assenta" no próximo frame — permite animar de 0 → valor na montagem. */
function useSettled<T>(value: T, initial: T): T {
  const [shown, setShown] = useState<T>(initial);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return shown;
}

function scrollToBlock(index: number): void {
  const el = document.getElementById(`bloco-${BLOCO_IDS[index]}`);
  if (el === null) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

/* ==========================================================================
   Componentes de apresentação
   ========================================================================== */

/** Anel de progresso: o traço corre de 0 até o valor ao montar e a cada mudança. */
function ProgressRing({
  percent,
  complete,
}: {
  percent: number;
  complete: boolean;
}) {
  const size = 112;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useSettled(percent, 0);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Currículo ${percent}% preenchido`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? "#c89d3c" : "#ffffff"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          className={`transition-[stroke-dashoffset,stroke] duration-[3300ms] ${EASE} motion-reduce:transition-none`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <Enter
            key="done"
            y={4}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c89d3c] text-[#241703]"
          >
            <Check className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          </Enter>
        ) : (
          <span className="font-serif text-3xl font-bold tabular-nums tracking-tight text-white">
            {percent}
            <span className="text-lg font-semibold text-white/70">%</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Hero({
  flags,
  firstName,
  hasProfile,
  editingLabel,
  onContinue,
  onGoToEditing,
}: {
  flags: boolean[];
  firstName: string;
  hasProfile: boolean;
  editingLabel: string | null;
  onContinue: () => void;
  onGoToEditing: () => void;
}) {
  const total = flags.length;
  const doneCount = flags.filter(Boolean).length;
  const percent = Math.round((doneCount / total) * 100);
  const complete = doneCount === total;
  const nextIndex = flags.findIndex((flag) => !flag);
  const nextLabel =
    nextIndex >= 0 ? (BLOCK_LABELS[nextIndex]?.label ?? "") : "";

  const flagsKey = flags.map((flag) => (flag ? "1" : "0")).join("");
  const shownKey = useSettled(flagsKey, "0".repeat(total));

  let title = "Vamos montar seu currículo";
  let subtitle =
    "Comece pelos seus dados pessoais — o restante abre em seguida.";
  if (complete) {
    title = firstName.length > 0 ? `Tudo pronto, ${firstName}` : "Tudo pronto";
    subtitle = "Seu currículo está completo e visível para os recrutadores.";
  } else if (hasProfile) {
    title = firstName.length > 0 ? `Olá, ${firstName}` : "Seu currículo";
    subtitle = `${doneCount} de ${total} blocos preenchidos. Falta pouco para um perfil completo.`;
  }

  return (
    <section
      aria-label="Resumo do preenchimento do currículo"
      className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#4f0d1c,#6b1426_45%,#8f2238)] p-6 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_24px_48px_-24px_rgba(79,13,28,0.55)] sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(200,157,60,0.32),transparent)]"
      />
      <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
        <ProgressRing percent={percent} complete={complete} />

        <div className="min-w-0 flex-1">
          <p className="mt-1 break-words font-serif text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
            {title}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
            {subtitle}
          </p>

          {/* Segmentos: um por bloco, preenchem em cascata ao montar. */}
          <ol className="mt-5 flex max-w-md gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <li
                key={i}
                style={{ transitionDelay: `${i * 100}ms` }}
                className={`h-1.5 flex-1 rounded-full transition-[background-color] duration-[700ms] ${EASE_OUT} motion-reduce:transition-none ${
                  shownKey[i] === "1" ? "bg-[#c89d3c]" : "bg-white/20"
                }`}
              />
            ))}
          </ol>
        </div>

        <div className="shrink-0">
          {editingLabel !== null ? (
            <button
              type="button"
              onClick={onGoToEditing}
              className={`inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c89d3c] ${PRESS}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editando {editingLabel}
            </button>
          ) : complete ? (
            <Enter
              y={4}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25"
            >
              <Sparkles className="h-4 w-4 text-[#e6c98a]" aria-hidden="true" />
              Currículo completo
            </Enter>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#ffffff] px-5 text-sm font-semibold text-[#6b1426] shadow-sm hover:bg-[#fdf2f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c89d3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#6b1426] ${PRESS}`}
            >
              {hasProfile ? `Continuar em ${nextLabel}` : "Preencher dados pessoais"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusPill({ done }: { done: boolean }) {
  return (
    <Enter
      as="span"
      key={done ? "done" : "todo"}
      y={3}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        done ? "bg-success/10 text-success" : "bg-slate-100 text-slate-600"
      }`}
    >
      {done ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : null}
      {done ? "Preenchido" : "Pendente"}
    </Enter>
  );
}

/** Grupo de campos com legenda — fieldset semântico, divisor opcional. */
function Group({
  title,
  hint,
  divider = false,
  children,
}: {
  title: string;
  hint?: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={`min-w-0 ${
        divider ? "border-t border-slate-100 pt-8" : ""
      }`}
    >
      <legend className="text-sm font-semibold text-slate-900">{title}</legend>
      {hint !== undefined ? (
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

/** Pílula de escolha (rádio ou checkbox nativos — teclado e leitor de tela). */
function ChoicePill({
  type,
  name,
  value,
  checked,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="group relative cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`inline-flex select-none items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 group-active:scale-[0.97] ${PRESS} ${
          checked
            ? "border-primary bg-[#FDF2F4] text-primary"
            : "border-slate-300 bg-white text-slate-700 hover:border-primary"
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-[18px] w-[18px] shrink-0 place-items-center border transition-[background-color,border-color] duration-[300ms] ${EASE_OUT} ${
            type === "radio" ? "rounded-full" : "rounded-[6px]"
          } ${checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}
        >
          <Check
            className={`h-3 w-3 transition-[opacity,transform,scale] duration-[300ms] ${EASE_OUT} ${
              checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
            strokeWidth={3.5}
          />
        </span>
        {children}
      </span>
    </label>
  );
}

/** Medidor de caracteres: a barra cresce com `scaleX` (só transform). */
function CharMeter({
  id,
  count,
  max,
  min,
}: {
  id?: string;
  count: number;
  max: number;
  min?: number;
}) {
  const ratio = Math.min(count / max, 1);
  const enough = min === undefined || count >= min;
  return (
    <div id={id} aria-live="polite" className="mt-2 flex items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          style={{ transform: `scaleX(${ratio})` }}
          className={`h-full origin-left rounded-full transition-[transform,background-color] duration-[450ms] ${EASE_OUT} motion-reduce:transition-none ${
            enough ? "bg-success" : "bg-secondary"
          }`}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-slate-500">
        {count}/{max} caracteres
        {min !== undefined ? ` (mínimo ${min})` : ""}
      </span>
    </div>
  );
}

/** Rótulo padrão de campo próprio (textarea) — igual ao do <Input>. */
function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
      {children}
      {required ? (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-[#f87171] ${PRESS}`}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** "Adicionar…" — tile tracejado; o + gira 90° ao passar o mouse (só com mouse). */
function AddTile({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-600 hover:border-primary hover:bg-[#FDF2F4] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${PRESS}`}
    >
      <Plus
        className={`h-4 w-4 transition-[transform,rotate] duration-[450ms] ${EASE_OUT} [@media(hover:hover)]:group-hover:rotate-90`}
        aria-hidden="true"
      />
      {children}
    </button>
  );
}

/** Cartão de item repetível com cabeçalho e botão de remover. */
function ItemCard({
  label,
  removeLabel,
  onRemove,
  delay = 0,
  children,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <Enter delay={delay} className={ITEM}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <RemoveButton label={removeLabel} onClick={onRemove} />
      </div>
      {children}
    </Enter>
  );
}

/**
 * [CERT_PDF] Linha de anexo do certificado: anexar, visualizar, substituir
 * e remover o PDF. Input de arquivo nativo (teclado e leitor de tela) dentro
 * de um <label> estilizado como botão.
 */
function CertificateFileRow({
  hasFile,
  url,
  uploading,
  disabled,
  onPick,
  onView,
  onRemoveFile,
}: {
  hasFile: boolean;
  url: string | null | undefined;
  uploading: boolean;
  disabled: boolean;
  onPick: (file: File) => void;
  onView: () => void;
  onRemoveFile: () => void;
}) {
  const action = `inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${PRESS}`;
  const picker = (label: string, tone: string) => (
    <label
      className={`${action} ${tone} ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) onPick(file);
        }}
      />
      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </label>
  );

  return (
    <div className="mt-4 border-t border-slate-200/70 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {uploading ? (
          <span
            role="status"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-100 px-3.5 text-xs font-semibold text-slate-600"
          >
            <Loader2
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-pulse"
              aria-hidden="true"
            />
            Enviando PDF…
          </span>
        ) : hasFile ? (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-success/10 px-3.5 text-xs font-semibold text-success">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              PDF anexado
            </span>
            {url ? (
              <button
                type="button"
                onClick={onView}
                className={`${action} bg-primary/10 text-primary dark:text-[#e9b8c3] [@media(hover:hover)]:hover:bg-primary [@media(hover:hover)]:hover:text-white`}
              >
                Visualizar
              </button>
            ) : null}
            {picker(
              "Substituir",
              "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] dark:bg-white/5 dark:text-slate-200 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] [@media(hover:hover)]:hover:bg-slate-100 dark:[@media(hover:hover)]:hover:bg-white/10",
            )}
            <button
              type="button"
              onClick={onRemoveFile}
              className={`${action} text-slate-600 dark:text-slate-300 [@media(hover:hover)]:hover:bg-danger/10 [@media(hover:hover)]:hover:text-danger dark:[@media(hover:hover)]:hover:text-[#f87171]`}
            >
              Remover PDF
            </button>
          </>
        ) : (
          picker(
            "Anexar PDF (opcional)",
            "bg-white text-primary shadow-[inset_0_0_0_1px_rgba(107,20,38,0.25)] dark:bg-white/5 dark:text-[#e9b8c3] dark:shadow-[inset_0_0_0_1px_rgba(233,184,195,0.35)] [@media(hover:hover)]:hover:bg-[#FDF2F4] dark:[@media(hover:hover)]:hover:bg-[#e9b8c3]/10",
          )
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        PDF de até 5MB. O recrutador poderá abrir o certificado para conferir
        a autenticidade.
      </p>
    </div>
  );
}

/** Aviso de descarte: alertdialog modal, foco preso, Esc = continuar editando. */
function DiscardDialog({
  from,
  to,
  onKeep,
  onDiscard,
}: {
  from: string;
  to: string | null;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Entrada: o fundo escurece e o painel sobe de scale(0.96). Modal fica centralizado.
  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const options = (duration: number): KeyframeAnimationOptions => ({
      duration,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "backwards",
    });
    const a = backdropRef.current?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      options(reduce ? 120 : 320),
    );
    const b = panelRef.current?.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "scale(0.96) translateY(6px)" },
            { opacity: 1, transform: "none" },
          ],
      options(reduce ? 120 : 440),
    );
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, []);

  // A opção segura (continuar editando) recebe o foco.
  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onKeep();
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = panelRef.current?.querySelectorAll<HTMLElement>("button");
      if (!buttons || buttons.length === 0) return;
      const first = buttons[0]!;
      const last = buttons[buttons.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        ref={backdropRef}
        aria-hidden="true"
        onClick={onKeep}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        aria-describedby="discard-desc"
        className={`${SURFACE} relative w-full max-w-md p-6 sm:p-7`}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning"
        >
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2
          id="discard-title"
          className="mt-4 font-serif text-xl font-bold tracking-tight text-slate-900"
        >
          Descartar alterações?
        </h2>
        <p
          id="discard-desc"
          className="mt-2 text-sm leading-relaxed text-slate-600"
        >
          Você está editando “{from}” e as alterações ainda não foram salvas.{" "}
          {to !== null
            ? `Se abrir “${to}” agora, tudo o que você mudou será perdido.`
            : "Se fechar agora, tudo o que você mudou será perdido."}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className={`inline-flex h-11 items-center justify-center rounded-xl bg-danger/10 px-5 text-sm font-semibold text-danger hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 dark:hover:text-white ${PRESS}`}
          >
            {to !== null ? "Descartar e trocar" : "Descartar e fechar"}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            className={`inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${PRESS}`}
          >
            Continuar editando
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Carregando currículo…</span>
      <div className="h-48 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />
      <div className="h-14 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 120}ms` }}
          className="h-40 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/* ==========================================================================
   ResumeForm
   ========================================================================== */

/**
 * Currículo Vitae (issue [S2-1] + REFATOR_ALUNO Etapa 2) — os 7 blocos do
 * construtor em um único formulário, com EDIÇÃO INLINE por bloco:
 *
 *  - Cada bloco nasce em modo de VISUALIZAÇÃO com um botão "Editar"
 *    (`aria-label="Editar <Bloco>"`), no canto superior direito.
 *  - Ao clicar, os campos desse bloco tornam-se editáveis no próprio local;
 *    o bloco volta à visualização ao Salvar ou Cancelar.
 *  - Salvar persiste via `students.saveResumeData` e
 *    `students.saveSkillsAndLanguages`; erro de servidor vira Toast global
 *    e o rascunho permanece em edição.
 *  - Validação de campo continua inline — painel "Corrija os pontos abaixo".
 *
 * [ONBOARDING_RECOVERY] Conta nova: o Bloco 1 NASCE ABERTO e grava via
 * `students.upsertProfile`. Nenhum bloco é bloqueado — os demais orientam
 * para o Bloco 1 enquanto o perfil não existe.
 *
 * [UI_REDESIGN] Camada visual refeita (lógica intacta):
 *  - Hero com anel de progresso e próximo passo sugerido.
 *  - Navegação sticky com indicador deslizante + scroll-spy.
 *  - Blocos em superfície, ring bordô no bloco em edição, barra de ações
 *    translúcida fixa ao rodapé, foco devolvido ao botão ao fechar.
 *  - Movimento: entradas pontuais em cascata curta, transições (não
 *    keyframes) nos estados, feedback no :active, reduced-motion respeitado.
 */
export function ResumeForm() {
  // [CERT_PDF] Sem anotação de tipo: o retorno de `myProfile` agora traz as
  // certificações já normalizadas ({ name, storageId?, url }).
  const profile = useQuery(api.students.myProfile, {});
  const upsertProfile = useMutation(api.students.upsertProfile);
  const saveResume = useMutation(api.students.saveResumeData);
  const saveSkills = useMutation(api.students.saveSkillsAndLanguages);
  const saveContactLinks = useMutation(api.students.saveContactLinks);
  const generateCertificateUploadUrl = useMutation(
    api.students.generateCertificateUploadUrl,
  );
  const confirmCertificateUpload = useMutation(
    api.students.confirmCertificateUpload,
  );
  const discardCertificateUpload = useMutation(
    api.students.discardCertificateUpload,
  );

  // Valores atuais do formulário (prefilled do CV salvo).
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [academicHistory, setAcademicHistory] = useState<AcademicDraft[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [lattesUrl, setLattesUrl] = useState("");
  // [FINAL_UPGRADE Etapa 1.3] — LinkedIn e Portfólio editáveis no Bloco 3
  // (antes só do cadastro de perfil; agora salvos via saveContactLinks).
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [projectsText, setProjectsText] = useState("");
  const [certifications, setCertifications] = useState<CertificationDraft[]>(
    [],
  );
  // [CERT_PDF] Upload em andamento (key da certificação), PDF aberto no
  // visualizador e PDFs enviados nesta edição que ainda não foram salvos
  // (descartados do Storage se o aluno cancelar, trocar ou remover).
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [viewerCert, setViewerCert] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const newUploadsRef = useRef<Set<Id<"_storage">>>(new Set());

  // [ONBOARDING_RECOVERY] Dados pessoais do Bloco 1 (upsert do perfil).
  const [fullName, setFullName] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus>("ativo");
  const [course, setCourse] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [semester, setSemester] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [availability, setAvailability] = useState<Availability[]>(["estagio"]);

  // Estados de controle do modo inline.
  const [errors, setErrors] = useState<string[]>([]);
  const [editingBlock, setEditingBlock] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  // Aviso de descarte: bloco para o qual o usuário tentou ir ("close" = fechar).
  const [pendingTarget, setPendingTarget] = useState<number | "close" | null>(
    null,
  );

  // "Sujo" = o rascunho atual difere do que estava na tela ao abrir o bloco.
  const draftKey = JSON.stringify([
    headline, summary, experiences, academicHistory, githubUrl, lattesUrl,
    linkedinUrl, portfolioUrl, skills, languages, projectsText,
    certifications.map((c) => [c.name, c.storageId ?? null]),
    fullName, enrollment, status, course, graduationYear, semester, location,
    phone, availability,
  ]);
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;
  const baselineRef = useRef(draftKey);
  useEffect(() => {
    baselineRef.current = draftKeyRef.current;
  }, [editingBlock]);
  const isDirty = editingBlock !== null && draftKey !== baselineRef.current;

  // ---- UI: navegação, foco e scroll ----
  const ready = profile !== undefined;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const scrollLock = useRef(0);
  const navListRef = useRef<HTMLUListElement>(null);
  const navItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const toggleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);
  const [indicator, setIndicator] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [snap, setSnap] = useState(false); // true = reposiciona sem animar

  // Pré-preenche com o CV salvo (edição idempotente).
  useEffect(() => {
    if (profile !== undefined && profile !== null) {
      const resume = profile.resumeData;
      if (resume !== undefined) {
        setHeadline(resume.headline);
        setSummary(resume.summary);
        setExperiences(
          resume.experiences.map((e) => ({
            company: e.company,
            role: e.role,
            period: e.period,
            description: e.description,
          })),
        );
        setAcademicHistory(
          resume.academicHistory.map((a) => ({
            item: a.item,
            year: String(a.year),
          })),
        );
        setGithubUrl(resume.links?.github ?? "");
        setLattesUrl(resume.links?.lattes ?? "");
        setProjectsText(resume.projectsText ?? "");
        setCertifications(toCertificationDrafts(resume.certifications));
      }
      setLinkedinUrl(profile.linkedinUrl ?? "");
      setPortfolioUrl(profile.portfolioUrl ?? "");
      setSkills(profile.skills ?? []);
      setLanguages(profile.languages ?? []);
      // [ONBOARDING_RECOVERY] dados pessoais do Bloco 1 (upsert idempotente).
      setFullName(profile.fullName);
      setEnrollment(profile.enrollment);
      setStatus(profile.status);
      setCourse(profile.course);
      setGraduationYear(String(profile.graduationYear));
      setSemester(
        profile.semester !== undefined && profile.semester !== null
          ? String(profile.semester)
          : "",
      );
      setLocation(profile.location ?? "");
      setPhone(profile.phone ?? "");
      setAvailability(profile.availability);
    }
  }, [profile]);

  /**
   * [ONBOARDING_RECOVERY] Conta nova (perfil ainda sem registro): o Bloco 1
   * nasce em modo de EDIÇÃO, com os dados pessoais prontos para preencher.
   * Só abre uma vez — cancelar enquanto o perfil continua nulo não reabre.
   */
  useEffect(() => {
    if (profile === null) {
      setEditingBlock((current) => current ?? 0);
    }
  }, [profile]);

  // ---- Indicador deslizante da navegação ----
  const measureIndicator = useCallback(() => {
    const el = navItemRefs.current[activeRef.current];
    if (!el) return;
    setIndicator({
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    });
  }, []);

  // Mede antes do paint: o indicador já nasce no lugar certo.
  useLayoutEffect(() => {
    activeRef.current = active;
    measureIndicator();
  }, [active, ready, measureIndicator]);

  // Mudou o layout (breakpoint, rotação): reposiciona sem "voar" pela tela.
  useEffect(() => {
    const list = navListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      setSnap(true);
      measureIndicator();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setSnap(false)),
      );
    });
    observer.observe(list);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [measureIndicator, ready]);

  // Em telas estreitas a faixa rola: mantém o item ativo centralizado.
  useEffect(() => {
    const list = navListRef.current;
    const el = navItemRefs.current[active];
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({
      left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  // Scroll-spy: o bloco que ocupa o topo da área de leitura vira o ativo.
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.block);
          if (entry.isIntersecting) visible.add(index);
          else visible.delete(index);
        }
        // Durante o scroll suave de um clique, ignora os blocos do caminho.
        if (Date.now() < scrollLock.current || visible.size === 0) return;
        setActive(Math.min(...Array.from(visible)));
      },
      { rootMargin: "-190px 0px -45% 0px" },
    );
    for (const block of BLOCK_LABELS) {
      const el = document.getElementById(`bloco-${BLOCO_IDS[block.index]}`);
      if (el !== null) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ready]);

  // Ao abrir um bloco por ação do usuário, o foco vai ao primeiro campo.
  useEffect(() => {
    if (editingBlock === null || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const section = document.getElementById(
      `bloco-${BLOCO_IDS[editingBlock]}`,
    );
    section
      ?.querySelector<HTMLElement>(
        '[data-edit-panel] input:not([type="radio"]):not([type="checkbox"]):not([role="combobox"]), [data-edit-panel] textarea',
      )
      ?.focus({ preventScroll: true });
  }, [editingBlock]);

  // Erros de validação entram na tela: o painel rola até ficar visível.
  useEffect(() => {
    if (errors.length === 0) return;
    errorRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }, [errors]);

  function updateExperience(
    index: number,
    key: keyof ExperienceDraft,
    value: string,
  ) {
    setExperiences((list) =>
      list.map((exp, i) => (i === index ? { ...exp, [key]: value } : exp)),
    );
  }

  function updateAcademic(
    index: number,
    key: keyof AcademicDraft,
    value: string,
  ) {
    setAcademicHistory((list) =>
      list.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry,
      ),
    );
  }

  function addSkillDraft() {
    if (skillDraft.trim().length === 0) return;
    setSkills((list) => addSkill(list, skillDraft));
    setSkillDraft("");
  }

  /** Grupos do combobox de competências (já escolhidas saem da lista). */
  function skillGroupsForCombobox(): ComboboxGroup[] {
    return SKILLS_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.filter(
        (item) =>
          !skills.some((skill) => skill.toLowerCase() === item.toLowerCase()),
      ),
    })).filter((group) => group.items.length > 0);
  }

  /** Opções de idioma da linha — sem os idiomas de outras linhas. */
  function languageGroupsForCombobox(index: number): ComboboxGroup[] {
    return [
      {
        label: "Idiomas",
        items: KNOWN_LANGUAGES.filter(
          (known) =>
            !languages.some(
              (other, i) =>
                i !== index && other.name.toLowerCase() === known.toLowerCase(),
            ),
        ),
      },
    ];
  }

  function addLanguage() {
    if (languages.length >= MAX_LANGUAGES) return;
    setLanguages((list) => [...list, { name: "", level: "basico" }]);
  }

  function updateLanguage(
    index: number,
    key: keyof LanguageEntry,
    value: string,
  ) {
    setLanguages((list) =>
      list.map((language, i) =>
        i === index
          ? {
              ...language,
              [key]:
                key === "level" ? (value as LanguageEntry["level"]) : value,
            }
          : language,
      ),
    );
  }

  /** Devolve o foco ao botão do bloco que acabou de fechar. */
  function restoreFocus(block: number | null): void {
    if (block === null) return;
    requestAnimationFrame(() =>
      toggleRefs.current[block]?.focus({ preventScroll: true }),
    );
  }

  /**
   * Validação e persistência compartilhados por "Salvar" de bloco e submit.
   *
   * [ONBOARDING_RECOVERY] O Bloco 1 valida os dados pessoais com a mesma
   * regra pura do servidor e grava via `students.upsertProfile` (UPsert —
   * cria o perfil da conta nova ou atualiza o existente). A apresentação
   * (headline/resumo) só é exigida quando já existe currículo salvo, para
   * a conta nova salvar de primeira, sem bloqueios.
   */
  async function persist(): Promise<void> {
    // Histórico: ano vazio ou inválido vira erro de formulário antes do
    // servidor (mensagens claras, CA 2).
    const academic: AcademicEntry[] = [];
    for (const [i, entry] of academicHistory.entries()) {
      const year = Number.parseInt(entry.year, 10);
      if (!Number.isFinite(year)) {
        setErrors([`Histórico ${i + 1}: informe o ano (número).`]);
        return;
      }
      academic.push({ item: entry.item, year });
    }

    // Idiomas: mesma validação do servidor (mensagens antes do envio).
    const languagesCheck = validateLanguages(languages);
    if (!languagesCheck.ok) {
      setErrors(languagesCheck.errors);
      return;
    }

    // [ONBOARDING_RECOVERY] Dados pessoais do Bloco 1 (regra pura unificada).
    let profileCheck: ReturnType<typeof validateStudentProfile> | null = null;
    if (editingBlock === 0) {
      const semesterRaw = semester.trim();
      const semesterValue =
        semesterRaw.length > 0 ? Number.parseInt(semesterRaw, 10) : undefined;
      if (semesterRaw.length > 0 && !Number.isFinite(semesterValue)) {
        setErrors(["Semestre deve ser um número."]);
        return;
      }
      profileCheck = validateStudentProfile({
        fullName,
        enrollment,
        status,
        course,
        graduationYear: Number.parseInt(graduationYear, 10),
        semester: semesterValue,
        location,
        phone,
        availability,
      });
      if (!profileCheck.ok) {
        setErrors(profileCheck.errors);
        return;
      }
    }

    // Apresentação: exigida se já houver CV salvo; opcional na criação do
    // perfil (conta nova preenche só os dados pessoais e já sai salva).
    const hasPresentation =
      headline.trim().length > 0 || summary.trim().length > 0;
    const mustSaveResume = hasPresentation || profile?.resumeData !== undefined;
    let validation: ReturnType<typeof validateResumeData> | null = null;
    if (mustSaveResume) {
      validation = validateResumeData({
        headline,
        summary,
        experiences,
        academicHistory: academic,
        links: { github: githubUrl, lattes: lattesUrl },
        projectsText,
        certifications: certifications.map((c) => ({
          name: c.name,
          storageId: c.storageId,
        })),
      });
      if (!validation.ok) {
        setErrors(validation.errors);
        return;
      }
    }

    // [FINAL_UPGRADE Etapa 1.3] — URLs do Bloco 3 validadas antes do
    // servidor (mensagem clara junto dos campos, CA 2).
    if (editingBlock === 2) {
      const linkErrors: string[] = [];
      if (!isValidUrl(linkedinUrl)) {
        linkErrors.push("URL do LinkedIn deve usar https://.");
      }
      if (!isValidUrl(portfolioUrl)) {
        linkErrors.push("URL de GitHub/Portfólio deve usar https://.");
      }
      if (linkErrors.length > 0) {
        setErrors(linkErrors);
        return;
      }
    }

    setPending(true);
    try {
      let createdProfile = false;
      // [ONBOARDING_RECOVERY] Bloco 1 → UPsert do perfil (cria ou atualiza)
      // junto de skills/idiomas — mesma mutation do cadastro, sem etapa extra.
      if (editingBlock === 0 && profileCheck !== null && profileCheck.ok) {
        const result = await upsertProfile({
          ...profileCheck.normalized,
          skills,
          languages,
        });
        createdProfile = result.created;
      }
      if (validation !== null && validation.ok) {
        // [CERT_PDF] A regra pura usa `storageId` como string; a mutation
        // espera `Id<"_storage">` (o servidor revalida tipo e tamanho).
        const { certifications: normalizedCerts, ...resumeRest } =
          validation.normalized;
        await saveResume({
          ...resumeRest,
          certifications: normalizeCertifications(normalizedCerts).map(
            (entry) =>
              entry.storageId !== undefined
                ? {
                    name: entry.name,
                    storageId: entry.storageId as Id<"_storage">,
                  }
                : { name: entry.name },
          ),
        });
        // Salvo: os PDFs enviados nesta edição passam a fazer parte do CV
        // (o servidor apaga os que saíram) — nada mais a descartar.
        newUploadsRef.current.clear();
      }
      if (editingBlock !== 0) {
        await saveSkills({ skills, languages });
      }
      // [FINAL_UPGRADE Etapa 1.3] — links do perfil salvos ao editar o
      // Bloco 3 (mesma regra https validada no servidor também).
      if (editingBlock === 2) {
        await saveContactLinks({
          linkedinUrl: linkedinUrl.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
        });
      }
      // Sucesso: o bloco volta à visualização (Etapa 2 — inline edit).
      const closing = editingBlock;
      setEditingBlock(null);
      setErrors([]);
      restoreFocus(closing);
      toast.success(
        createdProfile
          ? "Perfil criado com sucesso. Continue preenchendo o currículo."
          : "Currículo salvo com sucesso.",
      );
    } catch (err) {
      // [UX_REFINEMENT] erro de servidor vira Toast amigável, nunca um
      // bloco cru no formulário.
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function startEdit(block: number): void {
    focusOnOpen.current = true;
    // [ONBOARDING_RECOVERY] Sem perfil, os demais blocos dependem do Bloco 1:
    // em vez de erro do servidor ("perfil não encontrado"), o próprio
    // formulário abre o Bloco 1 — o utilizador nunca sai da página.
    if (profile === null && block !== 0) {
      toast.info(
        "Preencha seus dados pessoais no Bloco 1 para liberar os demais blocos.",
      );
      if (editingBlock !== 0) resetToProfile();
      setErrors([]);
      setEditingBlock(0);
      return;
    }
    // Se outro bloco estava sendo editado, o rascunho é descartado.
    if (editingBlock !== null && editingBlock !== block) {
      resetToProfile();
    }
    setErrors([]);
    setEditingBlock(block);
  }

  function cancelEdit(): void {
    const closing = editingBlock;
    resetToProfile();
    setErrors([]);
    setEditingBlock(null);
    restoreFocus(closing);
  }

  /**
   * [FINAL_UPGRADE Etapa 1.2] — o botão é LIGA/DESLIGA: clicar nele com o
   * bloco já em edição fecha a edição (equivale a Cancelar).
   */
  function toggleEdit(block: number): void {
    if (editingBlock === block) {
      if (isDirty) setPendingTarget("close");
      else cancelEdit();
      return;
    }
    // Conta nova: os outros blocos só redirecionam ao Bloco 1 (sem descarte).
    if (editingBlock !== null && isDirty && profile !== null) {
      setPendingTarget(block);
      return;
    }
    startEdit(block);
  }

  function confirmDiscard(): void {
    const target = pendingTarget;
    setPendingTarget(null);
    if (target === "close") cancelEdit();
    else if (target !== null) startEdit(target);
  }

  function keepEditing(): void {
    const target = pendingTarget;
    setPendingTarget(null);
    restoreFocus(typeof target === "number" ? target : editingBlock);
  }

  /**
   * [CERT_PDF] Apaga do Storage um PDF enviado nesta edição e ainda não
   * salvo. PDFs já salvos no CV nunca passam por aqui (o servidor também
   * recusa apagá-los); falha silenciosa — é só limpeza.
   */
  function releaseUpload(storageId: Id<"_storage"> | undefined): void {
    if (storageId === undefined || !newUploadsRef.current.has(storageId)) {
      return;
    }
    newUploadsRef.current.delete(storageId);
    void discardCertificateUpload({ storageId }).catch(() => undefined);
  }

  function updateCertificationName(key: string, name: string): void {
    setCertifications((list) =>
      list.map((c) => (c.key === key ? { ...c, name } : c)),
    );
  }

  function removeCertification(key: string): void {
    const target = certifications.find((c) => c.key === key);
    releaseUpload(target?.storageId);
    setCertifications((list) => list.filter((c) => c.key !== key));
  }

  /** Remove só o PDF, mantendo o nome da certificação. */
  function removeCertificateFile(key: string): void {
    const target = certifications.find((c) => c.key === key);
    releaseUpload(target?.storageId);
    setCertifications((list) =>
      list.map((c) =>
        c.key === key ? { ...c, storageId: undefined, url: null } : c,
      ),
    );
  }

  /** Upload: URL do Storage → POST → confirmação validada no servidor. */
  async function attachCertificateFile(
    key: string,
    file: File,
  ): Promise<void> {
    const isPdfName = file.name.toLowerCase().endsWith(".pdf");
    if (file.type !== "application/pdf" && !isPdfName) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > MAX_CERTIFICATE_BYTES) {
      toast.error("O PDF deve ter no máximo 5MB.");
      return;
    }
    // Assinatura do arquivo: todo PDF começa com "%PDF-".
    if ((await file.slice(0, 5).text()) !== "%PDF-") {
      toast.error("O arquivo não parece ser um PDF válido.");
      return;
    }
    setUploadingKey(key);
    try {
      const postUrl = await generateCertificateUploadUrl();
      const response = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!response.ok) {
        throw new Error("Falha no envio do arquivo. Tente de novo.");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      const result = await confirmCertificateUpload({ storageId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      newUploadsRef.current.add(result.storageId);
      // Trocou o PDF: o anterior (se era desta edição) vai embora.
      const previous = certifications.find((c) => c.key === key);
      releaseUpload(previous?.storageId);
      setCertifications((list) =>
        list.map((c) =>
          c.key === key
            ? { ...c, storageId: result.storageId, url: result.url }
            : c,
        ),
      );
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setUploadingKey(null);
    }
  }

  function resetToProfile(): void {
    // [CERT_PDF] PDFs enviados e não salvos não ficam órfãos no Storage.
    for (const storageId of Array.from(newUploadsRef.current)) {
      releaseUpload(storageId);
    }
    const resume = profile?.resumeData;
    if (resume !== undefined) {
      setHeadline(resume.headline);
      setSummary(resume.summary);
      setExperiences(
        resume.experiences.map((e) => ({
          company: e.company,
          role: e.role,
          period: e.period,
          description: e.description,
        })),
      );
      setAcademicHistory(
        resume.academicHistory.map((a) => ({
          item: a.item,
          year: String(a.year),
        })),
      );
      setGithubUrl(resume.links?.github ?? "");
      setLattesUrl(resume.links?.lattes ?? "");
      setProjectsText(resume.projectsText ?? "");
      setCertifications(toCertificationDrafts(resume.certifications));
    } else {
      setHeadline("");
      setSummary("");
      setExperiences([]);
      setAcademicHistory([]);
      setGithubUrl("");
      setLattesUrl("");
      setProjectsText("");
      setCertifications([]);
    }
    setLinkedinUrl(profile?.linkedinUrl ?? "");
    setPortfolioUrl(profile?.portfolioUrl ?? "");
    setSkills(profile?.skills ?? []);
    setLanguages(profile?.languages ?? []);
    // [ONBOARDING_RECOVERY] dados pessoais voltam ao estado salvo.
    setFullName(profile?.fullName ?? "");
    setEnrollment(profile?.enrollment ?? "");
    setStatus(profile?.status ?? "ativo");
    setCourse(profile?.course ?? "");
    setGraduationYear(
      profile?.graduationYear !== undefined
        ? String(profile.graduationYear)
        : "",
    );
    setSemester(
      profile?.semester !== undefined && profile?.semester !== null
        ? String(profile.semester)
        : "",
    );
    setLocation(profile?.location ?? "");
    setPhone(profile?.phone ?? "");
    setAvailability(profile?.availability ?? ["estagio"]);
    setErrors([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // Se um bloco está em edição, os dados são persistidos pelo bloco
    // atual (a visualização é retomada no sucesso). O submit antigo
    // (botão global "Salvar currículo") ficou sem uso.
    if (editingBlock !== null) {
      void persist();
    }
  }

  /** Navegação: rola até o bloco e marca o item já no clique. */
  function jumpTo(index: number): void {
    setActive(index);
    scrollLock.current = Date.now() + 900;
    scrollToBlock(index);
  }

  if (profile === undefined) {
    return <LoadingSkeleton />;
  }

  /**
   * [RECRUITER_VIEW_PROFILE] Os blocos em modo VISUALIZAÇÃO usam o
   * componente compartilhado `ResumeBlockContent` (o mesmo que renderiza
   * o currículo somente-leitura da página do candidato) — um único
   * design de visualização para o portal do aluno e para o recrutador.
   */
  const viewData: ResumeBlockData = {
    course: profile?.course ?? "",
    headline,
    summary,
    academicHistory,
    linkedinUrl: profile?.linkedinUrl ?? "",
    portfolioUrl: profile?.portfolioUrl ?? "",
    githubUrl,
    lattesUrl,
    skills,
    languages,
    experiences,
    projectsText,
    certifications: certifications.map((c) => ({ name: c.name, url: c.url })),
  };

  // Preenchimento por bloco — alimenta hero, navegação e selos de status.
  const flags: boolean[] = [
    fullName.trim().length > 0 &&
      headline.trim().length > 0 &&
      summary.trim().length > 0,
    academicHistory.some((entry) => entry.item.trim().length > 0),
    [linkedinUrl, portfolioUrl, githubUrl, lattesUrl].some(
      (url) => url.trim().length > 0,
    ),
    skills.length > 0,
    languages.some((language) => language.name.trim().length > 0),
    experiences.some((exp) => exp.company.trim().length > 0) ||
      projectsText.trim().length > 0,
    certifications.some((item) => item.name.trim().length > 0),
  ];
  const nextIndex = flags.findIndex((flag) => !flag);
  const firstName = (profile?.fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const editingLabel =
    editingBlock !== null ? (BLOCK_LABELS[editingBlock]?.label ?? null) : null;

  function continueFlow(): void {
    const target = profile === null || nextIndex < 0 ? 0 : nextIndex;
    jumpTo(target);
    startEdit(target);
  }

  return (
    <div className="flex flex-col gap-6">
      <Enter>
        <Hero
          flags={flags}
          firstName={firstName}
          hasProfile={profile !== null}
          editingLabel={editingLabel}
          onContinue={continueFlow}
          onGoToEditing={() => {
            if (editingBlock !== null) jumpTo(editingBlock);
          }}
        />
      </Enter>

      {/* Navegação: material translúcido fixo sob a navbar; o conteúdo rola
          por baixo. O indicador desliza entre os itens (ease-in-out). */}
      <Enter delay={100} className={`sticky ${STICKY_TOP} z-20`}>
        <nav
          aria-label="Blocos do currículo"
          className="rounded-2xl bg-white/85 p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[#171b22]/85 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
        >
          <ul
            ref={navListRef}
            className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {indicator !== null ? (
              <li
                aria-hidden="true"
                role="presentation"
                className={`pointer-events-none absolute left-0 top-0 rounded-xl bg-[#FDF2F4] shadow-[inset_0_0_0_1px_rgba(107,20,38,0.12)] ${NAV_INDICATOR} ${
                  snap ? "!transition-none" : ""
                }`}
                style={{
                  width: indicator.w,
                  height: indicator.h,
                  transform: `translate(${indicator.x}px, ${indicator.y}px)`,
                }}
              />
            ) : null}
            {BLOCK_LABELS.map((block) => {
              const Icon = BLOCK_ICONS[block.index]!;
              const isActive = active === block.index;
              const isDone = flags[block.index] === true;
              return (
                <li key={block.index} className="shrink-0 xl:flex-1">
                  <button
                    ref={(node) => {
                      navItemRefs.current[block.index] = node;
                    }}
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => jumpTo(block.index)}
                    className={`relative flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-[color,background-color,transform,scale] duration-[450ms] ${EASE_OUT} active:scale-[0.97] active:duration-100 motion-reduce:[transition-property:color,background-color] motion-reduce:active:scale-100 ${
                      isActive
                        ? "text-primary"
                        : "text-slate-600 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {block.label}
                    {/* Espaço sempre reservado: o selo entra sem empurrar o menu. */}
                    <span
                      aria-hidden="true"
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success text-white transition-[opacity,transform,scale] duration-[450ms] ${EASE_OUT} ${
                        isDone ? "scale-100 opacity-100" : "scale-75 opacity-0"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    {isDone ? <span className="sr-only">(preenchido)</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </Enter>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
        aria-label="Formulário de currículo vitae"
      >
        {BLOCK_LABELS.map((block) => {
          const isEditing = editingBlock === block.index;
          const Icon = BLOCK_ICONS[block.index]!;
          return (
            <Enter
              as="section"
              key={block.index}
              delay={200 + block.index * 90}
              id={`bloco-${BLOCO_IDS[block.index]}`}
              data-block={block.index}
              className={`scroll-mt-44 p-6 sm:p-8 ${
                isEditing ? SURFACE_EDITING : SURFACE
              }`}
            >
              {/* Cabeçalho do bloco: ícone, título, status e botão de edição. */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    aria-hidden="true"
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color] duration-[600ms] ${EASE} ${
                      isEditing
                        ? "bg-primary text-white"
                        : "bg-[#FDF2F4] text-primary"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="font-serif text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                        {block.index + 1}. {block.heading}
                      </h2>
                      <StatusPill done={flags[block.index] === true} />
                    </div>
                    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
                      {BLOCK_DESCRIPTIONS[block.index]}
                    </p>
                  </div>
                </div>
                <button
                  ref={(node) => {
                    toggleRefs.current[block.index] = node;
                  }}
                  type="button"
                  onClick={() => toggleEdit(block.index)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4 ${PRESS} ${
                    isEditing
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                  }`}
                  aria-label={
                    isEditing
                      ? `Fechar edição de ${block.label}`
                      : `Editar ${block.label}`
                  }
                  aria-pressed={isEditing}
                  title={
                    isEditing
                      ? `Fechar edição de ${block.label}`
                      : `Editar ${block.label}`
                  }
                >
                  <span className="relative h-4 w-4" aria-hidden="true">
                    <Pencil
                      className={`${SWAP} ${
                        isEditing
                          ? "-rotate-90 scale-75 opacity-0 blur-[2px]"
                          : "opacity-100"
                      }`}
                    />
                    <X
                      className={`${SWAP} ${
                        isEditing
                          ? "opacity-100"
                          : "rotate-90 scale-75 opacity-0 blur-[2px]"
                      }`}
                    />
                  </span>
                  <span className="hidden sm:inline">
                    {isEditing ? "Fechar" : "Editar"}
                  </span>
                </button>
              </div>

              {/* VISUALIZAÇÃO do bloco — componente compartilhado de
                  somente leitura (o mesmo usado pela página dedicada
                  do candidato no portal do recrutador). */}
              {!isEditing ? (
                <Enter key="view" y={6} className="mt-7 min-w-0 [overflow-wrap:anywhere]">
                  <ResumeBlockContent
                    blockIndex={block.index}
                    data={viewData}
                  />
                </Enter>
              ) : (
                /* EDIÇÃO do bloco — campos no próprio local. */
                <Enter
                  key="edit"
                  y={8}
                  data-edit-panel=""
                  className="mt-7 flex flex-col gap-8"
                >
                  {block.index === 0 && (
                    <>
                      {/* [ONBOARDING_RECOVERY] Dados pessoais editáveis no
                          Bloco 1: a conta nova cria o perfil por aqui (upsert)
                          — sem passar por nenhuma outra tela. */}
                      <Group title="Dados pessoais">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input
                            label="Nome completo"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                          />
                          <Input
                            label="Matrícula"
                            required
                            inputMode="numeric"
                            value={enrollment}
                            onChange={(e) => setEnrollment(e.target.value)}
                            hint="6 a 12 dígitos"
                          />
                          <Input
                            label="Curso"
                            required
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                          />
                          <Input
                            label="Ano de formação"
                            required
                            inputMode="numeric"
                            value={graduationYear}
                            onChange={(e) => setGraduationYear(e.target.value)}
                          />
                          <Input
                            label="Semestre atual (opcional)"
                            inputMode="numeric"
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                          />
                          <Input
                            label="Cidade/UF (opcional)"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                          />
                          <Input
                            label="Telefone de contato (opcional)"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(81) 99999-9999"
                            hint="Utilizado na exportação de currículo"
                          />
                        </div>
                      </Group>

                      <Group title="Status de vínculo" divider>
                        <div className="flex flex-wrap gap-2">
                          {ENROLLMENT_STATUS.map((entry) => (
                            <ChoicePill
                              key={entry}
                              type="radio"
                              name="resume-status"
                              value={entry}
                              checked={status === entry}
                              onChange={() => setStatus(entry)}
                            >
                              {STATUS_LABELS[entry]}
                            </ChoicePill>
                          ))}
                        </div>
                      </Group>

                      <Group
                        title="Disponibilidade"
                        hint="Marque todas que se aplicam."
                        divider
                      >
                        <div className="flex flex-wrap gap-2">
                          {AVAILABILITY.map((entry) => (
                            <ChoicePill
                              key={entry}
                              type="checkbox"
                              name="resume-availability"
                              value={entry}
                              checked={availability.includes(entry)}
                              onChange={() =>
                                setAvailability((current) =>
                                  current.includes(entry)
                                    ? current.filter((item) => item !== entry)
                                    : [...current, entry],
                                )
                              }
                            >
                              {AVAILABILITY_LABELS[entry]}
                            </ChoicePill>
                          ))}
                        </div>
                      </Group>

                      <Group title="Apresentação profissional" divider>
                        <Input
                          label="Headline"
                          required
                          value={headline}
                          onChange={(e) => setHeadline(e.target.value)}
                          hint="Ex.: Estudante de Sistemas para Internet focado em back-end (10–120 caracteres)"
                        />
                        <div className="flex flex-col gap-1.5">
                          <FieldLabel htmlFor="resume-summary-edit" required>
                            Resumo profissional
                          </FieldLabel>
                          <textarea
                            id="resume-summary-edit"
                            required
                            rows={5}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Quem você é, o que você faz e o que procura…"
                            maxLength={SUMMARY_MAX}
                            aria-describedby="resume-summary-count-edit"
                            className={`${FIELD} resize-y leading-relaxed`}
                          />
                          <CharMeter
                            id="resume-summary-count-edit"
                            count={summary.trim().length}
                            max={SUMMARY_MAX}
                            min={SUMMARY_MIN}
                          />
                        </div>
                      </Group>
                    </>
                  )}

                  {block.index === 1 && (
                    <Group title="Histórico acadêmico">
                      {academicHistory.map((entry, index) => (
                        <ItemCard
                          key={index}
                          label={`Item ${index + 1}`}
                          removeLabel="Remover"
                          onRemove={() =>
                            setAcademicHistory((list) =>
                              list.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                            <Input
                              label="Item"
                              required
                              value={entry.item}
                              onChange={(e) =>
                                updateAcademic(index, "item", e.target.value)
                              }
                              hint="Ex.: Bacharelado em Direção — UNICAP (concluído)"
                            />
                            <Input
                              label="Ano"
                              required
                              inputMode="numeric"
                              value={entry.year}
                              onChange={(e) =>
                                updateAcademic(index, "year", e.target.value)
                              }
                            />
                          </div>
                        </ItemCard>
                      ))}
                      {academicHistory.length < MAX_ACADEMIC ? (
                        <AddTile
                          onClick={() =>
                            setAcademicHistory((list) => [
                              ...list,
                              { ...EMPTY_ACADEMIC },
                            ])
                          }
                        >
                          Adicionar item ao histórico
                        </AddTile>
                      ) : null}
                    </Group>
                  )}

                  {block.index === 2 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="LinkedIn"
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/in/seu-perfil"
                        hint="Opcional — https://"
                      />
                      <Input
                        label="Portfólio"
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://seu-portfolio.com"
                        hint="Opcional — https://"
                      />
                      <Input
                        label="GitHub / GitLab"
                        type="url"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/seu-usuario"
                        hint="Opcional — https://"
                      />
                      <Input
                        label="Currículo Lattes (CNPq)"
                        type="url"
                        value={lattesUrl}
                        onChange={(e) => setLattesUrl(e.target.value)}
                        placeholder="http://lattes.cnpq.br/id-cnpq"
                        hint="Opcional — http(s)://"
                      />
                    </div>
                  )}

                  {block.index === 3 && (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5">
                        <FieldLabel htmlFor="resume-skill-select">
                          Nova competência
                        </FieldLabel>
                        <div className="flex flex-wrap items-start gap-2">
                          <div
                            className="min-w-52 flex-1"
                            onKeyDown={(e) => {
                              // 1º Enter escolhe a opção (o Combobox já cuida); com a lista
                              // fechada, Enter adiciona a competência e nunca salva o bloco.
                              if (e.key !== "Enter" || e.defaultPrevented) return;
                              e.preventDefault();
                              addSkillDraft();
                            }}
                          >
                            {/* [DICIONARIO_FECHADO] combobox pesquisável: sem
                                texto livre — só se confirma um termo do
                                dicionário oficial. */}
                            <Combobox
                              ariaLabel="Nova competência"
                              id="resume-skill-select"
                              describedBy="resume-skill-hint"
                              groups={skillGroupsForCombobox()}
                              value={skillDraft}
                              onSelect={setSkillDraft}
                              placeholder="Selecione no dicionário oficial…"
                            />
                          </div>
                          <Button
                            variant="secondary"
                            className="h-10 shrink-0"
                            disabled={skillDraft.trim().length === 0}
                            onClick={addSkillDraft}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Adicionar competência
                          </Button>
                        </div>
                        <p
                          id="resume-skill-hint"
                          className="text-xs text-slate-500"
                        >
                          {skills.length}/{MAX_SKILLS} — só termos do
                          dicionário oficial
                        </p>
                      </div>

                      <div
                        className="flex flex-wrap gap-2"
                        aria-label="Competências atuais"
                      >
                        {skills.map((skill, index) => (
                          <Enter
                            as="span"
                            key={skill}
                            y={4}
                            delay={Math.min(index, 8) * 30}
                            className="inline-flex items-center gap-1 rounded-full bg-[#FDF2F4] py-1 pl-3.5 pr-1 text-sm font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(107,20,38,0.12)]"
                          >
                            {skill}
                            <button
                              type="button"
                              aria-label={`Remover competência ${skill}`}
                              onClick={() =>
                                setSkills((list) => removeSkill(list, skill))
                              }
                              className={`grid h-6 w-6 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-[#e9b8c3] ${PRESS}`}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </Enter>
                        ))}
                      </div>
                    </div>
                  )}

                  {block.index === 4 && (
                    <div className="flex flex-col gap-4">
                      {languages.map((language, index) => (
                        <Enter key={index} className={ITEM}>
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
                              <FieldLabel
                                htmlFor={`resume-language-name-${index}`}
                                required
                              >
                                Idioma
                              </FieldLabel>
                              <Combobox
                                ariaLabel="Idioma"
                                id={`resume-language-name-${index}`}
                                required
                                groups={languageGroupsForCombobox(index)}
                                value={language.name}
                                onSelect={(term) =>
                                  updateLanguage(index, "name", term)
                                }
                                placeholder="Selecione o idioma…"
                              />
                            </div>

                            <CustomSelect
                              label="Nível"
                              placeholder="Selecione o nível"
                              value={language.level}
                              onChange={(next) => updateLanguage(index, "level", next)}
                              options={LANGUAGE_LEVELS.map((level) => ({
                                value: level,
                                label: LEVEL_LABELS[level],
                              }))}
                              className="w-full sm:w-48"
                            />

                            <RemoveButton
                              label="Remover"
                              onClick={() =>
                                setLanguages((list) =>
                                  list.filter((_, i) => i !== index),
                                )
                              }
                            />
                          </div>
                        </Enter>
                      ))}
                      {languages.length < MAX_LANGUAGES ? (
                        <AddTile onClick={addLanguage}>
                          Adicionar idioma
                        </AddTile>
                      ) : null}
                    </div>
                  )}

                  {block.index === 5 && (
                    <>
                      <Group title="Experiências profissionais">
                        {experiences.map((exp, index) => (
                          <ItemCard
                            key={index}
                            label={`Experiência ${index + 1}`}
                            removeLabel="Remover experiência"
                            onRemove={() =>
                              setExperiences((list) =>
                                list.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <div className="flex flex-col gap-4">
                              <div className="grid gap-4 sm:grid-cols-3">
                                <Input
                                  label="Empresa"
                                  required
                                  value={exp.company}
                                  onChange={(e) =>
                                    updateExperience(
                                      index,
                                      "company",
                                      e.target.value,
                                    )
                                  }
                                />
                                <Input
                                  label="Cargo"
                                  required
                                  value={exp.role}
                                  onChange={(e) =>
                                    updateExperience(
                                      index,
                                      "role",
                                      e.target.value,
                                    )
                                  }
                                />
                                <Input
                                  label="Período"
                                  required
                                  value={exp.period}
                                  onChange={(e) =>
                                    updateExperience(
                                      index,
                                      "period",
                                      e.target.value,
                                    )
                                  }
                                  hint="Ex.: 2023–2025 ou 2024–Atual"
                                />
                              </div>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-semibold text-slate-700">
                                  Descrição (opcional)
                                </span>
                                <textarea
                                  rows={3}
                                  value={exp.description}
                                  onChange={(e) =>
                                    updateExperience(
                                      index,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  className={`${FIELD} resize-y leading-relaxed`}
                                />
                              </label>
                            </div>
                          </ItemCard>
                        ))}
                        {experiences.length < MAX_EXPERIENCES ? (
                          <AddTile
                            onClick={() =>
                              setExperiences((list) => [
                                ...list,
                                { ...EMPTY_EXPERIENCE },
                              ])
                            }
                          >
                            Adicionar experiência
                          </AddTile>
                        ) : null}
                      </Group>

                      <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-8">
                        <FieldLabel htmlFor="resume-projects-edit">
                          Projetos de Extensão (texto livre)
                        </FieldLabel>
                        <textarea
                          id="resume-projects-edit"
                          rows={4}
                          value={projectsText}
                          maxLength={PROJECTS_TEXT_MAX}
                          onChange={(e) => setProjectsText(e.target.value)}
                          placeholder="Ex.: Monitoria de Banco de Dados I (2024.2); Feira de Ciências — oficina de Python…"
                          className={`${FIELD} resize-y leading-relaxed`}
                        />
                        <CharMeter
                          count={projectsText.trim().length}
                          max={PROJECTS_TEXT_MAX}
                        />
                      </div>
                    </>
                  )}

                  {block.index === 6 && (
                    <Group title="Certificações e atividades">
                      {certifications.map((item, index) => (
                        <ItemCard
                          key={item.key}
                          label={`Item ${index + 1}`}
                          removeLabel="Remover"
                          onRemove={() => removeCertification(item.key)}
                        >
                          <Input
                            label={`Certificação ${index + 1}`}
                            required
                            value={item.name}
                            onChange={(e) =>
                              updateCertificationName(item.key, e.target.value)
                            }
                            hint="Ex.: Cisco CCNA, Excel Avançado, Scrum Fundamentals"
                          />
                          <CertificateFileRow
                            hasFile={item.storageId !== undefined}
                            url={item.url}
                            uploading={uploadingKey === item.key}
                            disabled={uploadingKey !== null || pending}
                            onPick={(file) =>
                              void attachCertificateFile(item.key, file)
                            }
                            onView={() => {
                              if (item.url) {
                                setViewerCert({
                                  name: item.name || `Certificação ${index + 1}`,
                                  url: item.url,
                                });
                              }
                            }}
                            onRemoveFile={() => removeCertificateFile(item.key)}
                          />
                        </ItemCard>
                      ))}
                      {certifications.length < MAX_CERTIFICATIONS ? (
                        <AddTile
                          onClick={() =>
                            setCertifications((list) => [
                              ...list,
                              { key: nextCertificationKey(), name: "" },
                            ])
                          }
                        >
                          Adicionar certificação
                        </AddTile>
                      ) : null}
                    </Group>
                  )}

                  {/* Erros de validação do bloco em edição — junto dos
                      campos e dos botões (nunca no topo da página). */}
                  {errors.length > 0 ? (
                    <Enter
                      key={errors.join("|")}
                      y={6}
                      role="alert"
                      className="scroll-mb-28 rounded-2xl border border-danger bg-danger/5 p-4"
                    >
                      <div ref={errorRef} className="flex items-start gap-3">
                        <AlertTriangle
                          className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-danger">
                            Corrija os pontos abaixo:
                          </p>
                          <ul className="mt-1 list-disc pl-5 text-sm text-danger">
                            {errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Enter>
                  ) : null}

                  {/* Barra de ação do bloco em edição — translúcida e fixa ao
                      rodapé enquanto o bloco estiver na tela. */}
                  <div
                    className={`sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_12px_32px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:bg-[#171b22]/90 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none`}
                  >
                    <p className="hidden text-xs text-slate-500 sm:block">
                      As alterações só valem depois de salvar.
                    </p>
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={cancelEdit}
                        disabled={pending || uploadingKey !== null}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => void persist()}
                        disabled={pending || uploadingKey !== null}
                      >
                        {pending ? (
                          <Loader2
                            className="h-4 w-4 animate-spin motion-reduce:animate-pulse"
                            aria-hidden="true"
                          />
                        ) : (
                          <Save className="h-4 w-4" aria-hidden="true" />
                        )}
                        {pending ? "Salvando…" : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </Enter>
              )}
            </Enter>
          );
        })}
      </form>
      {viewerCert !== null ? (
        <CertificateViewer
          title={viewerCert.name}
          url={viewerCert.url}
          onClose={() => setViewerCert(null)}
        />
      ) : null}
      {pendingTarget !== null && editingBlock !== null ? (
        <DiscardDialog
          from={BLOCK_LABELS[editingBlock]?.label ?? "este bloco"}
          to={
            pendingTarget === "close"
              ? null
              : (BLOCK_LABELS[pendingTarget]?.label ?? null)
          }
          onKeep={keepEditing}
          onDiscard={confirmDiscard}
        />
      ) : null}
    </div>
  );
}