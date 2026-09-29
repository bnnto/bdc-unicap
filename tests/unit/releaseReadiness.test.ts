/**
 * [S8-5] Release 1.0 (CA 1 — todos os CAs anteriores verdes; CA 2 — deploy
 * validado). Regra pura `releaseReadiness.ts`: gates obrigatórios por
 * entrega (S0..S8-4), resumo de qualidade e avaliação consolidada que
 * bloqueia o deploy com qualquer gate vermelho.
 */
import { describe, expect, it } from "vitest";
import {
  RELEASE_VERSION,
  RELEASE_GATES,
  RELEASE_QUALITY_GATES,
  evaluateReleaseReadiness,
} from "../../src/lib/releaseReadiness";

const TODOS_OS_GATES = RELEASE_GATES.map((gate) => gate.id);

/** Entrada de referência: release íntegra. */
function greenInput(): Parameters<typeof evaluateReleaseReadiness>[0] {
  return {
    gates: TODOS_OS_GATES.map((id) => ({
      issueId: id,
      passed: true,
      evidence: "PR mergeado com CAs verdes",
    })),
    quality: {
      testsPassed: 663,
      testsFailed: 0,
      typecheck: true,
      lint: true,
      coverage: true,
    },
    health: {
      status: "ok" as const,
      db: true,
      checkedAt: Date.now(),
    },
    deployment: {
      url: "https://portal-carreiras-unicap.example",
      deployed: true,
      healthz: "up" as const,
    },
  };
}

describe("S8-5 — parâmetros da release", () => {
  it("versão da release é 1.0.0", () => {
    expect(RELEASE_VERSION).toBe("1.0.0");
  });

  it("declara gates para todas as entregas de S0 a S8-4", () => {
    const ids = RELEASE_GATES.map((gate) => gate.id);
    expect(ids).toContain("S1-1");
    expect(ids).toContain("S3-1");
    expect(ids).toContain("S5-1");
    // [REFACTOR_GESTOR] Módulo de extensão cancelado: sem gates S7-*.
    expect(ids.some((id) => id.startsWith("S7"))).toBe(false);
    expect(ids).toContain("S8-1");
    expect(ids).toContain("S8-4");
    // Todos os gates declarados cobrem issues até a S8-4 (S8-5 é a própria
    // release — não pode se auto-declarar como gate).
    expect(ids.some((id) => id.startsWith("S8-5"))).toBe(false);
  });

  it("gates de qualidade são os quatro da bateria do projeto", () => {
    expect(Object.keys(RELEASE_QUALITY_GATES).sort()).toEqual([
      "coverage",
      "lint",
      "tests",
      "typecheck",
    ]);
  });
});

describe("S8-5 — avaliação consolidada de prontidão (CA 1)", () => {
  it("release íntegra: todos os gates verdes, pronta para deploy", () => {
    const report = evaluateReleaseReadiness(greenInput());
    expect(report.ready).toBe(true);
    expect(report.failed).toEqual([]);
    expect(report.checks.gates).toBe(true);
    expect(report.checks.quality).toBe(true);
    expect(report.checks.health).toBe(true);
    expect(report.checks.deployment).toBe(true);
    expect(report.version).toBe("1.0.0");
  });

  it("um único gate de issue vermelho bloqueia a release", () => {
    const input = greenInput();
    const gateAlvo = input.gates.find((g) => g.issueId === "S8-2");
    if (gateAlvo !== undefined) {
      gateAlvo.passed = false;
      gateAlvo.evidence = "PR ainda aberto";
    }
    const report = evaluateReleaseReadiness(input);
    expect(report.ready).toBe(false);
    expect(report.failed).toContain("gate_S8-2");
  });

  it("gate de issue ausente na lista bloqueia a release", () => {
    const input = greenInput();
    input.gates = input.gates.filter((g) => g.issueId !== "S8-1");
    const report = evaluateReleaseReadiness(input);
    expect(report.ready).toBe(false);
    expect(report.failed).toContain("gate_S8-1");
  });

  it("qualidade: testes falhando, typecheck ou lint vermelhos bloqueiam", () => {
    for (const patch of [
      { testsFailed: 1 },
      { typecheck: false },
      { lint: false },
      { coverage: false },
    ]) {
      const input = greenInput();
      input.quality = { ...input.quality, ...patch };
      const report = evaluateReleaseReadiness(input);
      expect(report.ready, JSON.stringify(patch)).toBe(false);
      expect(report.failed).toContain("qualidade");
    }
  });
});

describe("S8-5 — deploy validado (CA 2)", () => {
  it("healthcheck degradado bloqueia o deploy", () => {
    const input = greenInput();
    input.health = { status: "degraded", db: false, checkedAt: Date.now() };
    const report = evaluateReleaseReadiness(input);
    expect(report.ready).toBe(false);
    expect(report.failed).toContain("healthcheck");
  });

  it("deploy ausente ou com /healthz fora do ar bloqueia a release", () => {
    for (const deployment of [
      { url: "https://x.example", deployed: false, healthz: "up" as const },
      { url: "https://x.example", deployed: true, healthz: "down" as const },
      { url: "https://x.example", deployed: true, healthz: "unknown" as const },
    ]) {
      const input = greenInput();
      input.deployment = deployment;
      const report = evaluateReleaseReadiness(input);
      expect(report.ready, JSON.stringify(deployment)).toBe(false);
      expect(report.failed).toContain("deploy");
    }
  });

  it("deploy válido com healthz up mantém a release pronta", () => {
    const report = evaluateReleaseReadiness(greenInput());
    expect(report.failed).not.toContain("deploy");
    expect(report.failed).not.toContain("healthcheck");
  });
});
