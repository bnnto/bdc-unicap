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
import {
  buildPasswordResetEmail,
  buildPasswordResetLink,
} from "../src/lib/passwordReset";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Base pública da aplicação para o link de recuperação: `APP_URL` (dashboard
 * Convex) → `CONVEX_SITE_URL` (plataforma) → localhost no desenvolvimento.
 */
function appBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.CONVEX_SITE_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

/** Remetente padrão; sobrescrito via RESEND_FROM no dashboard Convex. */
function fromAddress(): string {
  return process.env.RESEND_FROM ?? "onboarding@resend.dev";
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

/**
 * [ONBOARDING_RECOVERY] Etapa 2 — e-mail de "Esqueci minha senha".
 *
 * Monta o link `<APP_URL>/recuperar-senha?token=…` com a regra pura
 * `buildPasswordResetLink` e:
 *  - SEM `RESEND_API_KEY` → MOCK: `console.log` do link exato no terminal
 *    (teste local sem provedor de e-mail, spec Etapa 2.3);
 *  - COM a chave → envia via API do Resend. Nunca lança erro: falha de
 *    rede/API vira log e `{ sent: false }` (o pedido já foi criado).
 */
export const sendPasswordResetEmail = internalAction({
  args: { to: v.string(), token: v.string() },
  handler: async (_ctx, args): Promise<{ sent: boolean; mocked: boolean }> => {
    const link = buildPasswordResetLink(appBaseUrl(), args.token);
    const email = buildPasswordResetEmail({ link });

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
      // Fallback elegante (spec): imprime o LINK gerado no terminal.
      console.log(
        [
          "[password-reset] RESEND_API_KEY não configurada — e-mail NÃO enviado (simulação).",
          `Para: ${args.to}`,
          `Assunto: ${email.subject}`,
          "",
          email.text,
          "",
          `Link de recuperação: ${link}`,
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
      // E-mail é best-effort: loga e segue (nunca propaga para o cliente).
      console.error("[email] falha ao enviar e-mail de recuperação:", error);
      return { sent: false, mocked: false };
    }
  },
});
