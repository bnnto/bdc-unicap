import { describe, expect, it } from "vitest";
import {
  CONTRACT_TYPES,
  formatSalaryRange,
  validateJob,
  type JobInput,
} from "../../src/lib/job";
import { MAX_PREREQS } from "../../src/lib/job";

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
    const result = validateJob({ ...valid, title: "  Título com espaços  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.title).toBe("Título com espaços");
      expect(result.normalized.location).toBe("Recife/PE");
    }
  });

  it("título é obrigatório (5–120 caracteres)", () => {
    expect(validateJob({ ...valid, title: "curt" }).ok).toBe(false);
    expect(validateJob({ ...valid, title: "x".repeat(121) }).ok).toBe(false);
    expect(validateJob({ ...valid, title: "x".repeat(5) }).ok).toBe(true);
  });

  it("descrição é obrigatória (30–4000 caracteres)", () => {
    expect(validateJob({ ...valid, description: "muito curta" }).ok).toBe(
      false,
    );
    expect(validateJob({ ...valid, description: "x".repeat(4001) }).ok).toBe(
      false,
    );
    expect(validateJob({ ...valid, description: "x".repeat(30) }).ok).toBe(
      true,
    );
  });

  it("faixa salarial: mínimo e máximo opcionais, mas consistentes entre si", () => {
    expect(
      validateJob({ ...valid, salaryMin: undefined, salaryMax: undefined }).ok,
    ).toBe(true);
    expect(
      validateJob({ ...valid, salaryMin: 1500, salaryMax: undefined }).ok,
    ).toBe(true);
    expect(
      validateJob({ ...valid, salaryMin: undefined, salaryMax: 2000 }).ok,
    ).toBe(true);
    expect(validateJob({ ...valid, salaryMin: 2000, salaryMax: 1500 }).ok).toBe(
      false,
    );
  });

  it("faixa salarial: valores positivos e limite superior coerente", () => {
    expect(validateJob({ ...valid, salaryMin: 0 }).ok).toBe(false);
    expect(validateJob({ ...valid, salaryMax: -100 }).ok).toBe(false);
    expect(validateJob({ ...valid, salaryMin: 1_000_001 }).ok).toBe(false);
  });

  it("tipo de contrato é obrigatório e validado", () => {
    expect(validateJob({ ...valid, contractType: "clt" }).ok).toBe(true);
    expect(
      validateJob({
        ...valid,
        contractType: "pirata" as JobInput["contractType"],
      }).ok,
    ).toBe(false);
  });

  it("pré-requisitos: 1..15 itens, com flag obrigatório/opcional", () => {
    expect(validateJob({ ...valid, prerequisites: [] }).ok).toBe(false);
    const many = Array.from({ length: MAX_PREREQS + 1 }, (_, i) => ({
      item: `Req ${i}`,
      required: true,
    }));
    expect(validateJob({ ...valid, prerequisites: many }).ok).toBe(false);
    expect(
      validateJob({ ...valid, prerequisites: [{ item: "  ", required: true }] })
        .ok,
    ).toBe(false);
  });

  it("pré-requisitos são normalizados (trim) e preservam a flag", () => {
    const result = validateJob({
      ...valid,
      prerequisites: [
        { item: "  React  ", required: false },
        { item: "TypeScript", required: true },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.prerequisites).toEqual([
        { item: "React", required: false, kind: "skill" },
        { item: "TypeScript", required: true, kind: "skill" },
      ]);
    }
  });

  it("requisito descritivo nunca é obrigatório e mantém kind 'text'", () => {
    const result = validateJob({
      ...valid,
      prerequisites: [
        { item: "  Disponibilidade para viagens  ", required: true, kind: "text" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.prerequisites).toEqual([
        { item: "Disponibilidade para viagens", required: false, kind: "text" },
      ]);
    }
  });

  it("localização é opcional e vira undefined quando vazia", () => {
    const result = validateJob({ ...valid, location: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.location).toBeUndefined();
    }
  });

  it("agrega múltiplos erros de uma vez", () => {
    const result = validateJob({
      ...valid,
      title: "no",
      description: "curta",
      salaryMin: 5000,
      salaryMax: 1000,
      prerequisites: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("formatação da faixa salarial (S3-1)", () => {
  it("exibe faixa quando mínimo e máximo presentes", () => {
    expect(formatSalaryRange(1200, 1800)).toBe("R$ 1.200 – R$ 1.800");
  });

  it("exibe 'a partir de' quando só mínimo", () => {
    expect(formatSalaryRange(2500, null)).toBe("A partir de R$ 2.500");
  });

  it("exibe 'até' quando só máximo", () => {
    expect(formatSalaryRange(null, 3000)).toBe("Até R$ 3.000");
  });

  it("exibe 'A combinar' quando nenhum valor", () => {
    expect(formatSalaryRange(null, null)).toBe("A combinar");
  });
});

describe("constantes compartilhadas (S3-1)", () => {
  it("tipos de contrato do requisito", () => {
    expect(CONTRACT_TYPES).toEqual(["estagio", "clt", "pj", "temporario"]);
    expect(MAX_PREREQS).toBe(15);
  });
});
