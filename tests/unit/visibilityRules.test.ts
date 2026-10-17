import { describe, expect, it } from "vitest";
import {
  canAppearInTalentBank,
  filterTalentCandidates,
  normalizeForSearch,
  TALENT_PAGE_SIZE,
  type TalentCandidate,
} from "../../src/lib/talentSearch";

function makeCandidate(
  overrides: Partial<TalentCandidate> = {},
): TalentCandidate {
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

/**
 * S2-5 — cobertura dos branches de filtro remanescentes (CA 2: cobertura
 * ≥ 80% nas regras) e reforço do par R1/R2 no contexto do Banco de Talentos.
 */
describe("S2-5 — branches de filtro do Banco de Talentos", () => {
  it("normalizeForSearch remove acentos, corta espaços e caixa", () => {
    expect(normalizeForSearch("  Recife  ")).toBe("recife");
    expect(normalizeForSearch("Administração")).toBe("administracao");
    expect(normalizeForSearch("SÃO PAULO")).toBe("sao paulo");
  });

  it("filtro de disponibilidade exclui candidatos com outra disponibilidade", () => {
    const result = filterTalentCandidates(
      [
        makeCandidate({ id: "a", availability: ["estagio"] }),
        makeCandidate({ id: "b", availability: ["integral"] }),
      ],
      { availability: "integral" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["b"]);
  });

  it("candidato sem localização não falha no filtro de localização", () => {
    const result = filterTalentCandidates(
      [
        makeCandidate({ id: "semLocal", location: null }),
        makeCandidate({ id: "comLocal", location: "Recife/PE" }),
      ],
      { location: "recife" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["comLocal"]);
  });

  it("idioma sem nível mínimo: qualquer nível do idioma casa", () => {
    const result = filterTalentCandidates(
      [
        makeCandidate({
          id: "basico",
          languages: [{ name: "Inglês", level: "basico" }],
        }),
        makeCandidate({
          id: "fluente",
          languages: [{ name: "Inglês", level: "fluente" }],
        }),
      ],
      { language: "inglês" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["basico", "fluente"]);
  });

  it("idioma com nível mínimo: apenas nível igual ou superior casa", () => {
    const result = filterTalentCandidates(
      [
        makeCandidate({
          id: "intermediario",
          languages: [{ name: "Inglês", level: "intermediario" }],
        }),
        makeCandidate({
          id: "basico",
          languages: [{ name: "Inglês", level: "basico" }],
        }),
      ],
      { language: "inglês", languageLevel: "intermediario" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["intermediario"]);
  });

  it("idioma com nível mínimo e sem o idioma informado: nenhum resultado", () => {
    const result = filterTalentCandidates([makeCandidate({ id: "a" })], {
      language: "espanhol",
      languageLevel: "avancado",
    });
    expect(result.items).toEqual([]);
  });

  it("combina disponibilidade com competência e busca textual", () => {
    const result = filterTalentCandidates(
      [
        makeCandidate({
          id: "match",
          availability: ["freelancer"],
          skills: ["Node"],
          location: "Jaboatão/PE",
        }),
        makeCandidate({
          id: "outraDisponibilidade",
          availability: ["estagio"],
          skills: ["Node"],
        }),
      ],
      { availability: "freelancer", skill: "node", query: "jaboatão" },
    );
    expect(result.items.map((c) => c.id)).toEqual(["match"]);
  });

  it("paginação: última página parcial e clamp de página além do fim", () => {
    const many = Array.from({ length: TALENT_PAGE_SIZE + 3 }, (_, i) =>
      makeCandidate({ id: `p${i}` }),
    );
    const last = filterTalentCandidates(many, { page: 1 });
    expect(last.items).toHaveLength(3);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);

    const clamped = filterTalentCandidates(many, { page: 5 });
    expect(clamped.page).toBe(1);
    expect(clamped.items).toHaveLength(3);
  });

  it("elegibilidade: matriz completa de status × visibilidade", () => {
    for (const status of ["ativo", "egresso", "inativo"] as const) {
      for (const visibility of ["publico", "somente_candidaturas"] as const) {
        const expected = status !== "inativo" && visibility === "publico";
        expect(canAppearInTalentBank({ status, visibility })).toBe(expected);
      }
    }
  });
});
