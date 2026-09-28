import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  MAX_ACADEMIC,
  MAX_EXPERIENCES,
  SUMMARY_MAX,
  SUMMARY_MIN,
  validateResumeData,
  type AcademicEntry,
} from "../../lib/resume";

type ExperienceDraft = {
  company: string;
  role: string;
  period: string;
  description: string;
};

type AcademicDraft = {
  item: string;
  year: string;
};

const EMPTY_EXPERIENCE: ExperienceDraft = {
  company: "",
  role: "",
  period: "",
  description: "",
};

const EMPTY_ACADEMIC: AcademicDraft = { item: "", year: "" };

/**
 * Currículo Vitae (issue [S2-1]) — headline, resumo, experiências
 * profissionais e histórico acadêmico. Regras compartilhadas com o servidor
 * (src/lib/resume.ts); persistência em `students.resumeData` via
 * `students.saveResumeData` (exige consentimento vigente, R7).
 */
export function ResumeForm() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const saveResume = useMutation(api.students.saveResumeData);

  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [academicHistory, setAcademicHistory] = useState<AcademicDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Pré-preenche com o CV salvo (edição idempotente).
  useEffect(() => {
    if (profile !== undefined && profile !== null && !loaded) {
      const resume = profile.resumeData;
      if (resume !== undefined) {
        setHeadline(resume.headline);
        setSummary(resume.summary);
        setExperiences(
          resume.experiences.map((e) => ({
            company: e.company,
            role: e.role,
            period: e.period,
            description: e.description,
          })),
        );
        setAcademicHistory(
          resume.academicHistory.map((a) => ({
            item: a.item,
            year: String(a.year),
          })),
        );
      }
      setLoaded(true);
    }
  }, [profile, loaded]);

  function updateExperience(
    index: number,
    key: keyof ExperienceDraft,
    value: string,
  ) {
    setExperiences((list) =>
      list.map((exp, i) => (i === index ? { ...exp, [key]: value } : exp)),
    );
  }

  function updateAcademic(
    index: number,
    key: keyof AcademicDraft,
    value: string,
  ) {
    setAcademicHistory((list) =>
      list.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setErrors([]);
    setNotice(null);

    // Histórico: ano vazio ou inválido vira erro de formulário antes do
    // servidor (mensagens claras, CA 2).
    const academic: AcademicEntry[] = [];
    for (const [i, entry] of academicHistory.entries()) {
      const year = Number.parseInt(entry.year, 10);
      if (!Number.isFinite(year)) {
        setErrors([`Histórico ${i + 1}: informe o ano (número).`]);
        return;
      }
      academic.push({ item: entry.item, year });
    }

    const validation = validateResumeData({
      headline,
      summary,
      experiences,
      academicHistory: academic,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setPending(true);
    try {
      await saveResume(validation.normalized);
      setNotice("Currículo salvo com sucesso.");
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : "Falha ao salvar o currículo.",
      ]);
    } finally {
      setPending(false);
    }
  }

  if (profile === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando currículo…
      </p>
    );
  }

  if (profile === null) {
    return (
      <p className="text-sm text-slate-600">
        Complete o cadastro do perfil antes de preencher o currículo.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(e);
      }}
      className="flex flex-col gap-4"
      aria-label="Formulário de currículo vitae"
    >
      {notice !== null ? (
        <p
          role="status"
          className="rounded border border-success bg-white px-3 py-2 text-sm font-medium text-success"
        >
          {notice}
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
        label="Headline"
        required
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        hint="Ex.: Estudante de Sistemas para Internet focado em back-end (10–120 caracteres)"
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="resume-summary"
          className="text-sm font-semibold text-slate-700"
        >
          Resumo profissional
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="resume-summary"
          required
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Quem você é, o que você faz e o que procura…"
          maxLength={SUMMARY_MAX}
          aria-describedby="resume-summary-count"
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        />
        <p
          id="resume-summary-count"
          className="text-xs text-slate-500"
          aria-live="polite"
        >
          {summary.trim().length}/{SUMMARY_MAX} caracteres (mínimo {SUMMARY_MIN}
          )
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-slate-700">
          Experiências profissionais{" "}
          <span className="font-normal text-xs text-slate-500">
            ({experiences.length}/{MAX_EXPERIENCES})
          </span>
        </legend>
        {experiences.map((exp, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                label="Empresa"
                required
                value={exp.company}
                onChange={(e) =>
                  updateExperience(index, "company", e.target.value)
                }
              />
              <Input
                label="Cargo"
                required
                value={exp.role}
                onChange={(e) =>
                  updateExperience(index, "role", e.target.value)
                }
              />
              <Input
                label="Período"
                required
                value={exp.period}
                onChange={(e) =>
                  updateExperience(index, "period", e.target.value)
                }
                hint="Ex.: 2023–2025 ou 2024–Atual"
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-700">
                Descrição (opcional)
              </span>
              <textarea
                rows={2}
                value={exp.description}
                onChange={(e) =>
                  updateExperience(index, "description", e.target.value)
                }
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </label>
            <Button
              variant="secondary"
              onClick={() =>
                setExperiences((list) => list.filter((_, i) => i !== index))
              }
            >
              Remover experiência
            </Button>
          </div>
        ))}
        {experiences.length < MAX_EXPERIENCES ? (
          <Button
            variant="secondary"
            onClick={() =>
              setExperiences((list) => [...list, { ...EMPTY_EXPERIENCE }])
            }
          >
            + Adicionar experiência
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-slate-700">
          Histórico acadêmico{" "}
          <span className="font-normal text-xs text-slate-500">
            ({academicHistory.length}/{MAX_ACADEMIC})
          </span>
        </legend>
        {academicHistory.map((entry, index) => (
          <div
            key={index}
            className="flex items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex-1">
              <Input
                label="Item"
                required
                value={entry.item}
                onChange={(e) => updateAcademic(index, "item", e.target.value)}
                hint="Ex.: Bacharelado em Direção — UNICAP (concluído)"
              />
            </div>
            <div className="w-28">
              <Input
                label="Ano"
                required
                inputMode="numeric"
                value={entry.year}
                onChange={(e) => updateAcademic(index, "year", e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setAcademicHistory((list) => list.filter((_, i) => i !== index))
              }
            >
              Remover
            </Button>
          </div>
        ))}
        {academicHistory.length < MAX_ACADEMIC ? (
          <Button
            variant="secondary"
            onClick={() =>
              setAcademicHistory((list) => [...list, { ...EMPTY_ACADEMIC }])
            }
          >
            + Adicionar item ao histórico
          </Button>
        ) : null}
      </fieldset>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar currículo"}
        </Button>
      </div>
    </form>
  );
}
