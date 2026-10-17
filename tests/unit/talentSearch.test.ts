import { describe, expect, it } from "vitest";
import {
  canAppearInTalentBank,
  filterTalentCandidates,
  formatTalentSummary,
  TALENT_PAGE_SIZE,
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
    availability: ["estagio"],
    skills: ["React", "SQL"],
    languages: [{ name: "Inglês", level: "intermediario" }],
    ...overrides,
  };
}

describe("elegibilidade no Banco de Talentos (S2-3, R1/R2)", () => {
  it("R2: só aparece com visibilidade pública", () => {
    expect(
      canAppearInTalentBank(makeCandidate({ visibility: "publico" })),
    ).toBe(true);
    expect(
      canAppearInTalentBank(
        makeCandidate({ visibility: "somente_candidaturas" }),
      ),
    ).toBe(false);
  });

  it("R1: inativo nunca aparece; ativo e egresso aparecem", () => {
    expect(canAppearInTalentBank(makeCandidate({ status: "ativo" }))).toBe(
      true,
    );
    expect(canAppearInTalentBank(makeCandidate({ status: "egresso" }))).toBe(
      true,
    );
    expect(canAppearInTalentBank(makeCandidate({ status: "inativo" }))).toBe(
      false,
    );
  });

  it("R1 tem prioridade sobre R2 na ordem de avaliação", () => {
    // R1 antes de R2: inativo público permanece oculto.
    expect(canAppearInTalentBank(makeCandidate({ status: "inativo" }))).toBe(
      false,
    );
  });
});

describe("filtros combináveis (S2-3, CA 1)", () => {
  const candidates = [
    makeCandidate({ id: "a", course: "Ciência da Computação" }),
    makeCandidate({
      id: "b",
      fullName: "Bernardo Oliveira",
      course: "Direção",
      status: "egresso",
      location: "Caruaru/PE",
      skills: [],
      languages: [],
    }),
    makeCandidate({
      id: "c",
      fullName: "Carla Souza",
      course: "Ciência da Computação",
      location: "Olinda/PE",
      skills: ["Figma"],
      languages: [],
    }),
    makeCandidate({
      id: "d",
      course: "Administração",
      visibility: "somente_candidaturas", // nunca aparece (R2)
    }),
    makeCandidate({ id: "e", course: "Direção", status: "inativo" }), // nunca aparece (R1)
  ];

  it("sem filtros: apenas elegíveis (R1+R2), na ordem recebida", () => {
    const result = filterTalentCandidates(candidates, {});
    expect(result.items.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("filtra por curso (case-insensitive, contém)", () => {
    const result = filterTalentCandidates(candidates, { course: "CIÊNCIA" });
    expect(result.items.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("filtra por status de formação", () => {
    const result = filterTalentCandidates(candidates, { status: "egresso" });
    expect(result.items.map((c) => c.id)).toEqual(["b"]);
  });

  it("filtra por disponibilidade", () => {
    const result = filterTalentCandidates(candidates, {
      availability: "estagio",
      course: "computacao",
    });
    expect(result.items.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("filtra por localização (contém)", () => {
    const result = filterTalentCandidates(candidates, { location: "Recife" });
    expect(result.items.map((c) => c.id)).toEqual(["a"]);
  });

  it("filtra por competência e idioma com nível mínimo", () => {
    const result = filterTalentCandidates(candidates, {
      skill: "react",
      language: "inglês",
      languageLevel: "intermediario",
    });
    expect(result.items.map((c) => c.id)).toEqual(["a"]);
  });

  it("nível mínimo aceita níveis superiores", () => {
    const fluent = makeCandidate({
      id: "f",
      languages: [{ name: "Inglês", level: "fluente" }],
    });
    const result = filterTalentCandidates(
      [
        fluent,
        makeCandidate({
          id: "g",
          languages: [{ name: "Inglês", level: "basico" }],
        }),
      ],
      { language: "inglês", languageLevel: "intermediario" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["f"]);
  });

  it("filtros combinados (E lógico entre categorias)", () => {
    const result = filterTalentCandidates(candidates, {
      course: "direção",
      status: "egresso",
    });
    expect(result.items.map((c) => c.id)).toEqual(["b"]);
  });

  it("busca textual cobre nome, curso, competências e localização", () => {
    const byName = filterTalentCandidates(candidates, { query: "maria" });
    expect(byName.items.map((c) => c.id)).toEqual(["a"]);
    const bySkill = filterTalentCandidates(candidates, { query: "sql" });
    expect(bySkill.items.map((c) => c.id)).toEqual(["a"]);
    const byLocation = filterTalentCandidates(candidates, { query: "olinda" });
    expect(byLocation.items.map((c) => c.id)).toEqual(["c"]);
  });

  it("informar filtros de competência/idioma exige que o candidato os possua", () => {
    const result = filterTalentCandidates(candidates, { skill: "docker" });
    expect(result.items).toEqual([]);
    const byLang = filterTalentCandidates(candidates, { language: "espanhol" });
    expect(byLang.items).toEqual([]);
  });

  it("conta total antes da paginação e informa páginas", () => {
    const many = Array.from({ length: TALENT_PAGE_SIZE + 5 }, (_, i) =>
      makeCandidate({ id: `s${i}` }),
    );
    const result = filterTalentCandidates(many, { page: 0 });
    expect(result.total).toBe(TALENT_PAGE_SIZE + 5);
    expect(result.page).toBe(0);
    expect(result.pageCount).toBe(2);
    expect(result.items).toHaveLength(TALENT_PAGE_SIZE);
  });
});

describe("paginação (S2-3, CA 2)", () => {
  const many = Array.from({ length: 24 }, (_, i) =>
    makeCandidate({ id: `p${i}` }),
  );

  it("primeira página retorna exatamente o tamanho da página", () => {
    const result = filterTalentCandidates(many, { page: 0 });
    expect(result.items).toHaveLength(TALENT_PAGE_SIZE);
    expect(result.items[0]?.id).toBe("p0");
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
  });

  it("página intermediária e última página parcial", () => {
    const second = filterTalentCandidates(many, { page: 1 });
    expect(second.items[0]?.id).toBe("p10");
    expect(second.hasNext).toBe(true);
    expect(second.hasPrev).toBe(true);

    const last = filterTalentCandidates(many, { page: 2 });
    expect(last.items).toHaveLength(4);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);
  });

  it("página além da última é clampada para a última, sem erro", () => {
    const result = filterTalentCandidates(many, { page: 99 });
    expect(result.total).toBe(24);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(4);
    expect(result.hasNext).toBe(false);
  });
});

describe("formatação para o card do recrutador (S2-3)", () => {
  it("resumo compõe status, curso e detalhe de semestre/ano", () => {
    expect(
      formatTalentSummary({
        status: "ativo",
        course: "Ciência da Computação",
        graduationYear: 2026,
        semester: 8,
      }),
    ).toBe(
      "Aluno ativo · Ciência da Computação · 8º semestre (conclusão 2026)",
    );
  });

  it("egresso sem semestre exibe apenas curso e ano", () => {
    expect(
      formatTalentSummary({
        status: "egresso",
        course: "Direção",
        graduationYear: 2024,
        semester: null,
      }),
    ).toBe("Egresso · Direção · conclusão 2024");
  });
});
