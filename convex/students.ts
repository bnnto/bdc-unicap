import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  validateStudentProfile,
  type StudentProfileInput,
} from "../src/lib/studentProfile";
import {
  validateLanguages,
  addSkill,
  type LanguageEntry,
} from "../src/lib/skills";
import { validateResumeData } from "../src/lib/resume";
import {
  canAppearInTalentBank,
  chooseTalentScanPlan,
  filterTalentCandidates,
  formatTalentSummary,
  TALENT_SCAN_BATCH,
  toTalentCandidate,
  type TalentCandidate,
  type TalentFilters,
} from "../src/lib/talentSearch";
import { buildBenchmarkBatch } from "../src/lib/talentBenchmark";
import {
  canRecruiterSeeContact,
  recruiterProjection,
} from "../src/lib/visibility";
import { getCurrentUser, requireActiveConsentUser } from "./lib/currentUser";

/**
 * Perfil do aluno/egresso (issues [S1-3]/[S1-4], R1/R2/R6).
 * Toda mutação exige consentimento vigente (R7, issue [S1-2]) — checado no
 * servidor via `requireActiveConsent`, não apenas na UI.
 */

function toProfileArgs(raw: {
  fullName: string;
  enrollment: string;
  status: "ativo" | "egresso" | "inativo";
  course: string;
  graduationYear: number;
  semester?: number;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  availability: "estagio" | "integral" | "meio_periodo" | "freelancer";
}): StudentProfileInput {
  return {
    fullName: raw.fullName,
    enrollment: raw.enrollment,
    status: raw.status,
    course: raw.course,
    graduationYear: raw.graduationYear,
    semester: raw.semester,
    location: raw.location,
    linkedinUrl: raw.linkedinUrl,
    portfolioUrl: raw.portfolioUrl,
    availability: raw.availability,
  };
}

/** Perfil do aluno autenticado (ou null). */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return (
      (await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique()) ?? null
    );
  },
});

/**
 * Upsert do perfil completo do aluno autenticado (CA 1 de [S1-3]).
 * Valida no servidor (mesma regra pura do formulário) e garante matrícula
 * única (CA 2 de [S1-3]). Preserva `visibility`/`showContactToRecruiters`
 * (S1-4) — essas flags têm mutation própria.
 */
export const upsertProfile = mutation({
  args: {
    fullName: v.string(),
    enrollment: v.string(),
    status: v.union(
      v.literal("ativo"),
      v.literal("egresso"),
      v.literal("inativo"),
    ),
    course: v.string(),
    graduationYear: v.number(),
    semester: v.optional(v.number()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    availability: v.union(
      v.literal("estagio"),
      v.literal("integral"),
      v.literal("meio_periodo"),
      v.literal("freelancer"),
    ),
    /** [S1-5] — competências e idiomas (opcionais; validados no handler). */
    skills: v.optional(v.array(v.string())),
    languages: v.optional(
      v.array(
        v.object({
          name: v.string(),
          level: v.union(
            v.literal("basico"),
            v.literal("intermediario"),
            v.literal("avancado"),
            v.literal("fluente"),
            v.literal("nativo"),
          ),
        }),
      ),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ studentId: Id<"students">; created: boolean }> => {
    // R7 — uso do portal bloqueado sem aceite vigente do termo LGPD.
    // Resolução pelo token (getAuthUserId + fallback) e não pelo e-mail
    // da identidade: tokens do signUp não carregam e-mail casável.
    const consent = await requireActiveConsentUser(ctx);
    if (!consent.ok) {
      throw new Error(
        consent.reason === "usuario_inexistente"
          ? "Usuário não encontrado."
          : "Aceite o Termo de Consentimento LGPD vigente para continuar.",
      );
    }
    const studentUserId = consent.userId;

    // Papel: apenas alunos editam o próprio perfil (gestor usa outra rota).
    if (consent.role !== "aluno") {
      throw new Error("Apenas alunos podem editar o perfil de estudante.");
    }

    const validation = validateStudentProfile(toProfileArgs(args));
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }
    const profile = validation.normalized;

    // [S1-5] — competências normalizadas via addSkill (dedupe/limite)
    // e idiomas validados (níveis, duplicatas, limite).
    let skills: string[] = [];
    for (const raw of args.skills ?? []) {
      skills = addSkill(skills, raw);
    }
    const languagesCheck = validateLanguages(args.languages ?? []);
    if (!languagesCheck.ok) {
      throw new Error(languagesCheck.errors.join(" "));
    }
    const languages: LanguageEntry[] = args.languages ?? [];

    // CA 2 — matrícula única: mesma matrícula em outro usuário bloqueia.
    const enrollmentOwner = await ctx.db
      .query("students")
      .withIndex("by_enrollment", (q) => q.eq("enrollment", profile.enrollment))
      .unique();
    const existing = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", studentUserId))
      .unique();

    if (
      enrollmentOwner !== null &&
      (existing === null || enrollmentOwner._id !== existing._id)
    ) {
      throw new Error("Esta matrícula já está cadastrada para outro aluno.");
    }

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        fullName: profile.fullName,
        enrollment: profile.enrollment,
        status: profile.status,
        course: profile.course,
        graduationYear: profile.graduationYear,
        semester: profile.semester,
        location: profile.location,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
        availability: profile.availability,
        skills,
        languages,
      });
      return { studentId: existing._id, created: false as const };
    }

    const studentId: Id<"students"> = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: profile.fullName,
      enrollment: profile.enrollment,
      status: profile.status,
      course: profile.course,
      graduationYear: profile.graduationYear,
      semester: profile.semester,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
      availability: profile.availability,
      skills,
      languages,
      // S1-4 — defaults seguros: privado até o aluno escolher expor-se.
      visibility: "somente_candidaturas",
      showContactToRecruiters: false,
    });
    return { studentId, created: true as const };
  },
});

