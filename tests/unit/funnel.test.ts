import { describe, expect, it } from "vitest";
import {
  buildFunnel,
  countFunnelStages,
  FUNNEL_STAGES,
  type FunnelApplicationRow,
} from "../../src/lib/funnel";

function rows(
  ...stages: FunnelApplicationRow["stage"][]
): FunnelApplicationRow[] {
  return stages.map((stage) => ({ stage }));
}

describe("FUNNEL_STAGES (S5-3 — ordem do pipeline, sem reprovado)", () => {
  it("são as 4 etapas de avanço na ordem de conversão", () => {
    expect(FUNNEL_STAGES).toEqual([
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
    ]);
  });
});

describe("countFunnelStages (CA 1 — contagem por etapa)", () => {
  it("conta candidaturas em cada etapa do funil", () => {
    const counts = countFunnelStages(
      rows(
        "inscrito",
        "inscrito",
        "inscrito",
        "triagem",
        "triagem",
        "entrevista",
        "aprovado",
        "reprovado",
      ),
    );
    expect(counts).toEqual({
      inscrito: 3,
      triagem: 2,
      entrevista: 1,
      aprovado: 1,
    });
  });

  it("reprovados não pertencem ao funil (saída, não etapa)", () => {
    const counts = countFunnelStages(rows("reprovado", "reprovado"));
    expect(counts).toEqual({
      inscrito: 0,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
    });
  });

  it("base vazia: todas as contagens zero", () => {
    expect(countFunnelStages([])).toEqual({
      inscrito: 0,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
    });
  });
});

describe("buildFunnel (CA 1 — conversão % entre etapas)", () => {
  it("calcula conversão de cada etapa sobre a etapa anterior", () => {
    const funnel = buildFunnel([
      ...rows("inscrito", "inscrito", "inscrito", "inscrito"),
      ...rows("triagem", "triagem"),
      ...rows("entrevista"),
      ...rows("aprovado"),
    ]);
    expect(funnel).toEqual([
      {
        stage: "inscrito",
        label: "Inscrito",
        count: 4,
        conversionFromPrevious: null,
      },
      {
        stage: "triagem",
        label: "Em Triagem",
        count: 2,
        conversionFromPrevious: 50,
      },
      {
        stage: "entrevista",
        label: "Entrevista",
        count: 1,
        conversionFromPrevious: 50,
      },
      {
        stage: "aprovado",
        label: "Aprovado",
        count: 1,
        conversionFromPrevious: 100,
      },
    ]);
  });

  it("primeira etapa não tem conversão (é a base do funil)", () => {
    const funnel = buildFunnel(rows("inscrito"));
    expect(funnel[0]?.conversionFromPrevious).toBeNull();
  });

  it("etapa anterior zerada: conversão null (evita divisão por zero)", () => {
    const funnel = buildFunnel(rows("triagem", "entrevista"));
    expect(funnel[0]).toMatchObject({
      stage: "inscrito",
      count: 0,
      conversionFromPrevious: null,
    });
    expect(funnel[1]).toMatchObject({
      stage: "triagem",
      count: 1,
      conversionFromPrevious: null,
    });
    expect(funnel[2]).toMatchObject({
      stage: "entrevista",
      count: 1,
      conversionFromPrevious: 100,
    });
  });

  it("funil vazio: etapas com zero e conversões null", () => {
    const funnel = buildFunnel([]);
    expect(funnel).toHaveLength(4);
    expect(funnel.every((step) => step.count === 0)).toBe(true);
    expect(funnel.every((step) => step.conversionFromPrevious === null)).toBe(
      true,
    );
  });

  it("arredonda a conversão para inteiro (1/3 → 33%)", () => {
    const funnel = buildFunnel([
      ...rows("inscrito", "inscrito", "inscrito"),
      ...rows("triagem"),
    ]);
    expect(funnel[1]?.conversionFromPrevious).toBe(33);
  });

  it("candidatura reprovada não entra nas contagens", () => {
    const funnel = buildFunnel([...rows("inscrito", "reprovado")]);
    expect(funnel[0]?.count).toBe(1);
    expect(funnel.map((s) => s.count)).toEqual([1, 0, 0, 0]);
  });
});
