import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { friendlyErrorMessage } from "../../lib/toastMessages";
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
import {
  REPORT_DETAILS_MAX,
  REPORT_OTHER_MIN,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_SUSPEND_THRESHOLD,
  type ReportReason,
} from "../../lib/jobReport";
import { MATCH_BAND_LABELS, matchBand } from "../../lib/matching";
import { Banknote, FilterX, MapPin, Search, Send, Flag, X } from "lucide-react";
import { EmptyState } from "../ui/emptyState";
import { Modal } from "../ui/modal";
import { Select } from "../ui/select";

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
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
        band === "strong"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : band === "medium"
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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

  const reportedIds = useQuery(api.reports.myReportedJobIds, {});
  const reportJob = useMutation(api.reports.reportJob);
  const [reportTarget, setReportTarget] = useState<{
    id: Doc<"jobs">["_id"];
    title: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const reportTitleId = useId();
  const reportedSet = new Set(reportedIds ?? []);

  function closeReport() {
    setReportTarget(null);
    setReportReason(null);
    setReportDetails("");
  }

  async function submitReport() {
    if (reportTarget === null || reportReason === null) return;
    setReporting(true);
    try {
      const result = await reportJob({
        jobId: reportTarget.id,
        reason: reportReason,
        details: reportDetails,
      });
      setNotice(
        result.suspended
          ? "Denúncia registrada. A vaga saiu do ar para análise da coordenação."
          : "Denúncia registrada. Obrigado por ajudar a manter o portal seguro.",
      );
      closeReport();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setReporting(false);
    }
  }

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
      <div className="mx-auto w-full max-w-[1440px] min-w-0">
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
      className="mx-auto w-full max-w-[1440px] min-w-0"
    >
      <div className="mb-7 border-b border-slate-200 pb-6 dark:border-slate-700">
        <h1 className="font-serif text-3xl font-bold tracking-[-0.025em] text-slate-900 sm:text-4xl">
          Oportunidades
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Vagas abertas de empresas, filtre por contrato,
          localidade e salário; o percentual de compatibilidade é calculado a
          partir do seu currículo.
        </p>
      </div>

      {/* Barra de busca + filtros (estilo LinkedIn). */}
      <div className="mb-6 min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
          
          {/* 1. BUSCAR VAGAS */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label htmlFor="mural-busca" className="text-sm font-semibold text-slate-700">
              Buscar vagas
            </label>
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                id="mural-busca"
                type="search"
                role="searchbox"
                aria-label="Buscar vagas por cargo, skill ou palavra-chave"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder="Cargo, skill ou palavra-chave…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 transition-colors duration-150 ease-soft placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
              />
            </div>
          </div>

          {/* 2. TIPO DE CONTRATO */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mural-contrato" className="text-sm font-semibold text-slate-700">
              Tipo de contrato
            </label>
            <Select
              id="mural-contrato"
              aria-label="Tipo de contrato"
              value={filters.contract}
              onChange={(e) => update("contract", e.target.value as ContractType | "todos")}
              className="w-full lg:w-44"
            >
              <option value="todos">Todos</option>
              {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((type) => (
                <option key={type} value={type}>
                  {CONTRACT_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          {/* 3. LOCALIDADE */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mural-localidade" className="text-sm font-semibold text-slate-700">
              Localidade
            </label>
            <Select
              id="mural-localidade"
              aria-label="Localidade"
              value={filters.location}
              onChange={(e) => update("location", e.target.value)}
              className="w-full lg:w-40"
            >
              <option value="">Todas</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option> 
              ))}
            </Select>
          </div>

          {/* 4. SALÁRIO */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mural-salario" className="text-sm font-semibold text-slate-700">
              Salário mínimo
            </label>
            <Select
              id="mural-salario"
              aria-label="Salário mínimo"
              value={filters.minSalary === null ? "" : String(filters.minSalary)}
              onChange={(e) =>
                update(
                  "minSalary",
                  e.target.value.length === 0 ? null : Number.parseInt(e.target.value, 10),
                )
              }
              className="w-full lg:w-40"
            >
              <option value="">Qualquer</option>
              {SALARY_STEPS.map((step) => (
                <option key={step} value={String(step)}>
                  R$ {step.toLocaleString("pt-BR")}
                </option>
              ))}
            </Select>
          </div>

          {/* 5. ORDENAR POR */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mural-ordem" className="text-sm font-semibold text-slate-700">
              Ordenar por
            </label>
            <Select
              id="mural-ordem"
              aria-label="Ordenar por"
              value={order}
              onChange={(e) => setOrder(e.target.value as JobSortOrder)}
              className="w-full lg:w-44"
            >
              <option value="compatibilidade">Compatibilidade</option>
              <option value="recentes">Mais recentes</option>
            </Select>
          </div>

        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600" aria-live="polite">
            {visibleJobs.length === 1
              ? "1 vaga encontrada"
              : `${visibleJobs.length} vagas encontradas`}
            {hasActiveFilters ? " com os filtros aplicados" : ""}.
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={() => setFilters(DEFAULT_JOB_FILTERS)}>
              <FilterX className="h-4 w-4" aria-hidden="true" />
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {notice !== null ? (
        <p
          role="status"
          className="mb-6 break-words rounded-md border border-success bg-white px-4 py-3 text-sm font-medium text-success [overflow-wrap:anywhere]"
        >
          {notice}
        </p>
      ) : null}

      {visibleJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma vaga encontrada"
          description="Nenhuma vaga corresponde aos filtros. Ajuste a busca ou limpe os filtros para ver todas as oportunidades."
          action={
            hasActiveFilters
              ? {
                  label: "Limpar filtros",
                  onClick: () => setFilters(DEFAULT_JOB_FILTERS),
                }
              : undefined
          }
        />
      ) : (
        <ul
          aria-label="Vagas encontradas"
          className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2"
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
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">
                      {job.title}
                    </h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {CONTRACT_LABELS[job.contractType]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                        <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {formatSalaryRange(
                          job.salaryMin ?? null,
                          job.salaryMax ?? null,
                        )}
                      </span>
                      {job.location !== undefined && job.location !== null ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex min-w-0 items-center gap-1 break-words [overflow-wrap:anywhere]">
                            <MapPin
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            {job.location}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {score !== null ? <MatchBadge score={score} /> : null}
                </div>

                <p
                  className="line-clamp-3 break-words text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]"
                  title={job.description}
                >
                  {job.description}
                </p>

                <ul
                  className="flex flex-wrap gap-2"
                  aria-label="Pré-requisitos"
                >
                  {job.prerequisites.map((p, i) => (
                    <li key={`${p.item}-${i}`}>
                      <span
                        className={`inline-flex max-w-full break-words rounded-full border px-2.5 py-1 text-xs font-medium [overflow-wrap:anywhere] ${
                          p.required
                            ? "border-primary/30 bg-[#FDF2F4] text-primary"
                            : "border-slate-200 bg-slate-50 text-slate-600"
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
                    className="break-words rounded-md border border-warning bg-white px-4 py-3 text-sm font-medium text-warning [overflow-wrap:anywhere]"
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={reportedSet.has(String(job._id))}
                      aria-label={`Denunciar a vaga ${job.title}`}
                      onClick={() =>
                        setReportTarget({ id: job._id, title: job.title })
                      }
                    >
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      {reportedSet.has(String(job._id))
                        ? "Denunciada"
                        : "Denunciar"}
                    </Button>
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
                              [String(job._id)]: friendlyErrorMessage(err),
                            }));
                          }
                        })();
                      }}
                    >
                      {!applied ? (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                      {applied ? "Você já se candidatou" : "Candidatar-se"}
                    </Button>
                  </div>
                </div>
                {error !== undefined ? (
                  <span className="break-words text-xs text-danger [overflow-wrap:anywhere]" role="alert">
                    {error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {reportTarget !== null ? (
        <Modal titleId={reportTitleId} onClose={closeReport}>
          <h2
            id={reportTitleId}
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <Flag className="h-5 w-5" aria-hidden="true" />
            Denunciar vaga
          </h2>
          <p className="mt-1 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">“{reportTarget.title}”</p>

          <fieldset className="mt-4 flex flex-col gap-2">
            <legend className="text-sm font-semibold text-slate-700">
              Qual é o problema?
            </legend>
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={reason}
                  checked={reportReason === reason}
                  onChange={() => setReportReason(reason)}
                  className="h-4 w-4 accent-primary"
                />
                {REPORT_REASON_LABELS[reason]}
              </label>
            ))}
          </fieldset>

          <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Detalhes {reportReason === "outro" ? "(obrigatório)" : "(opcional)"}
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              maxLength={REPORT_DETAILS_MAX}
              className="rounded-md border border-slate-300 p-2 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            O recrutador não vê quem denunciou. Com {REPORT_SUSPEND_THRESHOLD}{" "}
            denúncias de alunos diferentes, a vaga sai do ar até a coordenação
            analisar.
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={closeReport}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={
                reporting ||
                reportReason === null ||
                (reportReason === "outro" &&
                  reportDetails.trim().length < REPORT_OTHER_MIN)
              }
              onClick={() => void submitReport()}
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              {reporting ? "Enviando…" : "Enviar denúncia"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
