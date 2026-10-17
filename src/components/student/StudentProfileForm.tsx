import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Combobox } from "../ui/Combobox";
import {
  AVAILABILITY,
  ENROLLMENT_STATUS,
  validateStudentProfile,
  type Availability,
  type EnrollmentStatus,
} from "../../lib/studentProfile";
import {
  KNOWN_LANGUAGES,
  SKILLS_GROUPS,
  addLanguage,
  addSkill,
  LANGUAGE_LEVELS,
  MAX_LANGUAGES,
  MAX_SKILLS,
  removeLanguage,
  removeSkill,
  validateLanguages,
  type LanguageEntry,
  type LanguageLevel,
} from "../../lib/skills";
import { Plus, Save } from "lucide-react";

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ativo: "Aluno ativo",
  egresso: "Egresso (formado)",
  inativo: "Inativo",
};

const AVAILABILITY_LABELS: Record<Availability, string> = {
  estagio: "Estágio",
  integral: "Integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

type FormState = {
  fullName: string;
  enrollment: string;
  status: EnrollmentStatus;
  course: string;
  graduationYear: string;
  semester: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  /** [QUICK_WIN_MULTI] multi-seleção (checkboxes). */
  availability: Availability[];
};

const EMPTY_FORM: FormState = {
  fullName: "",
  enrollment: "",
  status: "ativo",
  course: "",
  graduationYear: "",
  semester: "",
  location: "",
  linkedinUrl: "",
  portfolioUrl: "",
  availability: ["estagio"],
};

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

// [UX COMBOBOX] Os campos de dicionário (competências/idiomas) agora são
// o Combobox pesquisável de `../ui/Combobox` — o select nativo não
// escala com centenas de opções. Só o nível do idioma continua select.

/**
 * Cadastro/perfil do aluno (issue [S1-3]): dados pessoais, curso,
 * semestre/ano, matrícula única e status de vínculo (R1).
 * Validação com a mesma regra pura do servidor; salvamento via
 * `students.upsertProfile` (exige consentimento vigente, R7).
 */
export function StudentProfileForm() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const upsert = useMutation(api.students.upsertProfile);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [languageName, setLanguageName] = useState("");
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("basico");

  // Opções do combobox de competências — já escolhidas saem da lista.
  const availableSkillGroups = SKILLS_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter(
      (item) =>
        !skills.some((skill) => skill.toLowerCase() === item.toLowerCase()),
    ),
  })).filter((group) => group.items.length > 0);

  // Pré-preenche com o perfil existente (upsert idempotente).
  useEffect(() => {
    if (profile !== undefined && profile !== null && !loaded) {
      setForm({
        fullName: profile.fullName,
        enrollment: profile.enrollment,
        status: profile.status,
        course: profile.course,
        graduationYear: String(profile.graduationYear),
        semester:
          profile.semester !== undefined ? String(profile.semester) : "",
        location: profile.location ?? "",
        linkedinUrl: profile.linkedinUrl ?? "",
        portfolioUrl: profile.portfolioUrl ?? "",
        availability: profile.availability,
      });
      setSkills(profile.skills ?? []);
      setLanguages(profile.languages ?? []);
      setLoaded(true);
    }
  }, [profile, loaded]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setErrors([]);

    const graduationYear = Number.parseInt(form.graduationYear, 10);
    if (!Number.isFinite(graduationYear)) {
      setErrors(["Informe o ano de formação."]);
      return;
    }
    const semesterRaw = form.semester.trim();
    const semester =
      semesterRaw.length > 0 ? Number.parseInt(semesterRaw, 10) : undefined;
    if (semesterRaw.length > 0 && !Number.isFinite(semester)) {
      setErrors(["Semestre deve ser um número."]);
      return;
    }

    const validation = validateStudentProfile({
      fullName: form.fullName,
      enrollment: form.enrollment,
      status: form.status,
      course: form.course,
      graduationYear,
      semester,
      location: form.location,
      linkedinUrl: form.linkedinUrl,
      portfolioUrl: form.portfolioUrl,
      availability: form.availability,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    // [S1-5] — idiomas validados no cliente também (níveis/duplicatas/limite).
    const languagesCheck = validateLanguages(languages);
    if (!languagesCheck.ok) {
      setErrors(languagesCheck.errors);
      return;
    }

    setPending(true);
    try {
      const result = await upsert({
        ...validation.normalized,
        skills,
        languages,
      });
      // [UX_REFINEMENT] sucesso e falha do servidor viram Toast global.
      toast.success(
        result.created
          ? "Perfil criado com sucesso."
          : "Perfil atualizado com sucesso.",
      );
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (profile === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando perfil…
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
      aria-label="Formulário de perfil do aluno"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome completo"
          required
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Matrícula"
          required
          inputMode="numeric"
          value={form.enrollment}
          onChange={(e) => set("enrollment", e.target.value)}
          hint="6 a 12 dígitos"
        />
        <Input
          label="Curso"
          required
          value={form.course}
          onChange={(e) => set("course", e.target.value)}
        />
        <Input
          label="Ano de formação"
          required
          inputMode="numeric"
          value={form.graduationYear}
          onChange={(e) => set("graduationYear", e.target.value)}
        />
        <Input
          label="Semestre atual (opcional)"
          inputMode="numeric"
          value={form.semester}
          onChange={(e) => set("semester", e.target.value)}
        />
        <Input
          label="Cidade/UF (opcional)"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Status de vínculo
        </legend>
        <div className="flex flex-wrap gap-2">
          {ENROLLMENT_STATUS.map((status) => (
            <label
              key={status}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                form.status === status
                  ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                  : "border-slate-300 bg-white text-slate-700 hover:border-primary"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={status}
                checked={form.status === status}
                onChange={() => set("status", status)}
                className="accent-primary"
              />
              {STATUS_LABELS[status]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Disponibilidade
        </legend>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY.map((availability) => (
            <label
              key={availability}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                form.availability.includes(availability)
                  ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                  : "border-slate-300 bg-white text-slate-700 hover:border-primary"
              }`}
            >
              <input
                type="checkbox"
                name="availability"
                value={availability}
                checked={form.availability.includes(availability)}
                onChange={() =>
                  set(
                    "availability",
                    form.availability.includes(availability)
                      ? form.availability.filter(
                          (entry) => entry !== availability,
                        )
                      : [...form.availability, availability],
                  )
                }
                className="accent-primary"
              />
              {AVAILABILITY_LABELS[availability]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="LinkedIn (opcional)"
          type="url"
          placeholder="https://www.linkedin.com/in/…"
          value={form.linkedinUrl}
          onChange={(e) => set("linkedinUrl", e.target.value)}
        />
        <Input
          label="GitHub / Portfólio (opcional)"
          type="url"
          placeholder="https://github.com/…"
          value={form.portfolioUrl}
          onChange={(e) => set("portfolioUrl", e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Competências{" "}
          <span className="font-normal text-xs text-slate-500">
            ({skills.length}/{MAX_SKILLS})
          </span>
        </legend>
        <div className="flex gap-2">
          {/* [DICIONARIO_FECHADO] combobox pesquisável: sem texto livre —
              só se CONFIRMA um termo do dicionário oficial (digitação sem
              resultado mostra "Nenhum resultado" e o Adicionar fica
              desabilitado). */}
          <Combobox
            ariaLabel="Nova competência"
            groups={availableSkillGroups}
            value={skillDraft}
            onSelect={setSkillDraft}
            placeholder="Selecione no dicionário oficial…"
          />
          <Button
            className="mt-4 h-10 shrink-0"
            variant="secondary"
            disabled={skillDraft.trim().length === 0}
            onClick={() => {
              setSkills((s) => addSkill(s, skillDraft));
              setSkillDraft("");
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar
          </Button>
        </div>
        {skills.length > 0 ? (
          <ul
            className="flex flex-wrap gap-2"
            aria-label="Competências cadastradas"
          >
            {skills.map((skill) => (
              <li key={skill}>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills((s) => removeSkill(s, skill))}
                    aria-label={`Remover competência ${skill}`}
                    className="text-primary/70 hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-a11y-slate-500">
            Nenhuma competência ainda.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Idiomas{" "}
          <span className="font-normal text-xs text-slate-500">
            ({languages.length}/{MAX_LANGUAGES})
          </span>
        </legend>
        <div className="flex flex-col items-start gap-2 sm:flex-row">
          <div className="flex w-full flex-col gap-1 sm:max-w-48">
            {/* [DICIONARIO_FECHADO] combobox pesquisável: só idiomas da
                whitelist oficial, filtráveis digitando (50+ idiomas). */}
            <Combobox
              ariaLabel="Novo idioma"
              groups={[
                {
                  label: "Idiomas",
                  items: KNOWN_LANGUAGES.filter(
                    (known) =>
                      !languages.some(
                        (lang) =>
                          lang.name.toLowerCase() === known.toLowerCase(),
                      ),
                  ),
                },
              ]}
              value={languageName}
              onSelect={setLanguageName}
              placeholder="Selecione o idioma…"
            />
          </div>
          <select
            value={languageLevel}
            onChange={(e) => setLanguageLevel(e.target.value as LanguageLevel)}
            className="w-full sm:w-auto appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke-width=%222%22%20stroke=%22%2394a3b8%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[size:1.25em_1.25em] h-10 rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            aria-label="Nível do idioma"
          >
            {LANGUAGE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          <Button
            className="h-10 shrink-0"
            variant="secondary"
            disabled={languageName.trim().length === 0}
            onClick={() => {
              setLanguages((ls) =>
                addLanguage(ls, { name: languageName, level: languageLevel }),
              );
              setLanguageName("");
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar
          </Button>
        </div>
        {languages.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Idiomas cadastrados">
            {languages.map((lang) => (
              <li key={lang.name}>
                <span className="inline-flex items-center gap-1 rounded-full border border-secondary bg-white px-3 py-1 text-xs font-semibold text-slate-800">
                  {lang.name} · {LEVEL_LABELS[lang.level]}
                  <button
                    type="button"
                    onClick={() =>
                      setLanguages((ls) => removeLanguage(ls, lang.name))
                    }
                    aria-label={`Remover idioma ${lang.name}`}
                    className="text-slate-500 hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-a11y-slate-500">Nenhum idioma ainda.</p>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {pending ? "Salvando…" : "Salvar perfil"}
        </Button>
        <p className="text-xs text-slate-500">
          Alunos com status “Inativo” não aparecem nas buscas de recrutadores
          (regra de vínculo).
        </p>
      </div>
    </form>
  );
}
