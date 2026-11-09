import { describe, expect, it } from "vitest";
import {
  CONTRACT_TYPES,
  MAX_PREREQS,
  formatSalaryRange,
  validateJob,
  type JobInput,
} from "../../src/lib/job";
import { expectInvalid, expectValid } from "../helpers/validation";

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 4000;
const SALARY_LIMIT = 1_000_000;
/** Quantos erros o caso "tudo errado" deve acumular, no mínimo. */
const MIN_AGGREGATED_ERRORS = 4;

const valid: JobInput = {
  title: "Estágio em Desenvolvimento Web",
  description:
    "Apoio no desenvolvimento de aplicações web da universidade, com acompanhamento de servidores experientes.",
  prerequisites: [
    { item: "Conclusão de 60% do curso", required: true },
    { item: "Inglês técnico para leitura", required: false },
  ],
  contractType: "estagio",
  salaryMin: 1200,
  salaryMax: 1800,
  location: "Recife/PE",
};

describe("validação de vaga (S3-1)", () => {
  it("aceita vaga completa e normaliza campos", () => {
    const normalized = expectValid(
      validateJob({ ...valid, title: "  Título com espaços  " }),
    );

    expect(normalized).toMatchObject({
      title: "Título com espaços",
      location: "Recife/PE",
    });
  });

  it.each([
    ["curto demais", "curt", false],
    ["longo demais", "x".repeat(TITLE_MAX + 1), false],
    ["no limite mínimo", "x".repeat(TITLE_MIN), true],
  ])("título é obrigatório (5–120 caracteres): %s", (_caso, title, esperado) => {
    expect(validateJob({ ...valid, title }).ok).toBe(esperado);
  });

  it.each([
    ["curta demais", "muito curta", false],
    ["longa demais", "x".repeat(DESCRIPTION_MAX + 1), false],
    ["no limite mínimo", "x".repeat(DESCRIPTION_MIN), true],
  ])(
    "descrição é obrigatória (30–4000 caracteres): %s",
    (_caso, description, esperado) => {
      expect(validateJob({ ...valid, description }).ok).toBe(esperado);
    },
  );

  it.each([
    ["sem mínimo e sem máximo", undefined, undefined, true],
    ["só mínimo", 1500, undefined, true],
    ["só máximo", undefined, 2000, true],
    ["mínimo maior que o máximo", 2000, 1500, false],
  ] satisfies Array<[string, number | undefined, number | undefined, boolean]>)(
    "faixa salarial opcional, mas consistente: %s",
    (_caso, salaryMin, salaryMax, esperado) => {
      expect(validateJob({ ...valid, salaryMin, salaryMax }).ok).toBe(esperado);
    },
  );

  it.each([
    ["mínimo zero", { salaryMin: 0 }],
    ["máximo negativo", { salaryMax: -100 }],
    ["mínimo acima do limite superior", { salaryMin: SALARY_LIMIT + 1 }],
  ] satisfies Array<[string, Partial<JobInput>]>)(
    "faixa salarial: valores positivos e limite coerente — rejeita %s",
    (_caso, overrides) => {
      expect(validateJob({ ...valid, ...overrides }).ok).toBe(false);
    },
  );

  it.each([
    ["clt", true],
    ["pirata", false],
  ] satisfies Array<[string, boolean]>)(
    "tipo de contrato é obrigatório e validado: %s",
    (contractType, esperado) => {
      const input = {
        ...valid,
        contractType: contractType as JobInput["contractType"],
      };
      expect(validateJob(input).ok).toBe(esperado);
    },
  );

  it.each([
    ["lista vazia", []],
    [
      "acima do máximo",
      Array.from({ length: MAX_PREREQS + 1 }, (_, i) => ({
        item: `Req ${i}`,
        required: true,
      })),
    ],
    ["item em branco", [{ item: "  ", required: true }]],
  ] satisfies Array<[string, JobInput["prerequisites"]]>)(
    "pré-requisitos: 1..15 itens — rejeita %s",
    (_caso, prerequisites) => {
      expect(validateJob({ ...valid, prerequisites }).ok).toBe(false);
    },
  );

  it("pré-requisitos são normalizados (trim) e preservam a flag", () => {
    const normalized = expectValid(
      validateJob({
        ...valid,
        prerequisites: [
          { item: "  React  ", required: false },
          { item: "TypeScript", required: true },
        ],
      }),
    );

    expect(normalized.prerequisites).toEqual([
      { item: "React", required: false, kind: "skill" },
      { item: "TypeScript", required: true, kind: "skill" },
    ]);
  });

  it("requisito descritivo nunca é obrigatório e mantém kind 'text'", () => {
    const normalized = expectValid(
      validateJob({
        ...valid,
        prerequisites: [
          {
            item: "  Disponibilidade para viagens  ",
            required: true,
            kind: "text",
          },
        ],
      }),
    );

    expect(normalized.prerequisites).toEqual([
      { item: "Disponibilidade para viagens", required: false, kind: "text" },
    ]);
  });

  it("localização é opcional e vira undefined quando vazia", () => {
    const normalized = expectValid(validateJob({ ...valid, location: "   " }));

    expect(normalized.location).toBeUndefined();
  });

  it("agrega múltiplos erros de uma vez", () => {
    const errors = expectInvalid(
      validateJob({
        ...valid,
        title: "no",
        description: "curta",
        salaryMin: 5000,
        salaryMax: 1000,
        prerequisites: [],
      }),
    );

    expect(errors.length).toBeGreaterThanOrEqual(MIN_AGGREGATED_ERRORS);
  });
});

describe("formatação da faixa salarial (S3-1)", () => {
  it.each([
    ["exibe faixa quando mínimo e máximo presentes", 1200, 1800, "R$ 1.200 – R$ 1.800"],
    ["exibe 'a partir de' quando só mínimo", 2500, null, "A partir de R$ 2.500"],
    ["exibe 'até' quando só máximo", null, 3000, "Até R$ 3.000"],
    ["exibe 'A combinar' quando nenhum valor", null, null, "A combinar"],
  ] satisfies Array<[string, number | null, number | null, string]>)(
    "%s",
    (_caso, min, max, esperado) => {
      expect(formatSalaryRange(min, max)).toBe(esperado);
    },
  );
});

describe("constantes compartilhadas (S3-1)", () => {
  it("tipos de contrato do requisito", () => {
    expect(CONTRACT_TYPES).toEqual(["estagio", "clt", "pj", "temporario"]);
  });

  it("limite de pré-requisitos por vaga", () => {
    expect(MAX_PREREQS).toBe(15);
  });
});