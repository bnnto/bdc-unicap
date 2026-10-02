/**
 * [FINAL_UPGRADE Etapa 3] — Dashboard de Analytics do aluno na página
 * "Minhas Candidaturas": cards estilo SaaS com Taxa de Sucesso, Total,
 * Visualizações do Perfil, Média de Match e distribuição por etapa —
 * com os valores calculados NO SERVIDOR (applications.myStats).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    applications: {
      myApplications: "query:applications.myApplications",
      myStats: "query:applications.myStats",
      acceptProcess: "mut:applications.acceptProcess",
      revokeProcessAcceptance: "mut:applications.revokeProcessAcceptance",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { MyApplicationsPage } from "../../src/components/student/MyApplicationsPage";

const STATS = {
  total: 4,
  successRate: 50,
  byStage: {
    inscrito: 0,
    triagem: 1,
    entrevista: 1,
    aprovado: 1,
    reprovado: 1,
  },
  profileViews: 12,
  averageMatch: 65,
};

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:applications.myStats") return STATS;
    if (query === "query:applications.myApplications") return [];
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation((() => vi.fn()) as never);
});

describe("[FINAL_UPGRADE] Estatísticas do Meu Perfil (dashboard)", () => {
  it("exibe os cards com os valores calculados no backend", () => {
    render(<MyApplicationsPage />);

    const section = screen.getByRole("region", {
      name: /estatísticas do meu perfil/i,
    });
    expect(section).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument(); // taxa de sucesso
    expect(screen.getByText("12")).toBeInTheDocument(); // visualizações
    expect(screen.getByText("65%")).toBeInTheDocument(); // média de match
    expect(
      screen.getAllByText("4").length, // total (stats + KPI vazio não colide)
    ).toBeGreaterThan(0);
  });

  it("mostra a distribuição por etapa em chips", () => {
    render(<MyApplicationsPage />);
    expect(screen.getByText(/entrevista:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/aprovado:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/reprovado:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/inscrito:\s*0/i)).toBeInTheDocument();
  });

  it("enquanto carrega mostra traços, sem números inventados", () => {
    mockedUseQuery.mockImplementation(((query: unknown) => {
      if (query === "query:applications.myApplications") return [];
      return undefined; // myStats ainda carregando
    }) as never);
    render(<MyApplicationsPage />);

    const section = screen.getByRole("region", {
      name: /estatísticas do meu perfil/i,
    });
    expect(section).toHaveTextContent(/taxa de sucesso/i);
    expect(screen.queryByText("50%")).toBeNull();
    expect(screen.queryByText("12")).toBeNull();
  });
});