/**
 * R2 (issue [S1-4]) — toggle "Visível para recrutadores" ×
 * "apenas candidaturas ativas". Persistido no perfil do aluno.
 */
export const setVisibility = mutation({
  args: {
    visibility: v.union(
      v.literal("publico"),
      v.literal("somente_candidaturas"),
    ),
  },
  handler: async (ctx, { visibility }) => {
    const consent = await requireActiveConsentUser(ctx);
    if (!consent.ok) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }
    const studentUserId = consent.userId;
    if (consent.role !== "aluno") {
      throw new Error("Apenas alunos alteram a própria visibilidade.");
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", studentUserId))
      .unique();
    if (student === null) {
      throw new Error(
        "Complete o cadastro do perfil antes de alterar a visibilidade.",
      );
    }
    await ctx.db.patch(student._id, { visibility });
    return { ok: true as const, visibility };
  },
});

/**
 * R6 (issue [S1-4]) — autorização geral de contato para recrutadores.
 * Default seguro: false; o aluno autoriza, nunca o contrário.
 */
export const setContactConsent = mutation({
  args: { allow: v.boolean() },
  handler: async (ctx, { allow }) => {
    const consent = await requireActiveConsentUser(ctx);
    if (!consent.ok) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }
    const studentUserId = consent.userId;
    if (consent.role !== "aluno") {
      throw new Error(
        "Apenas alunos alteram a própria autorização de contato.",
      );
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", studentUserId))
      .unique();
    if (student === null) {
      throw new Error(
        "Complete o cadastro do perfil antes de autorizar contato.",
      );
    }
    await ctx.db.patch(student._id, { showContactToRecruiters: allow });
    return { ok: true as const, allow };
  },
});

/**
 * [S2-1] — Salva o Currículo Vitae do aluno autenticado em `resumeData`.
 * Valida com a mesma regra pura do formulário (mensagens claras) e exige
 * perfil existente (o CV é composto sobre o cadastro da [S1-3]).
 */
export const saveResumeData = mutation({
  args: {
    headline: v.string(),
    summary: v.string(),
    experiences: v.array(
      v.object({
        company: v.string(),
        role: v.string(),
        period: v.string(),
        description: v.string(),
      }),
    ),
    academicHistory: v.array(
      v.object({
        item: v.string(),
        year: v.number(),
      }),
    ),
    /** [REFACTOR_ALUNO Etapa 2] — novos blocos opcionais (3/6/7). */
    links: v.optional(
      v.object({
        github: v.optional(v.string()),
        lattes: v.optional(v.string()),
      }),
    ),
    projectsText: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const consent = await requireActiveConsentUser(ctx);
    if (!consent.ok) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }
    if (consent.role !== "aluno") {
      throw new Error("Apenas alunos editam o próprio currículo.");
    }
    const studentUserId = consent.userId;

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", studentUserId))
      .unique();
    if (student === null) {
      throw new Error(
        "Complete o cadastro do perfil antes de preencher o currículo.",
      );
    }

    const validation = validateResumeData(args);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" "));
    }

    await ctx.db.patch(student._id, { resumeData: validation.normalized });
    return { ok: true as const, savedAt: Date.now() };
  },
});

/**
 * [REFACTOR_ALUNO Etapa 2] — salva competências (bloco 4) e idiomas
 * (bloco 5) editados no construtor de currículo. Mesmas validações da
 * `upsertProfile` (addSkill/validateLanguages) — R7 + só o próprio aluno.
 */
