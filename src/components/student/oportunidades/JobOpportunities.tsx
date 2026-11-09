import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { CustomSelect } from "../../ui/CustomSelect";
import { SuperSearch, type SuperSearchSource } from "../../ui/SuperSearch";
import { friendlyErrorMessage } from "../../../lib/toastMessages";
import {
  STAGE_LABELS,
  checkRequiredPrerequisites,
} from "../../../lib/application";
import {
  CONTRACT_LABELS,
  formatSalaryRange,
  type ContractType,
  isVerifiablePrerequisite,
} from "../../../lib/job";
import {
  DEFAULT_JOB_FILTERS,
  filterOpenJobs,
  sortOpenJobs,
  type JobSortOrder,
  type OpenJobFilters,
} from "../../../lib/jobSearch";
import {
  REPORT_DETAILS_MAX,
  REPORT_OTHER_MIN,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "../../../lib/jobReport";
import { MATCH_BAND_LABELS, matchBand } from "../../../lib/matching";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Check,
  CheckCircle2,
  FilterX,
  Flag,
  ListChecks,
  MapPin,
  Search,
  Send,
  X,
} from "lucide-react";
import { EmptyState } from "../../ui/emptyState";
import { Modal } from "../../ui/modal";

/** Vaga do mural — `matchScore` chega calculado no servidor (R8). */
type OpenJob = Doc<"jobs"> & { matchScore?: number | null };

/** Pisos salariais sugeridos do filtro (valores em reais). */
const SALARY_STEPS = [1000, 1500, 2000, 3000, 5000];

/* ------------------------------------------------------------------ */
/* Tokens de design (mesmos do ProfilePage / DESIGN.md)                */
/* ------------------------------------------------------------------ */

const SURFACE =
  "rounded-2xl sm:rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Card de vaga: sobe 2px no hover (só com mouse) e ganha profundidade. */
const CARD = `${SURFACE} transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgba(107,20,38,0.18),0_2px_4px_rgba(15,23,42,0.04),0_20px_40px_-20px_rgba(107,20,38,0.28)] motion-reduce:transition-none`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/**
 * Área de toque ampliada (44px) para botões visualmente pequenos:
 * um pseudo-elemento invisível estende a zona clicável sem mudar o layout.
 */
const TOUCH_AREA =
  "relative before:absolute before:-inset-2.5 before:content-['']";

/** Texto auxiliar: 13px no mobile (legível), 12px de sm para cima. */
const SMALL_TEXT = "text-[13px] sm:text-xs";

/** Botões já têm !h-11 (44px); aqui só a largura responsiva. */
const APPLE_NEUTRAL =
  "group !h-11 !gap-2 !rounded-xl !border-transparent !bg-slate-100 !px-4 !text-slate-700 !shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] !transition-[background-color,box-shadow,transform] !duration-200 !ease-[cubic-bezier(0.23,1,0.32,1)] hover:!translate-y-0 hover:!bg-slate-200/70 active:!scale-[0.97] active:!duration-100 dark:!bg-[#2c1a21] dark:!text-[#e9b8c3] dark:!shadow-[inset_0_0_0_1px_rgba(233,184,195,0.22)] dark:hover:!bg-[#3a2029] w-full sm:w-auto";

const APPLE_PRIMARY =
  "group !h-11 !gap-2 !rounded-xl !px-4 !shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] !transition-[background-color,box-shadow,transform] !duration-200 !ease-[cubic-bezier(0.23,1,0.32,1)] hover:!translate-y-0 hover:!shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(107,20,38,0.25)] active:!scale-[0.97] active:!duration-100 disabled:active:!scale-100 w-full sm:w-auto";

/** Normaliza para comparar sem acento/caixa (mesma regra do SuperSearch). */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

