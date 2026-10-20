import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isRecruiterApproved } from "./lib/currentUser";

declare const process: { env: Record<string, string | undefined> };

const DAY = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 20;
/** Intervalo mínimo entre dois convites do mesmo recrutador ao mesmo aluno. */
const SAME_STUDENT_COOLDOWN = 7 * DAY;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Chamada pelo modal: valida tudo e agenda o envio. */
export const sendInvite = mutation({
  args: {
    studentId: v.id("students"),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Faça login para continuar.");

    const recruiter = await ctx.db.get(userId);
    if (
      recruiter === null ||
      recruiter.role !== "recrutador" ||
      recruiter.active === false
    ) {
      throw new ConvexError("Apenas recrutadores ativos podem enviar convites.");
    }
    if (!isRecruiterApproved(recruiter)) {
      throw new ConvexError(
        "Seu cadastro de recrutador ainda não foi aprovado pela coordenação.",
      );
    }

    // R1 + R2 + R6: vínculo ativo/egresso, perfil público e contato autorizado.
    const student = await ctx.db.get(args.studentId);
    if (
      student === null ||
      student.status === "inativo" ||
      student.visibility !== "publico" ||
      student.showContactToRecruiters !== true
    ) {
      throw new ConvexError("Este aluno não autorizou contato.");
    }

    const subject = args.subject.replace(/[\r\n]+/g, " ").trim();
    const message = args.message.trim();
    if (subject.length < 3 || subject.length > 120) {
      throw new ConvexError("O assunto deve ter entre 3 e 120 caracteres.");
    }
    if (message.length < 20 || message.length > 2000) {
      throw new ConvexError("A mensagem deve ter entre 20 e 2000 caracteres.");
    }

    // Limite diário por recrutador (anti-spam).
    const lastDay = await ctx.db
      .query("invitations")
      .withIndex("by_recruiter", (q) =>
        q.eq("recruiterId", userId).gt("_creationTime", Date.now() - DAY),
      )
      .collect();
    if (lastDay.length >= DAILY_LIMIT) {
      throw new ConvexError("Limite diário de convites atingido.");
    }

    // Não insistir com o mesmo aluno em curto intervalo.
    const repeated = await ctx.db
      .query("invitations")
      .withIndex("by_recruiter_student", (q) =>
        q
          .eq("recruiterId", userId)
          .eq("studentId", args.studentId)
          .gt("_creationTime", Date.now() - SAME_STUDENT_COOLDOWN),
      )
      .filter((q) => q.neq(q.field("status"), "failed"))
      .first();
    if (repeated !== null) {
      throw new ConvexError(
        "Você já enviou um convite a este aluno nos últimos 7 dias.",
      );
    }

    const invitationId = await ctx.db.insert("invitations", {
      recruiterId: userId,
      studentId: args.studentId,
      subject,
      message,
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.invitations.deliver, {
      invitationId,
    });
    return invitationId;
  },
});

/** Reúne os e-mails no servidor: nunca vão para o navegador. */
export const getDeliveryData = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId);
    if (invitation === null) return { error: "Convite não encontrado." };

    const student = await ctx.db.get(invitation.studentId);
    const recruiter = await ctx.db.get(invitation.recruiterId);
    if (student === null || recruiter === null) {
      return { error: "Aluno ou recrutador não encontrado." };
    }

    // O aluno pode ter revogado o contato entre o pedido e o envio.
    if (
      student.status === "inativo" ||
      student.visibility !== "publico" ||
      student.showContactToRecruiters !== true
    ) {
      return { error: "O aluno revogou a autorização de contato." };
    }

    const studentUser = await ctx.db.get(student.userId);
    if (!studentUser?.email || !recruiter.email) {
      return { error: "E-mail do aluno ou do recrutador indisponível." };
    }

    return {
      data: {
        subject: invitation.subject,
        message: invitation.message,
        studentName: student.fullName,
        studentEmail: studentUser.email,
        recruiterName: recruiter.name ?? recruiter.email,
        recruiterEmail: recruiter.email,
      },
    };
  },
});

export const markResult = internalMutation({
  args: {
    invitationId: v.id("invitations"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { invitationId, ...patch }) => {
    await ctx.db.patch(invitationId, patch);
  },
});

/** Envia via API REST do Resend (sem SDK). */
export const deliver = internalAction({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, { invitationId }) => {
    const fail = (error: string) =>
      ctx.runMutation(internal.invitations.markResult, {
        invitationId,
        status: "failed",
        error,
      });

    const loaded = await ctx.runQuery(internal.invitations.getDeliveryData, {
      invitationId,
    });
    if (loaded.data === undefined) {
      await fail(loaded.error ?? "Dados do convite incompletos.");
      return;
    }
    const data = loaded.data;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      await fail("Resend não configurado (RESEND_API_KEY / RESEND_FROM).");
      return;
    }

    const body = escapeHtml(data.message).replace(/\n/g, "<br />");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <p>Olá, ${escapeHtml(data.studentName)}!</p>
        <p><strong>${escapeHtml(data.recruiterName)}</strong> enviou uma mensagem pelo Banco de Currículos da UNICAP:</p>
        <div style="border-left:4px solid #6b1426;padding:8px 16px;background:#fdf2f4;margin:16px 0">
          ${body}
        </div>
        <p>Para responder, basta responder a este e-mail: a resposta vai direto para ${escapeHtml(data.recruiterName)}.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#64748b">
          Você recebeu esta mensagem porque autorizou o contato de recrutadores
          no seu perfil. Para deixar de receber, desative essa autorização nas
          configurações do seu perfil no portal.
        </p>
      </div>`;
    const text =
      `Olá, ${data.studentName}!\n\n` +
      `${data.recruiterName} enviou uma mensagem pelo Banco de Currículos da UNICAP:\n\n` +
      `${data.message}\n\n` +
      `Responda a este e-mail para falar diretamente com ${data.recruiterName}.\n\n` +
      `Você recebeu esta mensagem porque autorizou o contato de recrutadores no seu perfil.`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `invite-${invitationId}`,
        },
        body: JSON.stringify({
          from,
          to: [data.studentEmail],
          reply_to: data.recruiterEmail,
          subject: data.subject,
          html,
          text,
        }),
      });
      const json = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      await ctx.runMutation(internal.invitations.markResult, {
        invitationId,
        status: "sent",
        resendId: json.id,
      });
    } catch (err) {
      await fail(err instanceof Error ? err.message : "Erro desconhecido");
    }
  },
});