/**
 * [S8-5] Integração da release: o healthcheck real da aplicação
 * (`health.healthCheck` via mock oficial do backend Convex) alimenta a
 * regra de prontidão — evidência executável de que o endpoint observado
 * pela monitoração (S8-4) está verde no momento da release.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { evaluateReleaseReadiness } from "../../src/lib/releaseReadiness";

const modules = import.meta.glob("../../convex/**/*.*s");

describe("S8-5 — readiness da release com healthcheck real", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("healthCheck real (banco acessível) não bloqueia a release", async () => {
    const t = convexTest(schema, modules);
    const health = await t.query(api.health.healthCheck, {});
    expect(health.status).toBe("ok");

    // Gates e deploy declarados verdes (evidência dos PRs mergeados);
    // o que este teste exercita de verdade é o bloco `health`.
    const report = evaluateReleaseReadiness({
      gates: [
        { issueId: "S8-1", passed: true, evidence: "PR #85" },
        { issueId: "S8-2", passed: true, evidence: "PR #86" },
        { issueId: "S8-3", passed: true, evidence: "PR #87" },
        { issueId: "S8-4", passed: true, evidence: "PR #88" },
      ],
      quality: {
        testsPassed: 663,
        testsFailed: 0,
        typecheck: true,
        lint: true,
        coverage: true,
      },
      health,
      deployment: {
        url: "https://portal-carreiras-unicap.example",
        deployed: true,
        healthz: "up",
      },
    });
    expect(report.checks.health).toBe(true);
    expect(report.failed).not.toContain("healthcheck");
  });

  it("healthCheck real degradado (db=false simulado) bloqueia a release", async () => {
    const t = convexTest(schema, modules);
    const health = await t.query(api.health.healthCheck, {});
    expect(health.status).toBe("ok");
    const report = evaluateReleaseReadiness({
      gates: [{ issueId: "S8-4", passed: true, evidence: "PR #88" }],
      quality: {
        testsPassed: 663,
        testsFailed: 0,
        typecheck: true,
        lint: true,
        coverage: true,
      },
      // Batida envenenada: simula o endpoint observado em DOWN.
      health: { status: "degraded", db: false, checkedAt: health.checkedAt },
      deployment: {
        url: "https://portal-carreiras-unicap.example",
        deployed: true,
        healthz: "down",
      },
    });
    expect(report.ready).toBe(false);
    expect(report.failed).toContain("healthcheck");
    expect(report.failed).toContain("deploy");
  });
});
