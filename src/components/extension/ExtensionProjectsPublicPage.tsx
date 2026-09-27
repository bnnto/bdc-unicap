import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EXTENSION_AREA_LABELS } from "../../lib/extensionProject";
import { formatDay } from "../../lib/formatters";

/**
 * [S7-3] Divulgação pública de projetos ativos (R9) — página SEM
 * autenticação, aberta a estudantes, professores e público externo.
 *
 * CA 1 — responsiva (grade 1→2 colunas) e acessível (lista semântica,
 * contraste AA com os tokens institucionais); CA 2 — renderiza apenas
 * os campos do contrato público (`PublicProjectView`): a projeção
 * whitelist do servidor garante que nenhum dado restrito chega aqui,
 * e a UI não referencia nenhum campo interno.
 */
export function ExtensionProjectsPublicPage() {
  const projects = useQuery(api.extensionProjects.listPublicProjects, {});

  return (
    <div className="min-h-screen bg-canvas">
      <header
        aria-label="Cabeçalho"
        className="bg-primary text-white shadow-level2"
      >
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <p className="font-serif text-xs uppercase tracking-widest text-secondary">
            {/* [S8-2]: dourado puro aqui é DECORAÇÃO sobre bordô (6,36:1 com
                o bordô — AA); nunca use text-secondary sobre fundo claro. */}
            Universidade Católica de Pernambuco
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
            Projetos de Extensão
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            Divulgação pública dos projetos ativos do Setor de Extensão — aberta
            a estudantes, professores e público externo.
          </p>
        </div>
      </header>

      {/* [S8-2]: main único da página e destino do skip-link. */}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Projetos de extensão"
        className="mx-auto max-w-6xl px-4 py-8 outline-none"
      >
        {projects === undefined ? (
          <p role="status" className="text-sm text-slate-500">
            Carregando projetos de extensão…
          </p>
        ) : projects.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-level1">
            <p className="font-serif text-lg font-bold text-primary">
              Nenhum projeto ativo no momento
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Os projetos de extensão divulgados pelo Setor de Extensão
              aparecerão aqui.
            </p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <li
                key={`${project.title}-${project.createdAt}`}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-level1 transition-shadow hover:shadow-level2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-secondary/60 bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {EXTENSION_AREA_LABELS[project.area]}
                  </span>
                  <span className="text-xs text-a11y-slate-500">
                    Publicação: {formatDay(project.createdAt)}
                  </span>
                </div>
                <h2 className="font-serif text-lg font-bold text-primary">
                  {project.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {project.description}
                </p>
                <p className="mt-auto border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Público-alvo:
                  </span>{" "}
                  {project.targetAudience}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer
        aria-label="Rodapé"
        className="border-t border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-center">
          <p className="text-sm text-slate-600">
            Faça parte: alunos e professores participam pelo Portal de
            Carreiras.
          </p>
          <a
            href="/"
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Entrar no portal
          </a>
        </div>
      </footer>
    </div>
  );
}
