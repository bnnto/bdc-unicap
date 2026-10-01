/**
 * [REFACTOR_ALUNO Etapa 4] — Aba "Minhas Candidaturas" com feedback
 * claro: KPIs, etapa atual destacada (badge + timeline), mensagem de
 * status por etapa e motivo de reprovação amigável (R5) quando
 * "Reprovado". Também concentra o controle LGPD de contato por vaga
 * (R6 — aceite/revogação).
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    applications: {
      myApplications: "query:applications.myApplications",
      acceptProcess: "mut:applications.acceptProcess",
      revokeProcessAcceptance: "mut:applications.revokeProcessAcceptance",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { MyApplicationsPage } from "../../src/components/student/MyApplicationsPage";

/** Cards filhos diretos da lista (ignora li's da timeline interna). */
function cardsOf(list: HTMLElement): HTMLElement[] {
  const cards: HTMLElement[] = [];
  for (const child of list.children) {
    if (child instanceof HTMLLIElement) cards.push(child);
  }
  return cards;
}

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const acceptProcess = vi.fn().mockResolvedValue({ ok: true });
const revokeProcessAcceptance = vi.fn().mockResolvedValue({ ok: true });

const APPLICATIONS = [
  {
    applicationId: "app-1",
    jobId: "job-1",
    jobTitle: "Estágio em Desenvolvimento Web",
    jobStatus: "aberta",
    stage: "entrevista",
    matchScore: 88,
    appliedAt: Date.now() - 1000,
    processAccepted: false,
    rejectionReason: null,
  },
  {
    applicationId: "app-2",
    jobId: "job-2",
    jobTitle: "Estágio em Suporte",
    jobStatus: "fechada",
    stage: "reprovado",
    matchScore: 35,
    appliedAt: Date.now() - 5000,
    processAccepted: true,
    rejectionReason: "requisitos_obrigatorios",
  },
  {
    applicationId: "app-3",
    jobId: "job-3",
    jobTitle: "Bolsista PIBIC",
    jobStatus: "aberta",
    stage: "inscrito",
    matchScore: 70,
    appliedAt: Date.now(),
    processAccepted: false,
    rejectionReason: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:applications.myApplications"
      ? APPLICATIONS
      : undefined) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:applications.acceptProcess"
      ? acceptProcess
      : revokeProcessAcceptance) as never);
});

describe("Minhas Candidaturas — feedback da etapa atual (Etapa 4.2)", () => {
  it("exibe badge da etapa e timeline com a etapa atual marcada", () => {
    render(<MyApplicationsPage />);
    const list = screen.getByRole("list", { name: /todas as candidaturas/i });
    const cards = cardsOf(list);
    expect(cards).toHaveLength(3);

    const entrevista = cards[1]!; // ordenação por appliedAt desc: inscrito primeiro
    expect(
      within(entrevista).getAllByText("Entrevista").length,
    ).toBeGreaterThan(0);
    const timeline = within(entrevista).getByRole("list", {
      name: /etapa atual: entrevista/i,
    });
    const current = within(timeline).getByText("Entrevista");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("mensagem de status clara por candidatura (o que aconteceu/esperar)", () => {
    render(<MyApplicationsPage />);
    expect(screen.getAllByText(/candidatura enviada/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/etapa de entrevista/i).length).toBeGreaterThan(
      0,
    );
  });

  it("KPIs de visão geral (total, em andamento, melhor match)", () => {
    render(<MyApplicationsPage />);
    expect(screen.getByText("3")).toBeInTheDocument(); // total
    expect(screen.getByText("88%")).toBeInTheDocument(); // melhor match
    expect(screen.getByText(/em andamento/i)).toBeInTheDocument();
  });
});

describe("Minhas Candidaturas — reprovação amigável (Etapa 4.3)", () => {
  it("reprovado mostra motivo padronizado + conselho do que melhorar", () => {
    render(<MyApplicationsPage />);
    expect(screen.getByText(/não foi desta vez/i)).toBeInTheDocument();
    // Rótulo padronizado + conselho citam os requisitos (múltiplas menções).
    expect(
      screen.getAllByText(/requisitos obrigatórios/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/competências/i)).toBeInTheDocument();
  });

  it("candidatura sem reprovação não mostra bloco de motivo", () => {
    render(<MyApplicationsPage />);
    const list = screen.getByRole("list", { name: /todas as candidaturas/i });
    const inscrito = cardsOf(list)[0]!;
    expect(within(inscrito).queryByText(/não foi desta vez/i)).toBeNull();
  });

  it("processo encerrado sem motivo padronizado cai em feedback genérico", () => {
    mockedUseQuery.mockImplementation(((query: unknown) =>
      query === "query:applications.myApplications"
        ? [
            {
              ...APPLICATIONS[1]!,
              rejectionReason: null,
            },
          ]
        : undefined) as never);
    render(<MyApplicationsPage />);
    expect(screen.getByText(/processo encerrado/i)).toBeInTheDocument();
  });
});

describe("Minhas Candidaturas — controle de contato LGPD (R6)", () => {
  it("libera contato na candidatura sem aceite e revoga no que aceitou", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<MyApplicationsPage />);

    const liberar = screen.getByRole("button", {
      name: /liberar contato para .*estágio em desenvolvimento web/i,
    });
    await userEvent.click(liberar);
    expect(acceptProcess).toHaveBeenCalledWith({ applicationId: "app-1" });

    const revogar = screen.getByRole("button", {
      name: /revogar contato de .*estágio em suporte/i,
    });
    await userEvent.click(revogar);
    expect(revokeProcessAcceptance).toHaveBeenCalledWith({
      applicationId: "app-2",
    });
  });

  it("indica em texto quando o contato está liberado", () => {
    render(<MyApplicationsPage />);
    expect(screen.getAllByText(/contato liberado/i).length).toBeGreaterThan(0);
  });
});