export const saveSkillsAndLanguages = mutation({
  args: {
    skills: v.optional(v.array(v.string())),
    languages: v.optional(
      v.array(
        v.object({
          name: v.string(),
          level: v.union(
            v.literal("basico"),
            v.literal("intermediario"),
            v.literal("avancado"),
            v.literal("fluente"),
            v.literal("nativo"),
          ),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const consent = await requireActiveConsentUser(ctx);
    if (!consent.ok) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }
    if (consent.role !== "aluno") {
      throw new Error("Apenas alunos editam o próprio currículo.");
    }
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", consent.userId))
      .unique();
    if (student === null) {
      throw new Error(
        "Complete o cadastro do perfil antes de preencher o currículo.",
      );
    }

    const patch: Partial<Doc<"students">> = {};
    if (args.skills !== undefined) {
      let skills: string[] = [];
      for (const raw of args.skills) {
        skills = addSkill(skills, raw);
      }
      patch.skills = skills;
    }
    if (args.languages !== undefined) {
      const languagesCheck = validateLanguages(args.languages);
      if (!languagesCheck.ok) {
        throw new Error(languagesCheck.errors.join(" "));
      }
      patch.languages = args.languages;
    }

    await ctx.db.patch(student._id, patch);
    return { ok: true as const, savedAt: Date.now() };
  },
});

/**
 * Perfil público (R2) — o que um recrutador/visitante pode ver de um aluno.
 * Projeção no SERVIDOR: contato (R6) omitido quando não autorizado e perfil
 * inteiro oculto quando a regra R2 não permite a visualização.
 * `jobId` opcional: quando informado, avalia visibilidade no contexto da vaga.
 */
export const publicProfile = query({
  args: {
    studentId: v.id("students"),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, { studentId, jobId }) => {
    const student = await ctx.db.get(studentId);
    if (student === null) return null;
    // R1 — inativo não participa. R2 — avaliação de visibilidade.
    const view = recruiterProjection(
      {
        status: student.status,
        visibility: student.visibility ?? "somente_candidaturas",
        showContactToRecruiters: student.showContactToRecruiters ?? false,
        contactReleasedTo: [], // candidaturas ativas chegam na [S3-4]
        fullName: student.fullName,
        course: student.course,
      },
      jobId ?? null,
    );
    if (view === null) return null;
    // Enriquecimento público (sem contato): links e dados acadêmicos gerais.
    return {
      ...view,
      graduationYear: student.graduationYear,
      location: student.location ?? null,
      linkedinUrl:
        view.email !== undefined ? (student.linkedinUrl ?? null) : null,
      portfolioUrl:
        view.email !== undefined ? (student.portfolioUrl ?? null) : null,
      availability: student.availability,
    };
  },
});

/**
 * [S2-3] Banco de Talentos — busca com filtros avançados e resultados
 * paginados (CAs 1 e 2), para recrutadores e gestores autenticados
 * (R7). R1 (apenas ativo/egresso) e R2 (apenas `visibility: publico`)
 * são aplicados no servidor via índice `by_visibility_status` e
 * re-verificados por `canAppearInTalentBank` antes de expor cada card.
 * Contato (R6) só aparece com autorização geral do aluno.
 */
export const searchTalent = query({
  args: {
    search: v.optional(v.string()),
    course: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ativo"), v.literal("egresso"))),
    availability: v.optional(
      v.union(
        v.literal("estagio"),
        v.literal("integral"),
        v.literal("meio_periodo"),
        v.literal("freelancer"),
      ),
    ),
    location: v.optional(v.string()),
    skill: v.optional(v.string()),
    /** [REFACTOR_UI] Competências em chips (casa com pelo menos uma). */
    skills: v.optional(v.array(v.string())),
    /** [REFACTOR_UI] Faixa de previsão de conclusão (anos inclusivos). */
    graduationYearFrom: v.optional(v.number()),
    graduationYearTo: v.optional(v.number()),
    /** [REFACTOR_UI] Ordenação do dropdown "Ordenar por". */
    sort: v.optional(
      v.union(
        v.literal("relevancia"),
        v.literal("nome"),
        v.literal("conclusao_proxima"),
      ),
    ),
    language: v.optional(v.string()),
    languageLevel: v.optional(
      v.union(
        v.literal("basico"),
        v.literal("intermediario"),
        v.literal("avancado"),
        v.literal("fluente"),
        v.literal("nativo"),
      ),
    ),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Não autenticado.");
    // R7 + papel — uma única resolução do guard por consulta.
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Usuário não encontrado.");
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const hasConsent = consents.some(
      (c) => c.termVersion === CURRENT_TERM_VERSION,
    );
    if (!hasConsent) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }
    if (user.role !== "recrutador" && user.role !== "gestor") {
      throw new Error(
        "Apenas recrutadores e gestores acessam o Banco de Talentos.",
      );
    }

    const filters: TalentFilters = {
      query: args.search?.trim() || undefined,
      course: args.course?.trim() || undefined,
      status: args.status,
      availability: args.availability,
      location: args.location?.trim() || undefined,
      skill: args.skill?.trim() || undefined,
      skills: args.skills,
      language: args.language?.trim() || undefined,
      languageLevel: args.languageLevel,
      graduationYearFrom: args.graduationYearFrom,
      graduationYearTo: args.graduationYearTo,
      sort: args.sort,
      page: args.page,
    };

    // [S2-4] Plano de consulta indexado (regra pura `chooseTalentScanPlan`):
    // disponibilidade informada → by_status_availability; caso contrário,
    // entrada padrão by_visibility_status. R1+R2 já na varredura, nunca
    // full-scan. Filtros por igualdade exata de curso/cidade/competência/
    // idioma são aplicados em memória sobre o resultado do índice.
    const plan = chooseTalentScanPlan(args.availability);
    const rows: TalentCandidate[] = [];
    for (const status of plan.statuses) {
      let batch: Doc<"students">[];
      if (plan.index === "by_status_availability") {
        // Faixa por (status, availability): R1 no prefixo, filtro no índice.
        batch = await ctx.db
          .query("students")
          .withIndex("by_status_availability", (q) =>
            q
              .eq("status", status)
              .eq("availability", args.availability ?? "estagio"),
          )
          .order("desc")
          .take(TALENT_SCAN_BATCH);
      } else {
        // Entrada padrão: R1+R2 já no índice (visibility=publico × status).
        batch = await ctx.db
          .query("students")
          .withIndex("by_visibility_status", (q) =>
            q.eq("visibility", "publico").eq("status", status),
          )
          .order("desc")
          .take(TALENT_SCAN_BATCH);
      }
      for (const doc of batch) {
        rows.push(toTalentCandidate(doc));
      }
    }

    // Filtros combináveis + paginação (regra pura compartilhada com a UI).
    const result = filterTalentCandidates(rows, filters);

    const items = [];
    for (const row of result.items) {
      // Re-checagem por card: o perfil pode ter mudado entre índice e leitura.
      const student = await ctx.db.get(row.id as Id<"students">);
      if (student === null) continue;
      if (
        !canAppearInTalentBank({
          status: student.status,
          visibility: student.visibility ?? "somente_candidaturas",
        })
      ) {
        continue;
      }
      // R6 — contato e links profissionais apenas com autorização geral.
      const contactAllowed = canRecruiterSeeContact(
        {
          status: student.status,
          visibility: student.visibility ?? "somente_candidaturas",
          showContactToRecruiters: student.showContactToRecruiters ?? false,
          contactReleasedTo: [],
        },
        null,
      );
      items.push({
        studentId: student._id,
        fullName: student.fullName,
        course: student.course,
        status: student.status,
        graduationYear: student.graduationYear,
        semester: student.semester ?? null,
        location: student.location ?? null,
        availability: student.availability,
        summary: formatTalentSummary({
          status: student.status,
          course: student.course,
          graduationYear: student.graduationYear,
          semester: student.semester ?? null,
        }),
        skills: student.skills ?? [],
        languages: student.languages ?? [],
        headline: student.resumeData?.headline ?? null,
        contactAllowed,
        linkedinUrl: contactAllowed ? (student.linkedinUrl ?? null) : null,
        portfolioUrl: contactAllowed ? (student.portfolioUrl ?? null) : null,
      });
    }

    return { ...result, items };
  },
});

/**
 * [REFACTOR_GESTOR] KPI do Painel Estratégico: total de talentos
 * disponíveis no banco (públicos com vínculo válido — R1/R2 já nos
 * índices). Exclusivo do papel gestor; leitura indexada, sem full-scan.
 */
export const talentPoolCount = query({
  args: {},
  handler: async (ctx): Promise<{ total: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Não autenticado.");
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Usuário não encontrado.");
    if (user.role !== "gestor") {
      throw new Error("Painel estratégico disponível apenas para gestores.");
    }
    let total = 0;
    for (const status of ["ativo", "egresso"] as const) {
      const rows = await ctx.db
        .query("students")
        .withIndex("by_visibility_status", (q) =>
          q.eq("visibility", "publico").eq("status", status),
        )
        .collect();
      total += rows.length;
    }
    return { total };
  },
});

/**
 * Guard interno: resolve o estudante do usuário autenticado (pelo token).
 * Consumido por issues futuras (currículo S2, candidaturas S3).
 */
export const resolveStudent = internalQuery({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, _args) => {
    const user = await getCurrentUser(ctx);
    if (user === null)
      return { ok: false as const, reason: "usuario_inexistente" as const };
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return {
      ok: true as const,
      userId: user._id,
      role: user.role ?? null,
      student:
        student !== null
          ? {
              studentId: student._id,
              status: student.status,
              enrollment: student.enrollment,
              visibility: student.visibility ?? "somente_candidaturas",
              showContactToRecruiters: student.showContactToRecruiters ?? false,
            }
          : null,
    };
  },
});

/**
 * [S8-1] R6/R7 — Exclusão de dados pelo titular (art. 18, VI — LGPD).
 * Remove do acervo TODOS os dados pessoais do titular autenticado:
 * perfil de estudante, candidaturas e trilha de aceites. O documento
 * `users` (conta) é preservado para permitir reentrada com novo aceite
 * (o consentimento anterior é apagado — nada de dados persistem).
 * Aceite em processo seletivo: a liberação de contato cessa junto (R6) —
 * as candidaturas são eliminadas, logo não há o que projetar ao recrutador.
 */
export const deleteMyProfile = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    ok: true;
    deleted: { students: number; applications: number; consents: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Não autenticado.");
    // R7 — guard comum do módulo: usuário existente e aceite vigente.
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Usuário não encontrado.");
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
    if (!active) {
      throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
    }

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    let applicationCount = 0;
    if (student !== null) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      for (const app of apps) {
        await ctx.db.delete(app._id);
        applicationCount += 1;
      }
      await ctx.db.delete(student._id);
    }

    for (const consent of consents) {
      await ctx.db.delete(consent._id);
    }

    return {
      ok: true as const,
      deleted: {
        students: student !== null ? 1 : 0,
        applications: applicationCount,
        consents: consents.length,
      },
    };
  },
});

