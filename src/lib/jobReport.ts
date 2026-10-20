/** [MODERACAO_VAGA] Regras puras das denúncias de vagas. */
export const REPORT_REASONS = [
  "cobranca_indevida",
  "empresa_falsa",
  "contato_fora_do_portal",
  "conteudo_enganoso",
  "discriminacao",
  "outro",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  cobranca_indevida: "Cobra dinheiro ou taxa do candidato",
  empresa_falsa: "Empresa ou recrutador suspeito ou falso",
  contato_fora_do_portal: "Pede contato fora do portal (WhatsApp, Telegram…)",
  conteudo_enganoso: "Conteúdo enganoso (salário, requisitos irreais)",
  discriminacao: "Discriminação ou conteúdo ofensivo",
  outro: "Outro problema (descreva)",
};

/** Denúncias de alunos DIFERENTES que suspendem a vaga automaticamente. */
export const REPORT_SUSPEND_THRESHOLD = 10;
export const REPORT_DETAILS_MAX = 500;
export const REPORT_OTHER_MIN = 10;

export const REPORT_SUSPENSION_MESSAGE = `Suspensa automaticamente após ${REPORT_SUSPEND_THRESHOLD} denúncias de alunos. A coordenação vai analisar.`;

export function shouldSuspendForReports(activeReports: number): boolean {
  return activeReports >= REPORT_SUSPEND_THRESHOLD;
}

/** Contagem por motivo, do mais citado para o menos citado. */
export function reportBreakdown(
  reasons: readonly ReportReason[],
): Array<{ reason: ReportReason; count: number }> {
  const counts = new Map<ReportReason, number>();
  for (const reason of reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}