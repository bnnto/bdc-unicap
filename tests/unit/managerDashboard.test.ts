import { describe, expect, it } from "vitest";
import {
  MANAGER_DASHBOARD_MOCKS,
  buildManagerKpis,
  partnerStatus,
  rejectionShare,
} from "../../src/lib/managerDashboard";

/**
 * [REFACTOR_GESTOR] Etapa 4 — Painel Estratégico de Carreiras &
 * Empregabilidade. Regra pura que consolida os KPIs (dados reais quando
 * disponíveis) e os Insights Estratégicos (seções mockadas sinalizadas,
 * prontas para serem plugadas no banco depois — Nota Técnica Visual).
 */
describe("REFACTOR_GESTOR — KPIs do Painel Estratégico", () => {
  it("consolida os 4 KPIs com os valores informados", () => {
    const kpis = buildManagerKpis({
      openJobs: 12,
      employabilityRate: 64,
      timeToHireDays: 21,
      availableTalents: 148,
    });
    expect(kpis.oportunidades.value).toBe(12);
    expect(kpis.oportunidades.label).toContain("Vagas ativas");
    expect(kpis.empregabilidade).toEqual({ value: "64%", hasData: true });
    expect(kpis.tempoContratacao).toEqual({
      value: "21",
      hasData: true,
      unit: "dias",
    });
    expect(kpis.talentos.value).toBe(148);
    expect(kpis.talentos.label).toContain("perfil ativo");
  });

  it("métricas sem amostra exibem — (sem mascarar a falta de dados)", () => {
    const kpis = buildManagerKpis({
      openJobs: 0,
      employabilityRate: null,
      timeToHireDays: null,
      availableTalents: 0,
    });
    expect(kpis.empregabilidade).toEqual({ value: "—", hasData: false });
    expect(kpis.tempoContratacao).toEqual({
      value: "—",
      hasData: false,
      unit: "dias",
    });
  });
});

describe("REFACTOR_GESTOR — status de empresa parceira", () => {
  it("com contratados no período → ativa", () => {
    expect(partnerStatus(5, 12)).toBe("ativa");
  });

  it("com vagas publicadas mas sem contratação → em_negociacao", () => {
    expect(partnerStatus(0, 8)).toBe("em_negociacao");
  });

  it("sem vagas e sem contratação → inativa", () => {
    expect(partnerStatus(0, 0)).toBe("inativa");
  });
});

describe("REFACTOR_GESTOR — distribuição dos motivos de reprovação (R5)", () => {
  it("calcula percentuais e ordena do maior para o menor", () => {
    const shares = rejectionShare([
      { reason: "requisitos_obrigatorios", count: 18 },
      { reason: "idioma_insuficiente", count: 9 },
      { reason: "formacao_incompativel", count: 11 },
    ]);
    expect(shares.map((s) => s.reason)).toEqual([
      "requisitos_obrigatorios",
      "formacao_incompativel",
      "idioma_insuficiente",
    ]);
    expect(shares[0]?.percent).toBe(47); // 18/38
    expect(shares[1]?.percent).toBe(29); // 11/38
    expect(shares[2]?.percent).toBe(24); // 9/38
  });

  it("base vazia retorna lista vazia (sem NaN)", () => {
    expect(rejectionShare([])).toEqual([]);
  });
});

describe("REFACTOR_GESTOR — dados mockados sinalizados (Nota Técnica Visual)", () => {
  it("declara source: mock — a UI sabe o que é placeholder", () => {
    expect(MANAGER_DASHBOARD_MOCKS.source).toBe("mock");
  });

  it("empregabilidade por curso vem ordenada do maior para o menor", () => {
    const percents = MANAGER_DASHBOARD_MOCKS.courseEmployability.map(
      (c) => c.percent,
    );
    const ordered = [...percents].sort((a, b) => b - a);
    expect(percents).toEqual(ordered);
  });

  it("radar de competências traz demanda vs oferta por skill", () => {
    const first = MANAGER_DASHBOARD_MOCKS.skillGaps[0];
    expect(first).toHaveProperty("skill");
    expect(first).toHaveProperty("demand");
    expect(first).toHaveProperty("supply");
  });

  it("termômetro de engajamento expõe perfis incompletos e sem currículo", () => {
    expect(MANAGER_DASHBOARD_MOCKS.incompleteProfiles).toBeGreaterThan(0);
    expect(MANAGER_DASHBOARD_MOCKS.noResume).toBeGreaterThan(0);
  });
});
