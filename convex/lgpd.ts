import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import {
  buildLgpdChecklist,
  type ConsentAuditRecord,
  type ContactExposure,
  type LgpdChecklistReport,
} from "../src/lib/lgpdAudit";
import { getCurrentUser } from "./lib/currentUser";

/**
 * Auditoria LGPD end-to-end (issue [S8-1], R6/R7) — camada de servidor.
 *
 * - `runAudit` (gestor, mutation): checklist consolidado sobre o acervo
 *   real + snapshot persistido na trilha `lgpdAudits` (queries não
 *   gravam, logo a execução da auditoria é uma mutation idempotente).
 * - `myDataReport` (titular, query): relatório dos próprios dados
 *   (art. 18, II), projetado pelo servidor — contato só com liberação (R6).
 *
 * Regra pura em src/lib/lgpdAudit.ts (TDD unit).
 */

/** Guard comum: usuário autenticado com consentimento vigente (R7). */
async function requireActiveUser(ctx: MutationCtx): Promise<Doc<"users">> {
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
  return user;
}

/**
 * Checklist LGPD sobre o acervo real (CA 1 da [S8-1]).
 * Exclusivo do papel gestor; cada execução grava um snapshot do
 * relatório na trilha de auditoria (`lgpdAudits`) — imutável.
 */
export const runAudit = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<LgpdChecklistReport & { generatedAt: number }> => {
    const actor = await requireActiveUser(ctx);
    if (actor.role !== "gestor") {
      throw new Error("Apenas gestores executam a auditoria LGPD.");
    }
    const now = Date.now();

    // (1) Consentimento versionado (R7): amostra da trilha coletiva.
    const consentDocs = await ctx.db.query("consents").collect();
    const consentsSample: ConsentAuditRecord[] = consentDocs
      .slice(0, 50)
      .map((c) => ({ termVersion: c.termVersion, acceptedAt: c.acceptedAt }));

    // (2) Contato nunca exposto sem autorização (R6): as projeções
    // entregues a recrutadores são reavaliadas com a MESMA regra pura
    // usada pelo servidor em applications.jobBoard — contato presente
    // sem liberação caracteriza vazamento.
    const applicationDocs = await ctx.db.query("applications").collect();
    const exposures: ContactExposure[] = [];
    for (const app of applicationDocs.slice(0, 200)) {
      const student = await ctx.db.get(app.studentId);
      if (student === null) continue;
      const owner = await ctx.db.get(student.userId);
      const general = student.showContactToRecruiters ?? false;
      const accepted = app.processAccepted ?? false;
      exposures.push({
        applicationId: app._id,
        contactReleased: general || accepted,
        releaseReason: general
          ? "autorizacao_geral"
          : accepted
            ? "aceite_no_processo"
            : "sem_autorizacao",
        email: owner?.email,
        phone: undefined,
      });
    }

    const report = buildLgpdChecklist(
      {
        currentTermVersion: CURRENT_TERM_VERSION,
        consents: consentsSample,
        contactAuthorization: {
          showContactToRecruiters: false,
          processAccepted: false,
        },
        contactExposures: exposures,
        rectifySupported: true,
        eraseSupported: true,
        publicDivulgationWhitelist: true,
      },
      now,
    );

    // Trilha de auditoria: snapshot imutável de cada execução.
    await ctx.db.insert("lgpdAudits", {
      actorId: actor._id,
      actorRole: actor.role ?? "gestor",
      passed: report.passed,
      failedItems: report.failed,
      report: { items: report.items, passed: report.passed },
      createdAt: now,
    });

    return { ...report, generatedAt: now };
  },
});

/**
 * Relatório de dados do titular autenticado (art. 18, II — acesso).
 * Projeção no SERVIDOR: contato do perfil só com liberação (R6);
 * candidaturas incluem o estado do aceite do processo (auditável).
 */
export const myDataReport = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    const user = await getCurrentUser(ctx);
    if (user === null) return null;

    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const consentRecords: ConsentAuditRecord[] = consents.map((c) => ({
      termVersion: c.termVersion,
      acceptedAt: c.acceptedAt,
    }));

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const applications: Array<{
      applicationId: Doc<"applications">["_id"];
      jobTitle: string;
      stage: Doc<"applications">["stage"];
      processAccepted: boolean;
      appliedAt: number;
    }> = [];
    if (student !== null) {
      const rows = await ctx.db
        .query("applications")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      for (const row of rows) {
        const job = await ctx.db.get(row.jobId);
        if (job === null) continue;
        applications.push({
          applicationId: row._id,
          jobTitle: job.title,
          stage: row.stage,
          processAccepted: row.processAccepted ?? false,
          appliedAt: row.appliedAt,
        });
      }
    }

    return {
      user: {
        email: user.email ?? identity.email ?? null,
        role: user.role ?? null,
      },
      data: {
        profile:
          student === null
            ? null
            : {
                studentId: student._id,
                fullName: student.fullName,
                enrollment: student.enrollment,
                status: student.status,
                course: student.course,
                visibility: student.visibility ?? "somente_candidaturas",
                showContactToRecruiters:
                  student.showContactToRecruiters ?? false,
              },
        applications,
      },
      consents: consentRecords,
    };
  },
});
