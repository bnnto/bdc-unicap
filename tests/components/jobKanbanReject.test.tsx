/**
 * [UX-P1] H3-2/H5-1 — Reprovação NÃO pode acontecer sem motivo.
 * Arrastar um card até a coluna "Reprovado" (ou usar a seta → num card
 * em "Aprovado") deve abrir o painel de motivo padronizado (R5) em vez
 * de chamar `moveApplication` direto. Movimentos para outras colunas
 * permanecem imediatos.
 *
 * `convex/react` e `convex/_generated/api` são mockados (sentinelas
 * estáveis contra os proxies da api gerada do Convex).
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      myJobs: "query:jobs.myJobs",
    },
    applications: {
      jobBoard: "query:applications.jobBoard",
      moveApplication: "mut:applications.moveApplication",
      rejectApplication: "mut:applications.rejectApplication",
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
  studentId: "s1",
  fullName: "Maria da Silva",
  course: "Ciência da Computação",
  stage: "aprovado",
  matchScore: 90,
  appliedAt: Date.now(),
  contactReleased: false,
  releaseReason: "sem_autorizacao",
};

const moveApplication = vi.fn().mockResolvedValue({ ok: true });
const rejectApplication = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown, args: unknown) => {
    if (query === "query:jobs.myJobs") return [job];
    if (query === "query:applications.jobBoard") {
      return args === undefined
        ? undefined
        : { job, items: [boardApplication] };
    }
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:applications.moveApplication"
      ? moveApplication
      : rejectApplication) as never);
});

async function renderBoard() {
  render(<JobKanban />);
  // Seleciona a vaga na lista para abrir o board.
  await userEvent.click(
    screen.getByRole("button", { name: "Estágio em Desenvolvimento Web" }),
  );
}

describe("JobKanban — reprovação sempre com motivo (H3-2/H5-1)", () => {
  it("drop na coluna Reprovado abre o painel de motivo em vez de mover", async () => {
    await renderBoard();

    const reprovadoColumn = screen.getByRole("region", {
      name: /^Reprovado/,
    });
    fireEvent.drop(reprovadoColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    expect(moveApplication).not.toHaveBeenCalled();
    // Painel de motivo padronizado aberto para o card (R5).
    expect(
      screen.getByLabelText(/Motivo da reprovação \(obrigatório/i),
    ).toBeInTheDocument();
  });

  it("seta → num card em Aprovado abre o painel de motivo (não move direto)", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Reprovado",
      }),
    );

    expect(moveApplication).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(/Motivo da reprovação \(obrigatório/i),
    ).toBeInTheDocument();
  });

  it("H9-1 — erro de movimento aparece junto ao card, não no topo do board", async () => {
    moveApplication.mockRejectedValueOnce(
      new Error("O card já está nesta coluna."),
    );
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );

    const card = screen.getByText("Maria da Silva").closest("article");
    expect(card).not.toBeNull();
    const alert = within(card as HTMLElement).getByRole("alert");
    expect(alert).toHaveTextContent("O card já está nesta coluna.");
  });

  it("movimento para coluna de avanço (Entrevista) permanece imediato", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );

    expect(moveApplication).toHaveBeenCalledOnce();
    expect(moveApplication).toHaveBeenCalledWith({
      applicationId: "app-1",
      to: "entrevista",
    });
  });

  it("após escolher o motivo no painel aberto pelo drag, confirma a reprovação", async () => {
    await renderBoard();

    const reprovadoColumn = screen.getByRole("region", {
      name: /^Reprovado/,
    });
    fireEvent.drop(reprovadoColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    await userEvent.selectOptions(
      screen.getByLabelText(/Motivo da reprovação \(obrigatório/i),
      "vaga_preenchida",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Confirmar reprovação com o motivo selecionado",
      }),
    );

    expect(rejectApplication).toHaveBeenCalledOnce();
    expect(rejectApplication).toHaveBeenCalledWith({
      applicationId: "app-1",
      reason: "vaga_preenchida",
    });
    expect(moveApplication).not.toHaveBeenCalled();
  });
});
