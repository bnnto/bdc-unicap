import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  buildSkillsRadar,
  countRejectionReasons,
  engagementCounts,
  rejectionShare,
  skillDemandCounts,
  skillSupplyCounts,
  SKILLS_RADAR_LIMIT,
} from "../src/lib/managerDashboard";
import { getCurrentUser } from "./lib/currentUser";

/**
 * [GESTOR_BACKEND] Agregações dos Insights Estratégicos do Painel do
 * Gestor — cálculo no SERVIDOR (fonte da verdade), com regras puras
 * compartilhadas (src/lib/managerDashboard.ts, TDD).
 *
 * 1. getRejectionInsights — candidaturas reprovadas agrupadas por motivo
 *    (R5, enum fixo gravado apenas pela mutation rejectApplication);
 * 2. getSkillsRadar — competências mais pedidas nas vagas (demanda) vs.
 *    mais presentes nos perfis de alunos (oferta);
 * 3. getEngagementMetrics — termômetro de engajamento: alunos com vínculo
 *    (R1), perfis sem competências e alunos sem currículo.
 *
 * Guard: acesso EXCLUSIVO do papel gestor com consentimento vigente
 * (R7) — os resultados são agregados e nunca expõem dados pessoais.
 * Filtros: curso do aluno restringe reprovações/oferta/engajamento
 * (a demanda das vagas é do portal e permanece global).
 */

/** Guard comum das queries do gestor: R7 + papel gestor. */
async function requireGestor(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Não autenticado.");
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
  if (user.role !== "gestor") {
    throw new Error("Insights estratégicos disponíveis apenas para gestores.");
  }
  return user;
}

/** Mapa curso do aluno por studentId (filtro de curso das agregações). */
async function studentCourseById(ctx: QueryCtx): Promise<Map<string, string>> {
  return new Map(
    (await ctx.db.query("students").collect()).map((s) => [s._id, s.course]),
  );
}

/** Candidatura passa pelo filtro de curso (quando informado)? */
function matchesCourse(
  doc: Doc<"applications">,
  courseByStudent: ReadonlyMap<string, string>,
  course: string | undefined,
): boolean {
  return course === undefined || courseByStudent.get(doc.studentId) === course;
}

/** Aluno elegível pelo filtro de curso (quando informado). */
function studentMatchesCourse(
  student: Doc<"students">,
  course: string | undefined,
): boolean {
  return course === undefined || student.course === course;
}

/**
 * 1 — Motivos de reprovação (R5): contagem das candidaturas com
 * stage = "reprovado" agrupada por `rejectionReason`, com percentual
 * sobre o total de reprovações. Filtro por curso via perfil do aluno.
 */
export const getRejectionInsights = query({
  args: { course: v.optional(v.string()) },
  handler: async (ctx, rawArgs) => {
    await requireGestor(ctx);
    const course = rawArgs.course?.trim() || undefined;

    const courseByStudent = await studentCourseById(ctx);
    const rejected = (
      await ctx.db
        .query("applications")
        .withIndex("by_stage", (q) => q.eq("stage", "reprovado"))
        .collect()
    ).filter((doc) => matchesCourse(doc, courseByStudent, course));

    // Regra pura: contagem por motivo + percentual + rótulo (R5) —
    // prontos para exibição na UI.
    const rows = rejectionShare(countRejectionReasons(rejected));
    return { total: rejected.length, rows };
  },
});

/**
 * 2 — Radar de competências: DEMANDA (vagas que pedem cada competência,
 * exigida ou não) vs. OFERTA (perfis de alunos com a competência —
 * R1: apenas ativo/egresso; visibilidade não oculta contagens
 * agregadas). Top N por demanda, com filtro por curso na oferta.
 */
export const getSkillsRadar = query({
  args: {
    course: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, rawArgs) => {
    await requireGestor(ctx);
    const course = rawArgs.course?.trim() || undefined;
    const limit = rawArgs.limit ?? SKILLS_RADAR_LIMIT;

    // DEMANDA — todas as vagas do portal (pré-requisitos exigidos ou não).
    const demand = skillDemandCounts(await ctx.db.query("jobs").collect());

    // OFERTA — alunos com vínculo (R1), filtráveis por curso.
    const supply = skillSupplyCounts(
      (await ctx.db.query("students").collect()).filter(
        (student) =>
          (student.status === "ativo" || student.status === "egresso") &&
          studentMatchesCourse(student, course),
      ),
    );

    return buildSkillsRadar(demand, supply, limit);
  },
});

/**
 * 3 — Termômetro de engajamento: alunos com vínculo (R1 — inativo
 * nunca conta), perfis incompletos (sem competências registradas) e
 * alunos sem currículo (`resumeData` ausente). Filtro por curso.
 */
export const getEngagementMetrics = query({
  args: { course: v.optional(v.string()) },
  handler: async (ctx, rawArgs) => {
    await requireGestor(ctx);
    const course = rawArgs.course?.trim() || undefined;

    const metrics = engagementCounts(
      (await ctx.db.query("students").collect()).filter((student) =>
        studentMatchesCourse(student, course),
      ),
    );
    return metrics;
  },
});
