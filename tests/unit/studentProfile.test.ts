import { assert, describe, expect, it } from "vitest";
import {
  ENROLLMENT_STATUS,
  isValidEnrollment,
  isValidName,
  isValidUrl,
  normalizeEnrollment,
  validateStudentProfile,
  type StudentProfileInput,
} from "../../src/lib/studentProfile";
import { isRole } from "../../src/lib/roles";

const ANO_FORMATURA_BASE = 2025;
const SEMESTRE_BASE = 8;
/** Quantos erros o caso "tudo errado" deve acumular, no mínimo. */
const MIN_AGGREGATED_ERRORS = 3;

const validBase: StudentProfileInput = {
  fullName: "Maria da Silva",
  enrollment: "2021012345",
  status: "ativo",
  course: "Ciência da Computação",
  graduationYear: ANO_FORMATURA_BASE,
  semester: SEMESTRE_BASE,
  location: "Recife, PE",
  linkedinUrl: "https://www.linkedin.com/in/maria-silva",
  portfolioUrl: "https://github.com/mariasilva",
  availability: ["estagio"],
};

describe("validação de perfil de aluno (S1-3, R1)", () => {
  it("aceita perfil completo e válido", () => {
    expect(validateStudentProfile(validBase).ok).toBe(true);
  });

  it.each([
    ["só o primeiro nome", "Maria", false],
    ["nome e sobrenome", "Maria da Silva", true],
    ["só espaços", "  ", false],
  ])("nome requer pelo menos nome e sobrenome: %s", (_caso, nome, esperado) => {
    expect(isValidName(nome)).toBe(esperado);
  });

  it("perfil com nome incompleto é rejeitado", () => {
    const result = validateStudentProfile({ ...validBase, fullName: "Maria" });

    expect(result.ok).toBe(false);
  });

  it.each([
    ["só dígitos", "2021012345", true],
    ["pontuação ignorada", " 2021.0123-45 ", true],
    ["curta demais", "123", false],
    ["sem dígitos", "abcdefghij", false],
    ["vazia", "", false],
  ])("matrícula: 6–12 dígitos após normalização: %s", (_caso, valor, esperado) => {
    expect(isValidEnrollment(valor)).toBe(esperado);
  });

  it.each([
    [" 2021.0123-45 ", "2021012345"],
    ["abc 123-456 ", "123456"],
  ])("normaliza matrícula %j para índice único (só dígitos)", (entrada, esperado) => {
    expect(normalizeEnrollment(entrada)).toBe(esperado);
  });

  it("status do enum de vínculo contém ativo, egresso e inativo (R1)", () => {
    expect(ENROLLMENT_STATUS).toEqual(
      expect.arrayContaining(["ativo", "egresso", "inativo"]),
    );
  });

  it("status fora do enum de vínculo é rejeitado (R1)", () => {
    const result = validateStudentProfile({
      ...validBase,
      status: "formado" as never,
    });

    expect(result.ok).toBe(false);
  });

  it("curso é obrigatório", () => {
    const result = validateStudentProfile({ ...validBase, course: "  " });

    expect(result.ok).toBe(false);
  });

  it.each([
    ["antes do intervalo", 1999, false],
    ["depois do intervalo", 2100, false],
    ["dentro do intervalo", 2026, true],
  ])("ano de formação em intervalo plausível: %s", (_caso, graduationYear, esperado) => {
    expect(validateStudentProfile({ ...validBase, graduationYear }).ok).toBe(
      esperado,
    );
  });

  it.each([
    ["não informado", undefined, true],
    ["zero", 0, false],
    ["acima de 12", 13, false],
  ] satisfies Array<[string, number | undefined, boolean]>)(
    "semestre é opcional, mas quando informado fica em 1–12: %s",
    (_caso, semester, esperado) => {
      expect(validateStudentProfile({ ...validBase, semester }).ok).toBe(
        esperado,
      );
    },
  );

  it.each([
    ["https válida", "https://github.com/aluno", true],
    ["http (não seguro)", "http://github.com/aluno", false],
    ["sem protocolo", "github.com/aluno", false],
    ["não informada (opcional)", undefined, true],
  ] satisfies Array<[string, string | undefined, boolean]>)(
    "URL de LinkedIn/portfólio (opcional + https): %s",
    (_caso, url, esperado) => {
      expect(isValidUrl(url)).toBe(esperado);
    },
  );

  it("perfil sem links de LinkedIn/portfólio é válido", () => {
    const semLinks = {
      ...validBase,
      linkedinUrl: undefined,
      portfolioUrl: undefined,
    };

    expect(validateStudentProfile(semLinks).ok).toBe(true);
  });

  it("agrega todos os erros na resposta", () => {
    const result = validateStudentProfile({
      ...validBase,
      fullName: "Maria",
      enrollment: "12",
      course: "",
      linkedinUrl: "http://x.com",
    });

    assert(!result.ok, "esperava validação ok === false");
    expect(result.errors.length).toBeGreaterThanOrEqual(MIN_AGGREGATED_ERRORS);
  });
});

describe("integração com papéis (S1-1)", () => {
  it("papel aluno existe para guard de rota", () => {
    expect(isRole("aluno")).toBe(true);
  });
});