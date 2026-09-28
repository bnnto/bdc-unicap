import { describe, expect, it } from "vitest";
import {
  filterTalentCandidates,
  TALENT_PAGE_SIZE,
  type TalentCandidate,
} from "../../src/lib/talentSearch";

type Candidate = Parameters<typeof filterTalentCandidates>[0][number];

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "s1",
    fullName: "Maria da Silva",
    course: "Ciência da Computação",
    status: "ativo",
    visibility: "publico",
    graduationYear: 2026,
    semester: 8,
    location: "Recife/PE",
    availability: "estagio",
    skills: ["React", "SQL"],
    languages: [{ name: "Inglês", level: "intermediario" }],
    ...overrides,
  };
}

/**
 * [REFACTOR_UI] Etapa 3 — filtros novos do Banco de Talentos:
 * faixa de "Previsão de Conclusão" e ordenação "Ordenar por"
 * (relevância = ordem de chegada da varredura indexada).
 */
describe("REFACTOR_UI — faixa de conclusão (graduationYearFrom/To)", () => {
  const base: TalentCandidate[] = [
    makeCandidate({ id: "a", fullName: "Ana", graduationYear: 2025 }),
    makeCandidate({ id: "b", fullName: "Bruno", graduationYear: 2026 }),
    makeCandidate({ id: "c", fullName: "Carla", graduationYear: 2028 }),
  ];

  it("filtra por ano mínimo (a partir de)", () => {
    const result = filterTalentCandidates(base, {
      graduationYearFrom: 2026,
    });
    expect(result.items.map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("filtra por ano máximo (até)", () => {
    const result = filterTalentCandidates(base, { graduationYearTo: 2026 });
    expect(result.items.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("faixa inclusiva nos dois extremos", () => {
    const result = filterTalentCandidates(base, {
      graduationYearFrom: 2026,
      graduationYearTo: 2028,
    });
    expect(result.items.map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("sem faixa, não filtra nada", () => {
    const result = filterTalentCandidates(base, {});
    expect(result.total).toBe(3);
  });
});

describe("REFACTOR_UI — ordenação do Banco de Talentos (Ordenar por)", () => {
  const base: TalentCandidate[] = [
    makeCandidate({
      id: "z",
      fullName: "Zeca",
      graduationYear: 2024,
      semester: 6,
      course: "Administração",
    }),
    makeCandidate({
      id: "a",
      fullName: "Ana Beatriz",
      graduationYear: 2028,
      semester: 2,
      course: "Ciência da Computação",
    }),
    makeCandidate({
      id: "m",
      fullName: "Marco",
      graduationYear: 2026,
      semester: 8,
      course: "Direito",
    }),
  ];

  it("relevância (padrão) preserva a ordem da varredura indexada", () => {
    const result = filterTalentCandidates(base, { sort: "relevancia" });
    expect(result.items.map((c) => c.id)).toEqual(["z", "a", "m"]);
  });

  it("nome A→Z é alfabético e estável", () => {
    const result = filterTalentCandidates(base, { sort: "nome" });
    expect(result.items.map((c) => c.id)).toEqual(["a", "m", "z"]);
  });

  it("conclusão mais próxima ordena por graduationYear ascendente", () => {
    const result = filterTalentCandidates(base, {
      sort: "conclusao_proxima",
    });
    expect(result.items.map((c) => c.id)).toEqual(["z", "m", "a"]);
  });

  it("paginação continua coerente após a ordenação", () => {
    const many: TalentCandidate[] = Array.from(
      { length: TALENT_PAGE_SIZE + 5 },
      (_, i) =>
        makeCandidate({
          id: `s${i}`,
          fullName: `Aluno ${String(TALENT_PAGE_SIZE + 4 - i).padStart(2, "0")}`,
        }),
    );
    const result = filterTalentCandidates(many, { sort: "nome", page: 1 });
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]?.fullName).toBe("Aluno 10");
  });
});
