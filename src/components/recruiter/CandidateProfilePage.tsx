/**
 * [RECRUITER_VIEW_PROFILE] Perfil do candidato (somente leitura) —
 * variante "capa + currículo", refinada.
 *
 * Rota: `/recrutador/candidato/:studentId`, aberta pelo Kanban ou pelo
 * Banco de Talentos ("Visualizar Perfil & CV").
 *
 * Princípios aplicados (ui-ux-pro-max + Emil Kowalski / Apple):
 *  - Hierarquia: o nome do candidato é o <h1>; capa sóbria (um único brilho
 *    suave + filete dourado), avatar concêntrico "vazando" para o card.
 *  - Fatos agrupados num painel único com filetes de 1px (estilo Ajustes
 *    do iOS), em vez de quatro caixas soltas. Semântica <dl>/<dt>/<dd>.
 *  - Contato à direita em linhas de ação; no celular empilha:
 *    capa → contato → currículo. Estado LGPD explicado, não apenas omitido.
 *  - Currículo com medida de leitura confortável.
 *  - Acessibilidade: alvos ≥ 44px, foco visível, rótulos em todos os
 *    ícones, texto ≥ 4.5:1, `motion-reduce` desliga o movimento.
 *
 * Movimento: só transform/opacity/filter/cor; ease-out forte; entrada
 * escalonada de 70ms; press em scale(0.97); hover SOMENTE em dispositivos
 * com hover real (`@media (hover:hover)`); nada animado em ação frequente.
 *
 * `navbar`: a navbar do papel, montada pelo AuthGate (App.tsx).
 *
 * Lógica de dados, `ResumeView`, impressão do PDF e regras de contato
 * (LGPD) são as mesmas da versão anterior.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { copyTextToClipboard } from "../../lib/clipboard";
import { navigateTo } from "../../lib/router";
import {
  buildResumeDocument,
  buildResumeMarkup,
  formatResumeFileName,
} from "../../lib/resumeDocument";
import { printResumeDocument } from "../../lib/resumePrint";
import type { Availability } from "../../lib/studentProfile";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ResumeView, type ResumeBlockData } from "../student/ResumeView";
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Lock,
  Mail,
  MapPin,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const AVAILABILITY_LABELS: Record<Availability, string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

/** "ativo" = ainda cursando a faculdade; "egresso" = já concluiu. */
const STATUS_LABELS = {
  ativo: "Estudante",
  egresso: "Egresso",
  inativo: "Inativo",
} as const;

/** Classes comuns para texto que pode ser longo: quebra em qualquer ponto. */
const WRAP = "[overflow-wrap:anywhere]";

/** Mesma superfície do ProfilePage. */
const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Ease-out forte: resposta imediata, assenta suave. */
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/** Press curto: scale(0.97) no :active. Sem escala com movimento reduzido. */
const PRESS = `transition-[background-color,color,border-color,transform] duration-200 ${EASE_OUT} active:scale-[0.97] active:duration-150 motion-reduce:[transition-property:background-color,color,border-color] motion-reduce:active:scale-100`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** "https://www.linkedin.com/in/fulano/" → "linkedin.com/in/fulano" */
function prettyUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/**
 * Entrada escalonada: opacity + translateY(8px) → 0 depois do primeiro
 * paint. É transição (não keyframe), então não reinicia se o React
 * re-renderizar no meio. Sem movimento em `prefers-reduced-motion`.
 */
