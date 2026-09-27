import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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

const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY)[number], string> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

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
 */
export function JobForm({ initial = null, onDone }: JobFormProps) {
  const upsert = useMutation(api.jobs.upsertJob);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prerequisites, setPrerequisites] = useState<JobPrerequisite[]>([
    { item: "", required: true },
  ]);
  const [contractType, setContractType] = useState<ContractType>("estagio");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [location, setLocation] = useState("");
  const [languageName, setLanguageName] = useState("");
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("basico");
  const [jobAvailability, setJobAvailability] = useState<
    (typeof AVAILABILITY)[number] | ""
  >("");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Pré-preenche no modo edição (idempotente).
  useEffect(() => {
    if (initial !== null && !loaded) {
      setTitle(initial.title);
      setDescription(initial.description);
      setPrerequisites(
        initial.prerequisites.length > 0
          ? initial.prerequisites.map((p) => ({ ...p }))
          : [{ item: "", required: true }],
      );
      setContractType(initial.contractType);
      setSalaryMin(
        initial.salaryMin !== undefined ? String(initial.salaryMin) : "",
      );
      setSalaryMax(
        initial.salaryMax !== undefined ? String(initial.salaryMax) : "",
      );
      setLocation(initial.location ?? "");
      setLanguageName(initial.requiredLanguage?.name ?? "");
      setLanguageLevel(initial.requiredLanguage?.level ?? "basico");
      setJobAvailability(initial.availability ?? "");
      setLoaded(true);
    }
  }, [initial, loaded]);

  function updatePrereq(
    index: number,
    key: keyof JobPrerequisite,
    value: string | boolean,
  ) {
    setPrerequisites((list) =>
      list.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    );
  }

  async function handleSubmit(): Promise<void> {
    setErrors([]);
    setNotice(null);

    const parseSalary = (raw: string): number | undefined => {
      const trimmed = raw.trim();
      if (trimmed.length === 0) return undefined;
      return Number.parseInt(trimmed, 10);
    };

    const validation = validateJob({
      title,
      description,
      prerequisites,
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
      await upsert({
        jobId: initial?._id,
        ...validation.normalized,
      });
      /**
       * [UX-P3] H3-4 — sucesso retorna à lista imediatamente: evita duplo
       * salvamento acidental e devolve o contexto de navegação (a lista
       * reativa já mostra a vaga nova/atualizada).
       */
      onDone();
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : "Falha ao salvar a vaga.",
      ]);
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
      className="flex flex-col gap-4"
      aria-label={
        initial !== null
          ? "Formulário de edição de vaga"
          : "Formulário de nova vaga"
      }
    >
      {notice !== null ? (
        <p
          role="status"
          className="rounded border border-success bg-white px-3 py-2 text-sm font-medium text-success"
        >
          {notice}{" "}
          <button
            type="button"
            onClick={onDone}
            className="font-semibold underline"
          >
            ← Voltar para a lista
          </button>
        </p>
      ) : null}

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
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <p
          id="job-description-count"
          className="text-xs text-slate-500"
          aria-live="polite"
        >
          {description.trim().length}/{DESCRIPTION_MAX} caracteres (mínimo 30)
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Pré-requisitos{" "}
          <span className="font-normal text-xs text-slate-500">
            ({prerequisites.length}/{MAX_PREREQS}) — marque se são obrigatórios
          </span>
        </legend>
        {prerequisites.map((prereq, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={`Pré-requisito ${index + 1}`}
                  required
                  value={prereq.item}
                  onChange={(e) => updatePrereq(index, "item", e.target.value)}
                  hint="Ex.: Conclusão de 60% do curso; Inglês técnico…"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setPrerequisites((list) => list.filter((_, i) => i !== index))
                }
              >
                Remover
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={prereq.required}
                onChange={(e) =>
                  updatePrereq(index, "required", e.target.checked)
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
            onClick={() =>
              setPrerequisites((list) => [
                ...list,
                { item: "", required: true },
              ])
            }
          >
            + Adicionar pré-requisito
          </Button>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Tipo de contrato
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          </span>
          <select
            value={contractType}
            onChange={(e) => setContractType(e.target.value as ContractType)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            {CONTRACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTRACT_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Salário mínimo (R$)"
          inputMode="numeric"
          value={salaryMin}
          onChange={(e) => setSalaryMin(e.target.value)}
          hint="Opcional"
        />
        <Input
          label="Salário máximo (R$)"
          inputMode="numeric"
          value={salaryMax}
          onChange={(e) => setSalaryMax(e.target.value)}
          hint="Opcional; deve ser ≥ mínimo"
        />
      </div>

      <Input
        label="Localização (opcional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        hint="Ex.: Recife/PE ou Remoto"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Matching (opcional) —{" "}
          <span className="font-normal text-xs text-slate-500">
            usados no cálculo do % de compatibilidade dos candidatos
          </span>
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* [UX-P3] H6-1 — sugestões nativas via datalist (sem libs). */}
          <input
            type="text"
            value={languageName}
            onChange={(e) => setLanguageName(e.target.value)}
            placeholder="Idioma exigido (ex.: Inglês)"
            aria-label="Idioma exigido"
            list="job-language-options"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <datalist id="job-language-options">
            {KNOWN_LANGUAGES.map((language) => (
              <option key={language} value={language} />
            ))}
          </datalist>
          <select
            value={languageLevel}
            onChange={(e) => setLanguageLevel(e.target.value as LanguageLevel)}
            aria-label="Nível mínimo do idioma"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            {LANGUAGE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          <select
            value={jobAvailability}
            onChange={(e) =>
              setJobAvailability(
                e.target.value as (typeof AVAILABILITY)[number] | "",
              )
            }
            aria-label="Disponibilidade desejada"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">Disponibilidade: qualquer</option>
            {AVAILABILITY.map((value) => (
              <option key={value} value={value}>
                {AVAILABILITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending
            ? "Salvando…"
            : initial !== null
              ? "Salvar alterações"
              : "Publicar vaga"}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
