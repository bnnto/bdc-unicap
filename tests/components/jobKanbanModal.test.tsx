/**
 * [RECRUITER_WORKFLOW] Etapa 4.3 — Modal de Reprovação: mover um card
 * para "Reprovado" (drop, seta → ou botão Reprovar) abre um DIÁLOGO
 * modal com select de motivo padronizado (R5). A mutation
 * `rejectApplication` só é disparada DEPOIS de escolher o motivo; o
 * botão de confirmar fica bloqueado sem motivo e o Cancelar fecha sem
 * efeito. `aria-modal` sinaliza o bloqueio do board ao leitor de tela.
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
      getMyJobs: "query:jobs.getMyJobs",
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
  stage: "entrevista",
  matchScore: 82,
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
  await userEvent.click(
    screen.getByRole("button", { name: "Estágio em Desenvolvimento Web" }),
  );
}

describe("JobKanban — modal de reprovação com motivo obrigatório (R5)", () => {
  it("drop na coluna Reprovado abre o diálogo modal (não move direto)", async () => {
    await renderBoard();

    const reprovadoColumn = screen.getByRole("region", {
      name: /^Reprovado/,
    });
    fireEvent.drop(reprovadoColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    expect(moveApplication).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: /reprovar candidatura/i,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByLabelText(/Motivo da reprovação \(obrigatório/i),
    ).toBeInTheDocument();
  });

  it("botão Reprovar do card abre o modal com o nome do candidato", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Reprovar Maria da Silva com motivo padronizado/i,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /reprovar candidatura/i,
    });
    expect(within(dialog).getByText(/Maria da Silva/i)).toBeInTheDocument();
  });

  it("sem motivo selecionado, confirmar fica bloqueado e nada é enviado", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Reprovar Maria da Silva com motivo padronizado/i,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: /reprovar candidatura/i,
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Confirmar reprovação com o motivo selecionado",
    });
    expect(confirm).toBeDisabled();
    expect(rejectApplication).not.toHaveBeenCalled();
  });

  it("após escolher o motivo, confirma e o modal fecha", async () => {
    await renderBoard();

    const reprovadoColumn = screen.getByRole("region", {
      name: /^Reprovado/,
    });
    fireEvent.drop(reprovadoColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    const dialog = screen.getByRole("dialog", {
      name: /reprovar candidatura/i,
    });
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/Motivo da reprovação \(obrigatório/i),
      "idioma_insuficiente",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Confirmar reprovação com o motivo selecionado",
      }),
    );

    expect(rejectApplication).toHaveBeenCalledOnce();
    expect(rejectApplication).toHaveBeenCalledWith({
      applicationId: "app-1",
      reason: "idioma_insuficiente",
    });
    expect(moveApplication).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: /reprovar candidatura/i }),
    ).not.toBeInTheDocument();
  });

  it("cancelar fecha o modal sem chamar nenhuma mutation", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Reprovar Maria da Silva com motivo padronizado/i,
      }),
    );
    await userEvent.click(
      within(
        screen.getByRole("dialog", { name: /reprovar candidatura/i }),
      ).getByRole("button", { name: /^cancelar$/i }),
    );

    expect(
      screen.queryByRole("dialog", { name: /reprovar candidatura/i }),
    ).not.toBeInTheDocument();
    expect(rejectApplication).not.toHaveBeenCalled();
    expect(moveApplication).not.toHaveBeenCalled();
  });
});
