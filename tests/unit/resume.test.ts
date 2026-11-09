import { describe, expect, it } from "vitest";
import {
  MAX_EXPERIENCES,
  MAX_ACADEMIC,
  validateResumeData,
  type ResumeDataInput,
} from "../../src/lib/resume";
import { expectInvalid, expectValid } from "../helpers/validation";

const HEADLINE_MIN = 10;
const HEADLINE_MAX = 120;
const SUMMARY_MIN = 30;
const ANO_INGRESSO = 2021;
const ANO_MARATONA = 2023;
const ANO_EVENTO = 2022;
const ANO_IMPLAUSIVEL = 1990;
/** Quantos erros o caso "tudo errado" deve acumular, no mínimo. */
const MIN_AGGREGATED_ERRORS = 3;

const valid: ResumeDataInput = {
  headline: "Estudante de Ciência da Computação focado em backend",
  summary:
    "Aluno do 8º semestre com experiência em estágio de desenvolvimento web e projetos de extensão em dados.",
  experiences: [
    {
      company: "Acme Ltda",
      role: "Estagiário de Desenvolvimento",
      period: "2024.2 - 2025.1",
      description: "Manutenção de APIs internas em Node.js.",
    },
  ],
  academicHistory: [
    { item: "Ingresso no curso de CC", year: ANO_INGRESSO },
    { item: "Premiação na maratona de programação", year: ANO_MARATONA },
  ],
};

describe("validação de Currículo Vitae (S2-1)", () => {
  it("aceita currículo completo válido", () => {
    expect(expectValid(validateResumeData(valid))).toEqual(valid);
  });

  it.each([
    ["curta demais", "curto", false],
    ["longa demais", "x".repeat(HEADLINE_MAX + 1), false],
    ["no limite mínimo", "x".repeat(HEADLINE_MIN), true],
  ])(
    "headline é obrigatória (mín. 10, máx. 120 caracteres): %s",
    (_caso, headline, esperado) => {
      expect(validateResumeData({ ...valid, headline }).ok).toBe(esperado);
    },
  );

  it.each([
    ["curto demais", "muito curto", false],
    ["no limite mínimo", "x".repeat(SUMMARY_MIN), true],
  ])(
    "resumo é obrigatório (mín. 30 caracteres): %s",
    (_caso, summary, esperado) => {
      expect(validateResumeData({ ...valid, summary }).ok).toBe(esperado);
    },
  );

  it("experiências: campos obrigatórios por item", () => {
    const errors = expectInvalid(
      validateResumeData({
        ...valid,
        experiences: [
          { company: "", role: "Dev", period: "2024", description: "desc" },
        ],
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Empresa")]),
    );
  });

  it("limite máximo de experiências", () => {
    const many = Array.from({ length: MAX_EXPERIENCES + 1 }, () => ({
      company: "Acme",
      role: "Dev",
      period: "2024",
      description: "desc",
    }));

    expect(validateResumeData({ ...valid, experiences: many }).ok).toBe(false);
  });

  it.each([
    ["item em branco", [{ item: "  ", year: ANO_INGRESSO }]],
    ["ano implausível", [{ item: "Formatura", year: ANO_IMPLAUSIVEL }]],
  ] satisfies Array<[string, ResumeDataInput["academicHistory"]]>)(
    "histórico acadêmico: item obrigatório e ano plausível — rejeita %s",
    (_caso, academicHistory) => {
      expect(validateResumeData({ ...valid, academicHistory }).ok).toBe(false);
    },
  );

  it("limite máximo de itens no histórico", () => {
    const many = Array.from({ length: MAX_ACADEMIC + 1 }, (_, i) => ({
      item: `Evento ${i}`,
      year: ANO_EVENTO,
    }));

    expect(validateResumeData({ ...valid, academicHistory: many }).ok).toBe(
      false,
    );
  });

  it("agrega múltiplos erros", () => {
    const errors = expectInvalid(
      validateResumeData({
        ...valid,
        headline: "",
        summary: "curto",
        experiences: [{ company: "x", role: "", period: "", description: "" }],
      }),
    );

    expect(errors.length).toBeGreaterThanOrEqual(MIN_AGGREGATED_ERRORS);
  });
});