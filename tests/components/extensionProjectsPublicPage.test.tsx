/**
 * [S7-3] Testes de COMPONENTE da página pública de projetos ativos.
 *
 * CA 1 — página pública responsiva com projetos ativos; CA 2 — nenhum
 * dado restrito exposto (a view já chega sanitizada do servidor; a UI
 * só renderiza os campos públicos). R9 — sem autenticação.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    extensionProjects: {
      listPublicProjects: "query:extensionProjects.listPublicProjects",
    },
  },
}));

import { useQuery } from "convex/react";
import { ExtensionProjectsPublicPage } from "../../src/components/extension/ExtensionProjectsPublicPage";

const mockedUseQuery = vi.mocked(useQuery);

const PUBLIC_PROJECT = {
  title: "Escola de Verão de Computação para Escolas Públicas",
  description:
    "Oficinas de programação para estudantes de escolas públicas do Recife.",
  area: "educacao",
  targetAudience: "Estudantes do ensino médio da rede pública",
  createdAt: 1_750_000_000_000,
  statusChangedAt: 1_750_000_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExtensionProjectsPublicPage — divulgação pública (R9)", () => {
  it("CA 1 — renderiza os projetos ativos com título, área e público-alvo", () => {
    mockedUseQuery.mockReturnValue([PUBLIC_PROJECT] as never);
    render(<ExtensionProjectsPublicPage />);

    expect(
      screen.getByRole("heading", { name: /projetos de extensão/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Escola de Verão de Computação/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Educação")).toBeInTheDocument();
    expect(screen.getByText(/Estudantes do ensino médio/i)).toBeInTheDocument();
  });

  it("CA 1 — estado vazio orientador quando não há projetos ativos", () => {
    mockedUseQuery.mockReturnValue([] as never);
    render(<ExtensionProjectsPublicPage />);

    expect(screen.getByText(/nenhum projeto ativo/i)).toBeInTheDocument();
  });

  it("CA 2 — NUNCA renderiza dado restrito mesmo se vier na resposta", () => {
    mockedUseQuery.mockReturnValue([
      { ...PUBLIC_PROJECT, coordinatorId: "jx00000000000000000000000a" },
    ] as never);
    render(<ExtensionProjectsPublicPage />);

    expect(screen.queryByText(/jx00000000000000000000000a/)).toBeNull();
  });

  it("CA 1 — CTA orienta o visitante para o acesso autenticado", () => {
    mockedUseQuery.mockReturnValue([] as never);
    render(<ExtensionProjectsPublicPage />);

    expect(
      screen.getByRole("link", { name: /entrar no portal/i }),
    ).toHaveAttribute("href", "/");
  });

  it("CA 1 — lista usa marcação semântica acessível", () => {
    mockedUseQuery.mockReturnValue([PUBLIC_PROJECT] as never);
    render(<ExtensionProjectsPublicPage />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
