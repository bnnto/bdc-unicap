/**
 * [RECRUITER_VIEW_PROFILE] Perfil do candidato (somente leitura).
 *
 * Rota: `/recrutador/candidato/:studentId`, aberta pelo Kanban ou pelo
 * Banco de Talentos ("Visualizar Perfil & CV").
 *
 * Redesenho de UI/UX:
 *  - Hierarquia: identidade + contato fixos à esquerda (sticky no desktop),
 *    currículo completo à direita. No celular, tudo empilha na ordem
 *    "quem é → contato → currículo".
 *  - Cabeçalho com trilha de navegação e ações sempre visíveis; "Voltar"
 *    e "Baixar PDF" somem na impressão (`print:hidden`).
 *  - Mesma identidade do ProfilePage: serifa para títulos, bordô como cor
 *    de ação e um aro dourado discreto no avatar.
 *  - Contato com copiar em 1 clique + feedback visual (ícone muda por 2s)
 *    e Toast. Links externos sinalizados e com alvo de toque de 44px.
 *  - Estados: carregando (skeleton), perfil indisponível, sem currículo e
 *    contato não liberado (LGPD) — cada um explica o motivo.
 *  - Movimento contido: só transform/opacity, easing de saída, e
 *    `motion-reduce` desliga o que não é essencial.
 *
 * Lógica de dados, `ResumeView`, impressão do PDF e regras de contato
 * são as mesmas da versão anterior.
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
  Check,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  MapPin,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const AVAILABILITY_LABELS: Record<Availability, string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

const STATUS_LABELS = {
  ativo: "Ativo",
  egresso: "Egresso",
  inativo: "Inativo",
} as const;

/** Superfície padrão: borda fina + sombra suave, cantos generosos. */
const CARD =
  "rounded-2xl border border-slate-200/80 bg-white shadow-level1 [.high-contrast_&]:border-black";

/** Transição curta e com easing de saída, só em propriedades baratas. */
const PRESS =
  "transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

/** Raio de identidade + alvo de toque mínimo (44px) para ações. */
const TOUCH_BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Avatar de iniciais com aro bordô + dourado (mesma linguagem do perfil). */
function InitialsAvatar({ name }: { name: string }) {
  return (
    <div className="shrink-0 rounded-full bg-[conic-gradient(from_200deg,#6b1426,#c89d3c,#6b1426)] p-[3px]">
      <span
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-primary font-serif text-3xl font-bold text-white ring-4 ring-white"
      >
        {initialsOf(name)}
      </span>
    </div>
  );
}

/** Linha de dado da barra lateral: ícone, rótulo e valor. */
function FactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FDF2F4] text-primary"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-800">
          {children}
        </dd>
      </div>
    </div>
  );
}

/** Copiar em 1 clique: troca o ícone por um check por 2s + Toast. */
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

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`Copiar ${label.toLowerCase()}`}
      title={`Copiar ${label.toLowerCase()}`}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${PRESS}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}

