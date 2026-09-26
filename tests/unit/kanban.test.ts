import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  canTransitionTo,
  groupApplicationsByStage,
  isApplicationStage,
  type ApplicationStage,
} from "../../src/lib/application";

describe("colunas do Kanban (S4-1, CA 2)", () => {
  it("pipeline tem exatamente as 5 colunas do issue, na ordem", () => {
    expect(APPLICATION_STAGES).toEqual([
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
      "reprovado",
    ]);
  });

  it("rótulos pt-BR das colunas", () => {
    expect(STAGE_LABELS.inscrito).toBe("Inscrito");
    expect(STAGE_LABELS.triagem).toBe("Em Triagem");
    expect(STAGE_LABELS.entrevista).toBe("Entrevista");
    expect(STAGE_LABELS.aprovado).toBe("Aprovado");
    expect(STAGE_LABELS.reprovado).toBe("Reprovado");
  });

  it("toda coluna tem rótulo não vazio", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });
});

describe("transições entre colunas (S4-1, CA 1)", () => {
  it("movimentação entre colunas distintas é permitida", () => {
    for (const from of APPLICATION_STAGES) {
      for (const to of APPLICATION_STAGES) {
        if (from !== to) {
          expect(canTransitionTo(from, to)).toBe(true);
        }
      }
    }
  });

  it("mover para a mesma coluna é rejeitado (no-op explícito)", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(canTransitionTo(stage, stage)).toBe(false);
    }
  });
});

describe("guarda de stage para a mutation (S4-1)", () => {
  it("aceita apenas stages do pipeline", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(isApplicationStage(stage)).toBe(true);
    }
    expect(isApplicationStage("proposta")).toBe(false);
    expect(isApplicationStage("contratado")).toBe(false);
    expect(isApplicationStage("qualquer")).toBe(false);
    expect(isApplicationStage(42)).toBe(false);
    expect(isApplicationStage(null)).toBe(false);
  });

  it("stages antigos fora do issue não são mais válidos", () => {
    const old: string[] = ["proposta", "contratado"];
    for (const stage of old) {
      expect((APPLICATION_STAGES as readonly string[]).includes(stage)).toBe(
        false,
      );
    }
  });
});

describe("contagem de cards por coluna (S4-1, CA 2)", () => {
  type Row = { id: string; stage: ApplicationStage };

  const rows: Row[] = [
    { id: "a1", stage: "inscrito" },
    { id: "a2", stage: "inscrito" },
    { id: "a3", stage: "triagem" },
    { id: "a4", stage: "entrevista" },
    { id: "a5", stage: "aprovado" },
  ];

  it("agrupa candidaturas por stage mantendo os objetos", () => {
    const grouped = groupApplicationsByStage(rows);
    expect(grouped.inscrito.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(grouped.triagem.map((r) => r.id)).toEqual(["a3"]);
    expect(grouped.entrevista.map((r) => r.id)).toEqual(["a4"]);
    expect(grouped.aprovado.map((r) => r.id)).toEqual(["a5"]);
    expect(grouped.reprovado).toEqual([]);
  });

  it("todas as 5 colunas existem mesmo sem cards (contagem zero)", () => {
    const grouped = groupApplicationsByStage([] as Row[]);
    for (const stage of APPLICATION_STAGES) {
      expect(grouped[stage]).toEqual([]);
    }
  });
});
