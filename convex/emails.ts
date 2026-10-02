"use node";
/**
 * [FINAL_UPGRADE Etapa 2] — Infraestrutura de envio de E-mails do Convex.
 *
 * `sendStageNotification` é AGENDADA pela mutation
 * `applications.moveApplication` (ctx.scheduler.runAfter) quando o
 * recrutador avança uma candidatura para "Entrevista" ou "Aprovado".
 *
 * Transporte:
 *  - Com `RESEND_API_KEY` configurada → envia via API do Resend (fetch).
 *  - Sem a chave → MOCK amigável: `console.log` do conteúdo do e-mail no
 *    terminal, sem nunca quebrar o fluxo do Kanban.
 *
 * O conteúdo e a decisão de notificar são regras PURAS em
 * src/lib/emailNotify.ts (TDD). A action só faz I/O — por isso o
 * arquivo é exclusivo de actions ("use node" para process.env/fetch).
 */
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { buildStageNotificationEmail } from "../src/lib/emailNotify";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Remetente padrão; sobrescrito via RESEND_FROM no dashboard Convex. */
function fromAddress(): string {
  return (
    process.env.RESEND_FROM ??
    "Portal de Carreiras UNICAP <onboarding@resend.dev>"
  );
}

/**
 * E-mail de parabéns por avanço de etapa no Kanban. Nunca lança erro:
 * falhas de rede/API viram log e `{ sent: false }` — o Kanban não pode
 * falhar por causa de e-mail.
 */
export const sendStageNotification = internalAction({
  args: {
    to: v.string(),
    studentName: v.string(),
    jobTitle: v.string(),
    stage: v.union(v.literal("entrevista"), v.literal("aprovado")),
  },
  handler: async (_ctx, args): Promise<{ sent: boolean; mocked: boolean }> => {
    const email = buildStageNotificationEmail({
      studentName: args.studentName,
      jobTitle: args.jobTitle,
      stage: args.stage,
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
      // Fallback seguro (spec): imprime o e-mail amigavelmente no
      // terminal em vez de tentar enviar sem credencial.
      console.log(
        [
          "[email-mock] RESEND_API_KEY não configurada — e-mail NÃO enviado (simulação).",
          `Para: ${args.to}`,
          `Assunto: ${email.subject}`,
          "",
          email.text,
        ].join("\n"),
      );
      return { sent: false, mocked: true };
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [args.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(
          `[email] Resend respondeu ${response.status}: ${body.slice(0, 500)}`,
        );
        return { sent: false, mocked: false };
      }
      return { sent: true, mocked: false };
    } catch (error) {
      // E-mail é best-effort: loga e segue (nunca propaga para o Kanban).
      console.error("[email] falha ao enviar e-mail:", error);
      return { sent: false, mocked: false };
    }
  },
});
