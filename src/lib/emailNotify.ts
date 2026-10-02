/**
 * [FINAL_UPGRADE Etapa 2] — regra PURA de notificação por e-mail do
 * Kanban (TDD, sem I/O). A action Convex `emails.sendStageNotification`
 * só cuida do transporte (Resend ou mock com console.log); o conteúdo e
 * a decisão de notificar vivem aqui para serem testados isoladamente.
 *
 * Spec: quando o recrutador mover um aluno para "Entrevista" ou
 * "Aprovado", o backend notifica o aluno ("Parabéns, você avançou no
 * processo…").
 */
import { STAGE_LABELS, type ApplicationStage } from "./application";

/** Etapas que notificam o aluno por e-mail (spec do FINAL_UPGRADE). */
export const NOTIFY_STAGES: readonly ApplicationStage[] = [
  "entrevista",
  "aprovado",
];

/** Ordem do funil principal (sem a coluna terminal "reprovado"). */
const FUNNEL_ORDER: readonly ApplicationStage[] = [
  "inscrito",
  "triagem",
  "entrevista",
  "aprovado",
];

/**
 * Notifica apenas em AVANÇO de etapa (uma etapa por vez, sentido do
 * funil) que termina em "Entrevista" ou "Aprovado". Recuos (desfazer),
 * reprovações e no-ops nunca disparam e-mail.
 */
export function shouldNotifyStageAdvance(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  if (!NOTIFY_STAGES.includes(to)) return false;
  const fromIndex = FUNNEL_ORDER.indexOf(from);
  const toIndex = FUNNEL_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export type StageNotificationEmail = {
  subject: string;
  text: string;
  html: string;
};

/** Constrói o e-mail de parabéns por avanço de etapa (pt-BR). */
export function buildStageNotificationEmail(input: {
  studentName: string;
  jobTitle: string;
  stage: ApplicationStage;
}): StageNotificationEmail {
  const stageLabel = STAGE_LABELS[input.stage];
  const subject = `Parabéns! Você avançou para ${stageLabel} — ${input.jobTitle}`;
  const text = [
    `Olá, ${input.studentName}!`,
    "",
    `Parabéns, você avançou no processo seletivo da vaga "${input.jobTitle}".`,
    `Etapa atual: ${stageLabel}.`,
    "",
    "Acesse o Portal de Carreiras UNICAP para acompanhar os próximos passos.",
    "",
    "— Portal de Carreiras UNICAP",
  ].join("\n");
  const html = [
    `<p>Olá, <strong>${escapeHtml(input.studentName)}</strong>!</p>`,
    `<p><strong>Parabéns, você avançou no processo seletivo</strong> da vaga ` +
      `<strong>${escapeHtml(input.jobTitle)}</strong>.</p>`,
    `<p>Etapa atual: <strong>${escapeHtml(stageLabel)}</strong>.</p>`,
    `<p>Acesse o Portal de Carreiras UNICAP para acompanhar os próximos passos.</p>`,
    `<p>— Portal de Carreiras UNICAP</p>`,
  ].join("\n");
  return { subject, text, html };
}

/** Escapa valores do usuário no HTML (nomes/vagas com < ou &). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
