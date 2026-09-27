/**
 * [S7-4] Regras puras do painel gestor de extensão — TDD.
 *
 * CA 1 — contagens por área/status; CA 2 — filtros combináveis (área,
 * status, período) que atualizam as métricas de forma consistente.
 * Mesma filosofia do S5 (operationalPanel/dashboardFilters): arquivo
 * puro, sem I/O, consumido pela UI e reutilizável por queries.
 */
import { describe, expect, it } from "vitest";
import {
  countByArea,
  countByStatus,
  filterProjectsForDashboard,
  normalizeExtensionFilters,
  summarizeProjects,
  type ExtensionDashboardFilters,
  type ExtensionProjectRow,
} from "../../src/lib/extensionDashboard";

const T0 = 1_700_000_000_000;

function row(overrides: Partial<ExtensionProjectRow>): ExtensionProjectRow {
  return {
    title: "Projeto de Extensão Exemplo",
    area: "educacao",
    active: true,
    createdAt: T0,
    ...overrides,
  };
}

const ROWS: ExtensionProjectRow[] = [
  row({ title: "A", area: "educacao", active: true, createdAt: T0 }),
  row({
    title: "B",
    area: "saude",
    active: false,
    createdAt: T0 + 10 * 24 * 60 * 60 * 1000,
  }),
  row({
    title: "C",
    area: "educacao",
    active: true,
    createdAt: T0 + 40 * 24 * 60 * 60 * 1000,
  }),
  row({
    title: "D",
    area: "cultura",
    active: true,
    createdAt: T0 + 100 * 24 * 60 * 60 * 1000,
  }),
  row({
    title: "E",
    area: "saude",
    active: true,
    createdAt: T0 + 200 * 24 * 60 * 60 * 1000,
  }),
];

describe("[S7-4] normalizeExtensionFilters", () => {
  it("remove ruído: trim, vazios e área inválida", () => {
    const filters = normalizeExtensionFilters({
      area: "  ",
      status: "todos",
      from: -5,
    });
    expect(filters).toEqual({});
  });

  it("aceita área do enum, status válido e período consistente", () => {
    const filters = normalizeExtensionFilters({
      area: "educacao",
      status: "ativo",
      from: T0,
      to: T0 + 1000,
    });
    expect(filters).toEqual({
      area: "educacao",
      status: "ativo",
      from: T0,
      to: T0 + 1000,
    });
  });

  it("período invertido (from > to) é descartado", () => {
    const filters = normalizeExtensionFilters({
      from: T0 + 1000,
      to: T0,
    });
    expect(filters).toEqual({});
  });
});

describe("[S7-4] filterProjectsForDashboard (filtros combináveis — CA 2)", () => {
  it("sem filtros devolve todas as linhas", () => {
    expect(filterProjectsForDashboard(ROWS, {})).toHaveLength(5);
  });

  it("filtro de área (combinável)", () => {
    const filtered = filterProjectsForDashboard(ROWS, { area: "educacao" });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((p) => p.area === "educacao")).toBe(true);
  });

  it("filtro de status (combinável)", () => {
    const filtered = filterProjectsForDashboard(ROWS, { status: "inativo" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.active).toBe(false);
  });

  it("área + status combinados", () => {
    const filtered = filterProjectsForDashboard(ROWS, {
      area: "saude",
      status: "ativo",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("E");
  });

  it("período por createdAt, limites inclusivos e combinável com área", () => {
    const filtered = filterProjectsForDashboard(ROWS, {
      from: T0,
      to: T0 + 40 * 24 * 60 * 60 * 1000,
      area: "educacao",
    });
    expect(filtered).toHaveLength(2);
    const last90 = filterProjectsForDashboard(ROWS, {
      from: Date.now() - 90 * 24 * 60 * 60 * 1000,
    });
    expect(
      last90.every((p) => p.createdAt >= Date.now() - 90 * 24 * 60 * 60 * 1000),
    ).toBe(true);
  });

  it("[S7-5] limite superior do período (to) é inclusivo e combinável", () => {
    // De T0+10d a T0+100d: B, C e D (limites inclusivos nos dois lados).
    const upTo = filterProjectsForDashboard(ROWS, {
      from: T0 + 10 * 24 * 60 * 60 * 1000,
      to: T0 + 100 * 24 * 60 * 60 * 1000,
    });
    expect(upTo.map((p) => p.title).sort()).toEqual(["B", "C", "D"]);
    // Combinado com área, restringe ainda mais (CA 2).
    const combined = filterProjectsForDashboard(ROWS, {
      from: T0,
      to: T0 + 100 * 24 * 60 * 60 * 1000,
      area: "educacao",
    });
    expect(combined.map((p) => p.title).sort()).toEqual(["A", "C"]);
  });
});

describe("[S7-4] contagens por área/status (CA 1)", () => {
  it("countByArea cobre as 8 áreas do RESGES (zeros incluídos)", () => {
    const counts = countByArea(ROWS);
    expect(Object.keys(counts)).toHaveLength(8);
    expect(counts["educacao"]).toBe(2);
    expect(counts["saude"]).toBe(2);
    expect(counts["cultura"]).toBe(1);
    expect(counts["comunicacao"]).toBe(0);
  });

  it("countByStatus separa ativos/não ativos; total é sempre a soma", () => {
    const counts = countByStatus(ROWS);
    expect(counts).toEqual({ ativo: 4, inativo: 1, total: 5 });
  });

  it("summarizeProjects devolve visão única (total, ativos, áreas com projeto)", () => {
    const summary = summarizeProjects(ROWS);
    expect(summary.total).toBe(5);
    expect(summary.ativo).toBe(4);
    expect(summary.areasWithProjects).toBe(3);
  });

  it("lista vazia: zeros consistentes, nunca NaN", () => {
    const counts = countByArea([]);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    expect(countByStatus([])).toEqual({ ativo: 0, inativo: 0, total: 0 });
    const summary = summarizeProjects([]);
    expect(summary.areasWithProjects).toBe(0);
  });

  it("métricas respeitam os filtros combináveis (CA 2 — consistência)", () => {
    const filters: ExtensionDashboardFilters = {
      area: "educacao",
      status: "ativo",
    };
    const filtered = filterProjectsForDashboard(ROWS, filters);
    expect(countByArea(filtered)["educacao"]).toBe(2);
    expect(countByStatus(filtered)).toEqual({ ativo: 2, inativo: 0, total: 2 });
  });
});
