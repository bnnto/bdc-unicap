import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
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
import { isValidUrl } from "../../lib/studentProfile";
import {
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
 * Rótulos dos 7 blocos do currículo (ícone de lápis em cada um,
 * Etapa 2 do UX_REFINEMENT). `label` curto vai no aria-label do lápis;
 * `heading` rico é o título h2 exibido na página (spec dos 7 blocos).
 */
const BLOCK_LABELS: Array<{
  index: number;
  label: string;
  heading: string;
}> = [
  {
    index: 0,
    label: "Dados Pessoais",
    heading: "Dados Pessoais & Apresentação Profissional",
  },
  {
    index: 1,
    label: "Formação",
    heading: "Formação Acadêmica Institucional UNICAP",
  },
  {
    index: 2,
    label: "Links",
    heading: "Links Profissionais, Portfólio & Lattes",
  },
  {
    index: 3,
    label: "Competências",
    heading: "Competências & Tecnologias (Skills)",
  },
  {
    index: 4,
    label: "Idiomas",
    heading: "Idiomas & Nível de Proficiência",
  },
  {
    index: 5,
    label: "Experiências",
    heading: "Experiências Profissionais e Projetos de Extensão",
  },
  {
    index: 6,
    label: "Certificações",
    heading: "Certificações & Atividades Complementares",
  },
];

const BLOCO_IDS = [
  "pessoais",
  "academico",
  "links",
  "competencias",
  "idiomas",
  "experiencias",
  "certificacoes",
] as const;

/**
 * Currículo Vitae (issue [S2-1] + REFATOR_ALUNO Etapa 2) — os 7 blocos do
 * construtor em um único formulário, com EDIÇÃO INLINE por bloco:
 *
 *  - Cada bloco nasce em modo de VISUALIZAÇÃO com um ícone de lápis
 *    (`aria-label="Editar <Bloco>"`), no canto superior direito.
 *  - Ao clicar no lápis, os campos de texto desse bloco específico
 *    tornam-se editáveis no próprio local; o bloco volta à visualização
 *    ao Salvar ou Cancelar.
 *  - Salvar persiste via `students.saveResumeData` e
 *    `students.saveSkillsAndLanguages`; em caso de erro de servidor o
 *    erro vira Toast global (Etapa 1 do UX_REFINEMENT) e o rascunho
 *    permanece em edição.
 *  - Validação de campo (headline/resumo, anos, idiomas, competências)
 *    continua inline — painel "Corrija os pontos abaixo" (não sai do
 *    TDD: Etapa 5 do UX_REFINEMENT).
 *
 * Persistência via `students.saveResumeData` e
 * `students.saveSkillsAndLanguages` (R7).
 */
export function ResumeForm() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const saveResume = useMutation(api.students.saveResumeData);
  const saveSkills = useMutation(api.students.saveSkillsAndLanguages);
  const saveContactLinks = useMutation(api.students.saveContactLinks);

  // Valores atuais do formulário (prefilled do CV salvo).
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [academicHistory, setAcademicHistory] = useState<AcademicDraft[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [lattesUrl, setLattesUrl] = useState("");
  // [FINAL_UPGRADE Etapa 1.3] — LinkedIn e Portfólio editáveis no Bloco 3
  // (antes só do cadastro de perfil; agora salvos via saveContactLinks).
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [projectsText, setProjectsText] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);

  // Estados de controle do modo inline.
  const [errors, setErrors] = useState<string[]>([]);
  const [editingBlock, setEditingBlock] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  // Pré-preenche com o CV salvo (edição idempotente).
  useEffect(() => {
    if (profile !== undefined && profile !== null) {
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
      setLinkedinUrl(profile.linkedinUrl ?? "");
      setPortfolioUrl(profile.portfolioUrl ?? "");
      setSkills(profile.skills ?? []);
      setLanguages(profile.languages ?? []);
    }
  }, [profile]);

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

  /** Validação e persistência compartilhados por "Salvar" de bloco e submit. */
  async function persist(): Promise<void> {
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

    // [FINAL_UPGRADE Etapa 1.3] — URLs do Bloco 3 validadas antes do
    // servidor (mensagem clara junto dos campos, CA 2).
    if (editingBlock === 2) {
      const linkErrors: string[] = [];
      if (!isValidUrl(linkedinUrl)) {
        linkErrors.push("URL do LinkedIn deve usar https://.");
      }
      if (!isValidUrl(portfolioUrl)) {
        linkErrors.push("URL de GitHub/Portfólio deve usar https://.");
      }
      if (linkErrors.length > 0) {
        setErrors(linkErrors);
        return;
      }
    }

    setPending(true);
    try {
      await saveResume(validation.normalized);
      await saveSkills({ skills, languages });
      // [FINAL_UPGRADE Etapa 1.3] — links do perfil salvos ao editar o
      // Bloco 3 (mesma regra https validada no servidor também).
      if (editingBlock === 2) {
        await saveContactLinks({
          linkedinUrl: linkedinUrl.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
        });
      }
      // Sucesso: o bloco volta à visualização (Etapa 2 — inline edit).
      setEditingBlock(null);
      setErrors([]);
      toast.success("Currículo salvo com sucesso.");
    } catch (err) {
      // [UX_REFINEMENT] erro de servidor vira Toast amigável, nunca um
      // bloco cru no formulário.
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function startEdit(block: number): void {
    // Se outro bloco estava sendo editado, o rascunho é descartado.
    if (editingBlock !== null && editingBlock !== block) {
      resetToProfile();
    }
    setErrors([]);
    setEditingBlock(block);
  }

  function cancelEdit(): void {
    resetToProfile();
    setErrors([]);
    setEditingBlock(null);
  }

  /**
   * [FINAL_UPGRADE Etapa 1.2] — o lápis é um BOTÃO LIGA/DESLIGA:
   * clicar nele com o bloco já em edição fecha a edição (equivale a
   * Cancelar) e volta à visualização.
   */
  function toggleEdit(block: number): void {
    if (editingBlock === block) {
      cancelEdit();
    } else {
      startEdit(block);
    }
  }

  function resetToProfile(): void {
    const resume = profile?.resumeData;
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
    } else {
      setHeadline("");
      setSummary("");
      setExperiences([]);
      setAcademicHistory([]);
      setGithubUrl("");
      setLattesUrl("");
      setProjectsText("");
      setCertifications([]);
    }
    setLinkedinUrl(profile?.linkedinUrl ?? "");
    setPortfolioUrl(profile?.portfolioUrl ?? "");
    setSkills(profile?.skills ?? []);
    setLanguages(profile?.languages ?? []);
    setErrors([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // Se um bloco está em edição, os dados são persistidos pelo bloco
    // atual (a visualização é retomada no sucesso). O submit antigo
    // (botão global "Salvar currículo") ficou sem uso.
    if (editingBlock !== null) {
      void persist();
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
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      aria-label="Formulário de currículo vitae"
    >
      {BLOCK_LABELS.map((block) => {
        const isEditing = editingBlock === block.index;
        return (
          <section
            key={block.index}
            id={`bloco-${BLOCO_IDS[block.index]}`}
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
          >
            {/* Cabeçalho do bloco: título + ícone de lápis. */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-primary">
                    {block.index + 1}. {block.heading}
                  </h2>
                  {block.index === 0 ? (
                    <p
                      id="resume-summary-count"
                      className="text-xs text-slate-500"
                      aria-live="polite"
                    >
                      {summary.trim().length}/{SUMMARY_MAX} caracteres (mínimo{" "}
                      {SUMMARY_MIN})
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {block.index === 0
                      ? "Dados do cadastro (somente leitura) e sua apresentação profissional"
                      : block.index === 1
                        ? "Dados acadêmicos do cadastro e seu histórico"
                        : block.index === 2
                          ? "Todos os links são editados aqui: LinkedIn, portfólio, GitHub e Lattes"
                          : block.index === 3
                            ? "As mesmas competências usadas no matching com vagas"
                            : block.index === 4
                              ? "Contam para o bônus de idioma do matching quando a vaga exige"
                              : block.index === 5
                                ? "Experiências em cards e projetos de extensão em um único campo"
                                : "Cursos, certificados e atividades que reforçam seu perfil"}{" "}
                    — clique no lápis para editar neste local.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleEdit(block.index)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isEditing
                      ? "bg-primary text-white"
                      : "bg-primary/5 text-primary hover:bg-primary hover:text-white"
                  }`}
                  aria-label={
                    isEditing
                      ? `Fechar edição de ${block.label}`
                      : `Editar ${block.label}`
                  }
                  aria-pressed={isEditing}
                  title={
                    isEditing
                      ? `Fechar edição de ${block.label}`
                      : `Editar ${block.label}`
                  }
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>

              {/* VISUALIZAÇÃO do bloco —idades apenas leitura. */}
              {!isEditing ? (
                <div className="space-y-4">
                  {block.index === 0 && (
                    <>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Headline
                        </span>
                        <span className="font-medium text-slate-800">
                          {headline || "—"}
                        </span>
                      </p>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Resumo profissional
                        </span>
                        <span className="whitespace-pre-wrap font-medium text-slate-800">
                          {summary || "—"}
                        </span>
                      </p>
                    </>
                  )}

                  {block.index === 1 && (
                    <>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Curso
                        </span>
                        <span className="font-medium text-slate-800">
                          {profile.course}
                        </span>
                      </p>
                      {academicHistory.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nenhum item no histórico acadêmico ainda.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {academicHistory.map((entry, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 break-words text-slate-800">
                                {entry.item}
                              </span>
                              <span className="shrink-0 font-mono text-xs text-slate-500">
                                {entry.year}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  {block.index === 2 && (
                    <div className="space-y-2">
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          LinkedIn
                        </span>
                        <span className="break-all font-medium text-slate-800">
                          {profile.linkedinUrl || "Não cadastrado"}
                        </span>
                      </p>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Portfólio
                        </span>
                        <span className="break-all font-medium text-slate-800">
                          {profile.portfolioUrl || "Não cadastrado"}
                        </span>
                      </p>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          GitHub
                        </span>
                        <span className="break-all font-medium text-slate-800">
                          {githubUrl || "Não cadastrado"}
                        </span>
                      </p>
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Currículo Lattes
                        </span>
                        <span className="break-all font-medium text-slate-800">
                          {lattesUrl || "Não cadastrado"}
                        </span>
                      </p>
                    </div>
                  )}

                  {block.index === 3 && (
                    <div
                      className="flex flex-wrap gap-2"
                      aria-label="Competências atuais"
                    >
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
                          </span>
                        ))
                      )}
                    </div>
                  )}

                  {block.index === 4 && (
                    <ul className="flex flex-col gap-2">
                      {languages.length === 0 ? (
                        <li className="text-sm text-slate-500">
                          Nenhum idioma cadastrado ainda.
                        </li>
                      ) : (
                        languages.map((language, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span>
                              {language.name} — {LEVEL_LABELS[language.level]}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}

                  {block.index === 5 && (
                    <div className="space-y-3">
                      {experiences.map((exp, index) => (
                        <div
                          key={index}
                          className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                        >
                          <p className="font-semibold text-slate-800">
                            {exp.company} — {exp.role}
                          </p>
                          <p className="text-xs text-slate-500">{exp.period}</p>
                          {exp.description ? (
                            <p className="mt-2 text-xs text-slate-600">
                              {exp.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {projectsText ? (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Projetos de Extensão
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {projectsText}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {block.index === 6 && (
                    <div className="space-y-2">
                      {certifications.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nenhuma certificação registrada.
                        </p>
                      ) : (
                        certifications.map((item, index) => (
                          <p
                            key={index}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                              {index + 1}
                            </span>
                            {item}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* EDIÇÃO do bloco — campos no próprio local. */
                <div className="space-y-4">
                  {block.index === 0 && (
                    <>
                      <Input
                        label="Headline"
                        required
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        hint="Ex.: Estudante de Sistemas para Internet focado em back-end (10–120 caracteres)"
                      />
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="resume-summary-edit"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Resumo profissional
                          <span
                            className="ml-0.5 text-danger"
                            aria-hidden="true"
                          >
                            *
                          </span>
                        </label>
                        <textarea
                          id="resume-summary-edit"
                          required
                          rows={4}
                          value={summary}
                          onChange={(e) => setSummary(e.target.value)}
                          placeholder="Quem você é, o que você faz e o que procura…"
                          maxLength={SUMMARY_MAX}
                          aria-describedby="resume-summary-count-edit"
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        />
                        <p
                          id="resume-summary-count-edit"
                          className="text-xs text-slate-500"
                          aria-live="polite"
                        >
                          {summary.trim().length}/{SUMMARY_MAX} caracteres (
                          mínimo {SUMMARY_MIN})
                        </p>
                      </div>
                    </>
                  )}
                  {block.index === 1 && (
                    <fieldset className="flex flex-col gap-3">
                      <legend className="text-sm font-semibold text-slate-700">
                        Histórico acadêmico
                      </legend>
                      {academicHistory.map((entry, index) => (
                        <div
                          key={index}
                          className="rounded border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                            <div className="min-w-0">
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
                            <div className="w-28 shrink-0">
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
                          </div>
                          <div className="mt-2 flex justify-end">
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
                        </div>
                      ))}
                      {academicHistory.length < MAX_ACADEMIC ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setAcademicHistory((list) => [
                              ...list,
                              { ...EMPTY_ACADEMIC },
                            ])
                          }
                        >
                          + Adicionar item ao histórico
                        </Button>
                      ) : null}
                    </fieldset>
                  )}
                  {block.index === 2 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="LinkedIn"
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/in/seu-perfil"
                        hint="Opcional — https://"
                      />
                      <Input
                        label="Portfólio"
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://seu-portfolio.com"
                        hint="Opcional — https://"
                      />
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
                  )}
                  {block.index === 3 && (
                    <div className="flex flex-col gap-3">
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
                      <div
                        className="flex flex-wrap gap-2"
                        aria-label="Competências atuais"
                      >
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {skill}
                            <button
                              type="button"
                              aria-label={`Remover competência ${skill}`}
                              onClick={() =>
                                setSkills((list) => removeSkill(list, skill))
                              }
                              className="text-slate-400 transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {block.index === 4 && (
                    <div className="flex flex-col gap-3">
                      {languages.map((language, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <Input
                              label="Idioma"
                              required
                              list="known-languages"
                              value={language.name}
                              onChange={(e) =>
                                updateLanguage(index, "name", e.target.value)
                              }
                            />
                          </div>
                          <div className="w-44 shrink-0">
                            <label
                              htmlFor={`language-level-${index}`}
                              className="text-sm font-semibold text-slate-700"
                            >
                              Nível
                            </label>
                            <select
                              id={`language-level-${index}`}
                              value={language.level}
                              onChange={(e) =>
                                updateLanguage(index, "level", e.target.value)
                              }
                              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                            >
                              {LANGUAGE_LEVELS.map((level) => (
                                <option key={level} value={level}>
                                  {LEVEL_LABELS[level]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setLanguages((list) =>
                                  list.filter((_, i) => i !== index),
                                )
                              }
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                      {languages.length < MAX_LANGUAGES ? (
                        <Button variant="secondary" onClick={addLanguage}>
                          + Adicionar idioma
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {block.index === 5 && (
                    <div className="space-y-4">
                      <fieldset className="flex flex-col gap-3">
                        <legend className="text-sm font-semibold text-slate-700">
                          Experiências profissionais
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
                                  updateExperience(
                                    index,
                                    "company",
                                    e.target.value,
                                  )
                                }
                              />
                              <Input
                                label="Cargo"
                                required
                                value={exp.role}
                                onChange={(e) =>
                                  updateExperience(
                                    index,
                                    "role",
                                    e.target.value,
                                  )
                                }
                              />
                              <Input
                                label="Período"
                                required
                                value={exp.period}
                                onChange={(e) =>
                                  updateExperience(
                                    index,
                                    "period",
                                    e.target.value,
                                  )
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
                                  updateExperience(
                                    index,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                              />
                            </label>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setExperiences((list) =>
                                  list.filter((_, i) => i !== index),
                                )
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
                              setExperiences((list) => [
                                ...list,
                                { ...EMPTY_EXPERIENCE },
                              ])
                            }
                          >
                            + Adicionar experiência
                          </Button>
                        ) : null}
                      </fieldset>
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="resume-projects-edit"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Projetos de Extensão (texto livre)
                        </label>
                        <textarea
                          id="resume-projects-edit"
                          rows={3}
                          value={projectsText}
                          maxLength={PROJECTS_TEXT_MAX}
                          onChange={(e) => setProjectsText(e.target.value)}
                          placeholder="Ex.: Monitoria de Banco de Dados I (2024.2); Feira de Ciências — oficina de Python…"
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        />
                        <p className="text-xs text-slate-500">
                          {projectsText.trim().length}/{PROJECTS_TEXT_MAX}{" "}
                          caracteres
                        </p>
                      </div>
                    </div>
                  )}
                  {block.index === 6 && (
                    <fieldset className="flex flex-col gap-3">
                      <legend className="sr-only">
                        Certificações e atividades
                      </legend>
                      {certifications.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3"
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
                          onClick={() =>
                            setCertifications((list) => [...list, ""])
                          }
                        >
                          + Adicionar certificação
                        </Button>
                      ) : null}
                    </fieldset>
                  )}

                  {/* Erros de validação do bloco em edição — junto dos
                      campos e dos botões (nunca no topo da página). */}
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

                  {/* Barra de ação do bloco em edição. */}
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={cancelEdit}
                      disabled={pending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void persist()}
                      disabled={pending}
                    >
                      {pending ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </form>
  );
}
