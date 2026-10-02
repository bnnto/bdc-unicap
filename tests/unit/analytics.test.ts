/**
 * [FINAL_UPGRADE Etapa 3] — TDD dos cálculos matemáticos do Dashboard
 * de Analytics do aluno: Taxa de Sucesso (Entrevista + Aprovado /
 * Total × 100), distribuição por etapa, média de match e visualizações
 * do perfil. Funções puras em src/lib/analytics.ts — sem I/O.
 */
import { describe, expect, it } from "vitest";
import {
  computeStudentAnalytics,
  computeSuccessRate,
  countApplicationsByStage,
  isSuccessStage,
} from "../../src/lib/analytics";
import type { ApplicationStage } from "../../src/lib/application";

function app(stage: ApplicationStage, matchScore = 70) {
  return { stage, matchScore };
}

describe("[FINAL_UPGRADE] isSuccessStage — o que conta como sucesso", () => {
  it("entrevista e aprovado contam; inscrito/triagem/reprovado não", () => {
    expect(isSuccessStage("entrevista")).toBe(true);
    expect(isSuccessStage("aprovado")).toBe(true);
    expect(isSuccessStage("inscrito")).toBe(false);
    expect(isSuccessStage("triagem")).toBe(false);
    expect(isSuccessStage("reprovado")).toBe(false);
  });
});

describe("[FINAL_UPGRADE] computeSuccessRate — taxa de sucesso (TDD)", () => {
  it("sem candidaturas a taxa é 0 (nunca NaN)", () => {
    expect(computeSuccessRate([])).toBe(0);
  });

  it("todas em sucesso = 100", () => {
    const apps = [app("entrevista"), app("aprovado")];
    expect(computeSuccessRate(apps)).toBe(100);
  });

  it("(Entrevista + Aprovado) / Total × 100 com 1 casa decimal", () => {
    // 1 de 3 = 33,333… → 33.3
    expect(
      computeSuccessRate([app("entrevista"), app("inscrito"), app("triagem")]),
    ).toBe(33.3);
    // 2 de 4 = 50
    expect(
      computeSuccessRate([
        app("aprovado"),
        app("entrevista"),
        app("reprovado"),
        app("triagem"),
      ]),
    ).toBe(50);
    // 2 de 3 = 66,666… → 66.7
    expect(
      computeSuccessRate([app("aprovado"), app("entrevista"), app("inscrito")]),
    ).toBe(66.7);
  });

  it("reprovado nunca conta como sucesso", () => {
    expect(computeSuccessRate([app("reprovado"), app("reprovado")])).toBe(0);
  });
});

describe("[FINAL_UPGRADE] countApplicationsByStage — distribuição por etapa", () => {
  it("conta todas as 5 colunas, incluindo zeros", () => {
    const counts = countApplicationsByStage([
      app("inscrito"),
      app("inscrito"),
      app("entrevista"),
      app("reprovado"),
    ]);
    expect(counts).toEqual({
      inscrito: 2,
      triagem: 0,
      entrevista: 1,
      aprovado: 0,
      reprovado: 1,
    });
  });

  it("lista vazia zera tudo", () => {
    expect(countApplicationsByStage([])).toEqual({
      inscrito: 0,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
      reprovado: 0,
    });
  });
});

describe("[FINAL_UPGRADE] computeStudentAnalytics — agregado do dashboard", () => {
  it("combina total, taxa, distribuição, visualizações e média de match", () => {
    const stats = computeStudentAnalytics(
      [
        app("entrevista", 90),
        app("aprovado", 80),
        app("triagem", 40),
        app("reprovado", 50),
      ],
      12,
    );
    expect(stats.total).toBe(4);
    expect(stats.successRate).toBe(50); // (2 / 4) × 100
    expect(stats.byStage.entrevista).toBe(1);
    expect(stats.byStage.reprovado).toBe(1);
    expect(stats.profileViews).toBe(12);
    expect(stats.averageMatch).toBe(65); // (90+80+40+50) / 4
  });

  it("sem candidaturas: valores zero, média 0 (nunca NaN)", () => {
    const stats = computeStudentAnalytics([], 0);
    expect(stats).toEqual({
      total: 0,
      successRate: 0,
      byStage: {
        inscrito: 0,
        triagem: 0,
        entrevista: 0,
        aprovado: 0,
        reprovado: 0,
      },
      profileViews: 0,
      averageMatch: 0,
    });
  });

  it("média de match arredondada para 1 casa decimal", () => {
    const stats = computeStudentAnalytics(
      [app("inscrito", 70), app("inscrito", 71), app("inscrito", 71)],
      3,
    );
    expect(stats.averageMatch).toBe(70.7); // 212 / 3 = 70,666…
  });
});