function Reveal({
  delay = 0,
  className = "",
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return (
    <div
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-[400ms] ${EASE_OUT} motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function InitialsAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  return (
    <div className="shrink-0 rounded-full bg-[conic-gradient(from_200deg,#6b1426,#c89d3c,#6b1426)] p-[3px] shadow-[0_8px_24px_-8px_rgba(79,13,28,0.55)]">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Foto de ${name}`}
          className="h-28 w-28 rounded-full bg-primary object-cover ring-4 ring-white sm:h-32 sm:w-32 dark:ring-[#171b22]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-28 w-28 items-center justify-center rounded-full bg-primary font-serif text-4xl font-bold tracking-tight text-white ring-4 ring-white sm:h-32 sm:w-32 sm:text-5xl dark:ring-[#171b22]"
        >
          {initialsOf(name) || <UserRound className="h-10 w-10" />}
        </span>
      )}
    </div>
  );
}

/** Selo de situação acadêmica. Estudante = verde. */
function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  if (status === "ativo") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
        {STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <Badge variant={status === "inativo" ? "reprovado" : "andamento"}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Fato do painel: rótulo pequeno (dt) + valor em serifa (dd). O fundo
 * claro de cada célula sobre um grid com `gap-px` cria o filete de 1px.
 */
function FactTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-slate-50 p-5">
      <dt className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={`mt-2 font-serif text-xl font-bold leading-snug tracking-tight text-slate-900 ${WRAP}`}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Valor ausente ("Não informada"): sai da serifa em negrito e vira texto
 * de apoio, para a ausência não gritar mais alto que um dado real.
 */
function Muted({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-base font-medium tracking-normal text-slate-600">
      {children}
    </span>
  );
}

/** Cabeçalho de seção: ícone em bloco bordô-claro + título em serifa. */
function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F4] text-primary"
      >
        <Icon className="h-5 w-5" />
      </span>
      <h2
        id={id}
        className="font-serif text-xl font-bold tracking-tight text-slate-900"
      >
        {children}
      </h2>
    </div>
  );
}

/**
 * Copiar em 1 clique: crossfade copiar→check por 2s + Toast. O ícone que
 * sai ganha escala 0.75 e blur 2px, para a troca ler como um só objeto.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy(): Promise<void> {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopied(true);
      toast.success(`${label} copiado!`);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    }
  }

  const swap = `absolute inset-0 h-4 w-4 transition-[opacity,transform,filter] duration-200 ${EASE_OUT} motion-reduce:transition-opacity`;
  const hidden = "scale-75 opacity-0 blur-[2px]";
  const visible = "scale-100 opacity-100 blur-0";

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`Copiar ${label.toLowerCase()}`}
      title={`Copiar ${label.toLowerCase()}`}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 [@media(hover:hover)]:hover:border-primary [@media(hover:hover)]:hover:text-primary ${FOCUS} ${PRESS}`}
    >
      <span className="relative block h-4 w-4" aria-hidden="true">
        <Copy className={`${swap} ${copied ? hidden : visible}`} />
        <Check className={`${swap} text-success ${copied ? visible : hidden}`} />
      </span>
    </button>
  );
}

/** Bloco de ícone das linhas de contato. */
function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F4] text-primary"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** Linha de contato com ação à direita (ex.: copiar). */
function ContactRow({
  icon,
  label,
  href,
  value,
  action,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  value: string;
  action: ReactNode;
}) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <RowIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <a
          href={href}
          className={`block rounded text-sm font-semibold text-primary ${WRAP} [@media(hover:hover)]:hover:underline ${FOCUS}`}
        >
          {value}
        </a>
      </div>
      {action}
    </div>
  );
}

