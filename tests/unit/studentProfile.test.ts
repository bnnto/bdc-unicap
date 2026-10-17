import { describe, expect, it } from "vitest";
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

const validBase: StudentProfileInput = {
  fullName: "Maria da Silva",
  enrollment: "2021012345",
  status: "ativo",
  course: "Ciência da Computação",
  graduationYear: 2025,
  semester: 8,
  location: "Recife, PE",
  linkedinUrl: "https://www.linkedin.com/in/maria-silva",
  portfolioUrl: "https://github.com/mariasilva",
  availability: ["estagio"],
};

describe("validação de perfil de aluno (S1-3, R1)", () => {
  it("aceita perfil completo e válido", () => {
    const result = validateStudentProfile(validBase);
    expect(result.ok).toBe(true);
  });

  it("nome requer pelo menos nome e sobrenome", () => {
    expect(isValidName("Maria")).toBe(false);
    expect(isValidName("Maria da Silva")).toBe(true);
    expect(isValidName("  ")).toBe(false);
    const result = validateStudentProfile({ ...validBase, fullName: "Maria" });
    expect(result.ok).toBe(false);
  });

  it("matrícula: 6–12 dígitos após normalização", () => {
    expect(isValidEnrollment("2021012345")).toBe(true);
    expect(isValidEnrollment(" 2021.0123-45 ")).toBe(true); // pontuação ignorada
    expect(isValidEnrollment("123")).toBe(false);
    expect(isValidEnrollment("abcdefghij")).toBe(false);
    expect(isValidEnrollment("")).toBe(false);
  });

  it("normaliza matrícula para índice único (só dígitos)", () => {
    expect(normalizeEnrollment(" 2021.0123-45 ")).toBe("2021012345");
    expect(normalizeEnrollment("abc 123-456 ")).toBe("123456");
  });

  it("status restrito ao enum de vínculo (R1)", () => {
    expect(ENROLLMENT_STATUS).toContain("ativo");
    expect(ENROLLMENT_STATUS).toContain("egresso");
    expect(ENROLLMENT_STATUS).toContain("inativo");
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

  it("ano de formação em intervalo plausível", () => {
    expect(
      validateStudentProfile({ ...validBase, graduationYear: 1999 }).ok,
    ).toBe(false);
    expect(
      validateStudentProfile({ ...validBase, graduationYear: 2100 }).ok,
    ).toBe(false);
    expect(
      validateStudentProfile({ ...validBase, graduationYear: 2026 }).ok,
    ).toBe(true);
  });

  it("semestre é opcional, mas quando informado fica em 1–12", () => {
    expect(
      validateStudentProfile({ ...validBase, semester: undefined }).ok,
    ).toBe(true);
    expect(validateStudentProfile({ ...validBase, semester: 0 }).ok).toBe(
      false,
    );
    expect(validateStudentProfile({ ...validBase, semester: 13 }).ok).toBe(
      false,
    );
  });

  it("URLs de LinkedIn/portfólio validadas (opcional + https)", () => {
    expect(isValidUrl("https://github.com/aluno")).toBe(true);
    expect(isValidUrl("http://github.com/aluno")).toBe(false);
    expect(isValidUrl("github.com/aluno")).toBe(false);
    expect(isValidUrl(undefined)).toBe(true);
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
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("integração com papéis (S1-1)", () => {
  it("papel aluno existe para guard de rota", () => {
    expect(isRole("aluno")).toBe(true);
  });
});
