import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import { computeMatchScore } from "../src/lib/matching";
import {
  canApplyTo,
  checkRequiredPrerequisites,
  buildMatchingCandidateInput,
  formatMissingPrerequisites,
  type ApplicableJob,
} from "../src/lib/application";
import type { LanguageLevel } from "../src/lib/skills";

/**
 * Candidaturas (issue [S3-4], R8).
 * O % de compatibilidade é calculado NO SERVIDOR (fonte da verdade, CA 1)
 * com a regra pura de matching (S3-3) e persistido no documento.
 * Toda operação exige consentimento vigente (R7) e o papel correto.
 */

/** Guard comum: usuário autenticado com consentimento vigente (R7). */
async function requireActiveUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
  const email = identity.email ?? identity.tokenIdentifier;
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (user === null) throw new Error("Usuário não encontrado.");
  const consents = await ctx.db
    .query("consents")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const active = consents.some((c) => c.termVersion === CURRENT_TERM_VERSION);
  if (!active) {
    throw new Error("Aceite o Termo de Consentimento LGPD vigente.");
  }
  return user;
}

/** Carrega a vaga no formato da regra pura de candidatura. */
function toApplicableJob(job: Doc<"jobs">): ApplicableJob {
  return {
    status: job.status,
    expiresAt: job.expiresAt,
  };
}

/** Monta os pré-requisitos da vaga no formato da regra de matching. */
function jobPrerequisites(job: Doc<"jobs">) {
  return job.prerequisites.map((p) => ({
    item: p.item,
    required: p.required,
  }));
}

/**
 * CA 1 + CA 3 — Candidatura do aluno à vaga: valida elegibilidade (vaga
 * aberta e dentro do prazo, R4), calcula o match NO SERVIDOR com
 * `computeMatchScore` (R8 — fonte da verdade) e grava com stage inicial
 * "inscrito". Idempotente: aluno já inscrito recebe erro claro.
 */
export const applyToJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") {
      throw new Error("Apenas alunos se candidatam às vagas.");
    }

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) {
      throw new Error("Complete o cadastro do perfil antes de se candidatar.");
    }

    const job = await ctx.db.get(jobId);
    if (job === null) throw new Error("Vaga não encontrada.");

    const decision = canApplyTo(toApplicableJob(job), Date.now());
    if (!decision.ok) {
      throw new Error(
        decision.reason === "vaga_expirada"
          ? "Esta vaga está expirada e não aceita mais candidaturas."
          : "Esta vaga não está aberta para candidaturas.",
      );
    }

    // Unicidade: um aluno, uma candidatura por vaga.
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();
    if (existing.some((a) => a.jobId === jobId)) {
      throw new Error("Você já se candidatou a esta vaga.");
    }

    // [S3-5] CA 1 — bloqueio no servidor: pré-requisitos obrigatórios
    // não atendidos impedem a candidatura (mesma regra da UI, mas aqui
    // é a fonte da verdade — o cliente nunca decide).
    const gate = checkRequiredPrerequisites(
      { prerequisites: jobPrerequisites(job) },
      student.skills ?? [],
    );
    if (!gate.ok) {
      throw new Error(formatMissingPrerequisites(gate.missing));
    }

    // R8 — match calculado no servidor e persistido (CA 1).
    const score = computeMatchScore(
      buildMatchingCandidateInput({
        skills: student.skills,
        languages: student.languages as Array<{
          name: string;
          level: LanguageLevel;
        }>,
        availability: student.availability,
      }),
      {
        prerequisites: jobPrerequisites(job),
        requiredLanguage: job.requiredLanguage,
        availability: job.availability,
      },
    );

    const applicationId = await ctx.db.insert("applications", {
      jobId,
      studentId: student._id,
      stage: "inscrito",
      matchScore: score,
      appliedAt: Date.now(),
    });
    return { applicationId, matchScore: score };
  },
});

/**
 * Vagas abertas e dentro do prazo (R4) para a home do aluno (CA 2).
 * Ancorada no índice by_status — sem full-scan (padrão S2-4).
 */
export const openJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .order("desc")
      .take(50);
    return rows.filter(
      (job) => job.expiresAt === undefined || job.expiresAt > now,
    );
  },
});

/**
 * Candidaturas do aluno autenticado, com vaga e % de match (CA 2).
 */
export const myApplications = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    if (user.role !== "aluno") return [];
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (student === null) return [];

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .order("desc")
      .collect();

    const items = [];
    for (const row of rows) {
      const job = await ctx.db.get(row.jobId);
      if (job === null) continue;
      items.push({
        applicationId: row._id,
        jobId: job._id,
        jobTitle: job.title,
        jobStatus: job.status,
        stage: row.stage,
        matchScore: row.matchScore,
        appliedAt: row.appliedAt,
      });
    }
    return items;
  },
});

/**
 * Candidaturas de uma vaga para o recrutador dono (CA 2), ordenadas do
 * maior para o menor % de compatibilidade.
 */
export const jobApplications = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireActiveUser(ctx);
    const job = await ctx.db.get(jobId);
    if (job === null) return null;
    if (job.recruiterId !== user._id) return null;

    const rows = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();

    const items = [];
    for (const row of rows) {
      const student = await ctx.db.get(row.studentId);
      if (student === null) continue;
      items.push({
        applicationId: row._id,
        studentId: student._id,
        fullName: student.fullName,
        course: student.course,
        stage: row.stage,
        matchScore: row.matchScore,
        appliedAt: row.appliedAt,
        // R6 — contato segue a autorização geral do aluno.
        contactAllowed: student.showContactToRecruiters ?? false,
      });
    }
    return items.sort((a, b) => b.matchScore - a.matchScore);
  },
});

/** Id tipado para reuso interno (exportado para testes de tipo). */
export type ApplicationId = Id<"applications">;
