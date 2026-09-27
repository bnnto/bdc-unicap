import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { AVAILABILITY, type Availability } from "../../lib/studentProfile";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  type LanguageLevel,
} from "../../lib/skills";
import { TALENT_PAGE_SIZE } from "../../lib/talentSearch";

type SearchArgs = {
  search?: string;
  course?: string;
  status?: "ativo" | "egresso";
  availability?: Availability;
  location?: string;
  skill?: string;
  language?: string;
  languageLevel?: LanguageLevel;
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

type SearchResult = {
  items: Array<{
    studentId: string;
    fullName: string;
    course: string;
    status: "ativo" | "egresso" | "inativo";
    graduationYear: number;
    semester: number | null;
    location: string | null;
    availability: Availability;
    summary: string;
    skills: string[];
    languages: Array<{ name: string; level: LanguageLevel }>;
    headline: string | null;
    contactAllowed: boolean;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
  }>;
  total: number;
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Banco de Talentos (issue [S2-3]) — busca com filtros combináveis e
 * reativos (Convex useQuery reexecuta a cada mudança de filtro, CA 1)
 * com resultados paginados (CA 2). Servidor aplica R1 (apenas ativo/
 * egresso) e R2 (apenas perfis públicos) antes de expor qualquer dado.
 */
export function TalentSearchPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<"ativo" | "egresso" | "">("");
  const [availability, setAvailability] = useState<Availability | "">("");
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("");
  const [language, setLanguage] = useState("");
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("basico");
  const [page, setPage] = useState(0);

  const args: SearchArgs = {
    page,
    ...(search.trim().length > 0 ? { search } : {}),
    ...(course.trim().length > 0 ? { course } : {}),
    ...(status !== "" ? { status } : {}),
    ...(availability !== "" ? { availability } : {}),
    ...(location.trim().length > 0 ? { location } : {}),
    ...(skill.trim().length > 0 ? { skill } : {}),
    ...(language.trim().length > 0 ? { language, languageLevel } : {}),
  };

  const result: SearchResult | undefined = useQuery(
    api.students.searchTalent,
    args,
  );

  function updateFilter(resetPage = true) {
    if (resetPage) setPage(0);
  }

  const hasAnyFilter =
    search.trim().length > 0 ||
    course.trim().length > 0 ||
    status !== "" ||
    availability !== "" ||
    location.trim().length > 0 ||
    skill.trim().length > 0 ||
    language.trim().length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-secondary">
          Recrutadores
        </p>
        <h1 className="font-serif text-2xl font-bold text-primary">
          Banco de Talentos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Alunos ativos e egressos que autorizaram a divulgação do perfil
          (R1/R2). O contato só aparece quando o aluno autoriza (R6).
        </p>
      </header>

      <Card title="Filtros" accent="primary">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateFilter();
          }}
          aria-label="Filtros do Banco de Talentos"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Busca (nome, curso, competência, cidade)"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateFilter();
              }}
              placeholder="Ex.: React, Recife, Ciência da Computação…"
            />
            <Input
              label="Curso"
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                updateFilter();
              }}
              placeholder="Ex.: Direção"
            />
            <Input
              label="Cidade/UF"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                updateFilter();
              }}
              placeholder="Ex.: Recife/PE"
            />
            <Input
              label="Competência"
              value={skill}
              onChange={(e) => {
                setSkill(e.target.value);
                updateFilter();
              }}
              placeholder="Ex.: SQL"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">
                Formação
              </span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "ativo" | "egresso" | "");
                  updateFilter();
                }}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                <option value="">Todas</option>
                <option value="ativo">Alunos ativos</option>
                <option value="egresso">Egressos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">
                Disponibilidade
              </span>
              <select
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value as Availability | "");
                  updateFilter();
                }}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
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
              <span className="text-sm font-semibold text-slate-700">
                Idioma e nível mínimo
              </span>
              <div className="flex gap-2">
                {/* [UX-P3] H6-1 — sugestões nativas via datalist (sem libs). */}
                <input
                  type="text"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    updateFilter();
                  }}
                  placeholder="Ex.: Inglês"
                  aria-label="Idioma"
                  list="talent-language-options"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
                <datalist id="talent-language-options">
                  {KNOWN_LANGUAGES.map((language) => (
                    <option key={language} value={language} />
                  ))}
                </datalist>
                <select
                  value={languageLevel}
                  onChange={(e) => {
                    setLanguageLevel(e.target.value as LanguageLevel);
                    updateFilter();
                  }}
                  aria-label="Nível mínimo do idioma"
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  {LANGUAGE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          {hasAnyFilter ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCourse("");
                setStatus("");
                setAvailability("");
                setLocation("");
                setSkill("");
                setLanguage("");
                setLanguageLevel("basico");
                updateFilter();
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </form>
      </Card>

      <div className="mt-6">
        {result === undefined ? (
          <p
            className="text-sm text-slate-500"
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
            <p className="text-sm font-semibold text-slate-700">
              Nenhum talento encontrado com os filtros atuais.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tente ampliar a busca — por exemplo, removendo o idioma ou a
              disponibilidade.
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setStatus("");
                setAvailability("");
                setLanguage("");
                setSkill("");
                setPage(0);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600" aria-live="polite">
              {result.total} talento(s) encontrado(s) · página {result.page + 1}{" "}
              de {result.pageCount}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {result.items.map((talent) => (
                <li key={talent.studentId}>
                  <article className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-level1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-lg font-bold text-primary">
                        {talent.fullName}
                      </h3>
                      <Badge
                        variant={
                          talent.status === "ativo" ? "andamento" : "aprovado"
                        }
                      >
                        {talent.status === "ativo" ? "Ativo" : "Egresso"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {talent.summary}
                    </p>
                    {talent.headline !== null ? (
                      <p className="mt-1 text-sm italic text-slate-500">
                        “{talent.headline}”
                      </p>
                    ) : null}
                    {talent.location !== null ? (
                      <p className="mt-1 text-xs text-slate-500">
                        📍 {talent.location}
                      </p>
                    ) : null}
                    {talent.skills.length > 0 ? (
                      <ul
                        className="mt-2 flex flex-wrap gap-2"
                        aria-label="Competências"
                      >
                        {talent.skills.map((s) => (
                          <li key={s}>
                            <span className="inline-flex items-center rounded-full border border-primary bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary">
                              {s}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {talent.languages.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Idiomas:{" "}
                        {talent.languages
                          .map((l) => `${l.name} (${LEVEL_LABELS[l.level]})`)
                          .join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold">
                      {talent.contactAllowed ? (
                        <span className="text-success">
                          Contato autorizado pelo aluno
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Contato não autorizado
                        </span>
                      )}
                    </p>
                    {talent.contactAllowed &&
                    (talent.linkedinUrl !== null ||
                      talent.portfolioUrl !== null) ? (
                      <p className="mt-1 text-xs">
                        {talent.linkedinUrl !== null ? (
                          <a
                            href={talent.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary-hover"
                          >
                            LinkedIn
                          </a>
                        ) : null}
                        {talent.linkedinUrl !== null &&
                        talent.portfolioUrl !== null
                          ? " · "
                          : null}
                        {talent.portfolioUrl !== null ? (
                          <a
                            href={talent.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary-hover"
                          >
                            Portfólio
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>

            <nav
              className="mt-6 flex items-center justify-between gap-4"
              aria-label="Paginação de resultados"
            >
              <Button
                variant="secondary"
                disabled={!result.hasPrev}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Anterior
              </Button>
              <p className="text-sm text-slate-600">
                Exibindo {result.page * TALENT_PAGE_SIZE + 1}–
                {result.page * TALENT_PAGE_SIZE + result.items.length} de{" "}
                {result.total}
              </p>
              <Button
                variant="secondary"
                disabled={!result.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima →
              </Button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
