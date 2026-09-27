/**
 * [S7-1] Regras puras do cadastro de projetos de extensão — TDD.
 *
 * CA 1 — CRUD completo em `extensionProjects` (contrato validado aqui,
 * compartilhado entre UI e mutation — padrão do S3-1/job.ts).
 * CA 2 — validações básicas: título, descrição, coordenador, área
 * temática e público-alvo, com normalização (trim) e limites.
 */
import { describe, expect, it } from "vitest";
import {
  EXTENSION_AREAS,
  EXTENSION_AREA_LABELS,
  validateExtensionProject,
  type ExtensionProjectInput,
} from "../../src/lib/extensionProject";

const VALID: ExtensionProjectInput = {
  title: "Escola de Verão de Computação para Escolas Públicas",
  description:
    "Projeto de extensão que oferece oficinas de programação a estudantes de escolas públicas do Recife.",
  coordinatorId: "user-coord-1",
  area: "educacao",
  targetAudience: "Estudantes do ensino médio da rede pública",
};

describe("[S7-1] áreas temáticas (enum fixo do RESGES)", () => {
  it("define as 8 áreas temáticas com rótulos amigáveis", () => {
    expect(EXTENSION_AREAS).toHaveLength(8);
    expect(EXTENSION_AREA_LABELS["direitos_humanos_justica"]).toBe(
      "Direitos Humanos e Justiça",
    );
    expect(EXTENSION_AREA_LABELS["tecnologia_e_producao"]).toBe(
      "Tecnologia e Produção",
    );
  });
});

describe("[S7-1] validação do projeto (CA 2)", () => {
  it("aceita projeto completo e normaliza espaços das bordas", () => {
    const result = validateExtensionProject({
      ...VALID,
      title: `  ${VALID.title}  `,
      description: ` ${VALID.description} `,
      targetAudience: `  ${VALID.targetAudience}\t`,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.title).toBe(VALID.title);
      expect(result.normalized.description).toBe(VALID.description);
      expect(result.normalized.targetAudience).toBe(VALID.targetAudience);
    }
  });

  it("título curto demais é rejeitado com mensagem clara", () => {
    const result = validateExtensionProject({ ...VALID, title: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        "O título deve ter entre 5 e 120 caracteres.",
      );
    }
  });

  it("título vazio ou só espaços é rejeitado", () => {
    const result = validateExtensionProject({ ...VALID, title: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/título/i);
    }
  });

  it("descrição abaixo do mínimo é rejeitada", () => {
    const result = validateExtensionProject({
      ...VALID,
      description: "Muito curta.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/descrição/i);
    }
  });

  it("coordenador ausente é rejeitado", () => {
    const result = validateExtensionProject({ ...VALID, coordinatorId: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Selecione o coordenador do projeto.");
    }
  });

  it("área inválida (fora do enum) é rejeitada", () => {
    const result = validateExtensionProject({
      ...VALID,
      area: "engenharia_financeira" as ExtensionProjectInput["area"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Selecione uma área temática válida.");
    }
  });

  it("público-alvo vazio ou acima do limite é rejeitado", () => {
    const empty = validateExtensionProject({
      ...VALID,
      targetAudience: "   ",
    });
    expect(empty.ok).toBe(false);
    const tooLong = validateExtensionProject({
      ...VALID,
      targetAudience: "a".repeat(401),
    });
    expect(tooLong.ok).toBe(false);
  });

  it("[S7-5] limites superiores exatos são ACEITOS (título 120, descrição 4000)", () => {
    const atLimits = validateExtensionProject({
      ...VALID,
      title: "T".repeat(120),
      description: "D".repeat(4000),
      targetAudience: "P".repeat(400),
    });
    expect(atLimits.ok).toBe(true);
  });

  it("[S7-5] um caractere acima dos limites superiores é REJEITADO", () => {
    const over = validateExtensionProject({
      ...VALID,
      title: "T".repeat(121),
      description: "D".repeat(4001),
      targetAudience: "P".repeat(401),
    });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.errors).toHaveLength(3);
    }
  });

  it("coleta TODOS os erros de uma vez (não para no primeiro)", () => {
    const result = validateExtensionProject({
      title: "abc",
      description: "curta",
      coordinatorId: " ",
      area: "fora" as ExtensionProjectInput["area"],
      targetAudience: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBe(5);
    }
  });
});
