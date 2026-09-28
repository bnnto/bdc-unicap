/**
 * [S8-4] SLA de 99% — monitoração do deploy de produção (CA 2).
 *
 * Regra PURA sobre batidas de healthcheck: a rota `GET /healthz`
 * (convex/http.ts) produz as batidas; a janela deslizante consolida a
 * disponibilidade e o status da monitoração, sem I/O — TDD.
 */

/** Janela deslizante da monitoração: 120 batidas (1 h a cada 30 s). */
export const UPTIME_WINDOW_SIZE = 120;

/** SLA alvo de disponibilidade (RN da issue): 99%. */
export const SLA_TARGET_PERCENT = 99;

/** Uma batida de healthcheck consolidada (janela da monitoração). */
export type Heartbeat = { up: boolean; at: number };

/** Lê a resposta do healthcheck e produz a batida consolidada. */
export function buildHeartbeat(
  response: { httpStatus: number; dbOk: boolean },
  at: number,
): Heartbeat {
  return { up: response.httpStatus === 200 && response.dbOk, at };
}

/**
 * Disponibilidade da janela (0–100, até 4 casas). Janela vazia é neutra:
 * 100% (a monitoração não inventa falhas sem evidência).
 */
export function uptimePercent(window: readonly Heartbeat[]): number {
  if (window.length === 0) return 100;
  const up = window.filter((beat) => beat.up).length;
  return Math.round((up / window.length) * 10_000) / 100;
}

/** Entradas da avaliação da monitoração do deploy. */
export type DeployMonitoringInput = {
  /** Última batida conhecida (healthcheck mais recente). */
  lastHeartbeat: Heartbeat | null;
  /** Janela deslizante das últimas batidas (máx. UPTIME_WINDOW_SIZE). */
  window: readonly Heartbeat[];
  /** Deploy de produção (URL monitorada). */
  production: { url: string; deployed: boolean };
};

export type DeployMonitoringStatus = {
  ok: boolean;
  slaMet: boolean;
  availabilityPercent: number;
  windowSize: number;
  failed: string[];
};

/**
 * Avalia a monitoração do deploy de produção (CA 2 + RN SLA 99%):
 * - deploy_ausente: não há deploy de produção para monitorar;
 * - healthcheck_down: última batida indica indisponibilidade;
 * - sla_99_violado: disponibilidade da janela abaixo de 99%.
 */
export function evaluateDeployMonitoring(
  input: DeployMonitoringInput,
): DeployMonitoringStatus {
  const failed: string[] = [];
  const relevant = input.window.slice(-UPTIME_WINDOW_SIZE);
  const availability = uptimePercent(relevant);

  if (!input.production.deployed) {
    failed.push("deploy_ausente");
  }
  if (input.lastHeartbeat !== null && !input.lastHeartbeat.up) {
    failed.push("healthcheck_down");
  }
  const slaMet = availability >= SLA_TARGET_PERCENT;
  if (!slaMet) {
    failed.push("sla_99_violado");
  }

  return {
    ok: failed.length === 0,
    slaMet,
    availabilityPercent: availability,
    windowSize: relevant.length,
    failed,
  };
}
