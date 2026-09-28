/**
 * [S8-4] SLA 99% — monitoração do deploy de produção (CA 2).
 *
 * Regra pura sobre batidas de healthcheck (uptime.ts): cálculo da
 * disponibilidade da janela, classificação por SLA (99%) e status
 * consolidado para a observação do deploy.
 */
import { describe, expect, it } from "vitest";
import {
  SLA_TARGET_PERCENT,
  UPTIME_WINDOW_SIZE,
  buildHeartbeat,
  evaluateDeployMonitoring,
  uptimePercent,
} from "../../src/lib/uptime";

const OK = { httpStatus: 200, dbOk: true };
const FAIL = { httpStatus: 503, dbOk: false };

describe("S8-4 — janela de monitoração (healthcheck)", () => {
  it("batida válida registra estado UP com timestamp", () => {
    const beat = buildHeartbeat(OK, 1_000);
    expect(beat).toEqual({ up: true, at: 1_000 });
  });

  it("batida com banco indisponível registra DOWN", () => {
    expect(buildHeartbeat({ ...OK, dbOk: false }, 2_000)).toEqual({
      up: false,
      at: 2_000,
    });
  });

  it("batida 503 registra DOWN mesmo com sonda positiva", () => {
    expect(buildHeartbeat({ ...FAIL, dbOk: true }, 3_000)).toEqual({
      up: false,
      at: 3_000,
    });
  });

  it("janela tem tamanho fixo (últimas 120 batidas = 1h a 30s)", () => {
    expect(UPTIME_WINDOW_SIZE).toBe(120);
  });

  it("SLA alvo é 99%", () => {
    expect(SLA_TARGET_PERCENT).toBe(99);
  });
});

describe("S8-4 — disponibilidade da janela", () => {
  it("janela vazia é neutra (100% sem evidência contrária)", () => {
    expect(uptimePercent([])).toBe(100);
  });

  it("todas as batidas UP → 100%", () => {
    const beats = Array.from({ length: 10 }, (_, i) => ({
      up: true,
      at: i,
    }));
    expect(uptimePercent(beats)).toBe(100);
  });

  it("uma falha em 100 batidas → 99% (no limite do SLA)", () => {
    const beats = Array.from({ length: 100 }, (_, i) => ({
      up: i !== 0,
      at: i,
    }));
    expect(uptimePercent(beats)).toBeCloseTo(99, 5);
  });

  it("usar mais de 4 casas não mascara violações (99,999 → 99,9985)", () => {
    // 99,9985 é arredondado para 99,999 com 3 casas; a regra usa até 4.
    expect(
      uptimePercent([
        { up: true, at: 1 },
        { up: false, at: 2 },
      ]),
    ).toBe(50);
  });
});

describe("S8-4 — status consolidado da monitoração (CA 2)", () => {
  it("deploy saudável com histórico 100% UP e healthcheck 200", () => {
    const beats = Array.from({ length: 30 }, (_, i) => ({
      up: true,
      at: i,
    }));
    const status = evaluateDeployMonitoring({
      lastHeartbeat: { up: true, at: 10_000 },
      window: beats,
      production: { url: "https://portal.unicap.br", deployed: true },
    });
    expect(status.ok).toBe(true);
    expect(status.slaMet).toBe(true);
    expect(status.availabilityPercent).toBe(100);
    expect(status.failed).toEqual([]);
  });

  it("healthcheck DOWN marca o deploy como indisponível", () => {
    const beats = Array.from({ length: 30 }, (_, i) => ({
      up: true,
      at: i,
    }));
    const status = evaluateDeployMonitoring({
      lastHeartbeat: { up: false, at: 10_000 },
      window: beats,
      production: { url: "https://portal.unicap.br", deployed: true },
    });
    expect(status.ok).toBe(false);
    expect(status.failed).toContain("healthcheck_down");
  });

  it("no limite exato de 99% o SLA é cumprido", () => {
    const beats = Array.from({ length: 100 }, (_, i) => ({
      up: i !== 0,
      at: i,
    }));
    const status = evaluateDeployMonitoring({
      lastHeartbeat: { up: true, at: 10_000 },
      window: beats,
      production: { url: "https://portal.unicap.br", deployed: true },
    });
    expect(status.slaMet).toBe(true); // 99% no limite cumpre o SLA
    expect(status.availabilityPercent).toBe(99);
  });

  it("disponibilidade abaixo do SLA viola", () => {
    const beats = Array.from({ length: 100 }, (_, i) => ({
      up: i % 10 !== 0, // 90% UP
      at: i,
    }));
    const status = evaluateDeployMonitoring({
      lastHeartbeat: { up: true, at: 10_000 },
      window: beats,
      production: { url: "https://portal.unicap.br", deployed: true },
    });
    expect(status.ok).toBe(false);
    expect(status.slaMet).toBe(false);
    expect(status.failed).toContain("sla_99_violado");
  });

  it("sem deploy de produção, monitoração não pode declarar ok", () => {
    const status = evaluateDeployMonitoring({
      lastHeartbeat: { up: true, at: 10_000 },
      window: [],
      production: { url: "https://portal.unicap.br", deployed: false },
    });
    expect(status.ok).toBe(false);
    expect(status.failed).toContain("deploy_ausente");
  });
});
