/**
 * [REFACTOR_ALUNO Etapa 2] — Página "Meu Currículo": layout de duas
 * colunas inspirado na referência visual (stitch — edição de currículo):
 * sidebar sticky à esquerda (foto/iniciais, nome, curso, toggle de
 * visibilidade no Banco de Talentos e navegação rápida por âncoras) e
 * conteúdo à direita com os 7 blocos do formulário + visualização/exportação
 * do PDF (Etapa 2.3 — crítica).
 *
 * Container full-width max-w-[1440px] (Etapa 1.2). O landmark main
 * continua único no App — daqui sai apenas <section>/<aside>/<div>.
 */
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { ResumeForm } from "./ResumeForm";
import { ResumeDownload } from "./ResumeDownload";

/** Âncoras dos 7 blocos do formulário (navegação rápida da sidebar). */
const SECTION_LINKS: Array<{ href: string; label: string }> = [
  { href: "#bloco-pessoais", label: "1. Dados Pessoais & Apresentação" },
  { href: "#bloco-academico", label: "2. Formação Institucional UNICAP" },
  { href: "#bloco-links", label: "3. Links & Portfólio" },
  { href: "#bloco-competencias", label: "4. Competências (Skills)" },
  { href: "#bloco-idiomas", label: "5. Idiomas & Proficiência" },
  { href: "#bloco-experiencias", label: "6. Experiências & Extensão" },
  { href: "#bloco-certificacoes", label: "7. Certificações & Atividades" },
];

/** Iniciais do avatar: primeira + última palavra (sem foto externa). */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
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

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
      {/* Cabeçalho da página (h1 único da tela). */}
      <div className="mb-6 border-b border-slate-200 pb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Portal Discente
        </p>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Meu Currículo Vitae
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Mantenha seus dados acadêmicos, técnicos e projetos atualizados. O PDF
          gerado é o espelho exato desta tela — cores, colunas e identidade
          UNICAP preservadas na impressão.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* SIDEBAR — fixa/sticky na rolagem (Etapa 2.1). */}
        <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-24">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-level1">
            <div className="h-16 bg-gradient-to-r from-primary via-[#8a1c31] to-primary" />
            <div className="relative -mt-8 flex flex-col items-center px-4 pb-4 text-center">
              <span
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#FDF2F4] font-serif text-2xl font-bold text-primary shadow-level1"
              >
                {profile === undefined || profile === null
                  ? "…"
                  : initialsOf(profile.fullName)}
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
                <p className="mt-3 text-sm text-slate-600">
                  Complete o cadastro do perfil no menu “Meu Perfil”.
                </p>
              ) : (
                <>
                  <h2 className="mt-3 font-serif text-lg font-bold text-primary">
                    {profile.fullName}
                  </h2>
                  <p className="text-sm font-semibold text-slate-700">
                    {profile.course}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.semester !== undefined && profile.semester !== null
                      ? `${profile.semester}º semestre · `
                      : ""}
                    Conclusão {profile.graduationYear}
                  </p>
                  <p className="mt-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                    Matrícula {profile.enrollment}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Toggle de visibilidade (R2) — Público vs Privado. */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1">
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
                aria-checked={isPublic}
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
            <p className="mt-2 text-xs text-slate-500">
              {isPublic ? (
                <>
                  <strong className="text-primary">Público:</strong> seu
                  currículo aparece nas buscas do banco de talentos.
                </>
              ) : (
                <>
                  <strong className="text-primary">Privado:</strong> visível
                  apenas a recrutadores de vagas em que você é candidato.
                </>
              )}
            </p>
          </section>

          {/* Navegação rápida por âncoras (menu do formulário). */}
          <nav
            aria-label="Navegação rápida do currículo"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
          >
            <p className="mb-2 font-serif text-xs font-bold uppercase tracking-wider text-slate-500">
              Navegação rápida do currículo
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-slate-600 transition-colors hover:bg-[#FDF2F4] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* CONTEÚDO — os 7 blocos + exportação (Etapa 2.2/2.3). */}
        <div className="space-y-6 lg:col-span-8">
          <ResumeForm />
          <section
            id="bloco-exportar"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          >
            <h2 className="font-serif text-lg font-bold text-primary">
              Visualizador e Exportação PDF
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Confira a prévia final e baixe em PDF — a impressão usa as regras{" "}
              <code className="font-mono">@media print</code> com{" "}
              <code className="font-mono">print-color-adjust: exact</code>.
            </p>
            <div className="mt-3">
              <ResumeDownload />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
