import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  MAX_ACADEMIC,
  MAX_CERTIFICATIONS,
  MAX_EXPERIENCES,
  PROJECTS_TEXT_MAX,
  SUMMARY_MAX,
  SUMMARY_MIN,
  validateResumeData,
  type AcademicEntry,
} from "../../lib/resume";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_LEVELS,
  MAX_LANGUAGES,
  MAX_SKILLS,
  addSkill,
  removeSkill,
  validateLanguages,
  type LanguageEntry,
} from "../../lib/skills";

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

const LEVEL_LABELS: Record<LanguageEntry["level"], string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

/**
 * Currículo Vitae (issue [S2-1] + REFACTOR_ALUNO Etapa 2) — os 7 blocos
 * do construtor em um único formulário:
 *  1. Dados Pessoais & Apresentação Profissional
 *  2. Formação Acadêmica Institucional UNICAP (dados + histórico)
 *  3. Links Profissionais, Portfólio & Lattes
 *  4. Competências & Tecnologias (Skills)
 *  5. Idiomas & Nível de Proficiência
 *  6. Experiências Profissionais e Projetos de Extensão (texto livre)
 *  7. Certificações & Atividades Complementares
 *
 * Regras compartilhadas com o servidor (src/lib/resume.ts e
 * src/lib/skills.ts); persistência via `students.saveResumeData` e
 * `students.saveSkillsAndLanguages` (R7).
 */
