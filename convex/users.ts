import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/currentUser";

/**
 * [PERFIL_E_LGPD] Central de Perfil, Segurança e LGPD (convex/users.ts).
 *
 * - `deleteMyAccount` (Etapa 4) — apagão em cascata ATÔMICO: uma única
 *   mutation transacional apaga todas as dependências do aluno ou do
 *   recrutador (domínio + tabelas de auth) e só então o `users`, sem
 *   registros órfãos e sem tocar em dados de terceiros.
 * - Sessões (Etapa 2) — listagem com marcação da sessão atual e kill
 *   switch que revoga as demais sessões (+ refresh tokens).
 * - Portabilidade (Etapa 3) — `getMyDataExport` devolve um único objeto
 *   JSON-serializável com todos os dados do próprio usuário.
 * - Preferências — foto de avatar e switches de notificação.
 *
 * Guards: `requireUser` exige sessão ativa SEM exigir consentimento —
 * o Direito ao Esquecimento precisa funcionar mesmo se o aceite do
 * termo LGPD não estiver vigente. O UI extra protege por ConsentGate.
 */

/** Usuário autenticado ou exceção (não exige consentimento — ver acima). */
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new Error("Não autenticado.");
  }
  return user;
}

/** Sessão atual do token (subject "<userId>|<sessionId>") ou null. */
async function currentSessionId(ctx: QueryCtx | MutationCtx) {
  const sessionId = await getAuthSessionId(ctx);
  return typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : null;
}

/** Apaga uma sessão e todo o seu rastro (refresh tokens). */
async function deleteSessionCascade(
  ctx: MutationCtx,
  sessionId: Id<"authSessions">,
): Promise<void> {
  const refreshTokens = await ctx.db
    .query("authRefreshTokens")
    .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const token of refreshTokens) {
    await ctx.db.delete(token._id);
  }
  await ctx.db.delete(sessionId);
}

/**
 * [PERFIL_E_LGPD] Etapa 4 — O APAGÃO EM CASCATA.
 *
 * Mutation única e transacional (Convex garante rollback total se
 * qualquer passo falhar): apaga, nesta ordem,
 *
 * 1. as VAGAS do recrutador e TODAS as `applications` ligadas a elas;
 * 2. o PERFIL DE ALUNO e TODAS as `applications` de candidatura dele
 *    (também cobre o caso degenerado de recrutador com perfil legado —
 *    um Set deduplica para nunca reapagar o mesmo documento);
 * 3. os CONSENTIMENTOS LGPD e a trilha de auditoria do próprio usuário
 *    (o gestor é bloqueado antes — a trilha da coordenação é imutável);
 * 4. AUTH: sessões (+ refresh tokens e verificadores ligados) e contas
 *    de autenticação (+ códigos de verificação);
 * 5. por último, o documento em `users`.
 *
 * Proibido para gestores (papel provisionado pela coordenação).
 * Retorno inclui o resumo contado para auditoria/testes.
 */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.role === "gestor") {
      throw new Error(
        "Contas de gestor não podem ser autoexcluídas — a exclusão é feita pela coordenação.",
      );
    }

    const deleted = {
      users: 1,
      students: 0,
      consents: 0,
      applications: 0,
      jobs: 0,
      sessions: 0,
      accounts: 0,
    };
    const deletedApplications = new Set<Id<"applications">>();
    const deletedSessionIds = new Set<Id<"authSessions">>();

    // 1) Vagas do recrutador + todas as candidaturas dessas vagas.
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_recruiter", (q) => q.eq("recruiterId", user._id))
      .collect();
    for (const job of jobs) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      for (const application of applications) {
        if (!deletedApplications.has(application._id)) {
          await ctx.db.delete(application._id);
          deletedApplications.add(application._id);
          deleted.applications += 1;
        }
      }
      await ctx.db.delete(job._id);
      deleted.jobs += 1;
    }

    // 2) Perfil de aluno + candidaturas do próprio aluno (aluno; ou
    //    perfil legado de um recrutador — deduplicado acima).
    const students = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const student of students) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      for (const application of applications) {
        if (!deletedApplications.has(application._id)) {
          await ctx.db.delete(application._id);
          deletedApplications.add(application._id);
          deleted.applications += 1;
        }
      }
      await ctx.db.delete(student._id);
      deleted.students += 1;
    }

    // 3) Consentimentos LGPD + auditoria do próprio usuário (nunca
    //    existe para aluno/recrutador — gestor é bloqueado acima).
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const consent of consents) {
      await ctx.db.delete(consent._id);
      deleted.consents += 1;
    }
    const audits = await ctx.db
      .query("lgpdAudits")
      .withIndex("by_actor", (q) => q.eq("actorId", user._id))
      .collect();
    for (const audit of audits) {
      await ctx.db.delete(audit._id);
    }

    // 4a) Sessões de autenticação (+ refresh tokens de cada uma).
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const session of sessions) {
      await deleteSessionCascade(ctx, session._id);
      deletedSessionIds.add(session._id);
      deleted.sessions += 1;
    }
    // Verificadores (PKCE/OAuth) ligados às sessões apagadas — tabela
    // efêmera e minúscula, sem índice por sessionId (varredura OK).
    const verifiers = await ctx.db.query("authVerifiers").collect();
    for (const verifier of verifiers) {
      if (
        verifier.sessionId !== undefined &&
        deletedSessionIds.has(verifier.sessionId)
      ) {
        await ctx.db.delete(verifier._id);
      }
    }

    // 4b) Contas de autenticação (+ códigos de verificação de cada uma).
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
      deleted.accounts += 1;
    }

    // 5) O próprio usuário — por último, já com tudo desvinculado.
    await ctx.db.delete(user._id);
    return { ok: true as const, deleted };
  },
});

