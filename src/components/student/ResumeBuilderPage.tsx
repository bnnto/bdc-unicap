/**
 * [REFACTOR_ALUNO Etapa 2] — Página "Meu Currículo": layout de duas
 * colunas inspirada na referência visual (stitch — edição de currículo):
 * sidebar sticky à esquerda (foto/iniciais, nome, curso, toggle de
 * visibilidade no Banco de Talentos e navegação rápida por âncoras) e
 * conteúdo à direita com os 7 blocos do formulário + visualização/exportação
 * do PDF (Etapa 2.3 — crítica).
 *
 * Container full-width max-w-[1440px] (Etapa 1.2). O landmark main
 * continua único no App — daqui sai apenas <section>/<aside>/<div>.
 *
 * [REFACTOR_ALUNO visual] — títulos em grotesca (24/600) com tracking
 * negativo; superfícies planas (borda OU sombra, nunca as duas); a faixa
 * do cartão de identidade é cor chapada (sem gradiente); a navegação
 * rápida usa check/bolha em vez de check/× (× lê como erro).
 */
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { ResumeForm } from "./ResumeForm";
import { ResumeDownload } from "./ResumeDownload";
import { CheckCircle2, Circle, Eye } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { useAuthState } from "../auth/authContext";

/** Âncoras dos 7 blocos do formulário (navegação rápida da sidebar). */
const SECTION_LINKS: Array<{ href: string; label: string; index: number }> = [
  { href: "#bloco-pessoais", label: "1. Dados Pessoais & Apresentação", index: 0 },
  { href: "#bloco-academico", label: "2. Formação Institucional UNICAP", index: 1 },
  { href: "#bloco-links", label: "3. Links & Portfólio", index: 2 },
  { href: "#bloco-competencias", label: "4. Competências (Skills)", index: 3 },
  { href: "#bloco-idiomas", label: "5. Idiomas & Proficiência", index: 4 },
  { href: "#bloco-experiencias", label: "6. Experiências & Extensão", index: 5 },
  { href: "#bloco-certificacoes", label: "7. Certificações & Atividades", index: 6 },
];

/** Iniciais do avatar: primeira + última palavra (sem foto externa). */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Avalia se um bloco específico está preenchido com base nos dados do perfil */
function isBlockFilled(profile: Doc<"students"> | null | undefined, blockIndex: number): boolean {
  if (!profile) return false;

  const resume = profile.resumeData;

  switch (blockIndex) {
    case 0: // Pessoais
      // Para o Bloco 1, verificamos se tem headline e summary. Os dados pessoais
      // básicos vêm do perfil que sempre existe se chegamos aqui, mas o
      // currículo só é "valido" se a apresentação foi feita.
      return !!(resume && resume.headline.trim() && resume.summary.trim());
    
    case 1: // Acadêmico
      // CORREÇÃO: O curso principal da UNICAP (profile.course) já conta como 
      // formação acadêmica! Não é obrigatório ter histórico adicional.
      return !!(profile.course || (resume && resume.academicHistory && resume.academicHistory.length > 0));
      
    case 2: // Links
      // Verifica links salvos no perfil ou no currículo (legacy)
      return !!(
        profile.linkedinUrl || 
        profile.portfolioUrl || 
        (resume && resume.links && (resume.links.github || resume.links.lattes))
      );
      
    case 3: // Competências
      return !!(profile.skills && profile.skills.length > 0);
      
    case 4: // Idiomas
      return !!(profile.languages && profile.languages.length > 0);
      
    case 5: // Experiências
      return !!(
        resume && 
        ((resume.experiences && resume.experiences.length > 0) || 
         (resume.projectsText && resume.projectsText.trim()))
      );
      
    case 6: // Certificações
      return !!(resume && resume.certifications && resume.certifications.length > 0);
      
    default:
      return false;
  }
}

