import { describe, expect, it } from "vitest";
import {
  JOB_EXPIRY_DAYS,
  computeExpiresAt,
  isJobExpired,
  renewJob,
  renewalWindow,
  type ExpirableJob,
  type JobLifecycleStatus,
} from "../../src/lib/jobExpiry";

// Datas ISO sem horário são interpretadas em UTC (mesmo que Date.UTC).
const at = (iso: string) => Date.parse(iso);

const DAY_MS = 86_400_000; // 24 * 60 * 60 * 1000
const PRAZO_ESPERADO_DIAS = 30;
const PRAZO_MS = PRAZO_ESPERADO_DIAS * DAY_MS;
const JANELA_AVISO_DIAS = 5;

/** Vaga aberta publicada em 1/set/2026 com vencimento em 1/out/2026. */
const baseJob: ExpirableJob = {
  status: "aberta",
  publishedAt: at("2026-09-01"),
  expiresAt: at("2026-10-01"),
};

describe("R4 — prazo de expiração (S3-2)", () => {
  it("duração padrão é 30 dias", () => {
    expect(JOB_EXPIRY_DAYS).toBe(PRAZO_ESPERADO_DIAS);
  });

  it("expiresAt = publishedAt + 30d (CA 1)", () => {
    const publishedAt = at("2026-09-01T12:00:00Z");
    expect(computeExpiresAt(publishedAt)).toBe(publishedAt + PRAZO_MS);
  });

  it("é estável em bordas de mês (set → out)", () => {
    const publishedAt = at("2026-09-20T10:30:00Z");
    const expected = at("2026-10-20T10:30:00Z");
    expect(computeExpiresAt(publishedAt)).toBe(expected);
  });
});

describe("R4 — vencimento e status derivado (S3-2)", () => {
  it("vaga aberta dentro do prazo não está vencida", () => {
    expect(isJobExpired(baseJob, at("2026-09-15"))).toBe(false);
  });

  it("vaga aberta vencida deve ser encerrada pelo cron (CA 2)", () => {
    const now = at("2026-10-02");
    expect(isJobExpired(baseJob, now)).toBe(true);
    expect(renewJob(baseJob, now)).toEqual({
      ok: false,
      reason: "expirada",
      nextStatus: "encerrada",
    });
  });

  it("vence exatamente no milissegundo do expiresAt (limite inclusivo)", () => {
    expect(isJobExpired(baseJob, at("2026-10-01"))).toBe(true);
    expect(isJobExpired(baseJob, at("2026-10-01") - 1)).toBe(false);
  });

  it.each<JobLifecycleStatus>(["fechada", "encerrada"])(
    "vaga %s nunca é alvo do encerramento automático",
    (status) => {
      expect(isJobExpired({ ...baseJob, status }, at("2026-10-02"))).toBe(
        false,
      );
    },
  );

  it("renovação reativa o prazo de 30 dias a partir de agora (CA 3)", () => {
    const now = at("2026-09-20");
    expect(renewJob(baseJob, now)).toEqual({
      ok: true,
      expired: false,
      expiresAt: now + PRAZO_MS,
    });
  });

  it("renovação de vaga já encerrada é rejeitada (usa mudança de status)", () => {
    const result = renewJob({ ...baseJob, status: "encerrada" }, Date.now());
    expect(result).toEqual({ ok: false, reason: "status_invalido" });
  });

  it("renovação de vaga fechada é permitida e reabre o prazo", () => {
    const now = at("2026-09-25");
    const result = renewJob({ ...baseJob, status: "fechada" }, now);
    expect(result).toEqual({
      ok: true,
      expired: false,
      expiresAt: now + PRAZO_MS,
      reopen: true,
    });
  });
});

describe("R4 — janela de aviso de expiração (S3-2)", () => {
  it("avisa nos últimos 5 dias de vida da vaga aberta", () => {
    const window = renewalWindow(baseJob, at("2026-09-26")); // 5 dias antes de 1/out
    expect(window).toMatchObject({
      daysLeft: JANELA_AVISO_DIAS,
      expiring: true,
    });
  });

  it("não avisa fora da janela", () => {
    expect(renewalWindow(baseJob, at("2026-09-20")).expiring).toBe(false);
  });

  it("não avisa para vagas não abertas", () => {
    const encerrada: ExpirableJob = { ...baseJob, status: "encerrada" };
    expect(renewalWindow(encerrada, at("2026-09-27")).expiring).toBe(false);
  });

  it("vaga vencida reporta dias restantes negativos", () => {
    const window = renewalWindow(baseJob, at("2026-10-03"));
    expect(window.expired).toBe(true);
    expect(window.daysLeft).toBeLessThan(0);
  });
});