/**
 * [PERFIL_E_LGPD] Etapa 2 — sessões recentes do próprio usuário, com a
 * sessão ATUAL marcada (subject do token carrega o sessionId). Não
 * expõe IP/geolocalização (a API do Convex Auth não fornece — nada de
 * dado inventado).
 */
export const listMySessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const current = await currentSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    return sessions
      .map((session) => ({
        sessionId: session._id as string,
        createdAt: session._creationTime,
        expiresAt: session.expirationTime,
        isCurrent: current !== null && session._id === current,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * [PERFIL_E_LGPD] Etapa 2 — KILL SWITCH: encerra a sessão em TODOS os
 * outros dispositivos (apaga as demais `authSessions` + refresh
 * tokens). Falha (sem tocar em nada) quando a sessão atual não é
 * identificável — evita logout acidental do próprio usuário.
 */
export const revokeOtherSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const current = await currentSessionId(ctx);
    if (current === null) {
      throw new Error(
        "Sessão atual não identificada — entre novamente para encerrar as outras sessões.",
      );
    }
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    let revoked = 0;
    for (const session of sessions) {
      if (session._id === current) continue;
      await deleteSessionCascade(ctx, session._id);
      revoked += 1;
    }
    return { revoked, keptCurrent: true as const };
  },
});

/**
 * [PERFIL_E_LGPD] Etapa 3 — PORTABILIDADE: todos os dados do próprio
 * usuário num único objeto JSON-serializável (o cliente formata e
 * baixa no navegador). Só dados do próprio usuário (nunca de terceiros).
 */
export const getMyDataExport = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;

    const consents = await ctx.db
      .query("consents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const studentRows = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const student = studentRows[0] ?? null;

    const candidaturas = [];
    if (student !== null) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      for (const application of applications) {
        const job = await ctx.db.get(application.jobId);
        candidaturas.push({
          applicationId: application._id,
          jobId: application.jobId,
          jobTitle: job?.title ?? "Vaga removida",
          contractType: job?.contractType ?? null,
          stage: application.stage,
          matchScore: application.matchScore,
          appliedAt: application.appliedAt,
          rejectionReason: application.rejectionReason ?? null,
          processAccepted: application.processAccepted ?? false,
          interviewDate: application.interviewDate ?? null,
          expectedStartDate: application.expectedStartDate ?? null,
        });
      }
      candidaturas.sort((a, b) => b.appliedAt - a.appliedAt);
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_recruiter", (q) => q.eq("recruiterId", user._id))
      .collect();

    return {
      exportedAt: Date.now(),
      usuario: {
        id: user._id as string,
        email: user.email ?? null,
        name: user.name ?? null,
        role: user.role ?? null,
        active: user.active ?? true,
        image: user.image ?? null,
        notifyJobAlerts: user.notifyJobAlerts ?? true,
        notifyApplicationUpdates: user.notifyApplicationUpdates ?? true,
      },
      consentimentos: consents.map((consent) => ({
        termVersion: consent.termVersion,
        acceptedAt: consent.acceptedAt,
      })),
      perfilAluno:
        student === null
          ? null
          : {
              fullName: student.fullName,
              enrollment: student.enrollment,
              status: student.status,
              course: student.course,
              graduationYear: student.graduationYear,
              semester: student.semester ?? null,
              location: student.location ?? null,
              linkedinUrl: student.linkedinUrl ?? null,
              portfolioUrl: student.portfolioUrl ?? null,
              availability: student.availability,
              visibility: student.visibility ?? null,
              showContactToRecruiters: student.showContactToRecruiters ?? false,
              skills: student.skills ?? [],
              languages: student.languages ?? [],
              resumeData: student.resumeData,
            },
      candidaturas,
      vagasPublicadas: jobs.map((job) => ({
        jobId: job._id as string,
        title: job.title,
        status: job.status,
        contractType: job.contractType,
        publishedAt: job.publishedAt ?? null,
        expiresAt: job.expiresAt ?? null,
        filledAt: job.filledAt ?? null,
      })),
    };
  },
});

/** [PERFIL_E_LGPD] Etapa 1 — foto de avatar (data URL ≤ ~400KB). */
const MAX_IMAGE_CHARS = 560_000;

export const updateMyProfile = mutation({
  args: {
    /** Data URL `data:image/...;base64,...`; ausente = remover a foto. */
    image: v.optional(v.string()),
  },
  handler: async (ctx, { image }) => {
    const user = await requireUser(ctx);
    if (image === undefined) {
      await ctx.db.patch(user._id, { image: undefined });
      return { image: null };
    }
    if (!image.startsWith("data:image/") || !image.includes(";base64,")) {
      throw new Error(
        "Imagem inválida — envie um arquivo de imagem (PNG, JPEG ou WebP).",
      );
    }
    if (image.length > MAX_IMAGE_CHARS) {
      throw new Error("Imagem muito grande — o limite é 400KB.");
    }
    await ctx.db.patch(user._id, { image });
    return { image };
  },
});

/**
 * [PERFIL_E_LGPD] Etapa 2 — switches de notificação persistidos no
 * documento do usuário (reutilizados pelo `me` no cliente).
 */
export const updateMyNotificationPrefs = mutation({
  args: {
    jobAlerts: v.boolean(),
    applicationUpdates: v.boolean(),
  },
  handler: async (ctx, { jobAlerts, applicationUpdates }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, {
      notifyJobAlerts: jobAlerts,
      notifyApplicationUpdates: applicationUpdates,
    });
    return { jobAlerts, applicationUpdates };
  },
});
