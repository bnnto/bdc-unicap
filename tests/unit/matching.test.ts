import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_BONUS,
  BASE_MAX,
  LANGUAGE_BONUS,
  WEIGHT_OPTIONAL,
  WEIGHT_REQUIRED,
  computeMatchScore,
  matchBand,
  type MatchingCandidate,
  type MatchingJob,
} from "../../src/lib/matching";

const candidate: MatchingCandidate = {
  skills: ["React", "SQL", "Testes automatizados"],
  languages: [{ name: "Inglês", level: "intermediario" }],
  availability: ["estagio"],
};

const job: MatchingJob = {
  prerequisites: [
    { item: "React", required: true },
    { item: "SQL", required: true },
    { item: "Testes automatizados", required: false },
  ],
  requiredLanguage: { name: "Inglês", level: "intermediario" },
  availability: "estagio",
};

describe("constantes do algoritmo (S3-3, CA 1)", () => {
  it("pesos de pré-requisitos obrigatórios e opcionais", () => {
    expect(WEIGHT_REQUIRED).toBe(1.2);
    expect(WEIGHT_OPTIONAL).toBe(1.0);
  });

  it("bônus de idioma e disponibilidade e base dos pré-requisitos", () => {
    expect(LANGUAGE_BONUS).toBe(6);
    expect(AVAILABILITY_BONUS).toBe(4);
    expect(BASE_MAX + LANGUAGE_BONUS + AVAILABILITY_BONUS).toBe(100);
  });
});

describe("matching currículo × vaga (S3-3, CA 2 — função pura)", () => {
  it("casamento perfeito: 100 (todos os pré-requisitos, idioma e disponibilidade)", () => {
    const score = computeMatchScore(candidate, job);
    expect(score).toBe(100);
  });

  it("limites 0–100: nunca negativo, nunca acima de 100", () => {
    const max = computeMatchScore(candidate, job);
    expect(max).toBeLessThanOrEqual(100);
    const empty = computeMatchScore(
      { skills: [], languages: [], availability: ["freelancer"] },
      {
        prerequisites: Array.from({ length: 8 }, (_, i) => ({
          item: `Req ${i}`,
          required: true,
        })),
        requiredLanguage: { name: "Mandarim", level: "nativo" },
        availability: "integral",
      },
    );
    expect(empty).toBe(0);
  });

  it("aritmética dos pesos: obrigatório 1.2 vs opcional 1.0 (base 90)", () => {
    const mixedJob: MatchingJob = {
      prerequisites: [
        { item: "React", required: true },
        { item: "Inglês técnico", required: false },
      ],
    };
    const both = computeMatchScore(
      {
        skills: ["React", "Inglês técnico"],
        languages: [],
        availability: ["freelancer"],
      },
      mixedJob,
    );
    const onlyRequired = computeMatchScore(
      { skills: ["React"], languages: [], availability: ["freelancer"] },
      mixedJob,
    );
    const onlyOptional = computeMatchScore(
      {
        skills: ["Inglês técnico"],
        languages: [],
        availability: ["freelancer"],
      },
      mixedJob,
    );
    expect(both).toBe(90); // (1.2 + 1.0) / 2.2 × 90
    expect(onlyRequired).toBe(49); // 1.2 / 2.2 × 90 = 49,09 → 49
    expect(onlyOptional).toBe(41); // 1.0 / 2.2 × 90 = 40,9 → 41
  });

  it("bônus de idioma: nível igual ou superior ao exigido pontua; sem idioma, não", () => {
    const withLanguage = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [{ name: "Inglês", level: "avancado" }], // acima do exigido
        availability: ["freelancer"],
      },
      job,
    );
    const withoutLanguage = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [],
        availability: ["freelancer"],
      },
      job,
    );
    expect(withLanguage - withoutLanguage).toBe(LANGUAGE_BONUS);
  });

  it("bônus de idioma exige o idioma informado na vaga (nome case-insensitive)", () => {
    const wrongLanguage = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [{ name: "espanhol", level: "nativo" }],
        availability: ["freelancer"],
      },
      job,
    );
    const none = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [],
        availability: ["freelancer"],
      },
      job,
    );
    expect(wrongLanguage).toBe(none);
  });

  it("bônus de disponibilidade: apenas correspondência exata pontua", () => {
    const same = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [],
        availability: ["estagio"],
      },
      job,
    );
    const different = computeMatchScore(
      {
        skills: ["React", "SQL", "Testes automatizados"],
        languages: [],
        availability: ["integral"],
      },
      job,
    );
    expect(same - different).toBe(AVAILABILITY_BONUS);
  });

  it("pré-requisito obrigatório não atendido reduz mais que opcional (R8 — transparência dos pesos)", () => {
    const missesRequired = computeMatchScore(
      { skills: ["SQL"], languages: [], availability: ["freelancer"] },
      job,
    );
    const missesOptional = computeMatchScore(
      {
        skills: ["React", "Testes automatizados"],
        languages: [],
        availability: ["freelancer"],
      },
      job,
    );
    // Perder 1 obrigatório (peso 1.2) custa mais que perder 1 opcional (1.0).
    expect(missesRequired).toBeLessThan(missesOptional);
  });

  it("matching de skills é case-insensitive e tolerante a acentos", () => {
    const score = computeMatchScore(
      {
        skills: ["react", "sql", "testes automatizados"],
        languages: [{ name: "inglês", level: "intermediario" }],
        availability: ["estagio"],
      },
      job,
    );
    expect(score).toBe(100);
  });

  it("é determinístico: mesma entrada → mesmo resultado", () => {
    const a = computeMatchScore(candidate, job);
    const b = computeMatchScore(candidate, job);
    expect(a).toBe(b);
  });

  it("vaga sem idioma/disponibilidade exigidos: teto é a base 90 (ainda Strong)", () => {
    const plainJob: MatchingJob = {
      prerequisites: [{ item: "React", required: true }],
    };
    expect(
      computeMatchScore(
        {
          skills: ["React"],
          languages: [{ name: "Inglês", level: "nativo" }],
          availability: ["estagio"],
        },
        plainJob,
      ),
    ).toBe(90);
    expect(matchBand(90)).toBe("strong");
  });
});

describe("faixas de compatibilidade (S3-3, CA 3 — R8)", () => {
  it("≥85% é Strong Match", () => {
    expect(matchBand(100)).toBe("strong");
    expect(matchBand(85)).toBe("strong");
  });

  it("50–84% é Medium Match", () => {
    expect(matchBand(84)).toBe("medium");
    expect(matchBand(50)).toBe("medium");
  });

  it("<50% é Low Match", () => {
    expect(matchBand(49)).toBe("low");
    expect(matchBand(0)).toBe("low");
  });

  it("score é inteiro (0–100) para exibição direta", () => {
    for (let i = 0; i <= 10; i += 1) {
      const score = computeMatchScore(
        { skills: [], languages: [], availability: ["estagio"] },
        {
          prerequisites: Array.from({ length: i }, (_, j) => ({
            item: `Req ${j}`,
            required: j % 2 === 0,
          })),
        },
      );
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
