import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  STAGE_LABELS,
  checkRequiredPrerequisites,
} from "../../lib/application";
import {
  CONTRACT_LABELS,
  formatSalaryRange,
  type ContractType,
} from "../../lib/job";
import {
  DEFAULT_JOB_FILTERS,
  filterOpenJobs,
  sortOpenJobs,
  type JobSortOrder,
  type OpenJobFilters,
} from "../../lib/jobSearch";
import { MATCH_BAND_LABELS, matchBand } from "../../lib/matching";

/** Vaga do mural — `matchScore` chega calculado no servidor (R8). */
type OpenJob = Doc<"jobs"> & { matchScore?: number | null };

/** Pisos salariais sugeridos do filtro (valores em reais). */
const SALARY_STEPS = [1000, 1500, 2000, 3000, 5000];

function MatchBadge({ score }: { score: number }) {
  const band = matchBand(score);
  return (
    <span
      role="img"
      aria-label={`Compatibilidade de ${score}%`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold ${
        band === "strong"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : band === "medium"
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-slate-300 bg-slate-100 text-slate-700"
      }`}
      title={MATCH_BAND_LABELS[band]}
    >
      {score}% de compatibilidade
    </span>
  );
}

/**
 * Mural de Oportunidades estilo LinkedIn (REFACTOR_ALUNO Etapa 3):
 * - busca por cargo/skill + filtros de contrato, localidade e salário;
 * - cards detalhados (descrição, pré-requisitos, remuneração) com
 *   destaque do Percentual de Compatibilidade — score calculado NO
 *   SERVIDOR (R8) em `applications.openJobs`;
 * - candidatura em um clique com feedback claro (bloqueio nos
 *   pré-requisitos obrigatórios vem da mesma regra do servidor).
 */
export function JobOpportunities() {
  const openJobs = useQuery(api.applications.openJobs, {});
  const myApplications = useQuery(api.applications.myApplications, {});
  const profile = useQuery(api.students.myProfile, {});
  const apply = useMutation(api.applications.applyToJob);

  const [filters, setFilters] = useState<OpenJobFilters>(DEFAULT_JOB_FILTERS);
  const [order, setOrder] = useState<JobSortOrder>("compatibilidade");
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pré-candidaturas: ids das vagas já aplicadas (idempotência na UI).
  const appliedJobIds = new Set(
    (myApplications ?? []).map((a) => String(a.jobId)),
  );

  // Perfil mínimo exigido para candidatar (cadastro completo).
  const hasProfile = profile !== undefined && profile !== null;

  const jobs: OpenJob[] = useMemo(() => openJobs ?? [], [openJobs]);

  // Opções do filtro de localidade derivadas das vagas abertas.
  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    for (const job of jobs) {
      if (job.location !== undefined && job.location !== null) {
        names.add(job.location);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [jobs]);

  const visibleJobs = useMemo(
    () => sortOpenJobs(filterOpenJobs(jobs, filters), order),
    [jobs, filters, order],
  );

  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.contract !== "todos" ||
    filters.location.length > 0 ||
    filters.minSalary !== null ||
    filters.minMatch !== null;

  // [S3-5] Bloqueio da UI: pré-requisitos obrigatórios faltando
  // (mesma regra pura do servidor — a fonte da verdade continua lá).
  function missingPrerequisitesFor(job: OpenJob): string[] {
    if (!hasProfile) return [];
    return checkRequiredPrerequisites(
      { prerequisites: job.prerequisites },
      profile?.skills ?? [],
    ).missing;
  }

  function update<K extends keyof OpenJobFilters>(
    key: K,
    value: OpenJobFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  if (openJobs === undefined || myApplications === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Carregando oportunidades…
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Oportunidades"
      className="mx-auto w-full max-w-[1440px] px-6 py-6"
    >
      <div className="mb-5 border-b border-slate-200 pb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Mural de Vagas
        </p>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Oportunidades
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Vagas abertas das empresas conveniadas à UNICAP — filtre por contrato,
          localidade e salário; o percentual de compatibilidade é calculado a
          partir do seu currículo.
        </p>
      </div>

      {/* Barra de busca + filtros (estilo LinkedIn). */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-level1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label
              htmlFor="mural-busca"
              className="text-sm font-semibold text-slate-700"
            >
              Buscar vagas
            </label>
            <input
              id="mural-busca"
              type="search"
              role="searchbox"
              aria-label="Buscar vagas por cargo, skill ou palavra-chave"
              value={filters.query}
              onChange={(e) => update("query", e.target.value)}
              placeholder="Cargo, skill ou palavra-chave…"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </div>
          <div>
            <label
              htmlFor="mural-contrato"
              className="text-sm font-semibold text-slate-700"
            >
              Tipo de contrato
            </label>
            <select
              id="mural-contrato"
              aria-label="Tipo de contrato"
              value={filters.contract}
              onChange={(e) =>
                update("contract", e.target.value as ContractType | "todos")
              }
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 lg:w-44"
            >
              <option value="todos">Todos</option>
              {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((type) => (
                <option key={type} value={type}>
                  {CONTRACT_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="mural-localidade"
              className="text-sm font-semibold text-slate-700"
            >
              Localidade
            </label>
            <select
              id="mural-localidade"
              aria-label="Localidade"
              value={filters.location}
              onChange={(e) => update("location", e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 lg:w-48"
            >
              <option value="">Todas</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="mural-salario"
              className="text-sm font-semibold text-slate-700"
            >
              Salário mínimo
            </label>
            <select
              id="mural-salario"
              aria-label="Salário mínimo"
              value={
                filters.minSalary === null ? "" : String(filters.minSalary)
              }
              onChange={(e) =>
                update(
                  "minSalary",
                  e.target.value.length === 0
                    ? null
                    : Number.parseInt(e.target.value, 10),
                )
              }
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 lg:w-44"
            >
              <option value="">Qualquer</option>
              {SALARY_STEPS.map((step) => (
                <option key={step} value={String(step)}>
                  R$ {step.toLocaleString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="mural-ordem"
              className="text-sm font-semibold text-slate-700"
            >
              Ordenar por
            </label>
            <select
              id="mural-ordem"
              aria-label="Ordenar por"
              value={order}
              onChange={(e) => setOrder(e.target.value as JobSortOrder)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 lg:w-48"
            >
              <option value="compatibilidade">Compatibilidade</option>
              <option value="recentes">Mais recentes</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600" aria-live="polite">
            {visibleJobs.length === 1
              ? "1 vaga encontrada"
              : `${visibleJobs.length} vagas encontradas`}
            {hasActiveFilters ? " com os filtros aplicados" : ""}.
          </p>
          {hasActiveFilters ? (
            <Button
              variant="secondary"
              onClick={() => setFilters(DEFAULT_JOB_FILTERS)}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {notice !== null ? (
        <p
          role="status"
          className="mb-4 rounded border border-success bg-white px-3 py-2 text-sm font-medium text-success"
        >
          {notice}
        </p>
      ) : null}

      {visibleJobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          Nenhuma vaga corresponde aos filtros. Ajuste a busca ou limpe os
          filtros para ver todas as oportunidades.
        </p>
      ) : (
        <ul
          aria-label="Vagas encontradas"
          className="grid grid-cols-1 gap-4 xl:grid-cols-2"
        >
          {visibleJobs.map((job) => {
            const applied = appliedJobIds.has(String(job._id));
            const error = errors[String(job._id)];
            const missing = missingPrerequisitesFor(job);
            const blocked = missing.length > 0;
            const score =
              job.matchScore === undefined || job.matchScore === null
                ? null
                : job.matchScore;
            return (
              <li
                key={job._id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-level1 transition-shadow hover:border-primary/40 hover:shadow-level2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-bold text-primary">
                      {job.title}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                        {CONTRACT_LABELS[job.contractType]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatSalaryRange(
                          job.salaryMin ?? null,
                          job.salaryMax ?? null,
                        )}
                      </span>
                      {job.location !== undefined && job.location !== null ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{job.location}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {score !== null ? <MatchBadge score={score} /> : null}
                </div>

                <p className="line-clamp-3 text-sm text-slate-600">
                  {job.description}
                </p>

                <ul
                  className="flex flex-wrap gap-2"
                  aria-label="Pré-requisitos"
                >
                  {job.prerequisites.map((p, i) => (
                    <li key={`${p.item}-${i}`}>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                          p.required
                            ? "border-primary bg-[#FDF2F4] text-primary"
                            : "border-secondary bg-white text-slate-700"
                        }`}
                      >
                        {p.item}
                        {p.required ? " · obrigatório" : " · opcional"}
                      </span>
                    </li>
                  ))}
                </ul>

                {blocked ? (
                  <p
                    role="alert"
                    className="rounded border border-warning bg-white px-3 py-2 text-xs font-medium text-warning"
                  >
                    {missing.length === 1
                      ? `Requisito obrigatório não atendido: ${missing[0]}.`
                      : `Requisitos obrigatórios não atendidos: ${missing.join(", ")}.`}{" "}
                    Complete o perfil com as competências necessárias para se
                    candidatar.
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {applied ? (
                    <Badge variant="andamento">
                      Candidatura enviada · Etapa: {STAGE_LABELS.inscrito}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Etapa inicial: {STAGE_LABELS.inscrito}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    disabled={applied || !hasProfile || blocked}
                    title={
                      blocked
                        ? "Complete os requisitos obrigatórios no seu perfil para se candidatar."
                        : undefined
                    }
                    onClick={() => {
                      setNotice(null);
                      void (async () => {
                        try {
                          const result = await apply({ jobId: job._id });
                          const resultScore =
                            typeof result.matchScore === "number"
                              ? ` — match de ${result.matchScore}%`
                              : "";
                          setNotice(
                            `Candidatura registrada para “${job.title}”${resultScore}. Acompanhe o andamento na aba Minhas Candidaturas.`,
                          );
                        } catch (err) {
                          setErrors((prev) => ({
                            ...prev,
                            [String(job._id)]:
                              err instanceof Error
                                ? err.message
                                : "Falha ao se candidatar.",
                          }));
                        }
                      })();
                    }}
                  >
                    {applied ? "Você já se candidatou" : "Candidatar-se"}
                  </Button>
                </div>
                {error !== undefined ? (
                  <span className="text-xs text-danger" role="alert">
                    {error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