export function ResumeForm() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const saveResume = useMutation(api.students.saveResumeData);
  const saveSkills = useMutation(api.students.saveSkillsAndLanguages);

  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [academicHistory, setAcademicHistory] = useState<AcademicDraft[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [lattesUrl, setLattesUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [projectsText, setProjectsText] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
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
        setGithubUrl(resume.links?.github ?? "");
        setLattesUrl(resume.links?.lattes ?? "");
        setProjectsText(resume.projectsText ?? "");
        setCertifications(resume.certifications ?? []);
      }
      setSkills(profile.skills ?? []);
      setLanguages(profile.languages ?? []);
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

  function addSkillDraft() {
    if (skillDraft.trim().length === 0) return;
    setSkills((list) => addSkill(list, skillDraft));
    setSkillDraft("");
  }

  function addLanguage() {
    if (languages.length >= MAX_LANGUAGES) return;
    setLanguages((list) => [...list, { name: "", level: "basico" }]);
  }

  function updateLanguage(
    index: number,
    key: keyof LanguageEntry,
    value: string,
  ) {
    setLanguages((list) =>
      list.map((language, i) =>
        i === index
          ? {
              ...language,
              [key]:
                key === "level" ? (value as LanguageEntry["level"]) : value,
            }
          : language,
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

    // Idiomas: mesma validação do servidor (mensagens antes do envio).
    const languagesCheck = validateLanguages(languages);
    if (!languagesCheck.ok) {
      setErrors(languagesCheck.errors);
      return;
    }

    const validation = validateResumeData({
      headline,
      summary,
      experiences,
      academicHistory: academic,
      links: { github: githubUrl, lattes: lattesUrl },
      projectsText,
      certifications,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setPending(true);
    try {
      await saveResume(validation.normalized);
      await saveSkills({ skills, languages });
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
      className="flex flex-col gap-6"
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

      {/* BLOCO 1 — Dados Pessoais & Apresentação Profissional. */}
      <section
        id="bloco-pessoais"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            1. Dados Pessoais &amp; Apresentação Profissional
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dados do cadastro (somente leitura) e sua apresentação profissional
            — a primeira impressão de quem lê seu CV.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome completo
            </span>
            <span className="font-medium text-slate-800">
              {profile.fullName}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Matrícula
            </span>
            <span className="font-medium text-slate-800">
              {profile.enrollment}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cidade
            </span>
            <span className="font-medium text-slate-800">
              {profile.location ?? "—"}
            </span>
          </p>
        </div>
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
            {summary.trim().length}/{SUMMARY_MAX} caracteres (mínimo{" "}
            {SUMMARY_MIN})
          </p>
        </div>
      </section>

      {/* BLOCO 2 — Formação Acadêmica Institucional UNICAP. */}
      <section
        id="bloco-academico"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            2. Formação Acadêmica Institucional UNICAP
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dados acadêmicos do cadastro e seu histórico — a graduação entra
            automaticamente no PDF quando você não a lista.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Curso de graduação
            </span>
            <span className="font-medium text-slate-800">{profile.course}</span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Previsão de conclusão
            </span>
            <span className="font-medium text-slate-800">
              {profile.graduationYear}
              {profile.semester !== undefined && profile.semester !== null
                ? ` · ${profile.semester}º semestre`
                : ""}
            </span>
          </p>
        </div>
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
                  onChange={(e) =>
                    updateAcademic(index, "item", e.target.value)
                  }
                  hint="Ex.: Bacharelado em Direção — UNICAP (concluído)"
                />
              </div>
              <div className="w-28">
                <Input
                  label="Ano"
                  required
                  inputMode="numeric"
                  value={entry.year}
                  onChange={(e) =>
                    updateAcademic(index, "year", e.target.value)
                  }
                />
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setAcademicHistory((list) =>
                    list.filter((_, i) => i !== index),
                  )
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
      </section>

      {/* BLOCO 3 — Links Profissionais, Portfólio & Lattes. */}
      <section
        id="bloco-links"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            3. Links Profissionais, Portfólio &amp; Lattes
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            LinkedIn e portfólio vêm do seu cadastro (menu Meu Perfil); GitHub e
            Lattes são editados aqui e saem no PDF.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              LinkedIn
            </span>
            <span className="break-all font-medium text-slate-800">
              {profile.linkedinUrl ?? "Não cadastrado"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Portfólio
            </span>
            <span className="break-all font-medium text-slate-800">
              {profile.portfolioUrl ?? "Não cadastrado"}
            </span>
          </p>
          <Input
            label="GitHub / GitLab"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/seu-usuario"
            hint="Opcional — https://"
          />
          <Input
            label="Currículo Lattes (CNPq)"
            type="url"
            value={lattesUrl}
            onChange={(e) => setLattesUrl(e.target.value)}
            placeholder="http://lattes.cnpq.br/id-cnpq"
            hint="Opcional — http(s)://"
          />
        </div>
      </section>

      {/* BLOCO 4 — Competências & Tecnologias (Skills). */}
      <section
        id="bloco-competencias"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            4. Competências &amp; Tecnologias (Skills)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            As mesmas competências usadas no matching com vagas (R8) — quanto
            mais fiel, maior seu percentual de compatibilidade.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Competências atuais">
          {skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma competência adicionada ainda.
            </p>
          ) : (
            skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {skill}
                <button
                  type="button"
                  aria-label={`Remover competência ${skill}`}
                  onClick={() => setSkills((list) => removeSkill(list, skill))}
                  className="text-slate-400 transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <Input
              label="Nova competência"
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              hint={`${skills.length}/${MAX_SKILLS} — pressione Adicionar`}
            />
          </div>
          <Button variant="secondary" onClick={addSkillDraft}>
            + Adicionar competência
          </Button>
        </div>
      </section>

      {/* BLOCO 5 — Idiomas & Nível de Proficiência. */}
      <section
        id="bloco-idiomas"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            5. Idiomas &amp; Nível de Proficiência
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ({languages.length}/{MAX_LANGUAGES}) — contam para o bônus de idioma
            do matching quando a vaga exige.
          </p>
        </div>
        <datalist id="known-languages">
          {KNOWN_LANGUAGES.map((language) => (
            <option key={language} value={language} />
          ))}
        </datalist>
        {languages.map((language, index) => (
          <div
            key={index}
            className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="min-w-40 flex-1">
              <Input
                label="Idioma"
                required
                list="known-languages"
                value={language.name}
                onChange={(e) => updateLanguage(index, "name", e.target.value)}
              />
            </div>
            <div className="w-44">
              <label
                htmlFor={`language-level-${index}`}
                className="text-sm font-semibold text-slate-700"
              >
                Nível
              </label>
              <select
                id={`language-level-${index}`}
                value={language.level}
                onChange={(e) => updateLanguage(index, "level", e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setLanguages((list) => list.filter((_, i) => i !== index))
              }
            >
              Remover
            </Button>
          </div>
        ))}
        {languages.length < MAX_LANGUAGES ? (
          <Button variant="secondary" onClick={addLanguage}>
            + Adicionar idioma
          </Button>
        ) : null}
      </section>

      {/* BLOCO 6 — Experiências Profissionais e Projetos de Extensão. */}
      <section
        id="bloco-experiencias"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            6. Experiências Profissionais e Projetos de Extensão
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Experiências em cards e projetos de extensão em um único campo de
            texto (sem recriar as tabelas do módulo cancelado).
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
        <div className="flex flex-col gap-1">
          <label
            htmlFor="resume-projects"
            className="text-sm font-semibold text-slate-700"
          >
            Projetos de Extensão (texto livre)
          </label>
          <textarea
            id="resume-projects"
            rows={3}
            value={projectsText}
            maxLength={PROJECTS_TEXT_MAX}
            onChange={(e) => setProjectsText(e.target.value)}
            placeholder="Ex.: Monitoria de Banco de Dados I (2024.2); Feira de Ciências — oficina de Python…"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
          <p className="text-xs text-slate-500">
            {projectsText.trim().length}/{PROJECTS_TEXT_MAX} caracteres
          </p>
        </div>
      </section>

      {/* BLOCO 7 — Certificações & Atividades Complementares. */}
      <section
        id="bloco-certificacoes"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
      >
        <div>
          <h2 className="font-serif text-lg font-bold text-primary">
            7. Certificações &amp; Atividades Complementares
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ({certifications.length}/{MAX_CERTIFICATIONS}) — cursos,
            certificados e atividades que reforçam seu perfil.
          </p>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Certificações e atividades</legend>
          {certifications.map((item, index) => (
            <div
              key={index}
              className="flex items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex-1">
                <Input
                  label={`Certificação ${index + 1}`}
                  required
                  value={item}
                  onChange={(e) =>
                    setCertifications((list) =>
                      list.map((current, i) =>
                        i === index ? e.target.value : current,
                      ),
                    )
                  }
                  hint="Ex.: Cisco CCNA, Excel Avançado, Scrum Fundamentals"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setCertifications((list) =>
                    list.filter((_, i) => i !== index),
                  )
                }
              >
                Remover
              </Button>
            </div>
          ))}
          {certifications.length < MAX_CERTIFICATIONS ? (
            <Button
              variant="secondary"
              onClick={() => setCertifications((list) => [...list, ""])}
            >
              + Adicionar certificação
            </Button>
          ) : null}
        </fieldset>
      </section>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar currículo"}
        </Button>
      </div>
    </form>
  );
}
