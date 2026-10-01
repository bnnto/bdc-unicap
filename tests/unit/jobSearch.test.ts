/**
 * [REFACTOR_ALUNO Etapa 3] — Mural de Oportunidades estilo LinkedIn.
 * Regra pura (TDD) dos filtros do mural: busca por cargo/skill, tipo de
 * contrato, localidade, salário mínimo e match mínimo — tudo AND, com
 * normalização tolerante a acento/caixa (mesma filosofia do matching).
 */
import { describe, expect, it } from "vitest";
import {
  filterOpenJobs,
  sortOpenJobs,
  type MuralJob,
  type OpenJobFilters,
} from "../../src/lib/jobSearch";

function makeJob(overrides: Partial<MuralJob> = {}): MuralJob {
  return {
    title: "Estágio em Desenvolvimento Web",
    description:
      "Apoio no desenvolvimento de aplicações web com mentoria e code review.",
    contractType: "estagio",
    location: "Recife, PE",
    salaryMin: 1500,
    salaryMax: 2200,
    matchScore: 88,
    publishedAt: 1000,
    prerequisites: [
      { item: "React", required: true },
      { item: "Git", required: false },
    ],
    ...overrides,
  };
}

const FILTERS: OpenJobFilters = {
  query: "",
  contract: "todos",
  location: "",
  minSalary: null,
  minMatch: null,
};

function apply(jobs: MuralJob[], overrides: Partial<OpenJobFilters>) {
  return filterOpenJobs(jobs, { ...FILTERS, ...overrides });
}

describe("jobSearch — busca textual do mural (Etapa 3.2)", () => {
  const jobs = [
    makeJob(),
    makeJob({
      title: "Analista de Dados Jr",
      description: "Dashboards em Power BI e SQL para o campus.",
      contractType: "clt",
      location: "Olinda, PE",
      matchScore: 40,
      prerequisites: [{ item: "SQL", required: true }],
    }),
  ];

  it("consulta vazia retorna tudo", () => {
    expect(apply(jobs, {})).toHaveLength(2);
  });

  it("casa por título, descrição e pré-requisitos (case-insensitive)", () => {
    expect(apply(jobs, { query: "ESTÁGIO" })).toHaveLength(1);
    expect(apply(jobs, { query: "power bi" })).toHaveLength(1);
    expect(apply(jobs, { query: "git" })).toHaveLength(1);
    expect(apply(jobs, { query: "react native" })).toHaveLength(0);
  });

  it('ignora acentos na busca ("gestao" encontra "Gestão")', () => {
    const list = [
      makeJob({ title: "Estágio em Gestão de Projetos", description: "" }),
    ];
    expect(apply(list, { query: "gestao de projetos" })).toHaveLength(1);
  });
});

describe("jobSearch — filtros de contrato, localidade, salário e match", () => {
  const jobs = [
    makeJob(),
    makeJob({
      title: "Vaga CLT Remota",
      contractType: "clt",
      location: "Remoto",
      salaryMin: 3200,
      salaryMax: 4800,
      matchScore: 62,
    }),
    makeJob({
      title: "Freelance PJ",
      contractType: "pj",
      location: "São Paulo, SP",
      salaryMin: null,
      salaryMax: null,
      matchScore: 25,
    }),
  ];

  it("filtra por tipo de contrato", () => {
    expect(apply(jobs, { contract: "clt" })).toHaveLength(1);
    expect(apply(jobs, { contract: "estagio" })).toHaveLength(1);
    expect(apply(jobs, { contract: "todos" })).toHaveLength(3);
  });

  it("filtra por localidade (substring tolerante a acento)", () => {
    expect(apply(jobs, { location: "recife" })).toHaveLength(1);
    expect(apply(jobs, { location: "remoto" })).toHaveLength(1);
    expect(apply(jobs, { location: "sao paulo" })).toHaveLength(1);
    expect(apply(jobs, { location: "fortaleza" })).toHaveLength(0);
  });

  it("vaga sem localidade não passa no filtro de localidade", () => {
    const semLocal = [makeJob({ location: null })];
    expect(apply(semLocal, { location: "recife" })).toHaveLength(0);
    expect(apply(semLocal, { location: "" })).toHaveLength(1);
  });

  it("salário mínimo: vaga sem salário publicado não passa", () => {
    expect(apply(jobs, { minSalary: 3000 })).toHaveLength(1);
    expect(apply(jobs, { minSalary: 1500 })).toHaveLength(2);
    expect(apply(jobs, { minSalary: 0 })).toHaveLength(2);
  });

  it("match mínimo usa o percentual vindo do servidor (R8)", () => {
    expect(apply(jobs, { minMatch: 80 })).toHaveLength(1);
    expect(apply(jobs, { minMatch: 50 })).toHaveLength(2);
  });

  it("filtros combinam em E (AND)", () => {
    expect(
      apply(jobs, { contract: "clt", minMatch: 80, location: "remoto" }),
    ).toHaveLength(0);
    expect(apply(jobs, { contract: "clt", location: "remoto" })).toHaveLength(
      1,
    );
  });
});

describe("jobSearch — ordenação do mural", () => {
  const jobs = [
    makeJob({ title: "Antiga", publishedAt: 100, matchScore: 30 }),
    makeJob({ title: "Nova", publishedAt: 900, matchScore: 95 }),
    makeJob({ title: "Intermediária", publishedAt: 500, matchScore: 60 }),
  ];

  it("ordena por compatibilidade (match desc, sem score no fim)", () => {
    const sorted = sortOpenJobs(jobs, "compatibilidade");
    expect(sorted.map((j) => j.title)).toEqual([
      "Nova",
      "Intermediária",
      "Antiga",
    ]);
  });

  it("ordena por mais recentes (publishedAt desc)", () => {
    const sorted = sortOpenJobs(jobs, "recentes");
    expect(sorted.map((j) => j.title)).toEqual([
      "Nova",
      "Intermediária",
      "Antiga",
    ]);
  });

  it("sem score, ordenação por compatibilidade mantém estável", () => {
    const semScore = jobs.map((j) => ({ ...j, matchScore: null }));
    const sorted = sortOpenJobs(semScore, "compatibilidade");
    expect(sorted).toHaveLength(3);
  });
});