export function ResumeBuilderPage() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const setVisibility = useMutation(api.students.setVisibility);

  const isPublic =
    (profile?.visibility ?? "somente_candidaturas") === "publico";

  async function handleVisibility(next: "publico" | "somente_candidaturas") {
    try {
      await setVisibility({ visibility: next });
    } catch {
      // Erro exibido pelos próprios controles do formulário/privacidade;
      // aqui o toggle volta ao estado salvo pela reação do useQuery.
    }
  }

  const setContactConsent = useMutation(api.students.setContactConsent);
  const showContact = profile?.showContactToRecruiters ?? false;

  async function handleContactConsent(next: boolean) {
    try {
      await setContactConsent({ allow: next });
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    }
  }

  const { user } = useAuthState();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
      {/* Cabeçalho da página (h1 único da tela): substantivo, 24px,
          tinta cheia; a segunda linha explica o escopo em 14px cinza. */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">
          Meu Currículo
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Mantenha seus dados acadêmicos, técnicos e projetos atualizados. O PDF
          gerado é o espelho exato desta tela, cores, colunas e identidade
          UNICAP preservadas na impressão.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* SIDEBAR — fixa/sticky na rolagem (Etapa 2.1). */}
        <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-24">
          {/* Identidade: campo bordô chapado (sem gradiente) com o
              avatar sobreposto — a única cor de marca do painel. */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="h-16 bg-primary" />
            <div className="relative -mt-8 flex flex-col items-center px-6 pb-6 text-center">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#FDF2F4] font-serif text-2xl font-bold text-primary">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt="Sua foto de perfil"
                    className="h-full w-full object-cover"
                  />
                ) : profile === undefined || profile === null ? (
                  "…"
                ) : (
                  initialsOf(profile.fullName)
                )}
              </span>
              {profile === undefined ? (
                <p
                  className="mt-3 text-sm text-slate-500"
                  role="status"
                  aria-live="polite"
                >
                  Carregando perfil…
                </p>
              ) : profile === null ? (
                /* [ONBOARDING_RECOVERY] conta nova: sem beco sem saída — o
                   próprio Bloco 1 do currículo cria o perfil (upsert). */
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Perfil novo: preencha o Bloco 1 (Dados Pessoais) abaixo e
                  salve — seus dados ficam por aqui, direto no currículo.
                </p>
              ) : (
                <>
                  <h2 className="mt-3 break-words text-base font-semibold text-slate-900">
                    {profile.fullName}
                  </h2>
                  <p className="mt-0.5 break-words text-sm text-slate-600">
                    {profile.course}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.semester !== undefined && profile.semester !== null
                      ? `${profile.semester}º semestre · `
                      : ""}
                    Conclusão {profile.graduationYear}
                  </p>
                  <p className="mt-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs tabular-nums text-slate-600">
                    Matrícula {profile.enrollment}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Toggle de visibilidade (R2) — Público vs Privado. */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span
                id="visibility-switch-label"
                className="text-sm font-semibold text-slate-700"
              >
                Visibilidade no Banco de Talentos
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="visibility-switch-label"
                checked={isPublic}
                disabled={profile === undefined || profile === null}
                onChange={(event) =>
                  void handleVisibility(
                    event.target.checked ? "publico" : "somente_candidaturas",
                  )
                }
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] checked:after:translate-x-5"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {isPublic ? (
                <>
                  <strong className="text-primary">Público:</strong> seu currículo
                  aparece nas buscas do banco de talentos.
                </>
              ) : (
                <>
                  <strong className="text-primary">Privado:</strong> visível apenas a
                  recrutadores de vagas em que você é candidato.
                </>
              )}
            </p>

            <hr className="my-4 border-slate-200" />

            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span
                id="contact-switch-label"
                className="text-sm font-semibold text-slate-700"
              >
                Permitir contato de recrutadores
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="contact-switch-label"
                checked={showContact}
                disabled={profile === undefined || profile === null}
                onChange={(event) => void handleContactConsent(event.target.checked)}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] checked:after:translate-x-5"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {showContact ? (
                <>
                  <strong className="text-primary">Autorizado:</strong> recrutadores
                  podem ver seu e-mail e enviar convites por e-mail pelo portal.
                </>
              ) : (
                <>
                  <strong className="text-primary">Não autorizado:</strong> seu e-mail
                  fica oculto e você não recebe convites.
                </>
              )}
            </p>
          </section>

          {/* Navegação rápida por âncoras (menu do formulário com indicadores). */}
          <nav
            aria-label="Navegação rápida do currículo"
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <p className="mb-3 text-xs font-semibold text-slate-500">
              Navegação rápida do currículo
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {SECTION_LINKS.map((link) => {
                const filled = isBlockFilled(profile, link.index);
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-slate-600 transition-colors duration-150 ease-soft hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-300 dark:hover:text-white"
                    >
                      <span className="min-w-0 truncate" title={link.label}>
                        {link.label}
                      </span>
                      <span className="shrink-0" aria-hidden="true">
                        {filled ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300 dark:text-slate-500" />
                        )}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* CONTEÚDO — os 7 blocos + exportação (Etapa 2.2/2.3). */}
        <div className="space-y-6 lg:col-span-8">
          <ResumeForm />
          <section
            id="bloco-exportar"
            className="rounded-xl border border-slate-200 bg-white p-6 lg:p-8"
          >
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                Visualizador e Exportação PDF
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Confira a prévia final e baixe em PDF.
              </p>
            </div>
            <div className="mt-6">
              <ResumeDownload />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
