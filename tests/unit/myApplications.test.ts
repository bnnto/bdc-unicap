import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  formatApplicationStatusLabel,
  myApplicationsKpis,
  sortMyApplications,
  stageTimeline,
} from "../../src/lib/application";

const DAY = 24 * 60 * 60 * 1000;

function makeApplication(
  id: string,
  stage: (typeof APPLICATION_STAGES)[number],
  appliedAt: number,
) {
  return {
    applicationId: id,
    jobTitle: `Vaga ${id}`,
    stage,
    matchScore: 70,
    appliedAt,
  };
}

describe("ordenação das candidaturas (S4-4)", () => {
  it("mais recentes primeiro (appliedAt desc)", () => {
    const sorted = sortMyApplications([
      makeApplication("a", "inscrito", DAY),
      makeApplication("b", "triagem", 3 * DAY),
      makeApplication("c", "entrevista", 2 * DAY),
    ]);
    expect(sorted.map((a) => a.applicationId)).toEqual(["b", "c", "a"]);
  });

  it("não muta o array de entrada (pura)", () => {
    const input = [
      makeApplication("a", "inscrito", DAY),
      makeApplication("b", "triagem", 2 * DAY),
    ];
    const copy = [...input];
    sortMyApplications(input);
    expect(input).toEqual(copy);
  });
});

describe("status legível da candidatura (S4-4, CA 1)", () => {
  it("composta com etapa e rótulo do pipeline", () => {
    expect(
      formatApplicationStatusLabel({
        stage: "triagem",
        appliedAt: 1000,
        jobTitle: "Estágio em Web",
      }),
    ).toBe("Estágio em Web — etapa: Em Triagem (Inscrito em 1/1/1970).");
  });

  it("candidatura reprovada usa o rótulo da coluna Reprovado", () => {
    const label = formatApplicationStatusLabel({
      stage: "reprovado",
      appliedAt: 1000,
      jobTitle: "Vaga X",
    });
    expect(label).toContain("Reprovado");
  });
});

describe("timeline do pipeline por candidatura (S4-4, CA 1)", () => {
  it("marca etapas cumpridas, atual e futuras", () => {
    const timeline = stageTimeline("entrevista");
    expect(timeline).toEqual([
      { stage: "inscrito", state: "done" },
      { stage: "triagem", state: "done" },
      { stage: "entrevista", state: "current" },
      { stage: "aprovado", state: "upcoming" },
      { stage: "reprovado", state: "upcoming" },
    ]);
  });

  it("etapa inicial: atual é current e tudo à frente é upcoming", () => {
    const timeline = stageTimeline("inscrito");
    expect(timeline[0]).toEqual({ stage: "inscrito", state: "current" });
    expect(timeline[1]?.state).toBe("upcoming");
  });

  it("todas as 5 etapas presentes em qualquer timeline", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(stageTimeline(stage)).toHaveLength(5);
    }
  });
});

describe("KPIs de Minhas Candidaturas (S4-4, CA 2)", () => {
  it("total, ativas e melhor match", () => {
    const kpis = myApplicationsKpis([
      {
        applicationId: "a",
        jobTitle: "V1",
        stage: "inscrito",
        matchScore: 92,
        appliedAt: 1,
      },
      {
        applicationId: "b",
        jobTitle: "V2",
        stage: "reprovado",
        matchScore: 40,
        appliedAt: 2,
      },
      {
        applicationId: "c",
        jobTitle: "V3",
        stage: "triagem",
        matchScore: 65,
        appliedAt: 3,
      },
    ]);
    expect(kpis).toEqual({ total: 3, active: 2, bestMatch: 92 });
  });

  it("lista vazia: zeros e melhor match null", () => {
    expect(myApplicationsKpis([])).toEqual({
      total: 0,
      active: 0,
      bestMatch: null,
    });
  });

  it("somente reprovadas: ativas = 0", () => {
    const kpis = myApplicationsKpis([
      {
        applicationId: "a",
        jobTitle: "V1",
        stage: "reprovado",
        matchScore: 10,
        appliedAt: 1,
      },
    ]);
    expect(kpis.active).toBe(0);
    expect(kpis.total).toBe(1);
  });
});

describe("contrato com a query reativa (S4-4, CA 1)", () => {
  it("rótulos das etapas usados na exibição existem para todo stage", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(typeof STAGE_LABELS[stage]).toBe("string");
    }
  });
});
