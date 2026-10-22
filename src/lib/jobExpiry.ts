/**
 * Regra pura R4 — Expiração de Vagas (issue [S3-2]).
 * 30 dias de duração padrão; "Encerrada" se não renovada; renovação
 * reativa o prazo. Compartilhada entre mutations/cron Convex e a UI do
 * recrutador — TDD, sem I/O. Datas em milissegundos desde epoch (o
 * formato nativo de timestamps no Convex).
 */

/** Duração padrão da vaga em dias (R4). */
export const JOB_EXPIRY_DAYS = 30;
const JOB_EXPIRY_MS = JOB_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/** Dias restantes que acionam o aviso de renovação na UI. */
const JOB_EXPIRY_WARNING_DAYS = 5;

export type JobLifecycleStatus =
  | "aberta"
  | "fechada"
  | "encerrada"
  | "em_revisao"
  | "suspensa";

export type ExpirableJob = {
  status: JobLifecycleStatus;
  publishedAt: number;
  expiresAt: number;
};

/** CA 1 — `expiresAt = publishedAt + 30d`. */
export function computeExpiresAt(publishedAt: number): number {
  return publishedAt + JOB_EXPIRY_MS;
}

/**
 * Vaga vencida: aberta e com `expiresAt <= now` (limite inclusivo —
 * no exato milissegundo do prazo a vaga já está vencida).
 * Vagas fechadas/encerradas nunca são alvo do encerramento automático.
 */
export function isJobExpired(
  job: Pick<ExpirableJob, "status" | "expiresAt">,
  now: number,
): boolean {
  if (job.status !== "aberta") return false;
  return job.expiresAt <= now;
}

type RenewalResult =
  | { ok: true; expired: false; expiresAt: number; reopen?: boolean }
  | { ok: false; reason: "status_invalido" }
  | { ok: false; reason: "moderacao" }
  | { ok: false; reason: "expirada"; nextStatus: "encerrada" };

/**
 * CA 3 — Renovação reativa o prazo de 30 dias a partir de agora.
 * Vaga vencida não pode ser renovada pelo recrutador (o cron a encerra —
 * use a reabertura via `setJobStatus` se o produto permitir no futuro).
 * Vaga fechada pode ser renovada e volta a ficar aberta.
 */
export function renewJob(job: ExpirableJob, now: number): RenewalResult {
  if (job.status === "em_revisao" || job.status === "suspensa") {
    return { ok: false, reason: "moderacao" };
  }
  if (job.status === "encerrada") {
    return { ok: false, reason: "status_invalido" };
  }
  if (isJobExpired(job, now)) {
    return { ok: false, reason: "expirada", nextStatus: "encerrada" };
  }
  return {
    ok: true,
    expired: false,
    expiresAt: computeExpiresAt(now),
    ...(job.status === "fechada" ? { reopen: true } : {}),
  };
}

type RenewalWindow = {
  /** Dias restantes (negativo quando já vencida). */
  daysLeft: number;
  /** Dentro da janela de aviso (últimos 5 dias, vaga aberta). */
  expiring: boolean;
  expired: boolean;
};

/** Janela de aviso para a UI do recrutador (badge "expirando"). */
export function renewalWindow(
  job: Pick<ExpirableJob, "status" | "expiresAt">,
  now: number,
): RenewalWindow {
  const daysLeft = Math.ceil((job.expiresAt - now) / (24 * 60 * 60 * 1000));
  const expired = isJobExpired(job, now);
  return {
    daysLeft,
    expiring:
      job.status === "aberta" &&
      !expired &&
      daysLeft <= JOB_EXPIRY_WARNING_DAYS,
    expired,
  };
}
