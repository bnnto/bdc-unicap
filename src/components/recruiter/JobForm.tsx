import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery} from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Combobox } from "../ui/Combobox";
import { CustomSelect } from "../ui/CustomSelect";
import {
  AlertCircle,
  Banknote,
  FileText,
  Info,
  ListChecks,
  Plus,
  Save,
  Send,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  SKILLS_GROUPS,
  canonicalSkill,
  type LanguageLevel,
} from "../../lib/skills";
import { AVAILABILITY } from "../../lib/studentProfile";
import {
  CONTRACT_TYPES,
  CONTRACT_LABELS,
  MAX_PREREQS,
  PREREQ_TEXT_MAX,
  validateJob,
  type ContractType,
  type PrerequisiteKind,
} from "../../lib/job";
import {
  DIVIDER,
  IconTile,
  LABEL_CLASS,
  SURFACE,
  TEXTAREA_CLASS,
  TextField,
} from "./jobsUi";

const DESCRIPTION_MAX = 4000;
const DESCRIPTION_MIN = 30;

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

const LANGUAGE_GROUPS = [{ label: "Idiomas", items: KNOWN_LANGUAGES }];

const PREREQ_KINDS: { value: PrerequisiteKind; label: string }[] = [
  { value: "skill", label: "Competência" },
  { value: "text", label: "Requisito descritivo" },
];

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

type PrerequisiteDraft = {
  id: string;
  item: string;
  required: boolean;
  kind: PrerequisiteKind;
};

let prerequisiteSeq = 0;
function newPrerequisite(
  item = "",
  required = true,
  kind: PrerequisiteKind = "skill",
): PrerequisiteDraft {
  prerequisiteSeq += 1;
  return { id: `prereq-${prerequisiteSeq}`, item, required, kind };
}

