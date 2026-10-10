import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AVAILABILITY, type Availability } from "../../lib/studentProfile";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  type LanguageLevel,
} from "../../lib/skills";
import {
  TALENT_PAGE_SIZE,
  type TalentSortOption,
} from "../../lib/talentSearch";
import { COURSES } from "../../lib/talentBenchmark";
import { candidateProfilePath, navigateTo } from "../../lib/router";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  GraduationCap,
  Languages,
  MapPin,
  Plus,
  Search,
  SearchX,
  Send,
  ShieldAlert,
  ShieldCheck,
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
  skill?: string;
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

/** Faixa de "Previsão de Conclusão" exibida na sidebar (REFACTOR_UI). */
const GRADUATION_YEARS = Array.from({ length: 6 }, (_, i) => 2024 + i);

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
 * Banco de Talentos (issue [S2-3]; layout [REFACTOR_UI] Etapa 3).
 *
 * Estrutura da referência visual:
 * 1. Barra de busca superior larga (contagem "Estudantes Disponíveis" e
 *    botão "Limpar" à direita);
 * 2. Duas colunas: sidebar de filtros (Área & Curso, Previsão de Conclusão,
 *    Competências) + conteúdo com dropdown "Ordenar por";
 * 3. Cards em grid de 2 colunas com ações "Visualizar Perfil & CV"
 *    ([RECRUITER_VIEW_PROFILE] abre a página dedicada do candidato) e
 *    "Convidar";
 * 4. Paginação centralizada no rodapé.
 *
 * R1 (ativo/egresso) e R2 (apenas públicos) permanecem no servidor; a
 * busca reativa usa a mesma query `students.searchTalent` (CA 1/CA 2).
 */
