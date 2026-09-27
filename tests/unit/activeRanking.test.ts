import { describe, expect, it } from "vitest";
import {
  aggregateCompanyActivity,
  rankCompanies,
  rankJobs,
  type CompanyActivityRow,
  type JobActivityRow,
} from "../../src/lib/activeRanking";

function makeJob(overrides: Partial<JobActivityRow> = {}): JobActivityRow {
  return {
    jobId: "j1",
    title: "Vaga",
    recruiterId: "r1",
    applicationsCount: 0,
    ...overrides,
  };
}

function makeCompany(
  overrides: Partial<CompanyActivityRow> = {},
): CompanyActivityRow {
  return {
    recruiterId: "r1",
    companyName: "Empresa",
    publishedJobs: 1,
    applicationsCount: 0,
    ...overrides,
  };
}

describe("rankJobs (S5-4, CA 1 — Top N por volume de candidaturas)", () => {
  it("ordena por candidaturas, maior primeiro", () => {
    const ranked = rankJobs(
      [
        makeJob({ jobId: "a", applicationsCount: 3 }),
        makeJob({ jobId: "b", applicationsCount: 10 }),
        makeJob({ jobId: "c", applicationsCount: 7 }),
      ],
      3,
    );
    expect(ranked.map((job) => job.jobId)).toEqual(["b", "c", "a"]);
  });

  it("empate de candidaturas: ordem alfabética pelo título", () => {
    const ranked = rankJobs(
      [
        makeJob({ jobId: "a", title: "Dev Web", applicationsCount: 5 }),
        makeJob({ jobId: "b", title: "Analista Dados", applicationsCount: 5 }),
      ],
      2,
    );
    expect(ranked.map((job) => job.jobId)).toEqual(["b", "a"]);
  });

  it("corta no Top N", () => {
    const ranked = rankJobs(
      [
        makeJob({ jobId: "a", applicationsCount: 9 }),
        makeJob({ jobId: "b", applicationsCount: 5 }),
        makeJob({ jobId: "c", applicationsCount: 1 }),
      ],
      2,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.map((job) => job.jobId)).toEqual(["a", "b"]);
  });

  it("N maior que o total: retorna todas", () => {
    const ranked = rankJobs(
      [makeJob({ jobId: "a", applicationsCount: 1 })],
      10,
    );
    expect(ranked).toHaveLength(1);
  });

  it("N zero ou negativo: lista vazia", () => {
    expect(rankJobs([makeJob()], 0)).toEqual([]);
    expect(rankJobs([makeJob()], -3)).toEqual([]);
  });

  it("lista vazia: ranking vazio", () => {
    expect(rankJobs([], 5)).toEqual([]);
  });
});

describe("rankCompanies (S5-4, CA 1 — Top N por publicações e candidatos)", () => {
  it("ordena por candidaturas atraídas, maior primeiro", () => {
    const ranked = rankCompanies(
      [
        makeCompany({ recruiterId: "a", applicationsCount: 4 }),
        makeCompany({ recruiterId: "b", applicationsCount: 12 }),
        makeCompany({ recruiterId: "c", applicationsCount: 4 }),
      ],
      3,
    );
    expect(ranked.map((c) => c.recruiterId)).toEqual(["b", "a", "c"]);
  });

  it("empate de candidaturas: mais publicações primeiro", () => {
    const ranked = rankCompanies(
      [
        makeCompany({
          recruiterId: "a",
          publishedJobs: 2,
          applicationsCount: 8,
        }),
        makeCompany({
          recruiterId: "b",
          publishedJobs: 5,
          applicationsCount: 8,
        }),
      ],
      2,
    );
    expect(ranked.map((c) => c.recruiterId)).toEqual(["b", "a"]);
  });

  it("empate total: ordem alfabética pelo nome da empresa", () => {
    const ranked = rankCompanies(
      [
        makeCompany({ companyName: "Zeta Ltda", applicationsCount: 3 }),
        makeCompany({ companyName: "Alpha S.A.", applicationsCount: 3 }),
      ],
      2,
    );
    expect(ranked.map((c) => c.companyName)).toEqual([
      "Alpha S.A.",
      "Zeta Ltda",
    ]);
  });

  it("corta no Top N e N zero vira vazio", () => {
    const ranked = rankCompanies(
      [
        makeCompany({ recruiterId: "a", applicationsCount: 9 }),
        makeCompany({ recruiterId: "b", applicationsCount: 2 }),
      ],
      1,
    );
    expect(ranked.map((c) => c.recruiterId)).toEqual(["a"]);
    expect(rankCompanies([makeCompany()], 0)).toEqual([]);
  });
});

describe("aggregateCompanyActivity (S5-4 — rollup por empresa)", () => {
  it("soma publicações e candidaturas por recrutador", () => {
    const companies = aggregateCompanyActivity(
      [
        makeJob({ jobId: "j1", recruiterId: "r1", applicationsCount: 5 }),
        makeJob({ jobId: "j2", recruiterId: "r1", applicationsCount: 3 }),
        makeJob({ jobId: "j3", recruiterId: "r2", applicationsCount: 7 }),
      ],
      (recruiterId) => (recruiterId === "r1" ? "Alpha" : "Beta"),
    );
    expect(companies).toHaveLength(2);
    expect(companies).toContainEqual({
      recruiterId: "r1",
      companyName: "Alpha",
      publishedJobs: 2,
      applicationsCount: 8,
    });
    expect(companies).toContainEqual({
      recruiterId: "r2",
      companyName: "Beta",
      publishedJobs: 1,
      applicationsCount: 7,
    });
  });

  it("empresa sem candidaturas ainda aparece (vagas publicadas contam)", () => {
    const companies = aggregateCompanyActivity(
      [makeJob({ recruiterId: "r1", applicationsCount: 0 })],
      () => "Gamma",
    );
    expect(companies).toEqual([
      {
        recruiterId: "r1",
        companyName: "Gamma",
        publishedJobs: 1,
        applicationsCount: 0,
      },
    ]);
  });

  it("sem vagas: rollup vazio", () => {
    expect(aggregateCompanyActivity([], () => "Ninguém")).toEqual([]);
  });

  it("rollup + ranking pontuam a empresa mais ativa (uso ponta a ponta)", () => {
    const companies = rankCompanies(
      aggregateCompanyActivity(
        [
          makeJob({ recruiterId: "r1", applicationsCount: 2 }),
          makeJob({ recruiterId: "r2", applicationsCount: 4 }),
          makeJob({ recruiterId: "r2", applicationsCount: 6 }),
        ],
        (id) => (id === "r1" ? "Alpha" : "Beta"),
      ),
      1,
    );
    expect(companies[0]?.companyName).toBe("Beta");
  });
});
