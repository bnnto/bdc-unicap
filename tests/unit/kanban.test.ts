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

describe("transições entre colunas — caminho obrigatório (UX_UPGRADE, anti-cheat)", () => {
  it("avanço de UMA etapa por vez no funil principal é permitido", () => {
    const forward: Array<[ApplicationStage, ApplicationStage]> = [
      ["inscrito", "triagem"],
      ["triagem", "entrevista"],
      ["entrevista", "aprovado"],
    ];
    for (const [from, to] of forward) {
      expect(canTransitionTo(from, to)).toBe(true);
    }
  });

  it("retrocessos no funil são permitidos (desfazer/auditoria)", () => {
    const backward: Array<[ApplicationStage, ApplicationStage]> = [
      ["triagem", "inscrito"],
      ["entrevista", "triagem"],
      ["aprovado", "entrevista"],
      ["aprovado", "inscrito"],
    ];
    for (const [from, to] of backward) {
      expect(canTransitionTo(from, to)).toBe(true);
    }
  });

  it("SALTOS para frente são bloqueados (caminho obrigatório)", () => {
    const jumps: Array<[ApplicationStage, ApplicationStage]> = [
      ["inscrito", "entrevista"],
      ["inscrito", "aprovado"],
      ["triagem", "aprovado"],
    ];
    for (const [from, to] of jumps) {
      expect(canTransitionTo(from, to)).toBe(false);
    }
  });

  it("reprovar continua permitido a partir de qualquer coluna (com motivo na decisão)", () => {
    const sources: ApplicationStage[] = [
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
    ];
    for (const from of sources) {
      expect(canTransitionTo(from, "reprovado")).toBe(true);
    }
  });

  it("reentrada de Reprovado só pelo início do funil (inscrito)", () => {
    expect(canTransitionTo("reprovado", "inscrito")).toBe(true);
    expect(canTransitionTo("reprovado", "triagem")).toBe(false);
    expect(canTransitionTo("reprovado", "entrevista")).toBe(false);
    expect(canTransitionTo("reprovado", "aprovado")).toBe(false);
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
