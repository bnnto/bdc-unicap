import { describe, expect, it } from "vitest";
import {
  averageTimeToHire,
  filterSamplesByPeriod,
  formatTimeToHire,
  hireSamples,
  timeToHireDays,
  type TimeToHireSample,
} from "../../src/lib/operationalPanel";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Época fixa para determinismo dos testes. */
const T0 = 1_700_000_000_000;

/** Duração padrão de uma contratação nos cenários de teste. */
const DIAS_PADRAO = 10;
const CINCO_DIAS = 5 * DAY;

/** Instantes de referência (relativos a T0) para os filtros de período. */
const MOMENTO = {
  inicio: T0,
  dia30: T0 + 30 * DAY,
  dia40: T0 + 40 * DAY,
  dia90: T0 + 90 * DAY,
  dia100: T0 + 100 * DAY,
};

function makeSample(
  overrides: Partial<TimeToHireSample> = {},
): TimeToHireSample {
  return {
    jobId: "j1",
    studentId: "s1",
    days: DIAS_PADRAO,
    filledAt: T0,
    ...overrides,
  };
}

const jobIds = (samples: TimeToHireSample[]) => samples.map((s) => s.jobId);

describe("timeToHireDays (S5-2, CA 1 — cálculo em dias)", () => {
  it.each([
    ["dias inteiros entre candidatura e preenchimento", T0 + 3 * DAY, T0, 3],
    // 2,5 dias → 3 dias completos decorridos (parcial conta).
    ["dia parcial conta como dia completo (teto)", T0 + 2.5 * DAY, T0, 3],
    ["menos de um dia arredonda para 1 (não zera)", T0 + HOUR, T0, 1],
    [
      "datas inconsistentes (preenchimento antes da candidatura) viram 0",
      T0 - DAY,
      T0,
      0,
    ],
  ])("%s", (_cenario, filledAt, appliedAt, esperado) => {
    expect(timeToHireDays(filledAt, appliedAt)).toBe(esperado);
  });
});

describe("hireSamples (S5-2 — pareamento candidatura aprovada × vaga preenchida)", () => {
  it("cria amostra para aprovação em vaga preenchida", () => {
    const filledAt = T0 + DIAS_PADRAO * DAY;
    const samples = hireSamples(
      [{ jobId: "j1", filledAt }],
      [{ jobId: "j1", studentId: "s1", appliedAt: T0 }],
    );
    expect(samples).toEqual([
      { jobId: "j1", studentId: "s1", days: DIAS_PADRAO, filledAt },
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
      [{ jobId: "j1", filledAt: T0 + CINCO_DIAS }],
      [
        { jobId: "j1", studentId: "s1", appliedAt: T0 },
        { jobId: "j1", studentId: "s2", appliedAt: T0 + DAY },
      ],
    );
    expect(samples.map((s) => s.studentId).sort()).toEqual(["s1", "s2"]);
  });

  it("vaga preenchida sem aprovação não gera amostra", () => {
    const samples = hireSamples([{ jobId: "j1", filledAt: T0 + CINCO_DIAS }], []);
    expect(samples).toEqual([]);
  });
});

describe("filterSamplesByPeriod (S5-2 — agregado por período)", () => {
  const samples = [
    makeSample({ jobId: "a", filledAt: MOMENTO.inicio }),
    makeSample({ jobId: "b", filledAt: MOMENTO.dia40 }),
    makeSample({ jobId: "c", filledAt: MOMENTO.dia100 }),
  ];

  it("sem filtros retorna todas as amostras", () => {
    expect(jobIds(filterSamplesByPeriod(samples, {}))).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["início (inclusivo)", { from: MOMENTO.dia40 }, ["b", "c"]],
    ["fim (inclusivo)", { to: MOMENTO.dia40 }, ["a", "b"]],
    [
      "faixa completa",
      { from: MOMENTO.dia30, to: MOMENTO.dia90 },
      ["b"],
    ],
  ])("filtra por %s", (_cenario, periodo, esperados) => {
    expect(jobIds(filterSamplesByPeriod(samples, periodo))).toEqual(esperados);
  });
});

describe("averageTimeToHire (S5-2, CA 1 — agregação correta)", () => {
  it.each([
    ["sem amostras: null (não há contratação para medir)", [], null],
    ["média simples de uma amostra", [10], 10],
    ["média arredondada para inteiro (7,5 → 8)", [10, 5], 8],
    ["média de três amostras (10+5+3)/3 = 6", [10, 5, 3], 6],
  ] satisfies Array<[string, number[], number | null]>)(
    "%s",
    (_cenario, days, esperado) => {
      const samples = days.map((d) => makeSample({ days: d }));
      expect(averageTimeToHire(samples)).toBe(esperado);
    },
  );
});

describe("formatTimeToHire (S5-2, CA 2 — exibição)", () => {
  it.each([
    ["null (sem dados) vira travessão", null, "—"],
    ["valor em dias com sufixo", 12, "12 dias"],
    ["singular para um dia", 1, "1 dia"],
  ] satisfies Array<[string, number | null, string]>)(
    "%s",
    (_cenario, valor, esperado) => {
      expect(formatTimeToHire(valor)).toBe(esperado);
    },
  );
});