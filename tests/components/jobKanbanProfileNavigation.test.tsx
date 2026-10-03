/**
 * [RECRUITER_VIEW_PROFILE] Integração no Kanban (spec Etapa 3): clicar
 * no NOME do candidato ou no botão "Ver Perfil" do card navega para a
 * rota dedicada `/recrutador/candidato/:studentId`. O card continua
 * arrastável (drag & drop) e navegável por teclado (setas).
 *
 * `convex/react` e `convex/_generated/api` são mockados (sentinelas
 * estáveis contra os proxies da api gerada do Convex).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      getMyJobs: "query:jobs.getMyJobs",
    },
    applications: {
      jobBoard: "query:applications.jobBoard",
      moveApplication: "mut:applications.moveApplication",
      rejectApplication: "mut:applications.rejectApplication",
      trackProfileView: "mut:applications.trackProfileView",
    },
  },
}));

import { useQuery, useMutation } from "convex/react";
import { JobKanban } from "../../src/components/recruiter/JobKanban";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const job = {
  _id: "job-1",
  title: "Estágio em Desenvolvimento Web",
};

const boardApplication = {
  applicationId: "app-1",
  studentId: "k57abc123",
  fullName: "Maria da Silva",
  course: "Ciência da Computação",
  stage: "inscrito",
  matchScore: 90,
  appliedAt: Date.now(),
  contactReleased: false,
  releaseReason: "sem_autorizacao",
};

beforeEach(() => {
  window.history.pushState({}, "", "/");
  mockedUseQuery.mockImplementation(((query: unknown, args: unknown) => {
    if (query === "query:jobs.getMyJobs") return [job];
    if (query === "query:applications.jobBoard") {
      return args === undefined
        ? undefined
        : { job, items: [boardApplication] };
    }
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation((() =>
    vi.fn().mockResolvedValue({ ok: true })) as never);
});

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.clearAllMocks();
});

async function renderBoard() {
  render(<JobKanban />);
  await userEvent.click(
    screen.getByRole("button", { name: "Estágio em Desenvolvimento Web" }),
  );
}

describe("JobKanban — clique no card abre o perfil do candidato (Etapa 3)", () => {
  it("clicar no NOME do candidato navega para /recrutador/candidato/:studentId", async () => {
    await renderBoard();

    const nome = screen.getByRole("button", {
      name: /ver perfil de maria da silva/i,
    });
    await userEvent.click(nome);

    expect(window.location.pathname).toBe("/recrutador/candidato/k57abc123");
  });

  it("botão 'Ver Perfil' navega para a mesma rota dedicada", async () => {
    await renderBoard();

    await userEvent.click(screen.getByRole("button", { name: "Ver Perfil" }));

    expect(window.location.pathname).toBe("/recrutador/candidato/k57abc123");
  });

  it("o card continua indicando drag & drop e teclado (UX da Etapa 3)", async () => {
    await renderBoard();

    const card = screen.getByRole("article", {
      name: /maria da silva.*setas do teclado/i,
    });
    expect(card).toHaveAttribute("draggable", "true");
    // Dica de uso atualizada no board.
    expect(
      screen.getByText(/clique no nome ou em ver perfil/i),
    ).toBeInTheDocument();
  });
});