/** Link externo com ícone e alvo de toque de 44px. */
function ExternalLinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${TOUCH_BUTTON} border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary ${PRESS}`}
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 font-serif text-lg font-bold tracking-tight text-slate-900">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}

export function CandidateProfilePage({ studentId }: { studentId: string }) {
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

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* Barra superior: trilha + ações. Sticky para o recrutador nunca
          perder o caminho de volta, mesmo rolando o currículo longo. */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 print:hidden">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <nav aria-label="Trilha de navegação" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2 text-sm">
              <li className="shrink-0">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-xs font-bold text-white"
                >
                  UC
                </span>
                <span className="sr-only">Banco de Currículos UNICAP</span>
              </li>
              <li aria-hidden="true" className="text-slate-300">
                /
              </li>
              <li className="truncate text-slate-500">Banco de Currículos</li>
              <li aria-hidden="true" className="text-slate-300">
                /
              </li>
              <li
                aria-current="page"
                className="truncate font-semibold text-slate-900"
              >
                {ready ? profile.fullName : "Candidato"}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={baixarCurriculoPdf}
              disabled={printMarkup === null}
              title={
                printMarkup === null
                  ? "Este candidato ainda não preencheu o currículo."
                  : undefined
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar PDF
            </Button>
            <Button variant="secondary" onClick={voltarAoKanban}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao Kanban
            </Button>
          </div>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Perfil do candidato"
        className="mx-auto w-full max-w-[1200px] px-4 pt-6 outline-none sm:px-6 sm:pt-8"
      >
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"
          >
            <span className="sr-only">Carregando perfil…</span>
            <div className={`${CARD} h-96 animate-pulse`} />
            <div className={`${CARD} h-[32rem] animate-pulse`} />
          </div>
        ) : null}

        {denied ? (
          <section
            className={`${CARD} mx-auto max-w-lg p-8 text-center view-enter`}
            aria-labelledby="perfil-indisponivel"
          >
            <span
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
            >
              <UserRound className="h-7 w-7" />
            </span>
            <h1
              id="perfil-indisponivel"
              className="mt-5 font-serif text-2xl font-bold text-slate-900"
            >
              Perfil indisponível
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Não foi possível exibir este perfil. Ele pode ter sido ocultado
              pelo aluno ou o endereço pode estar incorreto.
            </p>
            <div className="mt-6 flex justify-center">
              <Button variant="primary" onClick={voltarAoKanban}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar ao Kanban
              </Button>
            </div>
          </section>
        ) : null}

        {ready ? (
          <div className="view-enter grid grid-cols-1 items-start gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
            {/* Coluna de identidade: fixa no desktop, empilhada no celular. */}
            <aside
              aria-label="Resumo do candidato"
              className="space-y-6 xl:sticky xl:top-24"
            >
              <section className={`${CARD} p-6`} aria-labelledby="candidato-nome">
                <div className="flex flex-col items-center text-center">
                  <InitialsAvatar name={profile.fullName} />
                  <h1
                    id="candidato-nome"
                    className="mt-5 break-words font-serif text-2xl font-bold leading-tight tracking-tight text-slate-900"
                  >
                    {profile.fullName}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {profile.course}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Badge
                      variant={
                        profile.status === "inativo" ? "reprovado" : "andamento"
                      }
                    >
                      {STATUS_LABELS[profile.status]}
                    </Badge>
                    <Badge variant="triagem">Somente leitura</Badge>
                  </div>
                  {profile.headline !== null ? (
                    <p className="mt-5 border-t border-slate-100 pt-5 text-sm italic leading-relaxed text-slate-500">
                      “{profile.headline}”
                    </p>
                  ) : null}
                </div>

                <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  <FactRow icon={CalendarDays} label="Previsão de conclusão">
                    {profile.graduationYear}
                    {profile.semester !== null
                      ? ` · ${profile.semester}º semestre`
                      : ""}
                  </FactRow>
                  <FactRow icon={MapPin} label="Localização">
                    {profile.location ?? "Não informada"}
                  </FactRow>
                  <FactRow icon={UserRound} label="Disponibilidade">
                    {profile.availability.length > 0 ? (
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {profile.availability.map((entry) => (
                          <li
                            key={entry}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                          >
                            {AVAILABILITY_LABELS[entry]}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "Não informada"
                    )}
                  </FactRow>
                </dl>
              </section>

              {/* Contato (R6): só quando o servidor liberou. */}
              <section className={`${CARD} p-6`} aria-labelledby="contato-titulo">
                <h2
                  id="contato-titulo"
                  className="font-serif text-lg font-bold tracking-tight text-slate-900"
                >
                  Contato
                </h2>

                {contactReleased ? (
                  <div className="mt-4 space-y-3">
                    {hasEmail ? (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 pl-3">
                        <Mail
                          className="h-4 w-4 shrink-0 text-slate-500"
                          aria-hidden="true"
                        />
                        <a
                          href={`mailto:${profile.email}`}
                          className="min-w-0 flex-1 break-all text-sm font-medium text-primary hover:underline"
                        >
                          {profile.email}
                        </a>
                        <CopyButton value={profile.email ?? ""} label="E-mail" />
                      </div>
                    ) : null}

                    {hasLinkedin || hasPortfolio ? (
                      <div className="flex flex-wrap gap-2">
                        {hasLinkedin ? (
                          <ExternalLinkChip
                            href={profile.linkedinUrl ?? ""}
                            label="LinkedIn"
                          />
                        ) : null}
                        {hasPortfolio ? (
                          <ExternalLinkChip
                            href={profile.portfolioUrl ?? ""}
                            label="Portfólio"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {!hasEmail && !hasLinkedin && !hasPortfolio ? (
                      <p className="text-sm text-slate-500">
                        O aluno não cadastrou dados de contato.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 flex gap-3 rounded-xl bg-slate-50 p-4">
                    <Lock
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-relaxed text-slate-600">
                      Contato não liberado pelo aluno. E-mail e links
                      profissionais estão omitidos (LGPD).
                    </p>
                  </div>
                )}
              </section>
            </aside>

            {/* Coluna principal: currículo completo, somente leitura. */}
            <section
              aria-labelledby="curriculo-titulo"
              className={`${CARD} min-w-0 overflow-hidden`}
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:px-8">
                <SectionTitle icon={FileText}>
                  <span id="curriculo-titulo">Currículo</span>
                </SectionTitle>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Visualização do Portal do Aluno
                </span>
              </header>

              {hasResume ? (
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                  <ResumeView data={viewData} />
                </div>
              ) : (
                <div className="px-6 py-16 text-center sm:px-8">
                  <span
                    aria-hidden="true"
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
                  >
                    <FileText className="h-7 w-7" />
                  </span>
                  <p className="mt-5 font-serif text-lg font-bold text-slate-900">
                    Currículo ainda não preenchido
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                    Este candidato ainda não montou o currículo no Portal do
                    Aluno. Os dados acadêmicos ao lado já estão disponíveis.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}