/** Linha inteira clicável que abre link externo em nova aba. */
function ContactLinkRow({
  icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-slate-50 p-3 [@media(hover:hover)]:hover:bg-slate-100 dark:[@media(hover:hover)]:hover:bg-white/[0.06] ${FOCUS} ${PRESS}`}
    >
      <RowIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className={`text-xs text-slate-600 ${WRAP}`}>{prettyUrl(href)}</p>
      </div>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-slate-500"
        aria-hidden="true"
      />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

/** Esqueleto que espelha o layout final: sem salto quando o dado chega. */
function ProfileSkeleton() {
  const bar = "rounded-lg bg-slate-200/70 animate-pulse motion-reduce:animate-none";
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando perfil…</span>
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="h-36 bg-slate-200/70 animate-pulse motion-reduce:animate-none sm:h-40" />
        <div className="px-5 pb-8 sm:px-8">
          <div className="-mt-14 flex flex-col gap-6 sm:-mt-16 sm:flex-row sm:items-end">
            <div className="h-[7.5rem] w-[7.5rem] shrink-0 rounded-full bg-slate-300/70 ring-4 ring-white animate-pulse motion-reduce:animate-none sm:h-[8.5rem] sm:w-[8.5rem]" />
            <div className="flex-1 space-y-3 sm:pb-1">
              <div className={`${bar} h-9 w-2/3 max-w-md`} />
              <div className={`${bar} h-4 w-1/3 max-w-xs`} />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-slate-200/70 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="space-y-3 bg-slate-50 p-5">
                <div className={`${bar} h-3 w-24`} />
                <div className={`${bar} h-6 w-32`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={`${SURFACE} h-[30rem] animate-pulse motion-reduce:animate-none`} />
        <div className={`${SURFACE} h-56 animate-pulse motion-reduce:animate-none`} />
      </div>
    </div>
  );
}

/**
 * `navbar`: a navbar do papel (montada pelo AuthGate), igual ao
 * ProfilePage. Sem ela a página renderiza só o conteúdo.
 */
export function CandidateProfilePage({
  studentId,
  navbar,
}: {
  studentId: string;
  navbar?: ReactNode;
}) {
  // Ids do Convex são alfanuméricos — qualquer outro formato é rota
  // inválida e vira "acesso negado" sem tocar na query.
  const invalidId = !/^[a-zA-Z0-9_-]+$/.test(studentId);
  const profile = useQuery(
    api.students.getCandidateProfile,
    invalidId ? "skip" : { studentId: studentId as Id<"students"> },
  );

  function voltarAoKanban(): void {
    navigateTo("/");
  }

  const denied = invalidId || profile === null;
  const loading = profile === undefined && !denied;
  const ready = profile !== undefined && profile !== null;

  const resume = profile?.resume;
  const viewData: ResumeBlockData = {
    course: profile?.course ?? "",
    headline: resume?.headline ?? "",
    summary: resume?.summary ?? "",
    academicHistory:
      resume?.academicHistory.map((entry) => ({
        item: entry.item,
        year: entry.year,
      })) ?? [],
    linkedinUrl: profile?.linkedinUrl ?? "",
    portfolioUrl: profile?.portfolioUrl ?? "",
    githubUrl: resume?.links?.github ?? "",
    lattesUrl: resume?.links?.lattes ?? "",
    skills: profile?.skills ?? [],
    languages: profile?.languages ?? [],
    experiences:
      resume?.experiences.map((exp) => ({
        company: exp.company,
        role: exp.role,
        period: exp.period,
        description: exp.description,
      })) ?? [],
    projectsText: resume?.projectsText ?? "",
    certifications: resume?.certifications ?? [],
    contactBlocked: profile?.contactReleased !== true,
  };

  // Documento puro + markup imprimível (mesmo template do Portal do Aluno).
  const doc = ready
    ? buildResumeDocument({
        student: {
          fullName: profile.fullName,
          enrollment: profile.enrollment,
          course: profile.course,
          status: profile.status,
          graduationYear: profile.graduationYear,
          semester: profile.semester,
          location: profile.location,
          linkedinUrl: profile.linkedinUrl ?? null,
          portfolioUrl: profile.portfolioUrl ?? null,
          availability: profile.availability,
          skills: profile.skills,
          languages: profile.languages.map((language) => ({
            name: language.name,
            level: language.level,
          })),
        },
        resume: profile.resume,
      })
    : null;
  const printMarkup = doc !== null && doc.ok ? buildResumeMarkup(doc) : null;

  function baixarCurriculoPdf(): void {
    if (printMarkup === null || !ready) return;
    printResumeDocument(
      printMarkup,
      formatResumeFileName(
        profile.fullName,
        profile.course,
        profile.graduationYear,
      ),
    );
  }

  const hasResume = resume !== null && resume !== undefined;
  const contactReleased = ready && profile.contactReleased === true;
  const hasEmail = ready && profile.email !== undefined && profile.email !== "";
  const hasLinkedin =
    ready && profile.linkedinUrl !== undefined && profile.linkedinUrl !== "";
  const hasPortfolio =
    ready && profile.portfolioUrl !== undefined && profile.portfolioUrl !== "";

  const pdfUnavailable = printMarkup === null;
  const pdfTitle = pdfUnavailable
    ? "Este candidato ainda não preencheu o currículo."
    : undefined;
  const skillsCount = ready ? profile.skills.length : 0;
  const headline =
    ready && profile.headline !== null && profile.headline.trim() !== ""
      ? profile.headline
      : null;

  return (
    <div className="min-h-screen bg-canvas">
      {navbar}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Perfil do candidato"
        className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-8"
      >
        {!ready ? <h1 className="sr-only">Perfil do candidato</h1> : null}

        {loading ? <ProfileSkeleton /> : null}

        {denied ? (
          <Reveal>
            <section
              className={`${SURFACE} mx-auto max-w-lg p-8 text-center sm:p-10`}
              aria-labelledby="perfil-indisponivel"
            >
              <span
                aria-hidden="true"
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
              >
                <UserRound className="h-7 w-7" />
              </span>
              <h2
                id="perfil-indisponivel"
                className="mt-5 font-serif text-2xl font-bold tracking-tight text-slate-900"
              >
                Perfil indisponível
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-slate-600">
                Não foi possível exibir este perfil. Ele pode ter sido
                ocultado pelo aluno ou o endereço pode estar incorreto.
              </p>
              <div className="mt-7 flex justify-center">
                <Button variant="primary" onClick={voltarAoKanban}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar
                </Button>
              </div>
            </section>
          </Reveal>
        ) : null}

        {ready ? (
          <div className="space-y-6">
            {/* Capa: faixa bordô + identidade + fatos. */}
            <Reveal>
              <section
                aria-labelledby="candidato-nome"
                className={`${SURFACE} overflow-hidden`}
              >
                <div className="relative h-36 overflow-hidden bg-[linear-gradient(120deg,#4f0d1c,#6b1426_45%,#8f2238)] sm:h-40">
                  {profile.bannerUrl ? (
                    <>
                      <img
                        src={profile.bannerUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent"
                      />
                    </>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_88%_0%,rgba(255,255,255,0.16),transparent_62%)]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={voltarAoKanban}
                    className={`absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-black/50 px-4 text-sm font-semibold text-white backdrop-blur-md [@media(hover:hover)]:hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white print:hidden sm:left-6 sm:top-5 ${PRESS}`}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Voltar
                  </button>
                </div>

                <div className="px-5 pb-6 sm:px-8 sm:pb-8">
                  {/*
                    `relative z-10`: a capa é `relative` (posicionada) e por
                    isso pintava POR CIMA do avatar/nome, que vêm depois no
                    DOM mas não eram posicionados. Posicionar esta linha com
                    z-index maior a traz para frente da capa.
                  */}
                  <div className="relative z-10 -mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-start sm:gap-6">
                    <InitialsAvatar name={profile.fullName} imageUrl={profile.imageUrl} />
                    <div className="min-w-0 flex-1 sm:pt-[4.75rem]">
                      <h1
                        id="candidato-nome"
                        className={`text-balance font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl ${WRAP}`}
                      >
                        {profile.fullName}
                      </h1>
                      <p className={`mt-1.5 text-base text-slate-600 ${WRAP}`}>
                        {profile.course}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={profile.status} />
                      </div>
                    </div>
                    <div className="print:hidden sm:pt-[4.75rem] max-sm:[&>button]:w-full">
                      <Button
                        variant="primary"
                        onClick={baixarCurriculoPdf}
                        disabled={pdfUnavailable}
                        title={pdfTitle}
                        aria-describedby={
                          pdfUnavailable ? "pdf-indisponivel" : undefined
                        }
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Baixar PDF
                      </Button>
                      {pdfUnavailable ? (
                        <span id="pdf-indisponivel" className="sr-only">
                          Indisponível: este candidato ainda não preencheu o
                          currículo.
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {headline !== null ? (
                    <p
                      className={`mt-6 max-w-3xl text-pretty border-l-2 border-[#c89d3c] pl-4 text-base leading-relaxed text-slate-700 ${WRAP}`}
                    >
                      {headline}
                    </p>
                  ) : null}

                  <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/70 sm:grid-cols-2 xl:grid-cols-4 dark:bg-white/[0.08] dark:ring-white/[0.08]">
                    <FactTile icon={CalendarDays} label="Previsão de conclusão">
                      <span className="tabular-nums">
                        {profile.graduationYear}
                      </span>
                      {profile.semester !== null
                        ? ` · ${profile.semester}º período`
                        : ""}
                    </FactTile>
                    <FactTile icon={MapPin} label="Localização">
                      {profile.location !== null &&
                      profile.location.trim() !== "" ? (
                        profile.location
                      ) : (
                        <Muted>Não informada</Muted>
                      )}
                    </FactTile>
                    <FactTile icon={Briefcase} label="Disponibilidade">
                      {profile.availability.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5 font-sans">
                          {profile.availability.map((entry) => (
                            <li
                              key={entry}
                              className="rounded-full bg-[#FDF2F4] px-2.5 py-0.5 text-xs font-semibold tracking-normal text-primary"
                            >
                              {AVAILABILITY_LABELS[entry]}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Muted>Não informada</Muted>
                      )}
                    </FactTile>
                    <FactTile icon={Sparkles} label="Competências">
                      <span className="tabular-nums">{skillsCount}</span>
                      <span className="ml-1.5 font-sans text-sm font-medium tracking-normal text-slate-600">
                        {skillsCount === 1 ? "cadastrada" : "cadastradas"}
                      </span>
                    </FactTile>
                  </dl>
                </div>
              </section>
            </Reveal>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              {/* Contato à direita no desktop (fixo no fluxo, NÃO acompanha
                  a rolagem); no celular vem antes do currículo. */}
              <aside
                aria-label="Contato do candidato"
                className="min-w-0 xl:col-start-2 xl:row-start-1"
              >
                <Reveal delay={70}>
                  <section
                    className={`${SURFACE} p-6 sm:p-7`}
                    aria-labelledby="contato-titulo"
                  >
                    <SectionHeading id="contato-titulo" icon={Mail}>
                      Contato
                    </SectionHeading>

                    {contactReleased ? (
                      <div className="mt-5 space-y-3">
                        {hasEmail ? (
                          <ContactRow
                            icon={Mail}
                            label="E-mail"
                            href={`mailto:${profile.email}`}
                            value={profile.email ?? ""}
                            action={
                              <CopyButton
                                value={profile.email ?? ""}
                                label="E-mail"
                              />
                            }
                          />
                        ) : null}
                        {hasLinkedin ? (
                          <ContactLinkRow
                            icon={UserRound}
                            label="LinkedIn"
                            href={profile.linkedinUrl ?? ""}
                          />
                        ) : null}
                        {hasPortfolio ? (
                          <ContactLinkRow
                            icon={Globe}
                            label="Portfólio"
                            href={profile.portfolioUrl ?? ""}
                          />
                        ) : null}
                        {!hasEmail && !hasLinkedin && !hasPortfolio ? (
                          <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
                            O aluno não cadastrou dados de contato.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 flex gap-3 rounded-2xl bg-slate-50 p-4">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-[0_0_0_1px_rgba(15,23,42,0.06)]"
                        >
                          <Lock className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            Contato protegido
                          </p>
                          <p className="mt-0.5 text-pretty text-sm leading-relaxed text-slate-600">
                            O aluno ainda não liberou o contato.
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                </Reveal>
              </aside>

              {/* Currículo: leitura principal. */}
              <Reveal delay={140} className="min-w-0 xl:col-start-1 xl:row-start-1">
                <section
                  aria-labelledby="curriculo-titulo"
                  className={`${SURFACE} min-w-0 overflow-hidden`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6 xl:px-10">
                    <SectionHeading id="curriculo-titulo" icon={FileText}>
                      Currículo
                    </SectionHeading>
                  </header>

                  {hasResume ? (
                    <div className="min-w-0 px-5 py-6 sm:px-8 sm:py-8 xl:px-10 xl:py-10">
                      {/* `overflow-wrap` é herdado: força quebra de linha em
                          todo texto do currículo (headline, resumo, etc.). */}
                      <div
                        className={`mx-auto w-full min-w-0 max-w-4xl ${WRAP} [&_*]:[overflow-wrap:anywhere]`}
                      >
                        <ResumeView data={viewData} />
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-16 text-center sm:px-8 sm:py-20">
                      <span
                        aria-hidden="true"
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
                      >
                        <FileText className="h-7 w-7" />
                      </span>
                      <p className="mt-5 font-serif text-lg font-bold text-slate-900">
                        Currículo ainda não preenchido
                      </p>
                      <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-slate-600">
                        Este candidato ainda não montou o currículo no Portal
                        do Aluno. Os dados acadêmicos acima já estão
                        disponíveis.
                      </p>
                    </div>
                  )}
                </section>
              </Reveal>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}