export function TalentSearchPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<"ativo" | "egresso" | "">("");
  const [availability, setAvailability] = useState<Availability | "">("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [language, setLanguage] = useState("");
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("basico");
  const [yearFrom, setYearFrom] = useState<number | "">("");
  const [yearTo, setYearTo] = useState<number | "">("");
  const [sort, setSort] = useState<TalentSortOption>("relevancia");
  const [page, setPage] = useState(0);

  const args: SearchArgs = useMemo(
    () => ({
      page,
      ...(search.trim().length > 0 ? { search } : {}),
      ...(course !== "" ? { course } : {}),
      ...(status !== "" ? { status } : {}),
      ...(availability !== "" ? { availability } : {}),
      ...(location.trim().length > 0 ? { location } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(language.trim().length > 0 ? { language, languageLevel } : {}),
      ...(yearFrom !== "" ? { graduationYearFrom: yearFrom } : {}),
      ...(yearTo !== "" ? { graduationYearTo: yearTo } : {}),
      ...(sort !== "relevancia" ? { sort } : {}),
    }),
    [
      page,
      search,
      course,
      status,
      availability,
      location,
      skills,
      language,
      languageLevel,
      yearFrom,
      yearTo,
      sort,
    ],
  );

  const result: SearchResult | undefined = useQuery(
    api.students.searchTalent,
    args,
  );

  const hasAnyFilter =
    search.trim().length > 0 ||
    course !== "" ||
    status !== "" ||
    availability !== "" ||
    location.trim().length > 0 ||
    skills.length > 0 ||
    language.trim().length > 0 ||
    yearFrom !== "" ||
    yearTo !== "";

  function clearAll() {
    setSearch("");
    setCourse("");
    setStatus("");
    setAvailability("");
    setLocation("");
    setSkills([]);
    setSkillDraft("");
    setLanguage("");
    setLanguageLevel("basico");
    setYearFrom("");
    setYearTo("");
    setPage(0);
  }

  function addSkillChip() {
    const value = skillDraft.trim();
    if (value.length === 0) return;
    setSkills((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setSkillDraft("");
    setPage(0);
  }

  return (
    // [S8-2]: região nomeada em vez de <main> aninhado (o main da página é
    // único, no App — WCAG 1.3.1). Layout full-width (REFACTOR_UI Etapa 2).
    <div role="region" aria-label="Busca de talentos" className="px-6 py-8">
      {/* 1 — Barra de busca superior larga. */}
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Recrutadores
        </p>
        <h2 className="font-serif text-2xl font-bold text-primary">
          Banco de Talentos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Alunos ativos e egressos que autorizaram a divulgação do perfil
          (R1/R2). O contato só aparece quando o aluno autoriza (R6).
        </p>
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
                role="searchbox"
                aria-label="Buscar talentos"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar por nome, curso, competência (ex.: React), cidade ou idioma…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p
              className="flex items-center gap-1.5 text-sm text-slate-600"
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
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* 2 — Duas colunas: sidebar de filtros + conteúdo. */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <form
          aria-label="Filtros do Banco de Talentos"
          className="flex flex-col gap-6 self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-level1"
          onSubmit={(e) => e.preventDefault()}
        >
          <fieldset className="flex flex-col gap-3" aria-label="Área & Curso">
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <GraduationCap
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              Área &amp; Curso
            </legend>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Curso</span>
              <select
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setPage(0);
                }}
                aria-label="Curso"
                className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
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
              <span className="text-xs font-medium text-slate-500">
                Formação
              </span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "ativo" | "egresso" | "");
                  setPage(0);
                }}
                aria-label="Formação"
                className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="">Todas</option>
                <option value="ativo">Alunos ativos</option>
                <option value="egresso">Egressos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">
                Disponibilidade
              </span>
              <select
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value as Availability | "");
                  setPage(0);
                }}
                aria-label="Disponibilidade"
                className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
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
              <span className="text-xs font-medium text-slate-500">
                Cidade/UF
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPage(0);
                }}
                placeholder="Ex.: Recife/PE"
                aria-label="Cidade/UF"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Idioma</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Ex.: Inglês"
                  aria-label="Idioma"
                  list="talent-language-options"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                />
                <select
                  value={languageLevel}
                  onChange={(e) => {
                    setLanguageLevel(e.target.value as LanguageLevel);
                    setPage(0);
                  }}
                  aria-label="Nível mínimo do idioma"
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                >
                  {LANGUAGE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>
              <datalist id="talent-language-options">
                {KNOWN_LANGUAGES.map((language) => (
                  <option key={language} value={language} />
                ))}
              </datalist>
            </label>
          </fieldset>

          <fieldset
            className="flex flex-col gap-2"
            aria-label="Previsão de Conclusão"
          >
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-700">
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
                  setPage(0);
                }}
                placeholder="De"
                aria-label="Conclusão a partir de"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
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
                  setPage(0);
                }}
                placeholder="Até"
                aria-label="Conclusão até"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </div>
            <div className="flex flex-wrap gap-1" aria-hidden="true">
              {GRADUATION_YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setYearFrom(year);
                    setYearTo(year);
                    setPage(0);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    yearFrom === year && yearTo === year
                      ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2" aria-label="Competências">
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Competências
            </legend>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkillChip();
                  }
                }}
                placeholder="Ex.: SQL"
                aria-label="Nova competência"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
              <Button variant="secondary" onClick={addSkillChip}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar
              </Button>
            </div>
            {skills.length > 0 ? (
              <ul
                className="flex flex-wrap gap-2"
                aria-label="Competências selecionadas"
              >
                {skills.map((chip) => (
                  <li key={chip}>
                    <button
                      type="button"
                      onClick={() => {
                        setSkills((current) =>
                          current.filter((c) => c !== chip),
                        );
                        setPage(0);
                      }}
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

        {/* Conteúdo principal — dropdown Ordenar por + grid de cards. */}
        <div>
          <div className="mb-4 flex items-center justify-end gap-2">
            <label
              htmlFor="talent-sort"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600"
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
              onChange={(e) => {
                setSort(e.target.value as TalentSortOption);
                setPage(0);
              }}
              aria-label="Ordenar por"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              {(Object.keys(SORT_LABELS) as TalentSortOption[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

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
              <SearchX
                className="mx-auto h-10 w-10 text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Nenhum talento encontrado com os filtros atuais.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tente ampliar a busca — por exemplo, removendo o idioma ou a
                disponibilidade.
              </p>
              <Button variant="secondary" className="mt-3" onClick={clearAll}>
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <ul
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                aria-label="Talentos encontrados"
              >
                {result.items.map((talent) => (
                  <li key={talent.studentId}>
                    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-level1 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-level2">
                      <div className="flex items-start gap-3">
                        {/* Placeholder circular de foto (referência). */}
                        <span
                          aria-hidden="true"
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] font-serif text-base font-bold text-primary ring-1 ring-primary/20"
                        >
                          {talent.fullName
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part.charAt(0).toUpperCase())
                            .join("")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-serif text-lg font-bold text-primary">
                              {talent.fullName}
                            </h3>
                            <Badge
                              variant={
                                talent.status === "ativo"
                                  ? "andamento"
                                  : "aprovado"
                              }
                            >
                              {talent.status === "ativo" ? "Ativo" : "Egresso"}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {talent.course}
                            {talent.semester !== null
                              ? ` · ${talent.semester}º semestre`
                              : ""}
                            {" · "}
                            {talent.graduationYear}
                          </p>
                        </div>
                      </div>

                      {talent.headline !== null ? (
                        <p className="mt-2 text-sm italic text-slate-500">
                          “{talent.headline}”
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        {talent.summary}
                      </p>

                      {talent.skills.length > 0 ? (
                        <ul
                          className="mt-3 flex flex-wrap gap-2"
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

                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock
                            className="h-3.5 w-3.5 text-primary"
                            aria-hidden="true"
                          />
                          {AVAILABILITY_LABELS[talent.availability]}
                        </span>
                        {talent.location !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin
                              className="h-3.5 w-3.5 text-primary"
                              aria-hidden="true"
                            />
                            {talent.location}
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex items-center gap-1 ${
                            talent.contactAllowed
                              ? "font-semibold text-success"
                              : ""
                          }`}
                        >
                          {talent.contactAllowed ? (
                            <ShieldCheck
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ShieldAlert
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          {talent.contactAllowed
                            ? "Contato autorizado pelo aluno"
                            : "Contato não autorizado"}
                        </span>
                      </p>

                      {talent.languages.length > 0 ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                          <Languages
                            className="h-3.5 w-3.5 text-primary"
                            aria-hidden="true"
                          />
                          Idiomas:{" "}
                          {talent.languages
                            .map((l) => `${l.name} (${LEVEL_LABELS[l.level]})`)
                            .join(", ")}
                        </p>
                      ) : null}

                      {/* Rodapé do card com as ações da referência —
                          [RECRUITER_VIEW_PROFILE] "Visualizar Perfil & CV"
                          abre a página dedicada (somente leitura). */}
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigateTo(candidateProfilePath(talent.studentId))
                          }
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Visualizar Perfil &amp; CV
                        </Button>
                        <Button variant="primary">
                          <Send className="h-4 w-4" aria-hidden="true" />
                          Convidar
                        </Button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>

              {/* 4 — Rodapé: paginação centralizada. */}
              <nav
                className="mt-8 flex items-center justify-center gap-6"
                aria-label="Paginação de resultados"
              >
                <Button
                  variant="secondary"
                  disabled={!result.hasPrev}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>
                <p className="text-sm text-slate-600">
                  Página {result.page + 1} de {result.pageCount} ·{" "}
                  {result.page * TALENT_PAGE_SIZE + 1}–
                  {result.page * TALENT_PAGE_SIZE + result.items.length} de{" "}
                  {result.total}
                </p>
                <Button
                  variant="secondary"
                  disabled={!result.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </nav>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
