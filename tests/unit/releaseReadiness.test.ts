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

type ReadinessInput = Parameters<typeof evaluateReleaseReadiness>[0];

const TODOS_OS_GATES = RELEASE_GATES.map((gate) => gate.id);
const TESTES_APROVADOS = 663;

const GREEN_QUALITY: ReadinessInput["quality"] = {
  testsPassed: TESTES_APROVADOS,
  testsFailed: 0,
  typecheck: true,
  lint: true,
  coverage: true,
};

/** Entrada de referência: release íntegra, com sobrescritas opcionais. */
function greenInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    gates: TODOS_OS_GATES.map((id) => ({
      issueId: id,
      passed: true,
      evidence: "PR mergeado com CAs verdes",
    })),
    quality: GREEN_QUALITY,
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
    ...overrides,
  };
}

/** Release íntegra, exceto pelo gate de issue indicado, que fica vermelho. */
function inputWithFailingGate(issueId: string): ReadinessInput {
  const base = greenInput();
  return {
    ...base,
    gates: base.gates.map((gate) =>
      gate.issueId === issueId
        ? { ...gate, passed: false, evidence: "PR ainda aberto" }
        : gate,
    ),
  };
}

describe("S8-5 — parâmetros da release", () => {
  it("versão da release é 1.0.0", () => {
    expect(RELEASE_VERSION).toBe("1.0.0");
  });

  it.each(["S1-1", "S3-1", "S5-1", "S8-1", "S8-4"])(
    "declara gate para a entrega %s",
    (id) => {
      expect(TODOS_OS_GATES).toContain(id);
    },
  );

  it("[REFACTOR_GESTOR] módulo de extensão cancelado: sem gates S7-*", () => {
    expect(TODOS_OS_GATES.filter((id) => id.startsWith("S7"))).toEqual([]);
  });

  it("S8-5 é a própria release: não pode se auto-declarar como gate", () => {
    expect(TODOS_OS_GATES.filter((id) => id.startsWith("S8-5"))).toEqual([]);
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

    expect(report).toMatchObject({
      ready: true,
      failed: [],
      checks: { gates: true, quality: true, health: true, deployment: true },
      version: RELEASE_VERSION,
    });
  });

  it("um único gate de issue vermelho bloqueia a release", () => {
    const report = evaluateReleaseReadiness(inputWithFailingGate("S8-2"));

    expect(report.ready).toBe(false);
    expect(report.failed).toContain("gate_S8-2");
  });

  it("gate de issue ausente na lista bloqueia a release", () => {
    const base = greenInput();
    const report = evaluateReleaseReadiness({
      ...base,
      gates: base.gates.filter((g) => g.issueId !== "S8-1"),
    });

    expect(report.ready).toBe(false);
    expect(report.failed).toContain("gate_S8-1");
  });

  it.each([
    { testsFailed: 1 },
    { typecheck: false },
    { lint: false },
    { coverage: false },
  ] satisfies Array<Partial<ReadinessInput["quality"]>>)(
    "qualidade vermelha bloqueia: %j",
    (patch) => {
      const report = evaluateReleaseReadiness(
        greenInput({ quality: { ...GREEN_QUALITY, ...patch } }),
      );

      expect(report.ready).toBe(false);
      expect(report.failed).toContain("qualidade");
    },
  );
});

describe("S8-5 — deploy validado (CA 2)", () => {
  it("healthcheck degradado bloqueia o deploy", () => {
    const report = evaluateReleaseReadiness(
      greenInput({
        health: { status: "degraded", db: false, checkedAt: Date.now() },
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.failed).toContain("healthcheck");
  });

  it.each([
    { url: "https://x.example", deployed: false, healthz: "up" as const },
    { url: "https://x.example", deployed: true, healthz: "down" as const },
    { url: "https://x.example", deployed: true, healthz: "unknown" as const },
  ] satisfies Array<ReadinessInput["deployment"]>)(
    "deploy ausente ou com /healthz fora do ar bloqueia a release: %j",
    (deployment) => {
      const report = evaluateReleaseReadiness(greenInput({ deployment }));

      expect(report.ready).toBe(false);
      expect(report.failed).toContain("deploy");
    },
  );

  it("deploy válido com healthz up mantém a release pronta", () => {
    const report = evaluateReleaseReadiness(greenInput());

    expect(report.failed).not.toContain("deploy");
    expect(report.failed).not.toContain("healthcheck");
  });
});