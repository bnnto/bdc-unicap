import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Crons do sistema — [S0-3] / [S3-2].
 * R4 — Expiração de vagas: executa diariamente à meia-noite (UTC) e
 * encerra automaticamente as vagas abertas vencidas (30 dias padrão,
 * sem renovação). Chama a mutation interna `jobs.closeExpiredJobs`,
 * ancorada no índice `by_status` (varredura enxuta).
 */
const crons = cronJobs();

crons.daily(
  "encerrar-vagas-vencidas",
  { hourUTC: 0, minuteUTC: 0 },
  internal.jobs.closeExpiredJobs,
);

crons.daily(
  "purge stale recruiters",
  { hourUTC: 6, minuteUTC: 0 },
  internal.moderation.purgeStaleRecruiters,
);

crons.daily(
  "purge old moderation records",
  { hourUTC: 7, minuteUTC: 0 },
  internal.moderation.purgeOldModerationRecords,
);

export default crons;
