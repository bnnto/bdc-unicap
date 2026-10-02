/**
 * [UX_UPGRADE] Etapa 3 — Modais de validação no Kanban: mover um card
 * para "Entrevista" ou "Aprovado" é INTERCEPTADO antes de disparar a
 * mutation `moveApplication` para o Convex:
 *
 * - Entrevista: modal exige Data, Hora e Link/Local; a mutation só
 *   dispara após salvar, com os dados auditáveis.
 * - Contratação (Aprovado): modal exige a Data de Início Prevista.
 * - Rollback visual: cancelar (ou clicar no backdrop) NÃO dispara
 *   mutation — o card permanece na coluna de origem.
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
  studentId: "s1",
  fullName: "Maria da Silva",
  course: "Ciência da Computação",
  stage: "triagem" as
    "inscrito" | "triagem" | "entrevista" | "aprovado" | "reprovado",
  matchScore: 82,
  appliedAt: Date.now(),
  contactReleased: false,
  releaseReason: "sem_autorizacao",
};

/** Args tipados da mutation (evita `any` no lint ao inspecionar calls). */
type MoveArgs = {
  applicationId: string;
  to: "inscrito" | "triagem" | "entrevista" | "aprovado" | "reprovado";
  interviewDate?: number;
  interviewLink?: string;
  expectedStartDate?: number;
};

const moveApplication = vi
  .fn<(args: MoveArgs) => Promise<{ ok: boolean }>>()
  .mockResolvedValue({ ok: true });
const rejectApplication = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  // Cenário padrão: card em "Triagem" pronto para avançar.
  boardApplication.stage = "triagem";
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

describe("JobKanban — modal de Entrevista antes da mutation (Etapa 3)", () => {
  it("drop na coluna Entrevista abre o modal e NÃO move direto", async () => {
    await renderBoard();

    const entrevistaColumn = screen.getByRole("region", {
      name: /^Entrevista/,
    });
    fireEvent.drop(entrevistaColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    expect(moveApplication).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /agendar entrevista/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByLabelText(/Data da entrevista/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Hora da entrevista/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/Link ou local da entrevista/i),
    ).toBeInTheDocument();
  });

  it("seta → do card em Triagem abre o modal (teclado também intercepta)", async () => {
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

  it("sem preencher data, hora e link, salvar fica bloqueado", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: /agendar entrevista/i });
    const save = within(dialog).getByRole("button", {
      name: /salvar entrevista/i,
    });
    expect(save).toBeDisabled();
    expect(moveApplication).not.toHaveBeenCalled();
  });

  it("após salvar, dispara a mutation com data, hora (timestamp) e link", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: /agendar entrevista/i });
    fireEvent.change(within(dialog).getByLabelText(/Data da entrevista/i), {
      target: { value: "2026-03-02" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hora da entrevista/i), {
      target: { value: "14:30" },
    });
    fireEvent.change(
      within(dialog).getByLabelText(/Link ou local da entrevista/i),
      { target: { value: "https://meet.example.com/unicap-1" } },
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /salvar entrevista/i }),
    );

    expect(moveApplication).toHaveBeenCalledOnce();
    const args = moveApplication.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      applicationId: "app-1",
      to: "entrevista",
      interviewLink: "https://meet.example.com/unicap-1",
    });
    expect(args?.interviewDate).toBeTypeOf("number");
    expect(args?.interviewDate ?? 0).toBeGreaterThan(0);
    expect(
      screen.queryByRole("dialog", { name: /agendar entrevista/i }),
    ).not.toBeInTheDocument();
  });

  it("cancelar fecha o modal sem mutation e o card volta para a origem", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Entrevista",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: /agendar entrevista/i });
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^cancelar$/i }),
    );

    expect(
      screen.queryByRole("dialog", { name: /agendar entrevista/i }),
    ).not.toBeInTheDocument();
    expect(moveApplication).not.toHaveBeenCalled();
    // Rollback visual: a mutation nunca disparou — o card continua em Triagem.
    const triagemColumn = screen.getByRole("region", { name: /^Em Triagem/ });
    expect(
      within(triagemColumn).getByText("Maria da Silva"),
    ).toBeInTheDocument();
  });
});

describe("JobKanban — modal de Contratação antes da mutation (Etapa 3)", () => {
  beforeEach(() => {
    boardApplication.stage = "entrevista";
  });

  it("drop na coluna Aprovado abre o modal e NÃO move direto", async () => {
    await renderBoard();

    const aprovadoColumn = screen.getByRole("region", { name: /^Aprovado/ });
    fireEvent.drop(aprovadoColumn, {
      dataTransfer: { getData: () => "app-1" },
    });

    expect(moveApplication).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /confirmar contratação/i }),
    ).toBeInTheDocument();
  });

  it("sem data de início, confirmar fica bloqueado", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Aprovado",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirmar contratação/i,
    });
    expect(
      within(dialog).getByRole("button", { name: /confirmar contratação/i }),
    ).toBeDisabled();
    expect(moveApplication).not.toHaveBeenCalled();
  });

  it("após informar a data, dispara a mutation com o timestamp", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Aprovado",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /confirmar contratação/i,
    });
    fireEvent.change(
      within(dialog).getByLabelText(/Data de início prevista/i),
      {
        target: { value: "2026-04-01" },
      },
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /confirmar contratação/i }),
    );

    expect(moveApplication).toHaveBeenCalledOnce();
    const args = moveApplication.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      applicationId: "app-1",
      to: "aprovado",
    });
    expect(args?.expectedStartDate).toBeTypeOf("number");
    expect(args?.expectedStartDate ?? 0).toBeGreaterThan(0);
    expect(
      screen.queryByRole("dialog", { name: /confirmar contratação/i }),
    ).not.toBeInTheDocument();
  });

  it("cancelar a contratação não dispara mutation (rollback visual)", async () => {
    await renderBoard();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover Maria da Silva para Aprovado",
      }),
    );
    await userEvent.click(
      within(
        screen.getByRole("dialog", { name: /confirmar contratação/i }),
      ).getByRole("button", { name: /^cancelar$/i }),
    );

    expect(
      screen.queryByRole("dialog", { name: /confirmar contratação/i }),
    ).not.toBeInTheDocument();
    expect(moveApplication).not.toHaveBeenCalled();
    const entrevistaColumn = screen.getByRole("region", {
      name: /^Entrevista/,
    });
    expect(
      within(entrevistaColumn).getByText("Maria da Silva"),
    ).toBeInTheDocument();
  });
});
