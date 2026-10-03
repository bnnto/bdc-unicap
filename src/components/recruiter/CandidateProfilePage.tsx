/**
 * [RECRUITER_VIEW_PROFILE] Página dedicada do candidato
 * (spec Etapa 2): o recrutador chega aqui clicando no nome/"Ver Perfil"
 * de um card do Kanban ou em "Visualizar Perfil & CV" no Banco de
 * Talentos, pela rota `/recrutador/candidato/:studentId`.
 *
 *  - Reutiliza o design de currículo do Portal do Aluno renderizado em
 *    modo ESTRITO de somente leitura: `ResumeView` (o mesmo markup que o
 *    ResumeForm exibe no modo visualização), sem lápis nem formulários.
 *  - Botão proeminente "← Voltar ao Kanban" no topo devolve o
 *    recrutador à tela de origem (a aba Vagas & Pipeline é mantida pelo
 *    AuthGate — o estado da aberta sobrevive à navegação).
 *  - Contato (R6) só aparece quando o servidor liberou; caso contrário a
 *    página explica a omissão em vez de exibir valores reservados.
 *  - [QUICK_WIN_RECRUITER] Ações rápidas: "Baixar Currículo em PDF"
 *    reusa a MESMA lógica de impressão do Portal do Aluno
 *    (`printResumeDocument` + `@media print`) e ícones de copiar ao
 *    lado do E-mail/Telefone colocam o contato na área de transferência
 *    com 1 clique (Toast de confirmação).
 */
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { copyTextToClipboard } from "../../lib/clipboard";
import { navigateTo } from "../../lib/router";
import {
  buildResumeDocument,
  buildResumeMarkup,
} from "../../lib/resumeDocument";
import { printResumeDocument } from "../../lib/resumePrint";
import type { Availability } from "../../lib/studentProfile";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ResumeView, type ResumeBlockData } from "../student/ResumeView";

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

/** [QUICK_WIN_RECRUITER] Ícone de copiar (1 clique + Toast). */
function CopyIconButton({
  ariaLabel,
  onClick,
}: {
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

/** Card de dado acadêmico (mesma estética `bg-slate-50` do currículo). */
function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="font-medium text-slate-800">{value}</span>
    </p>
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

  /**
   * [QUICK_WIN_RECRUITER] Mesmo template do Portal do Aluno: documento
   * puro (`buildResumeDocument`) + markup imprimível; o botão do
   * cabeçalho dispara `printResumeDocument` → `window.print()` com o
   * `@media print` do aluno — só o currículo limpo vai pro PDF, os
   * botões/navegação desta tela ficam ocultos na impressão.
   */
  const doc =
    profile !== undefined && profile !== null
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
    if (printMarkup === null) return;
    printResumeDocument(printMarkup);
  }

  /** [QUICK_WIN_RECRUITER] Copia em 1 clique e avisa via Toast. */
  async function copiarDado(valor: string, rotulo: string): Promise<void> {
    const ok = await copyTextToClipboard(valor);
    if (ok) {
      toast.success(`${rotulo} copiado!`);
    } else {
      toast.error(`Não foi possível copiar ${rotulo}.`);
    }
  }

  return (
    <div className="min-h-screen bg-canvas pb-12">
      {/* Barra superior: identidade do portal + Voltar proeminente. */}
      <header className="border-b border-slate-200 bg-white shadow-level1">
        <div className="mx-auto flex w-full max-w-[1000px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-white"
            >
              UC
            </span>
            <div>
              <p className="font-serif text-lg font-bold leading-tight text-primary">
                Portal de Carreiras — UNICAP
              </p>
              <p className="text-xs text-slate-500">Perfil do candidato</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={baixarCurriculoPdf}
              disabled={printMarkup === null}
              title={
                printMarkup === null
                  ? "Este candidato ainda não preencheu o currículo."
                  : undefined
              }
            >
              Baixar Currículo em PDF
            </Button>
            <Button variant="primary" onClick={voltarAoKanban}>
              ← Voltar ao Kanban
            </Button>
          </div>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Perfil do candidato"
        className="mx-auto w-full max-w-[1000px] px-6 py-6 outline-none"
      >
        {profile === undefined && !denied ? (
          <p
            className="text-sm text-slate-500"
            role="status"
            aria-live="polite"
          >
            Carregando perfil…
          </p>
        ) : null}

        {denied ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1">
            <h1 className="font-serif text-xl font-bold text-primary">
              Perfil indisponível
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Não foi possível exibir este perfil. Ele pode ter sido ocultado
              pelo aluno ou o endereço pode estar incorreto.
            </p>
          </section>
        ) : null}

        {profile !== undefined && profile !== null ? (
          <>
            {/* Cabeçalho do candidato. */}
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Perfil do candidato
                  </p>
                  <h1 className="font-serif text-2xl font-bold text-primary">
                    {profile.fullName}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {profile.course}
                    {profile.semester !== null
                      ? ` · ${profile.semester}º semestre`
                      : ""}
                    {" · Previsão de conclusão "}
                    {profile.graduationYear}
                  </p>
                  {profile.headline !== null ? (
                    <p className="mt-2 text-sm italic text-slate-500">
                      “{profile.headline}”
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      profile.status === "inativo" ? "reprovado" : "andamento"
                    }
                  >
                    {STATUS_LABELS[profile.status]}
                  </Badge>
                  <Badge variant="triagem">Somente leitura</Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetaCard
                  label="Disponibilidade"
                  value={AVAILABILITY_LABELS[profile.availability]}
                />
                <MetaCard
                  label="Localização"
                  value={profile.location ?? "Não informada"}
                />
              </div>

              {/* Dados Pessoais (R6) — projetado pelo servidor; os
                  ícones de copiar entregam o contato em 1 clique. */}
              {profile.contactReleased ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dados Pessoais — contato
                  </p>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {profile.email !== undefined && profile.email !== "" ? (
                      <li className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="min-w-0 break-all">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            E-mail
                          </span>
                          <a
                            href={`mailto:${profile.email}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {profile.email}
                          </a>
                        </span>
                        <CopyIconButton
                          ariaLabel="Copiar e-mail"
                          onClick={() =>
                            void copiarDado(profile.email ?? "", "E-mail")
                          }
                        />
                      </li>
                    ) : null}
                    {profile.phone !== undefined && profile.phone !== "" ? (
                      <li className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="min-w-0 break-all">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Telefone/WhatsApp
                          </span>
                          <span className="font-medium text-slate-800">
                            {profile.phone}
                          </span>
                        </span>
                        <CopyIconButton
                          ariaLabel="Copiar telefone"
                          onClick={() =>
                            void copiarDado(profile.phone ?? "", "Telefone")
                          }
                        />
                      </li>
                    ) : null}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {profile.linkedinUrl !== undefined &&
                    profile.linkedinUrl !== "" ? (
                      <a
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                    {profile.portfolioUrl !== undefined &&
                    profile.portfolioUrl !== "" ? (
                      <a
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Portfólio
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Contato não liberado pelo aluno — e-mail e links profissionais
                  estão omitidos (LGPD).
                </p>
              )}
            </section>

            {resume === null || resume === undefined ? (
              <p className="mt-6 text-sm text-slate-600">
                Este candidato ainda não preencheu o currículo.
              </p>
            ) : null}

            {/* Currículo completo — SOMENTE LEITURA (design do portal
                do aluno, sem qualquer botão de edição). */}
            <div className="mt-6">
              <ResumeView data={viewData} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
