import { describe, expect, it } from "vitest";
import {
  checkRequiredPrerequisites,
  formatMissingPrerequisites,
} from "../../src/lib/application";
import { computeMatchScore } from "../../src/lib/matching";

const job = {
  prerequisites: [
    { item: "React", required: true },
    { item: "SQL", required: true },
    { item: "Testes automatizados", required: false },
    { item: "Inglês técnico", required: false },
  ],
};

describe("bloqueio por requisitos obrigatórios (S3-5, CA 1)", () => {
  it("atende todos os obrigatórios: liberado", () => {
    const gate = checkRequiredPrerequisites(job, ["React", "SQL"]);
    expect(gate.ok).toBe(true);
    expect(gate.missing).toEqual([]);
  });

  it("falta um obrigatório: bloqueado com o item faltante", () => {
    const gate = checkRequiredPrerequisites(job, ["React"]);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toEqual(["SQL"]);
  });

  it("faltam vários obrigatórios: bloqueado com todos os itens, em ordem", () => {
    const gate = checkRequiredPrerequisites(job, []);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toEqual(["React", "SQL"]);
  });

  it("opcionais NUNCA bloqueiam (mesmo sem nenhuma skill de opcional)", () => {
    const gate = checkRequiredPrerequisites(job, ["React", "SQL"]);
    expect(gate.ok).toBe(true);
    expect(gate.missing).toEqual([]);
  });

  it("atender só opcionais não libera a candidatura", () => {
    const gate = checkRequiredPrerequisites(job, [
      "Testes automatizados",
      "Inglês técnico",
    ]);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toEqual(["React", "SQL"]);
  });

  it("matching de skill é tolerante a acento e caixa (reuso do S3-3)", () => {
    const gate = checkRequiredPrerequisites(job, ["react", "sql"]);
    expect(gate.ok).toBe(true);
  });

  it("skill parcial não conta (igualdade, não substring)", () => {
    const gate = checkRequiredPrerequisites(job, ["React Native"]);
    expect(gate.ok).toBe(false);
    expect(gate.missing).toEqual(["React", "SQL"]);
  });

  it("vaga sem obrigatórios: sempre liberada", () => {
    const gate = checkRequiredPrerequisites(
      { prerequisites: [{ item: "Portfólio", required: false }] },
      [],
    );
    expect(gate.ok).toBe(true);
  });
});

describe("aviso claro na UI (S3-5, CA 2)", () => {
  it("mensagem singular para um item faltante", () => {
    expect(formatMissingPrerequisites(["SQL"])).toBe(
      "Requisito obrigatório não atendido: SQL.",
    );
  });

  it("mensagem plural lista todos os itens faltantes", () => {
    expect(formatMissingPrerequisites(["React", "SQL"])).toBe(
      "Requisitos obrigatórios não atendidos: React, SQL.",
    );
  });
});

describe("integração com o matching (S3-5 × S3-3)", () => {
  it("candidato bloqueado ainda tem % calculável (score independe do gate)", () => {
    const score = computeMatchScore(
      {
        skills: ["React"],
        languages: [],
        availability: "estagio",
      },
      {
        prerequisites: job.prerequisites,
        availability: "estagio",
      },
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});