/** Mantém só dígitos nos campos de salário. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Cartão de seção: ícone + título serifado + descrição curta + conteúdo. */
function Section({
  icon,
  title,
  description,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className={`${SURFACE} min-w-0 p-6 sm:p-8`}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <IconTile>{icon}</IconTile>
          <div>
            <h3 className="font-serif text-lg font-bold leading-tight tracking-tight text-primary">
              {title}
            </h3>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-a11y-slate-500">
              {description}
            </p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

type JobFormProps = {
  /** Vaga em edição (null = nova vaga). */
  initial?: Doc<"jobs"> | null;
  onDone: () => void;
};

/**
 * Publicação/edição de vagas (issue [S3-1]) — título, descrição,
 * pré-requisitos obrigatórios/opcionais (CA 3, base R3/R8), tipo de
 * contrato, faixa salarial validada (CA 2) e localização. Validação
 * com a mesma regra pura do servidor (src/lib/job.ts).
 *
 * O estado é inicializado direto a partir de `initial`: o componente é
 * montado do zero ao entrar em "nova vaga" ou "editar", então não há
 * necessidade de efeito de pré-preenchimento.
 *
 * Visual: quatro seções em cartões e barra de ações fixa no rodapé.
 */
export function JobForm({ initial = null, onDone }: JobFormProps) {
  // [RECRUITER_WORKFLOW] Etapa 3 — publicação usa `createJob` (mesma
  // validação/guard do upsert, sem jobId); edição segue no `upsertJob`.
  const upsert = useMutation(api.jobs.upsertJob);
  const create = useMutation(api.jobs.createJob);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prerequisites, setPrerequisites] = useState<PrerequisiteDraft[]>(() =>
    initial !== null && initial.prerequisites.length > 0
      ? initial.prerequisites.map((p) => {
          // Vagas antigas (sem `kind`): item do dicionário vira competência;
          // o resto vira requisito descritivo (informativo, nunca obrigatório).
          const canonical = p.kind === "text" ? null : canonicalSkill(p.item);
          return canonical !== null
            ? newPrerequisite(canonical, p.required, "skill")
            : newPrerequisite(p.item, false, "text");
        })
      : [newPrerequisite()],
  );
  const requiredSkills = useMemo(
    () =>
      prerequisites
        .filter((p) => p.kind === "skill" && p.required && p.item !== "")
        .map((p) => p.item),
    [prerequisites],
  );
  const eligibility = useQuery(
    api.jobInsights.countEligibleStudents,
    requiredSkills.length > 0 ? { requiredSkills } : "skip",
  );
  const [contractType, setContractType] = useState<ContractType>(
    initial?.contractType ?? "estagio",
  );
  const [salaryMin, setSalaryMin] = useState(
    initial?.salaryMin !== undefined ? String(initial.salaryMin) : "",
  );
  const [salaryMax, setSalaryMax] = useState(
    initial?.salaryMax !== undefined ? String(initial.salaryMax) : "",
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [languageName, setLanguageName] = useState(
    initial?.requiredLanguage?.name ?? "",
  );
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>(
    initial?.requiredLanguage?.level ?? "basico",
  );
  const [jobAvailability, setJobAvailability] = useState<
    (typeof AVAILABILITY)[number] | ""
  >(initial?.availability ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Ao falhar a validação, leva o aviso para a tela (ação do próprio usuário).
  useEffect(() => {
    if (errors.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    errorRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }, [errors]);

  function updatePrerequisite(
    id: string,
    key: "item" | "required",
    value: string | boolean,
  ) {
    setPrerequisites((list) =>
      list.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
    );
  }

  function changeKind(id: string, kind: PrerequisiteKind) {
    setPrerequisites((list) =>
      list.map((p) =>
        p.id === id && p.kind !== kind
          ? { ...p, kind, item: "", required: kind === "skill" }
          : p,
      ),
    );
  }

  async function handleSubmit(): Promise<void> {
    if (pending) return;
    setErrors([]);

    const parseSalary = (raw: string): number | undefined => {
      const trimmed = raw.trim();
      if (trimmed.length === 0) return undefined;
      return Number.parseInt(trimmed, 10);
    };

    const validation = validateJob({
      title,
      description,
      prerequisites: prerequisites.map(({ item, required, kind }) => ({
        item,
        required,
        kind,
      })),
      contractType,
      salaryMin: parseSalary(salaryMin),
      salaryMax: parseSalary(salaryMax),
      location,
      requiredLanguage:
        languageName.trim().length > 0
          ? { name: languageName, level: languageLevel }
          : undefined,
      availability: jobAvailability === "" ? undefined : jobAvailability,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setPending(true);
    try {
      if (initial !== null) {
        await upsert({
          jobId: initial._id,
          ...validation.normalized,
        });
      } else {
        await create(validation.normalized);
      }
      /**
       * [UX-P3] H3-4 — sucesso retorna à lista imediatamente: evita duplo
       * salvamento acidental e devolve o contexto de navegação (a lista
       * reativa já mostra a vaga nova/atualizada).
       */
      onDone();
    } catch (err) {
      // [UX_REFINEMENT] falha do servidor vira Toast amigável; a
      // validação de campo continua inline ("Corrija os pontos abaixo").
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const descriptionLength = description.trim().length;
  const descriptionReady = descriptionLength >= DESCRIPTION_MIN;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="flex flex-col gap-6"
      aria-label={
        initial !== null
          ? "Formulário de edição de vaga"
          : "Formulário de nova vaga"
      }
    >
      {errors.length > 0 ? (
        <div
          ref={errorRef}
          role="alert"
          className="jb-rise flex items-start gap-3 rounded-2xl border border-danger/40 bg-rose-50 px-5 py-4 dark:border-rose-400/30 dark:bg-rose-500/10"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger">
              Corrija os pontos abaixo:
            </p>
            <ul className="mt-1.5 list-disc pl-5 text-sm leading-relaxed text-danger">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* [RECRUITER_UX_UPGRADE] Seção 1 — campos agrupados com ícone. */}
      <Section
        icon={<FileText className="h-4 w-4" />}
        title="Sobre a vaga"
        description="O que o aluno vê primeiro: um título claro e uma descrição que explique a rotina."
      >
        <div className="flex flex-col gap-5">
          <TextField
            label="Título da vaga"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint="Ex.: Estágio em Desenvolvimento Web (5–120 caracteres)"
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="job-description"
              className={`${LABEL_CLASS} after:ml-0.5 after:text-danger after:content-['*']`}
            >
              Descrição
            </label>
            <textarea
              id="job-description"
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Responsabilidades, rotinas, etapa do processo seletivo…"
              maxLength={DESCRIPTION_MAX}
              aria-describedby="job-description-count"
              className={TEXTAREA_CLASS}
            />
            <p
              id="job-description-count"
              className={`text-xs tabular-nums transition-colors duration-150 ${
                descriptionReady
                  ? "font-medium text-success"
                  : "text-a11y-slate-500"
              }`}
              aria-live="polite"
            >
              {descriptionLength}/{DESCRIPTION_MAX} caracteres (mínimo{" "}
              {DESCRIPTION_MIN})
            </p>
          </div>
        </div>
      </Section>

      <Section
        icon={<ListChecks className="h-4 w-4" />}
        title="Pré-requisitos"
        description="Competências do dicionário podem ser obrigatórias: quem não tem não consegue se candidatar. Requisitos descritivos são só informativos."
        aside={
          <span
            className="inline-flex h-7 items-center rounded-full bg-[#FDF2F4] px-3 text-xs font-semibold tabular-nums text-primary ring-1 ring-primary/15 dark:bg-primary/15"
            aria-label={`${prerequisites.length} de ${MAX_PREREQS} pré-requisitos`}
          >
            {prerequisites.length}/{MAX_PREREQS}
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          {prerequisites.map((prereq, index) => {
            const isSkill = prereq.kind === "skill";
            const fieldId = `prereq-field-${prereq.id}`;
            return (
              <div
                key={prereq.id}
                className="jb-rise flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 transition-colors duration-150 dark:border-white/10 dark:bg-white/[0.03] [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="group"
                    aria-label={`Tipo do pré-requisito ${index + 1}`}
                    className="flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5"
                  >
                    {PREREQ_KINDS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={prereq.kind === value}
                        onClick={() => changeKind(prereq.id, value)}
                        className={`inline-flex h-8 items-center rounded-[10px] px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          prereq.kind === value
                            ? "bg-[#FDF2F4] text-primary dark:bg-primary/15"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    aria-label={`Remover pré-requisito ${index + 1}`}
                    onClick={() =>
                      setPrerequisites((list) => list.filter((p) => p.id !== prereq.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remover
                  </Button>
                </div>

                {isSkill ? (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={fieldId}
                      className={`${LABEL_CLASS} after:ml-0.5 after:text-danger after:content-['*']`}
                    >
                      Competência {index + 1}
                    </label>
                    <Combobox
                      id={fieldId}
                      ariaLabel={`Competência do pré-requisito ${index + 1}`}
                      groups={SKILLS_GROUPS}
                      value={prereq.item}
                      onSelect={(term) => updatePrerequisite(prereq.id, "item", term)}
                      placeholder="Busque na lista de competências"
                    />
                  </div>
                ) : (
                  <TextField
                    label={`Requisito ${index + 1}`}
                    required
                    maxLength={PREREQ_TEXT_MAX}
                    value={prereq.item}
                    onChange={(e) => updatePrerequisite(prereq.id, "item", e.target.value)}
                    hint="Ex.: 60% do curso concluído; disponibilidade para viagens. Informativo: não bloqueia candidaturas."
                  />
                )}

                {isSkill ? (
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex w-fit cursor-pointer items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={prereq.required}
                        onChange={(e) =>
                          updatePrerequisite(prereq.id, "required", e.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="relative h-6 w-10 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:ease-[cubic-bezier(0.23,1,0.32,1)] after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 motion-reduce:after:transition-none dark:bg-white/20"
                      />
                      Obrigatório (desmarque para opcional)
                    </label>
                    {prereq.required ? (
                      <p className="flex items-start gap-1.5 text-xs text-a11y-slate-500">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Alunos sem esta competência no perfil não conseguem se candidatar.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {eligibility ? (
            <p className="flex items-start gap-1.5 text-xs text-a11y-slate-500" aria-live="polite">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {eligibility.eligible} de {eligibility.total} alunos do banco de talentos
              têm todas as competências obrigatórias.
            </p>
          ) : null}
          {prerequisites.length < MAX_PREREQS ? (
            <Button
              variant="secondary"
              className="w-fit"
              onClick={() =>
                setPrerequisites((list) => [...list, newPrerequisite()])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar pré-requisito
            </Button>
          ) : null}
        </div>
      </Section>

      {/* [RECRUITER_UX_UPGRADE] Seção 2 — contrato, salário e local. */}
      <Section
        icon={<Banknote className="h-4 w-4" />}
        title="Contrato & Remuneração"
        description="Modelo de contratação, faixa salarial e onde a vaga acontece."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <CustomSelect
              label="Tipo de contrato"
              value={contractType}
              onChange={(v) => setContractType(v as ContractType)}
              placeholder="Selecione"
              options={CONTRACT_TYPES.map((type) => ({
                value: type,
                label: CONTRACT_LABELS[type],
              }))}
            />
            <TextField
              label="Salário mínimo (R$)"
              inputMode="numeric"
              prefix="R$"
              value={salaryMin}
              onChange={(e) => setSalaryMin(digitsOnly(e.target.value))}
              hint="Opcional"
            />
            <TextField
              label="Salário máximo (R$)"
              inputMode="numeric"
              prefix="R$"
              value={salaryMax}
              onChange={(e) => setSalaryMax(digitsOnly(e.target.value))}
              hint="Opcional; deve ser ≥ mínimo"
            />
          </div>

          <TextField
            label="Localização (opcional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            hint="Ex.: Recife/PE ou Remoto"
          />
        </div>
      </Section>

      <Section
        icon={<Target className="h-4 w-4" />}
        title="Matching (opcional)"
        description="Usados no cálculo do % de compatibilidade dos candidatos."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {/* [DICIONARIO_FECHADO] Idioma só da lista oficial (Combobox). */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="job-language" className={LABEL_CLASS}>
              Idioma exigido
            </label>
            <Combobox
              id="job-language"
              ariaLabel="Idioma exigido"
              groups={LANGUAGE_GROUPS}
              value={languageName}
              onSelect={setLanguageName}
              placeholder="Ex.: Inglês"
            />
          </div>
          <CustomSelect
            label="Nível mínimo do idioma"
            disabled={languageName === ""}
            value={languageLevel}
            onChange={(v) => setLanguageLevel(v as LanguageLevel)}
            placeholder="Selecione"
            options={LANGUAGE_LEVELS.map((level) => ({
              value: level,
              label: LEVEL_LABELS[level],
            }))}
          />
          <CustomSelect
            label="Disponibilidade desejada"
            value={jobAvailability}
            onChange={(v) =>
              setJobAvailability(v as (typeof AVAILABILITY)[number] | "")
            }
            placeholder="Qualquer"
            options={[
              { value: "", label: "Qualquer" },
              ...AVAILABILITY.map((value) => ({
                value,
                label: AVAILABILITY_LABELS[value],
              })),
            ]}
          />
        </div>
      </Section>

      {/* Barra de ações fixa: sempre ao alcance, mesmo em formulários longos. */}
      <div
        className={`${SURFACE} sticky bottom-4 z-10 flex flex-wrap items-center gap-3 border-t ${DIVIDER} p-3 sm:p-4`}
      >
        <Button type="submit" variant="primary" disabled={pending}>
          {initial === null && !pending ? (
            <Send className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {pending
            ? "Salvando…"
            : initial !== null
              ? "Salvar alterações"
              : "Publicar vaga"}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          <X className="h-4 w-4" aria-hidden="true" />
          Cancelar
        </Button>
        <p className="ml-auto hidden items-center gap-1.5 text-xs text-a11y-slate-500 md:inline-flex">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Campos com <span className="font-semibold text-danger">*</span> são
          obrigatórios
        </p>
      </div>
    </form>
  );
}