/**
 * [S8-3] E-mail sintético da conta-âncora do seed de benchmark. A conta
 * não representa pessoa real — apenas fornece um `userId` válido (FK) para
 * os perfis semeados; nenhum fluxo do portal consulta esse usuário.
 */
function benchmarkAnchorEmail(runId: number): string {
  return `benchmark-run-${String(runId)}@seed.unicap.br`;
}

/**
 * [S8-3] Seed determinístico do benchmark do Banco de Talentos: insere
 * BENCHMARK_UNIT_SIZE perfis por chamada, a partir da regra pura
 * `buildBenchmarkBatch` (mesma população dos testes). Idempotente por
 * lote: a matrícula-âncora do primeiro registro existe ⇒ lote já semeado
 * (retorna 0). População segregada: g%5==0 inativo (R1), g%5==1 privado
 * (R2), demais elegíveis — as regras continuam valendo em escala.
 * Internal: executável só por testes/backoffice, nunca pela UI.
 */
export const seedTalentBenchmarkBatch = internalMutation({
  args: { runId: v.number(), unitIndex: v.number() },
  handler: async (ctx, { runId, unitIndex }): Promise<number> => {
    const { rows } = buildBenchmarkBatch({ runId, unitIndex });
    const anchor = rows[0];
    if (anchor === undefined) return 0;

    // Idempotência: a âncora (primeira matrícula do lote) já existe?
    const existingAnchor = await ctx.db
      .query("students")
      .withIndex("by_enrollment", (q) => q.eq("enrollment", anchor.enrollment))
      .unique();
    if (existingAnchor !== null) return 0;

    // Conta-âncora do run (criada na primeira unidade semeada).
    const anchorEmail = benchmarkAnchorEmail(runId);
    const anchorUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", anchorEmail))
      .unique();
    const anchorUserId =
      anchorUser?._id ??
      (await ctx.db.insert("users", {
        email: anchorEmail,
        name: `Seed Benchmark run ${String(runId)}`,
        role: "aluno",
        active: true,
      }));

    let inserted = 0;
    for (const row of rows) {
      await ctx.db.insert("students", {
        userId: anchorUserId,
        fullName: row.fullName,
        enrollment: row.enrollment,
        status: row.status,
        course: row.course,
        graduationYear: row.graduationYear,
        ...(row.semester !== undefined ? { semester: row.semester } : {}),
        location: row.location,
        availability: row.availability,
        visibility: row.visibility,
        skills: row.skills,
        languages: row.languages,
      });
      inserted += 1;
    }
    return inserted;
  },
});
