import { describe, expect, it } from "vitest";
import {
  averageTimeToHire,
  filterSamplesByPeriod,
  formatTimeToHire,
  hireSamples,
  timeToHireDays,
  type TimeToHireSample,
} from "../../src/lib/operationalPanel";

const DAY = 24 * 60 * 60 * 1000;
/** Época fixa para determinismo dos testes. */
const T0 = 1_700_000_000_000;

function makeSample(
  overrides: Partial<TimeToHireSample> = {},
): TimeToHireSample {
  return {
    jobId: "j1",
    studentId: "s1",
    days: 10,
    filledAt: T0,
    ...overrides,
  };
}

describe("timeToHireDays (S5-2, CA 1 — cálculo em dias)", () => {
  it("dias inteiros entre candidatura e preenchimento", () => {
    expect(timeToHireDays(T0 + 3 * DAY, T0)).toBe(3);
  });

  it("dia parcial conta como dia completo (teto)", () => {
    // 2,5 dias → 3 dias completos decorridos (parcial conta).
    expect(timeToHireDays(T0 + 2.5 * DAY, T0)).toBe(3);
  });

  it("menos de um dia arredonda para 1 (não zera)", () => {
    expect(timeToHireDays(T0 + 60 * 60 * 1000, T0)).toBe(1);
  });

  it("datas inconsistentes (preenchimento antes da candidatura) viram 0", () => {
    expect(timeToHireDays(T0 - DAY, T0)).toBe(0);
  });
});

describe("hireSamples (S5-2 — pareamento candidatura aprovada × vaga preenchida)", () => {
  it("cria amostra para aprovação em vaga preenchida", () => {
    const samples = hireSamples(
      [{ jobId: "j1", filledAt: T0 + 10 * DAY }],
      [{ jobId: "j1", studentId: "s1", appliedAt: T0 }],
    );
    expect(samples).toEqual([
      { jobId: "j1", studentId: "s1", days: 10, filledAt: T0 + 10 * DAY },
    ]);
  });

  it("ignora aprovação em vaga não preenchida (sem filledAt)", () => {
    const samples = hireSamples(
      [], // nenhuma vaga preenchida
      [{ jobId: "j1", studentId: "s1", appliedAt: T0 }],
    );
    expect(samples).toEqual([]);
  });

  it("duas contratações na mesma vaga geram duas amostras", () => {
    const samples = hireSamples(
      [{ jobId: "j1", filledAt: T0 + 5 * DAY }],
      [
        { jobId: "j1", studentId: "s1", appliedAt: T0 },
        { jobId: "j1", studentId: "s2", appliedAt: T0 + DAY },
      ],
    );
    expect(samples).toHaveLength(2);
    expect(samples.map((s) => s.studentId).sort()).toEqual(["s1", "s2"]);
  });

  it("vaga preenchida sem aprovação não gera amostra", () => {
    const samples = hireSamples([{ jobId: "j1", filledAt: T0 + 5 * DAY }], []);
    expect(samples).toEqual([]);
  });
});

describe("filterSamplesByPeriod (S5-2 — agregado por período)", () => {
  const samples = [
    makeSample({ jobId: "a", filledAt: T0 }),
    makeSample({ jobId: "b", filledAt: T0 + 40 * DAY }),
    makeSample({ jobId: "c", filledAt: T0 + 100 * DAY }),
  ];

  it("sem filtros retorna todas as amostras", () => {
    expect(filterSamplesByPeriod(samples, {})).toHaveLength(3);
  });

  it("filtra por início (inclusivo)", () => {
    const filtered = filterSamplesByPeriod(samples, { from: T0 + 40 * DAY });
    expect(filtered.map((s) => s.jobId)).toEqual(["b", "c"]);
  });

  it("filtra por fim (inclusivo)", () => {
    const filtered = filterSamplesByPeriod(samples, { to: T0 + 40 * DAY });
    expect(filtered.map((s) => s.jobId)).toEqual(["a", "b"]);
  });

  it("filtra por faixa completa", () => {
    const filtered = filterSamplesByPeriod(samples, {
      from: T0 + 30 * DAY,
      to: T0 + 90 * DAY,
    });
    expect(filtered.map((s) => s.jobId)).toEqual(["b"]);
  });
});

describe("averageTimeToHire (S5-2, CA 1 — agregação correta)", () => {
  it("sem amostras: null (não há contratação para medir)", () => {
    expect(averageTimeToHire([])).toBeNull();
  });

  it("média simples de uma amostra", () => {
    expect(averageTimeToHire([makeSample({ days: 10 })])).toBe(10);
  });

  it("média arredondada para inteiro (7,5 → 8)", () => {
    expect(
      averageTimeToHire([makeSample({ days: 10 }), makeSample({ days: 5 })]),
    ).toBe(8);
  });

  it("média de três amostras (10+5+3)/3 = 6", () => {
    expect(
      averageTimeToHire([
        makeSample({ days: 10 }),
        makeSample({ days: 5 }),
        makeSample({ days: 3 }),
      ]),
    ).toBe(6);
  });
});

describe("formatTimeToHire (S5-2, CA 2 — exibição)", () => {
  it("null (sem dados) vira travessão", () => {
    expect(formatTimeToHire(null)).toBe("—");
  });

  it("valor em dias com sufixo", () => {
    expect(formatTimeToHire(12)).toBe("12 dias");
  });

  it("singular para um dia", () => {
    expect(formatTimeToHire(1)).toBe("1 dia");
  });
});
