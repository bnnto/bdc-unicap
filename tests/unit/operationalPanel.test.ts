import { describe, expect, it } from "vitest";
import {
  employabilityRate,
  formatEmployabilityRate,
  formatPercent,
  summarizeJobs,
  type JobRow,
} from "../../src/lib/operationalPanel";

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    jobId: "j1",
    status: "aberta",
    ...overrides,
  };
}

describe("KPIs de vagas (S5-1, CA 1)", () => {
  it("separa abertas, fechadas, encerradas e total", () => {
    const summary = summarizeJobs([
      makeJob({ jobId: "a", status: "aberta" }),
      makeJob({ jobId: "b", status: "aberta" }),
      makeJob({ jobId: "c", status: "fechada" }),
      makeJob({ jobId: "d", status: "encerrada" }),
      makeJob({ jobId: "e", status: "encerrada" }),
      makeJob({ jobId: "f", status: "encerrada" }),
    ]);
    expect(summary).toEqual({
      open: 2,
      closed: 1,
      filled: 3,
      total: 6,
    });
  });

  it("base vazia: todos os números zero", () => {
    expect(summarizeJobs([])).toEqual({
      open: 0,
      closed: 0,
      filled: 0,
      total: 0,
    });
  });

  it("total é sempre a soma das três categorias", () => {
    const summary = summarizeJobs([
      makeJob({ status: "aberta" }),
      makeJob({ status: "encerrada" }),
      makeJob({ status: "aberta" }),
      makeJob({ status: "aberta" }),
    ]);
    expect(summary.total).toBe(summary.open + summary.closed + summary.filled);
  });
});

describe("taxa de empregabilidade (S5-1, CA 2 — a partir de aprovações)", () => {
  it("aprovados / (aprovados + reprovados), sem candidaturas: null", () => {
    expect(employabilityRate([], [])).toBeNull();
  });

  it("aprovados / finalizados, ignorando candidaturas em andamento", () => {
    const rate = employabilityRate(
      [
        { stage: "aprovado" },
        { stage: "aprovado" },
        { stage: "reprovado" },
        { stage: "reprovado" },
        { stage: "triagem" }, // em andamento: não entra na taxa
        { stage: "inscrito" },
      ],
      [],
    );
    // 2 aprovados de 4 finalizados = 50%.
    expect(rate).toBe(50);
  });

  it("soma candidaturas de todas as vagas ( segundo parâmetro )", () => {
    const rate = employabilityRate(
      [{ stage: "aprovado" }],
      [{ stage: "reprovado" }, { stage: "reprovado" }, { stage: "reprovado" }],
    );
    // 1 aprovado de 4 finalizados = 25%.
    expect(rate).toBe(25);
  });

  it("só aprovações: 100%", () => {
    expect(
      employabilityRate([{ stage: "aprovado" }, { stage: "aprovado" }], []),
    ).toBe(100);
  });

  it("zero aprovados com finalizados: 0% (não null)", () => {
    expect(
      employabilityRate([{ stage: "reprovado" }, { stage: "reprovado" }], []),
    ).toBe(0);
  });

  it("arredonda para inteiro (exibição direta)", () => {
    // 1/3 = 33.33 → 33.
    expect(
      employabilityRate(
        [{ stage: "aprovado" }],
        [{ stage: "reprovado" }, { stage: "reprovado" }],
      ),
    ).toBe(33);
  });
});

describe("formatação do painel (S5-1)", () => {
  it("percentual com sufixo", () => {
    expect(formatPercent(50)).toBe("50%");
  });

  it("taxa de empregabilidade nula vira '—'", () => {
    expect(formatEmployabilityRate(null)).toBe("—");
    expect(formatEmployabilityRate(75)).toBe("75%");
  });
});