/** Anel de compatibilidade: o arco desenha até o valor ao montar. */
function ScoreRing({ score, delay = 0 }: { score: number; delay?: number }) {
  const band = matchBand(score);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score, 0), 100);
  const offset = ready ? circumference * (1 - pct / 100) : circumference;

  const stroke =
    band === "strong"
      ? "stroke-emerald-600 dark:stroke-emerald-400"
      : band === "medium"
        ? "stroke-amber-500 dark:stroke-amber-400"
        : "stroke-slate-400 dark:stroke-slate-500";
  const text =
    band === "strong"
      ? "text-emerald-800 dark:text-emerald-300"
      : band === "medium"
        ? "text-amber-800 dark:text-amber-300"
        : "text-slate-700 dark:text-slate-300";

  return (
    <div
      role="img"
      aria-label={`Compatibilidade de ${score}%`}
      title={MATCH_BAND_LABELS[band]}
      className="flex shrink-0 flex-col items-center gap-1"
    >
      {/* O SVG escala com o contêiner: 48px no mobile, 56px de sm para cima. */}
      <div className="relative h-12 w-12 sm:h-14 sm:w-14">
        <svg
          viewBox="0 0 56 56"
          aria-hidden="true"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            strokeWidth="5"
            className="stroke-slate-200 dark:stroke-white/10"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${stroke} transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none`}
          />
        </svg>
        <span
          aria-hidden="true"
          className={`absolute inset-0 grid place-items-center text-[13px] font-bold tabular-nums sm:text-sm ${text}`}
        >
          {score}%
        </span>
      </div>
      <span className="text-[11px] font-semibold text-slate-500">
        compatível
      </span>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={`rise inline-flex max-w-full items-center gap-1 rounded-full bg-[#FDF2F4] py-1 ps-3 pe-1 font-semibold text-primary [animation-duration:500ms] ${SMALL_TEXT}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        aria-label={`Remover filtro: ${label}`}
        onClick={onRemove}
        className={`${TOUCH_AREA} grid h-6 w-6 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-primary/10 active:scale-90 motion-reduce:active:scale-100 ${FOCUS}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Mural de Oportunidades (REFACTOR_ALUNO Etapa 3):
 * - SuperSearch: busca livre por cargo/skill + atalhos de competência,
 *   contrato e localidade;
 * - CustomSelect para contrato, localidade, salário e ordenação;
 * - cards com anel de Percentual de Compatibilidade — score calculado NO
 *   SERVIDOR (R8) em `applications.openJobs`;
 * - candidatura em um clique (bloqueio nos pré-requisitos obrigatórios
 *   vem da mesma regra do servidor) e denúncia de vaga.
 *
 * Responsividade (mobile-first): grade de cards por conteúdo (auto-fill),
 * tipografia e espaçamentos fluidos, alvos de toque ≥ 44px, botões em
 * largura total no mobile, modal com altura segura (dvh) e inputs a 16px
 * (evita zoom automático no iOS), safe-area e propriedades lógicas.
 */
export function JobOpportunities() {
  const openJobs = useQuery(api.applications.openJobs, {});
  const myApplications = useQuery(api.applications.myApplications, {});
  const profile = useQuery(api.students.myProfile, {});
  const apply = useMutation(api.applications.applyToJob);

  const [filters, setFilters] = useState<OpenJobFilters>(DEFAULT_JOB_FILTERS);
  // Competências escolhidas pelos atalhos do SuperSearch (todas precisam casar).
  const [skills, setSkills] = useState<string[]>([]);
  const [order, setOrder] = useState<JobSortOrder>("compatibilidade");
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);

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

  const loaded =
    openJobs !== undefined &&
    myApplications !== undefined &&
    profile !== undefined &&
    reportedIds !== undefined;

  // "Carregando…" só aparece se a espera passar de 500ms (evita piscar).
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (loaded) {
      setShowLoading(false);
      return;
    }
    const id = window.setTimeout(() => setShowLoading(true), 500);
    return () => window.clearTimeout(id);
  }, [loaded]);

  function closeReport() {
    setReportTarget(null);
    setReportReason(null);
    setReportDetails("");
  }

  async function submitReport() {
    if (reportTarget === null || reportReason === null) return;
    setReporting(true);
    try {
      await reportJob({
        jobId: reportTarget.id,
        reason: reportReason,
        details: reportDetails,
      });
      setNotice(
        "Denúncia registrada. Obrigado por ajudar a manter o portal seguro.",
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

  const contractTypes = useMemo(
    () => Object.keys(CONTRACT_LABELS) as ContractType[],
    [],
  );

  const visibleJobs = useMemo(() => {
    const byFilters = filterOpenJobs(jobs, filters);
    const bySkills =
      skills.length === 0
        ? byFilters
        : byFilters.filter((job) =>
            skills.every((skill) =>
              job.prerequisites.some((p) => fold(p.item) === fold(skill)),
            ),
          );
    return sortOpenJobs(bySkills, order);
  }, [jobs, filters, skills, order]);

  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.contract !== "todos" ||
    filters.location.length > 0 ||
    filters.minSalary !== null ||
    filters.minMatch !== null ||
    skills.length > 0;

  // Atalhos do SuperSearch: competências (dos pré-requisitos das vagas),
  // tipos de contrato e localidades.
  const searchSources = useMemo<SuperSearchSource[]>(() => {
    const byKey = new Map<string, string>();
    for (const job of jobs) {
      for (const p of job.prerequisites) {
        const key = fold(p.item);
        if (!byKey.has(key)) byKey.set(key, p.item);
      }
    }
    const picked = new Set(skills.map(fold));
    const skillItems = [...byKey.entries()]
      .filter(([key]) => !picked.has(key))
      .map(([, label]) => ({ value: label, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return [
      {
        id: "skills",
        label: "Competências",
        icon: ListChecks,
        items: skillItems,
      },
      {
        id: "contract",
        label: "Tipo de contrato",
        icon: Briefcase,
        items: contractTypes.map((type) => ({
          value: type,
          label: CONTRACT_LABELS[type],
        })),
      },
      {
        id: "location",
        label: "Localidade",
        icon: MapPin,
        items: locationOptions.map((name) => ({ value: name, label: name })),
      },
    ];
  }, [jobs, skills, contractTypes, locationOptions]);

  function handlePick(sourceId: string, value: string) {
    if (sourceId === "skills") {
      setSkills((current) =>
        current.some((s) => fold(s) === fold(value))
          ? current
          : [...current, value],
      );
    } else if (sourceId === "contract") {
      update("contract", value as ContractType);
    } else if (sourceId === "location") {
      update("location", value);
    }
  }

  function clearAll() {
    setFilters(DEFAULT_JOB_FILTERS);
    setSkills([]);
  }

  function missingPrerequisitesFor(job: OpenJob): string[] {
    if (!hasProfile) return [];
    return checkRequiredPrerequisites(
      { prerequisites: job.prerequisites.filter(isVerifiablePrerequisite) },
      profile?.skills ?? [],
    ).missing;
  }

  function update<K extends keyof OpenJobFilters>(
    key: K,
    value: OpenJobFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function handleApply(job: OpenJob) {
    const id = String(job._id);
    setNotice(null);
    setErrors((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setApplyingId(id);
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
      setErrors((prev) => ({ ...prev, [id]: friendlyErrorMessage(err) }));
    } finally {
      setApplyingId(null);
    }
  }

  // Muda a cada filtro "de clique" (menos a busca digitada): o <ul> é
  // remontado e todos os cards entram de novo em cascata.
  const listKey = [
    filters.contract,
    filters.location,
    filters.minSalary,
    filters.minMatch,
    order,
    skills.join("|"),
  ].join("::");
  // Chips dos filtros ativos (cada um remove o seu).
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (filters.contract !== "todos") {
    chips.push({
      key: "contract",
      label: CONTRACT_LABELS[filters.contract as ContractType],
      remove: () => update("contract", "todos"),
    });
  }
  if (filters.location.length > 0) {
    chips.push({
      key: "location",
      label: filters.location,
      remove: () => update("location", ""),
    });
  }
  if (filters.minSalary !== null) {
    chips.push({
      key: "salary",
      label: `Salário ≥ R$ ${filters.minSalary.toLocaleString("pt-BR")}`,
      remove: () => update("minSalary", null),
    });
  }
  if (filters.minMatch !== null) {
    chips.push({
      key: "match",
      label: `Compatibilidade ≥ ${filters.minMatch}%`,
      remove: () => update("minMatch", null),
    });
  }
  for (const skill of skills) {
    chips.push({
      key: `skill:${skill}`,
      label: skill,
      remove: () => setSkills((current) => current.filter((s) => s !== skill)),
    });
  }

  return (
    // Safe-area: respeita o notch em paisagem; overflow-x-clip evita
    // rolagem horizontal sem quebrar elementos sticky.
    <div
      role="region"
      aria-label="Oportunidades"
      className="mx-auto w-full max-w-[1440px] overflow-x-clip pb-[max(5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 sm:px-6 sm:pt-8 lg:px-8"
    >
      <header className="mb-6 sm:mb-8">
        <h1 className="rise font-serif text-[length:clamp(1.875rem,1.4rem_+_2.4vw,3rem)] font-bold leading-[1.1] tracking-tight text-primary [overflow-wrap:anywhere]">
          Oportunidades
        </h1>
        <p
          className="rise mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600 sm:mt-4 sm:text-base"
          style={{ animationDelay: "120ms" }}
        >
          Vagas abertas de empresas. Filtre por contrato, localidade e
          salário; o percentual de compatibilidade é calculado a partir do seu
          currículo.
        </p>
      </header>

      {/* Busca + filtros. `relative z-20` mantém os menus acima dos cards. */}
      <section
        aria-label="Busca e filtros"
        className={`rise relative z-20 mb-5 p-4 sm:mb-6 sm:p-6 xl:p-8 ${SURFACE}`}
        style={{ animationDelay: "240ms" }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="mural-busca"
            className="text-sm font-semibold text-slate-700"
          >
            Buscar vagas
          </label>
          <SuperSearch
            id="mural-busca"
            ariaLabel="Buscar vagas por cargo, competência ou palavra-chave"
            placeholder="Cargo, competência ou palavra-chave…"
            value={filters.query}
            onChange={(text) => update("query", text)}
            sources={searchSources}
            onPick={handlePick}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CustomSelect
            label="Tipo de contrato"
            placeholder="Todos"
            value={filters.contract}
            onChange={(v) => update("contract", v as ContractType | "todos")}
            options={[
              { value: "todos", label: "Todos" },
              ...contractTypes.map((type) => ({
                value: type,
                label: CONTRACT_LABELS[type],
              })),
            ]}
          />
          <CustomSelect
            label="Localidade"
            placeholder="Todas"
            value={filters.location}
            onChange={(v) => update("location", v)}
            options={[
              { value: "", label: "Todas" },
              ...locationOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <CustomSelect
            label="Salário mínimo"
            placeholder="Qualquer"
            value={filters.minSalary === null ? "" : String(filters.minSalary)}
            onChange={(v) =>
              update("minSalary", v.length === 0 ? null : Number.parseInt(v, 10))
            }
            options={[
              { value: "", label: "Qualquer" },
              ...SALARY_STEPS.map((step) => ({
                value: String(step),
                label: `R$ ${step.toLocaleString("pt-BR")}`,
              })),
            ]}
          />
          <CustomSelect
            label="Ordenar por"
            placeholder="Compatibilidade"
            value={order}
            onChange={(v) => setOrder(v as JobSortOrder)}
            options={[
              { value: "compatibilidade", label: "Compatibilidade" },
              { value: "recentes", label: "Mais recentes" },
            ]}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p
            key={loaded ? visibleJobs.length : "carregando"}
            className="rise min-h-[1.25rem] text-sm tabular-nums text-slate-600 [animation-duration:600ms]"
            aria-live="polite"
          >
            {!loaded
              ? showLoading
                ? "Carregando vagas…"
                : ""
              : visibleJobs.length === 1
                ? "1 vaga encontrada"
                : `${visibleJobs.length} vagas encontradas`}
            {loaded && hasActiveFilters ? " com os filtros aplicados" : ""}
            {loaded ? "." : ""}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" className={APPLE_NEUTRAL} onClick={clearAll}>
              <FilterX className="h-4 w-4" aria-hidden="true" />
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key} className="min-w-0 max-w-full">
                <FilterChip label={chip.label} onRemove={chip.remove} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {notice !== null ? (
        <div
          role="status"
          className="rise mb-5 flex items-start gap-3 rounded-2xl bg-success/10 px-4 py-4 text-sm font-medium text-success [animation-duration:600ms] sm:mb-6 sm:px-5"
        >
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 leading-relaxed [overflow-wrap:anywhere]">
            {notice}
          </p>
          <button
            type="button"
            aria-label="Dispensar aviso"
            onClick={() => setNotice(null)}
            className={`${TOUCH_AREA} grid h-7 w-7 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-success/10 active:scale-90 motion-reduce:active:scale-100 ${FOCUS}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!loaded ? (
        showLoading ? (
          <p
            role="status"
            aria-live="polite"
            className="rise rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
          >
            Carregando oportunidades…
          </p>
        ) : null
      ) : visibleJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma vaga encontrada"
          description="Nenhuma vaga corresponde aos filtros. Ajuste a busca ou limpe os filtros para ver todas as oportunidades."
          action={
            hasActiveFilters
              ? { label: "Limpar filtros", onClick: clearAll }
              : undefined
          }
        />
      ) : (
        <ul
          key={listKey}
          aria-label="Vagas encontradas"
          // Grade por conteúdo: tantas colunas quantas couberem com ≥ 30rem
          // (1 no mobile/tablet estreito, 2 em telas largas) — sem breakpoint fixo.
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,30rem),1fr))] gap-4 sm:gap-5"
        >
          {visibleJobs.map((job, index) => {
            const id = String(job._id);
            const applied = appliedJobIds.has(id);
            const applying = applyingId === id;
            const error = errors[id];
            const missing = missingPrerequisitesFor(job);
            const blocked = missing.length > 0;
            const reported = reportedSet.has(id);
            const score =
              job.matchScore === undefined || job.matchScore === null
                ? null
                : job.matchScore;
            return (
              <li
                key={job._id}
                className={`rise flex min-w-0 flex-col gap-4 p-5 [animation-duration:1600ms] sm:p-6 xl:p-7 ${CARD}`}
                style={{
                  animationDelay: `${80 + Math.min(index, 9) * 180}ms`,
                }}
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    {/* Em telas muito estreitas o ícone cede espaço ao título. */}
                    <span
                      aria-hidden="true"
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FDF2F4] text-primary min-[400px]:flex sm:h-12 sm:w-12"
                    >
                      <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-bold leading-snug tracking-tight text-primary [overflow-wrap:anywhere] sm:text-xl">
                        {job.title}
                      </h2>
                      <p
                        className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-500 ${SMALL_TEXT}`}
                      >
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                          {CONTRACT_LABELS[job.contractType]}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Banknote
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {formatSalaryRange(
                            job.salaryMin ?? null,
                            job.salaryMax ?? null,
                          )}
                        </span>
                        {job.location !== undefined &&
                        job.location !== null ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {job.location}
                            </span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {score !== null ? (
                    <ScoreRing score={score} delay={80 + Math.min(index, 9) * 180 + 300} />
                  ) : null}
                </div>

                <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
                  {job.description}
                </p>

                <ul
                  className="flex flex-wrap gap-2"
                  aria-label="Pré-requisitos"
                >
                  {job.prerequisites.map((p, i) => {
                    const verifiable = isVerifiablePrerequisite(p);
                    const blocking = verifiable && p.required;
                    const unmet = blocking && missing.includes(p.item);
                    const met = blocking && hasProfile && !unmet;
                    return (
                      <li key={`${p.item}-${i}`} className="min-w-0 max-w-full">
                        <span
                          title={p.item}
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${SMALL_TEXT} ${
                            blocking
                              ? "border-primary/30 bg-[#FDF2F4] text-primary"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {met ? (
                            <Check
                              className="h-3 w-3 shrink-0 text-success"
                              aria-hidden="true"
                            />
                          ) : null}
                          {unmet ? (
                            <AlertTriangle
                              className="h-3 w-3 shrink-0 text-warning"
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="min-w-0 truncate">{p.item}</span>
                          <span className="shrink-0 whitespace-nowrap">
                            {!verifiable
                              ? "· informativo"
                              : p.required
                                ? "· obrigatório"
                                : "· opcional"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {blocked ? (
                  <p
                    role="alert"
                    className={`flex items-start gap-2.5 rounded-2xl bg-warning/10 px-4 py-3 font-medium leading-relaxed text-warning ${SMALL_TEXT}`}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {missing.length === 1
                        ? `Requisito obrigatório não atendido: ${missing[0]}.`
                        : `Requisitos obrigatórios não atendidos: ${missing.join(", ")}.`}{" "}
                      Complete o perfil com as competências necessárias para
                      se candidatar.
                    </span>
                  </p>
                ) : null}

                {/* Rodapé: empilhado no mobile (ação principal primeiro),
                    em linha de sm para cima. */}
                <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  {applied ? (
                    <Badge variant="andamento">
                      Candidatura enviada · Etapa: {STAGE_LABELS.inscrito}
                    </Badge>
                  ) : null}
                  <div className="flex w-full flex-col gap-2 sm:ms-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      variant="secondary"
                      className={APPLE_NEUTRAL}
                      disabled={reported}
                      aria-label={`Denunciar a vaga ${job.title}`}
                      onClick={() =>
                        setReportTarget({ id: job._id, title: job.title })
                      }
                    >
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      {reported ? "Denunciada" : "Denunciar"}
                    </Button>
                    <Button
                      variant="primary"
                      className={`${APPLE_PRIMARY} max-sm:order-first`}
                      disabled={applied || applying || !hasProfile || blocked}
                      title={
                        blocked
                          ? "Complete os requisitos obrigatórios no seu perfil para se candidatar."
                          : undefined
                      }
                      onClick={() => void handleApply(job)}
                    >
                      {!applied ? (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      {applied
                        ? "Você já se candidatou"
                        : applying
                          ? "Enviando…"
                          : "Candidatar-se"}
                    </Button>
                  </div>
                </div>
                {error !== undefined ? (
                  <span
                    className={`font-medium text-danger [overflow-wrap:anywhere] ${SMALL_TEXT}`}
                    role="alert"
                  >
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
          {/* Altura segura: usa dvh (barra do navegador mobile) e nunca
              menos que o conteúdo mínimo, inclusive em paisagem. */}
          <div className="-mx-2 max-h-[min(70dvh,34rem)] overflow-y-auto overscroll-contain px-2 py-1 [scrollbar-width:thin]">
            <h2
              id={reportTitleId}
              className="flex items-center gap-2.5 font-serif text-lg font-bold tracking-tight text-primary sm:text-xl"
            >
              <Flag className="h-5 w-5 shrink-0" aria-hidden="true" />
              Denunciar vaga
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 [overflow-wrap:anywhere]">
              “{reportTarget.title}”
            </p>

            <fieldset className="mt-5 flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-slate-700">
                Qual é o problema?
              </legend>
              {REPORT_REASONS.map((reason) => {
                const checked = reportReason === reason;
                return (
                  <label key={reason} className="group block cursor-pointer">
                    <input
                      type="radio"
                      name="report-reason"
                      value={reason}
                      checked={checked}
                      onChange={() => setReportReason(reason)}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm transition-[background-color,border-color,transform] duration-500 group-active:duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.985] peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:group-active:scale-100 ${
                        checked
                          ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                          : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 ${
                          checked ? "border-primary" : "border-slate-300"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full bg-primary transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                            checked
                              ? "scale-100 opacity-100"
                              : "scale-50 opacity-0"
                          }`}
                        />
                      </span>
                      <span className="min-w-0">{REPORT_REASON_LABELS[reason]}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <label className="mt-5 flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              <span className="flex items-baseline justify-between gap-2">
                <span>
                  Detalhes{" "}
                  {reportReason === "outro" ? "(obrigatório)" : "(opcional)"}
                </span>
                <span className="text-xs font-medium tabular-nums text-slate-500">
                  {reportDetails.length}/{REPORT_DETAILS_MAX}
                </span>
              </span>
              {/* 16px no mobile: abaixo disso o iOS dá zoom ao focar o campo. */}
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                maxLength={REPORT_DETAILS_MAX}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-3.5 text-base font-normal text-slate-900 transition-colors duration-150 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 sm:text-sm dark:focus:ring-offset-[#0f1218]"
              />
            </label>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500 sm:text-xs">
              O recrutador não vê quem denunciou.
            </p>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              onClick={closeReport}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="min-h-11 w-full sm:w-auto"
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