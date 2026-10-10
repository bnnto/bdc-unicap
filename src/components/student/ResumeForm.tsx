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
import {
  AVAILABILITY,
  ENROLLMENT_STATUS,
  isValidUrl,
  validateStudentProfile,
  type Availability,
  type EnrollmentStatus,
} from "../../lib/studentProfile";
import {
  LANGUAGE_LEVELS,
  MAX_LANGUAGES,
  MAX_SKILLS,
  addSkill,
  removeSkill,
  validateLanguages,
  type LanguageEntry,
} from "../../lib/skills";
import { ResumeBlockContent } from "./ResumeView";
import {
  BLOCK_LABELS,
  BLOCO_IDS,
  LEVEL_LABELS,
  type ResumeBlockData,
} from "./resumeBlocks";
import {
  Award,
  Briefcase,
  Code,
  GraduationCap,
  Languages,
  Link2,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

/** [UI_OVERHAUL] Ícone contextual de cada bloco do currículo. */
const BLOCK_ICONS: LucideIcon[] = [
  User, // 0 · Dados Pessoais
  GraduationCap, // 1 · Formação
  Link2, // 2 · Links
  Code, // 3 · Competências
  Languages, // 4 · Idiomas
  Briefcase, // 5 · Experiências
  Award, // 6 · Certificações
];

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
 *
 * [ONBOARDING_RECOVERY] Etapa 1 — fim do beco sem saída das contas novas:
 * sem perfil, o Bloco 1 ("Dados Pessoais & Apresentação") NASCE ABERTO e
 * grava via `students.upsertProfile` (upsert: cria o registro ou atualiza).
 * Nada manda o utilizador para o antigo "Meu Perfil" e nenhum bloco é
 * bloqueado — os demais orientam para o Bloco 1 enquanto o perfil não
 * existe. A apresentação (headline/resumo) só é exigida quando já há
 * currículo salvo, então a conta nova salva de primeira, sem erros.
 */
export function ResumeForm() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const upsertProfile = useMutation(api.students.upsertProfile);
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

  // [ONBOARDING_RECOVERY] Dados pessoais do Bloco 1 (upsert do perfil).
  const [fullName, setFullName] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus>("ativo");
  const [course, setCourse] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [semester, setSemester] = useState("");
  const [location, setLocation] = useState("");
  const [availability, setAvailability] = useState<Availability>("estagio");

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
      // [ONBOARDING_RECOVERY] dados pessoais do Bloco 1 (upsert idempotente).
      setFullName(profile.fullName);
      setEnrollment(profile.enrollment);
      setStatus(profile.status);
      setCourse(profile.course);
      setGraduationYear(String(profile.graduationYear));
      setSemester(
        profile.semester !== undefined && profile.semester !== null
          ? String(profile.semester)
          : "",
      );
      setLocation(profile.location ?? "");
      setAvailability(profile.availability);
    }
  }, [profile]);

  /**
   * [ONBOARDING_RECOVERY] Conta nova (perfil ainda sem registro): o Bloco 1
   * nasce em modo de EDIÇÃO, com os dados pessoais prontos para preencher.
   * Só abre uma vez — cancelar enquanto o perfil continua nulo não reabre.
   */
  useEffect(() => {
    if (profile === null) {
      setEditingBlock((current) => current ?? 0);
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

  /**
   * Validação e persistência compartilhados por "Salvar" de bloco e submit.
   *
   * [ONBOARDING_RECOVERY] O Bloco 1 valida os dados pessoais com a mesma
   * regra pura do servidor e grava via `students.upsertProfile` (UPsert —
   * cria o perfil da conta nova ou atualiza o existente). A apresentação
   * (headline/resumo) só é exigida quando já existe currículo salvo, para
   * a conta nova salvar de primeira, sem bloqueios.
   */
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

    // [ONBOARDING_RECOVERY] Dados pessoais do Bloco 1 (regra pura unificada).
    let profileCheck: ReturnType<typeof validateStudentProfile> | null = null;
    if (editingBlock === 0) {
      const semesterRaw = semester.trim();
      const semesterValue =
        semesterRaw.length > 0 ? Number.parseInt(semesterRaw, 10) : undefined;
      if (semesterRaw.length > 0 && !Number.isFinite(semesterValue)) {
        setErrors(["Semestre deve ser um número."]);
        return;
      }
      profileCheck = validateStudentProfile({
        fullName,
        enrollment,
        status,
        course,
        graduationYear: Number.parseInt(graduationYear, 10),
        semester: semesterValue,
        location,
        availability,
      });
      if (!profileCheck.ok) {
        setErrors(profileCheck.errors);
        return;
      }
    }

    // Apresentação: exigida se já houver CV salvo; opcional na criação do
    // perfil (conta nova preenche só os dados pessoais e já sai salva).
    const hasPresentation =
      headline.trim().length > 0 || summary.trim().length > 0;
    const mustSaveResume = hasPresentation || profile?.resumeData !== undefined;
    let validation: ReturnType<typeof validateResumeData> | null = null;
    if (mustSaveResume) {
      validation = validateResumeData({
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
      let createdProfile = false;
      // [ONBOARDING_RECOVERY] Bloco 1 → UPsert do perfil (cria ou atualiza)
      // junto de skills/idiomas — mesma mutation do cadastro, sem etapa extra.
      if (editingBlock === 0 && profileCheck !== null && profileCheck.ok) {
        const result = await upsertProfile({
          ...profileCheck.normalized,
          skills,
          languages,
        });
        createdProfile = result.created;
      }
      if (validation !== null && validation.ok) {
        await saveResume(validation.normalized);
      }
      if (editingBlock !== 0) {
        await saveSkills({ skills, languages });
      }
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
      toast.success(
        createdProfile
          ? "Perfil criado com sucesso. Continue preenchendo o currículo."
          : "Currículo salvo com sucesso.",
      );
    } catch (err) {
      // [UX_REFINEMENT] erro de servidor vira Toast amigável, nunca um
      // bloco cru no formulário.
      toast.error(friendlyErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function startEdit(block: number): void {
    // [ONBOARDING_RECOVERY] Sem perfil, os demais blocos dependem do Bloco 1:
    // em vez de erro do servidor ("perfil não encontrado"), o próprio
    // formulário abre o Bloco 1 — o utilizador nunca sai da página.
    if (profile === null && block !== 0) {
      toast.info(
        "Preencha seus dados pessoais no Bloco 1 para liberar os demais blocos.",
      );
      resetToProfile();
      setErrors([]);
      setEditingBlock(0);
      return;
    }
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
    // [ONBOARDING_RECOVERY] dados pessoais voltam ao estado salvo.
    setFullName(profile?.fullName ?? "");
    setEnrollment(profile?.enrollment ?? "");
    setStatus(profile?.status ?? "ativo");
    setCourse(profile?.course ?? "");
    setGraduationYear(
      profile?.graduationYear !== undefined
        ? String(profile.graduationYear)
        : "",
    );
    setSemester(
      profile?.semester !== undefined && profile?.semester !== null
        ? String(profile.semester)
        : "",
    );
    setLocation(profile?.location ?? "");
    setAvailability(profile?.availability ?? "estagio");
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

  /**
   * [RECRUITER_VIEW_PROFILE] Os blocos em modo VISUALIZAÇÃO usam o
   * componente compartilhado `ResumeBlockContent` (o mesmo que renderiza
   * o currículo somente-leitura da página do candidato) — um único
   * design de visualização para o portal do aluno e para o recrutador.
   */
  const viewData: ResumeBlockData = {
    course: profile?.course ?? "",
    headline,
    summary,
    academicHistory,
    linkedinUrl: profile?.linkedinUrl ?? "",
    portfolioUrl: profile?.portfolioUrl ?? "",
    githubUrl,
    lattesUrl,
    skills,
    languages,
    experiences,
    projectsText,
    certifications,
  };

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
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-level1 transition-all duration-300 ease-in-out hover:shadow-level2"
          >
            {/* Cabeçalho do bloco: título + ícone de lápis. */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
                  >
                    {(() => {
                      const Icon = BLOCK_ICONS[block.index]!;
                      return <Icon className="h-5 w-5" strokeWidth={2} />;
                    })()}
                  </span>
                  <div className="min-w-0">
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
                        ? "Seus dados pessoais (salvos aqui mesmo — criam ou atualizam o perfil) e sua apresentação profissional"
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
                </div>
                <button
                  type="button"
                  onClick={() => toggleEdit(block.index)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-in-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
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
                  {isEditing ? (
                    <X className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* VISUALIZAÇÃO do bloco — componente compartilhado de
                  somente leitura (o mesmo usado pela página dedicada
                  do candidato no portal do recrutador). */}
              {!isEditing ? (
                <ResumeBlockContent blockIndex={block.index} data={viewData} />
              ) : (
                /* EDIÇÃO do bloco — campos no próprio local. */
                <div className="space-y-4">
                  {block.index === 0 && (
                    <>
                      {/* [ONBOARDING_RECOVERY] Dados pessoais editáveis no
                          Bloco 1: a conta nova cria o perfil por aqui (upsert)
                          — sem passar por nenhuma outra tela. */}
                      <fieldset className="flex flex-col gap-3">
                        <legend className="text-sm font-semibold text-slate-700">
                          Dados pessoais
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Nome completo"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                          />
                          <Input
                            label="Matrícula"
                            required
                            inputMode="numeric"
                            value={enrollment}
                            onChange={(e) => setEnrollment(e.target.value)}
                            hint="6 a 12 dígitos"
                          />
                          <Input
                            label="Curso"
                            required
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                          />
                          <Input
                            label="Ano de formação"
                            required
                            inputMode="numeric"
                            value={graduationYear}
                            onChange={(e) => setGraduationYear(e.target.value)}
                          />
                          <Input
                            label="Semestre atual (opcional)"
                            inputMode="numeric"
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                          />
                          <Input
                            label="Cidade/UF (opcional)"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold text-slate-700">
                            Status de vínculo
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ENROLLMENT_STATUS.map((entry) => (
                              <label
                                key={entry}
                                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                                  status === entry
                                    ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-primary"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="resume-status"
                                  value={entry}
                                  checked={status === entry}
                                  onChange={() => setStatus(entry)}
                                  className="accent-primary"
                                />
                                {STATUS_LABELS[entry]}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-semibold text-slate-700">
                            Disponibilidade
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {AVAILABILITY.map((entry) => (
                              <label
                                key={entry}
                                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                                  availability === entry
                                    ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-primary"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="resume-availability"
                                  value={entry}
                                  checked={availability === entry}
                                  onChange={() => setAvailability(entry)}
                                  className="accent-primary"
                                />
                                {AVAILABILITY_LABELS[entry]}
                              </label>
                            ))}
                          </div>
                        </div>
                      </fieldset>

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
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Adicionar item ao histórico
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
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Adicionar competência
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
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                      {languages.length < MAX_LANGUAGES ? (
                        <Button variant="secondary" onClick={addLanguage}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Adicionar idioma
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
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Adicionar certificação
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
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void persist()}
                      disabled={pending}
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
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
