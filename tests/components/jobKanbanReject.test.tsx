/**
 * [UX-P1] H3-2/H5-1 — Reprovação NÃO pode acontecer sem motivo.
 * Arrastar um card até a coluna "Reprovado" (ou usar a seta → num card
 * em "Aprovado") deve abrir o painel de motivo padronizado (R5) em vez
 * de chamar `moveApplication` direto. As colunas Entrevista e Aprovado
 * também abrem seus próprios modais de dados (ver jobKanbanProgression);
 * retrocessos simples permanecem imediatos.
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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      myJobs: "query:jobs.myJobs",
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
import { toast } from "sonner";
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
    if (query === "query:jobs.getMyJobs") return [job];
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

  it("H9-1 — erro de movimento vira toast amigável, não bloco no card", async () => {
    rejectApplication.mockRejectedValueOnce(
      new Error("O card já está nesta coluna."),
    );
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Reprovar Maria da Silva com motivo padronizado/i,
      }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/Motivo da reprovação \(obrigatório/i),
      "outro",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Confirmar reprovação com o motivo selecionado",
      }),
    );

    expect(toast.error).toHaveBeenCalledWith("O card já está nesta coluna.");
    const card = screen.getByText("Maria da Silva").closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).queryByRole("alert"),
    ).not.toBeInTheDocument();
  });

  it("mover para Entrevista abre o modal ANTES da mutation (Etapa 3)", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );

    expect(moveApplication).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /agendar entrevista/i }),
    ).toBeInTheDocument();
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
