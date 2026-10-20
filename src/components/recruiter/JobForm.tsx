import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Combobox } from "../ui/Combobox";
import {
  Banknote,
  FileText,
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
  type LanguageLevel,
} from "../../lib/skills";
import { AVAILABILITY } from "../../lib/studentProfile";
import {
  CONTRACT_TYPES,
  CONTRACT_LABELS,
  MAX_PREREQS,
  validateJob,
  type ContractType,
  type JobPrerequisite,
} from "../../lib/job";

const DESCRIPTION_MAX = 4000;

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

const LANGUAGE_GROUPS = [{ label: "Idiomas", items: KNOWN_LANGUAGES }];

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

/**
 * Pré-requisito em edição: ganha um `id` local e estável para servir de
 * `key` no React (remover um item do meio não embaralha os inputs).
 * O `id` nunca é enviado ao servidor.
 */
type PrerequisiteDraft = JobPrerequisite & { id: string };

let prerequisiteSeq = 0;
function newPrerequisite(item = "", required = true): PrerequisiteDraft {
  prerequisiteSeq += 1;
  return { id: `prereq-${prerequisiteSeq}`, item, required };
}

/** Mantém só dígitos nos campos de salário. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
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
      ? initial.prerequisites.map((p) => newPrerequisite(p.item, p.required))
      : [newPrerequisite()],
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

  function updatePrerequisite(
    id: string,
    key: keyof JobPrerequisite,
    value: string | boolean,
  ) {
    setPrerequisites((list) =>
      list.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
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
      prerequisites: prerequisites.map(({ item, required }) => ({
        item,
        required,
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
          role="alert"
          className="rounded border border-danger bg-white px-3 py-2"
        >
          <p className="text-sm font-semibold text-danger">
            Corrija os pontos abaixo:
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* [RECRUITER_UX_UPGRADE] Seção 1 — campos agrupados com ícone. */}
      <fieldset className="flex flex-col gap-5 rounded-2xl border border-slate-300 bg-transparent p-8">
        <legend className="flex items-center gap-2 rounded-lg px-1 font-serif text-sm font-bold text-primary">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Sobre a vaga
        </legend>
        <Input
          label="Título da vaga"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint="Ex.: Estágio em Desenvolvimento Web (5–120 caracteres)"
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="job-description"
            className="text-sm font-semibold text-slate-700"
          >
            Descrição
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="job-description"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Responsabilidades, rotinas, etapa do processo seletivo…"
            maxLength={DESCRIPTION_MAX}
            aria-describedby="job-description-count"
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
          <p
            id="job-description-count"
            className="text-xs text-a11y-slate-500"
            aria-live="polite"
          >
            {description.trim().length}/{DESCRIPTION_MAX} caracteres (mínimo 30)
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex items-center gap-2 font-serif text-sm font-bold text-primary pb-3">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Pré-requisitos{" "}
          <span className="font-sans text-xs font-normal text-a11y-slate-500">
            ({prerequisites.length}/{MAX_PREREQS}) — marque se são obrigatórios
          </span>
        </legend>
        {prerequisites.map((prereq, index) => (
          <div
            key={prereq.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 transition-colors hover:border-primary/30"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  label={`Pré-requisito ${index + 1}`}
                  required
                  value={prereq.item}
                  onChange={(e) =>
                    updatePrerequisite(prereq.id, "item", e.target.value)
                  }
                  hint="Ex.: Conclusão de 60% do curso; Inglês técnico…"
                />
              </div>
              <Button
                variant="secondary"
                className="mt-6 h-10 shrink-0"
                aria-label={`Remover pré-requisito ${index + 1}`}
                onClick={() =>
                  setPrerequisites((list) =>
                    list.filter((p) => p.id !== prereq.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remover
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={prereq.required}
                onChange={(e) =>
                  updatePrerequisite(prereq.id, "required", e.target.checked)
                }
                className="accent-primary"
              />
              Obrigatório (desmarque para opcional)
            </label>
          </div>
        ))}
        {prerequisites.length < MAX_PREREQS ? (
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() =>
              setPrerequisites((list) => [...list, newPrerequisite()])
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar pré-requisito
          </Button>
        ) : null}
      </fieldset>

      {/* [RECRUITER_UX_UPGRADE] Seção 2 — contrato, salário e local. */}
      <fieldset className="flex flex-col gap-5 rounded-2xl border border-slate-300 bg-transparent p-8">
        <legend className="flex items-center gap-2 rounded-lg px-1 font-serif text-sm font-bold text-primary">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          Contrato &amp; Remuneração
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">
              Tipo de contrato
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            </span>
            <Select
              className="w-full"
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
            >
              {CONTRACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTRACT_LABELS[type]}
                </option>
              ))}
            </Select>
          </label>
          <Input
            label="Salário mínimo (R$)"
            inputMode="numeric"
            value={salaryMin}
            onChange={(e) => setSalaryMin(digitsOnly(e.target.value))}
            hint="Opcional"
          />
          <Input
            label="Salário máximo (R$)"
            inputMode="numeric"
            value={salaryMax}
            onChange={(e) => setSalaryMax(digitsOnly(e.target.value))}
            hint="Opcional; deve ser ≥ mínimo"
          />
        </div>

        <Input
          label="Localização (opcional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          hint="Ex.: Recife/PE ou Remoto"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex items-center gap-2 font-serif text-sm font-bold text-primary pb-3">
          <Target className="h-4 w-4" aria-hidden="true" />
          Matching (opcional) —{" "}
          <span className="font-sans text-xs font-normal text-a11y-slate-500">
            usados no cálculo do % de compatibilidade dos candidatos
          </span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* [UX-P3] H6-1 — sugestões nativas via datalist (sem libs). */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="job-language"
              className="text-sm font-semibold text-slate-700"
            >
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
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">
              Nível mínimo do idioma
            </span>
            <Select
              className="w-full"
              value={languageLevel}
              onChange={(e) =>
                setLanguageLevel(e.target.value as LanguageLevel)
              }
            >
              {LANGUAGE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-700">
              Disponibilidade desejada
            </span>
            <Select
              className="w-full"
              value={jobAvailability}
              onChange={(e) =>
                setJobAvailability(
                  e.target.value as (typeof AVAILABILITY)[number] | "",
                )
              }
            >
              <option value="">Qualquer</option>
              {AVAILABILITY.map((value) => (
                <option key={value} value={value}>
                  {AVAILABILITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
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
      </div>
    </form>
  );
}