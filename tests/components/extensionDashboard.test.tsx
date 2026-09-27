/**
 * [S7-4] Testes de COMPONENTE do painel gestor de extensão.
 *
 * CA 1 — contagens por área/status visíveis; CA 2 — filtros combináveis
 * (área, status, período) que atualizam as métricas reativamente.
 * Consistência visual com o Painel Operacional da S5 (KPI cards,
 * barras, tokens UNICAP).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    extensionProjects: {
      listProjects: "query:extensionProjects.listProjects",
    },
  },
}));

import { useQuery } from "convex/react";
import { ExtensionDashboard } from "../../src/components/extension/ExtensionDashboard";

const mockedUseQuery = vi.mocked(useQuery);

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function project(
  title: string,
  area: string,
  active: boolean,
  createdAt: number,
) {
  return {
    title,
    description: "Descrição suficiente para o painel do gestor.",
    area,
    targetAudience: "Comunidade acadêmica",
    coordinatorId: "jx00000000000000000000000a",
    createdAt,
    statusChangedAt: createdAt,
    active,
    _id: `id-${title}`,
    _creationTime: createdAt,
  };
}

const DB_ROWS = [
  project("Projeto A de Extensão", "educacao", true, NOW - 2 * DAY),
  project("Projeto B de Extensão", "saude", true, NOW - 20 * DAY),
  project("Projeto C de Extensão", "educacao", false, NOW - 40 * DAY),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown, _args: unknown) =>
    query === "query:extensionProjects.listProjects"
      ? DB_ROWS
      : undefined) as never);
});

describe("ExtensionDashboard — painel gestor (S7-4)", () => {
  it("CA 1 — exibe KPIs de status (total, ativos, não ativos)", () => {
    render(<ExtensionDashboard />);

    expect(
      screen.getByRole("heading", { name: /extensão/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-ativo")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-inativo")).toHaveTextContent("1");
  });

  it("CA 1 — exibe contagens por área temática (barras)", () => {
    render(<ExtensionDashboard />);

    expect(screen.getByTestId("area-bar-educacao")).toHaveTextContent("2");
    expect(screen.getByTestId("area-bar-saude")).toHaveTextContent("1");
  });

  it("CA 2 — filtro de área atualiza as métricas (combinável)", async () => {
    render(<ExtensionDashboard />);

    await userEvent.selectOptions(screen.getByLabelText(/^área$/i), "saude");

    expect(screen.getByTestId("area-bar-saude")).toHaveTextContent("1");
    expect(screen.queryByTestId("area-bar-educacao")).toBeNull();
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("1");
  });

  it("CA 2 — filtro de status atualiza as métricas", async () => {
    render(<ExtensionDashboard />);

    await userEvent.selectOptions(
      screen.getByLabelText(/status do projeto/i),
      "inativo",
    );

    expect(screen.getByTestId("kpi-total")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-inativo")).toHaveTextContent("1");
    // Projeto C é educacao inativo: a barra de educação permanece.
    expect(screen.getByTestId("area-bar-educacao")).toHaveTextContent("1");
    expect(screen.queryByTestId("area-bar-saude")).toBeNull();
  });

  it("CA 2 — período restringe por createdAt", async () => {
    render(<ExtensionDashboard />);

    await userEvent.selectOptions(screen.getByLabelText(/período/i), "30");

    expect(screen.getByTestId("area-bar-educacao")).toHaveTextContent("1");
    expect(screen.getByTestId("area-bar-saude")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("2");
  });

  it("estado vazio quando os filtros não retornam projetos", async () => {
    render(<ExtensionDashboard />);

    await userEvent.selectOptions(screen.getByLabelText(/^área$/i), "trabalho");

    expect(screen.getByText(/nenhum projeto no filtro/i)).toBeInTheDocument();
  });

  // —— [S7-5] Backfill de cobertura de ramos da UI ——

  it("[S7-5] estado de carregamento mantém o layout estável", () => {
    mockedUseQuery.mockReturnValue(undefined);
    render(<ExtensionDashboard />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /carregando painel de extensão/i,
    );
    expect(screen.queryByTestId("kpi-total")).toBeNull();
  });

  it("[S7-5] Limpar filtros restaura as métricas completas", async () => {
    render(<ExtensionDashboard />);

    await userEvent.selectOptions(screen.getByLabelText(/^área$/i), "saude");
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("1");
    expect(screen.getByTestId("clear-extension-filters")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("clear-extension-filters"));

    expect(screen.getByTestId("kpi-total")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-ativo")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-inativo")).toHaveTextContent("1");
  });
});
