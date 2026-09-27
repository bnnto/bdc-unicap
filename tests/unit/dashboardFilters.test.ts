import { describe, expect, it } from "vitest";
import {
  filterApplicationsForDashboard,
  filterJobsForDashboard,
  hasActiveFilters,
  normalizeDashboardFilters,
  type DashboardApplicationRow,
  type DashboardJobRow,
} from "../../src/lib/dashboardFilters";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function makeJob(overrides: Partial<DashboardJobRow> = {}): DashboardJobRow {
  return {
    jobId: "j1",
    status: "aberta",
    publishedAt: T0,
    ...overrides,
  };
}

function makeApp(
  overrides: Partial<DashboardApplicationRow> = {},
): DashboardApplicationRow {
  return {
    jobId: "j1",
    stage: "inscrito",
    appliedAt: T0,
    ...overrides,
  };
}

describe("normalizeDashboardFilters (S5-5 — filtros combináveis)", () => {
  it("mantém filtros válidos", () => {
    expect(
      normalizeDashboardFilters({
        from: T0,
        to: T0 + DAY,
        course: "CC",
        company: "Alpha",
        status: "aberta",
      }),
    ).toEqual({
      from: T0,
      to: T0 + DAY,
      course: "CC",
      company: "Alpha",
      status: "aberta",
    });
  });

  it("remove strings vazias ou só espaços", () => {
    expect(
      normalizeDashboardFilters({
        course: "   ",
        company: "",
        status: "aberta",
      }),
    ).toEqual({ status: "aberta" });
  });

  it("descarta status inválido (fora do enum do schema)", () => {
    expect(normalizeDashboardFilters({ status: "expirada" })).toEqual({});
  });

  it("objeto vazio permanece vazio", () => {
    expect(normalizeDashboardFilters({})).toEqual({});
  });
});

describe("hasActiveFilters", () => {
  it("false sem filtros e true com qualquer filtro ativo", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ course: "CC" })).toBe(true);
    expect(hasActiveFilters({ status: "encerrada" })).toBe(true);
  });
});

describe("filterJobsForDashboard (status + período por publicação)", () => {
  const jobs = [
    makeJob({ jobId: "a", status: "aberta", publishedAt: T0 }),
    makeJob({ jobId: "b", status: "fechada", publishedAt: T0 + DAY }),
    makeJob({ jobId: "c", status: "encerrada", publishedAt: T0 + 40 * DAY }),
  ];

  it("sem filtros mantém todas as vagas", () => {
    expect(filterJobsForDashboard(jobs, {})).toHaveLength(3);
  });

  it("filtra por status", () => {
    const filtered = filterJobsForDashboard(jobs, { status: "aberta" });
    expect(filtered.map((job) => job.jobId)).toEqual(["a"]);
  });

  it("filtra por período (publicação dentro da faixa, limites inclusivos)", () => {
    const filtered = filterJobsForDashboard(jobs, {
      from: T0 + DAY,
      to: T0 + 10 * DAY,
    });
    expect(filtered.map((job) => job.jobId)).toEqual(["b"]);
  });

  it("vaga sem publishedAt sai quando há filtro de período (não verificável)", () => {
    const filtered = filterJobsForDashboard(
      [makeJob({ jobId: "x", publishedAt: undefined })],
      { from: T0 },
    );
    expect(filtered).toEqual([]);
  });

  it("vaga sem publishedAt fica quando NÃO há filtro de período", () => {
    const filtered = filterJobsForDashboard(
      [makeJob({ jobId: "x", publishedAt: undefined })],
      {},
    );
    expect(filtered).toHaveLength(1);
  });

  it("status e período combinam", () => {
    const filtered = filterJobsForDashboard(jobs, {
      status: "encerrada",
      from: T0,
    });
    expect(filtered.map((job) => job.jobId)).toEqual(["c"]);
  });
});

describe("filterApplicationsForDashboard (status da vaga + período por candidatura)", () => {
  const apps = [
    makeApp({ jobId: "a", stage: "inscrito", appliedAt: T0 }),
    makeApp({ jobId: "b", stage: "triagem", appliedAt: T0 + DAY }),
    makeApp({ jobId: "b", stage: "aprovado", appliedAt: T0 + 40 * DAY }),
  ];
  const jobStatusById = new Map([
    ["a", "aberta" as const],
    ["b", "encerrada" as const],
  ]);

  it("sem filtros mantém todas as candidaturas", () => {
    expect(
      filterApplicationsForDashboard(apps, jobStatusById, {}),
    ).toHaveLength(3);
  });

  it("filtro de status seleciona só candidaturas de vagas daquele status", () => {
    const filtered = filterApplicationsForDashboard(apps, jobStatusById, {
      status: "encerrada",
    });
    expect(filtered.map((app) => app.stage)).toEqual(["triagem", "aprovado"]);
  });

  it("filtro de período usa appliedAt (limites inclusivos)", () => {
    const filtered = filterApplicationsForDashboard(apps, jobStatusById, {
      from: T0 + DAY,
      to: T0 + 10 * DAY,
    });
    expect(filtered.map((app) => app.stage)).toEqual(["triagem"]);
  });

  it("candidatura de vaga desconhecida sai quando há filtro de status", () => {
    const filtered = filterApplicationsForDashboard(
      [makeApp({ jobId: "z" })],
      jobStatusById,
      { status: "aberta" },
    );
    expect(filtered).toEqual([]);
  });

  it("candidatura de vaga desconhecida fica sem filtro de status", () => {
    const filtered = filterApplicationsForDashboard(
      [makeApp({ jobId: "z" })],
      jobStatusById,
      {},
    );
    expect(filtered).toHaveLength(1);
  });

  it("status e período combinam", () => {
    const filtered = filterApplicationsForDashboard(apps, jobStatusById, {
      status: "encerrada",
      to: T0 + 10 * DAY,
    });
    expect(filtered.map((app) => app.stage)).toEqual(["triagem"]);
  });
});
