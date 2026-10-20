/**
 * [MODERACAO_VAGA] Regras puras de moderação de vagas: status de bloqueio
 * e revisão automática de conteúdo em dois níveis (bloqueia o óbvio,
 * manda o duvidoso para revisão do gestor).
 */
import type { JobLifecycleStatus } from "./jobExpiry";

export const MODERATION_HOLD_STATUSES = ["em_revisao", "suspensa"] as const;
export type ModerationHoldStatus = (typeof MODERATION_HOLD_STATUSES)[number];
export type LiveJobStatus = Exclude<JobLifecycleStatus, ModerationHoldStatus>;

export function isModerationHold(status: string): status is ModerationHoldStatus {
  return (MODERATION_HOLD_STATUSES as readonly string[]).includes(status);
}

export function isLiveJobStatus(status: JobLifecycleStatus): status is LiveJobStatus {
  return !isModerationHold(status);
}

/** Descarta vagas em revisão/suspensas (KPIs e rankings só contam as demais). */
export function onlyLiveJobs<T extends { status: JobLifecycleStatus }>(
  jobs: readonly T[],
): Array<T & { status: LiveJobStatus }> {
  return jobs.filter((job): job is T & { status: LiveJobStatus } =>
    isLiveJobStatus(job.status),
  );
}

export const HOLD_MESSAGE =
  "Esta vaga está em revisão ou suspensa pela coordenação e não pode ser alterada pelo recrutador.";

export type ReviewVerdict = "ok" | "revisao" | "bloqueada";
export type ContentReview = { verdict: ReviewVerdict; reasons: string[] };

export type ReviewInput = {
  title: string;
  description: string;
  contractType: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
};

const BLOCK_RULES: Array<{ re: RegExp; reason: string }> = [
  {
    re: /taxa (de |para )?(inscricao|cadastro|selecao|participacao|treinamento|material|adesao)/,
    reason: "Cobrança de taxa do candidato.",
  },
  {
    re: /(pagamento|deposito|pix)\s+(antecipado|previo|adiantado)/,
    reason: "Pedido de pagamento antecipado.",
  },
  {
    re: /(envie|mande|transfira|deposite)\s+(o\s+)?(dinheiro|valor)/,
    reason: "Pedido de transferência de dinheiro.",
  },
  {
    re: /investimento (inicial|minimo)/,
    reason: "Exige investimento inicial do candidato.",
  },
  {
    re: /(piramide|multinivel|marketing de rede)/,
    reason: "Possível esquema de pirâmide/multinível.",
  },
  {
    re: /(pix|dinheiro|premio|bonus)\s+gratis|gratis\s+(pix|dinheiro)/,
    reason: "Promessa de dinheiro ou prêmio grátis.",
  },
  {
    re: /(cassino|tigrinho)/,
    reason: "Divulgação de jogo de azar.",
  },
];

const REVIEW_RULES: Array<{ re: RegExp; reason: string }> = [
  { re: /(https?:\/\/|www\.)\S+/, reason: "Contém link externo." },
  { re: /\b(whatsapp|zap|telegram)\b/, reason: "Cita WhatsApp/Telegram." },
  {
    re: /\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/,
    reason: "Contém número de telefone.",
  },
  { re: /\S+@\S+\.\S+/, reason: "Contém e-mail na descrição." },
  {
    re: /(renda extra|ganhos? (ilimitado|garantido)s?|ganhe (muito )?dinheiro|lucro garantido)/,
    reason: "Promessa de ganhos fáceis.",
  },
  { re: /\bpix\b/, reason: "Menciona Pix." },
  { re: /\b(gratis|gratuito|gratuita)\b/, reason: "Promete algo grátis." },
  { re: /\b(sorteio|premio|brinde)s?\b/, reason: "Menciona sorteio ou prêmio." },
  { re: /\b(aposta|apostas|bet|bets)\b/, reason: "Menciona apostas." },
  {
    re: /(cripto|bitcoin|forex|day ?trade)/,
    reason: "Menciona criptomoedas ou investimentos.",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function upperRatio(text: string): number {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  return upper / letters.length;
}

/** Revisão automática do conteúdo da vaga (dois níveis). */
export function reviewJobContent(input: ReviewInput): ContentReview {
  const text = normalize(`${input.title}\n${input.description}`);

  const blocked = BLOCK_RULES.filter((rule) => rule.re.test(text)).map(
    (rule) => rule.reason,
  );
  if (blocked.length > 0) return { verdict: "bloqueada", reasons: blocked };

  const reasons = REVIEW_RULES.filter((rule) => rule.re.test(text)).map(
    (rule) => rule.reason,
  );
  if (input.contractType === "estagio" && (input.salaryMax ?? 0) > 5000) {
    reasons.push("Bolsa de estágio acima do usual.");
  } else if ((input.salaryMax ?? 0) > 40000) {
    reasons.push("Salário muito acima do usual.");
  }
  if (input.description.length >= 40 && upperRatio(input.description) > 0.6) {
    reasons.push("Descrição em caixa alta.");
  }
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  if (words.length >= 6 && new Set(words).size / words.length < 0.5) {
    reasons.push("Texto repetitivo.");
  }
  if ((`${input.title}${input.description}`.match(/!/g) ?? []).length >= 3) {
    reasons.push("Excesso de exclamações.");
  }
  return reasons.length > 0
    ? { verdict: "revisao", reasons }
    : { verdict: "ok", reasons: [] };
}