/**
 * [UX-P1] H3-1 — Ações destrutivas de vaga exigem confirmação.
 * "Encerrar" é permanente (sem reabertura) e "Fechar" impede candidaturas:
 * ambas precisam de confirmação inline (Confirmar/Cancelar) ANTES de
 * chamar a mutation. "Reabrir" é reversível e permanece direta.
 *
 * `convex/react` e `convex/_generated/api` são mockados: a api gerada usa
 * proxies (cada acesso cria referência nova), então sentinelas estáveis
 * garantem a identidade entre teste e componente.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";

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
      setJobStatus: "mut:jobs.setJobStatus",
      renewJob: "mut:jobs.renewJob",
    },
  },
}));

import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { JobsPanel } from "../../src/components/recruiter/JobsPanel";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const DAY = 24 * 60 * 60 * 1000;

const job = {
  _id: "job-1",
  _creationTime: 0,
  recruiterId: "r1",
  title: "Estágio em Desenvolvimento Web",
  description: "Apoio no desenvolvimento web.",
  prerequisites: [],
  contractType: "estagio",
  status: "aberta",
  publishedAt: Date.now(),
  expiresAt: Date.now() + 20 * DAY,
} as unknown as Doc<"jobs">;

const setJobStatus = vi.fn().mockResolvedValue({ ok: true });
const renewJob = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === api.jobs.getMyJobs ? [job] : undefined) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === api.jobs.setJobStatus ? setJobStatus : renewJob) as never);
});

describe("JobsPanel — confirmação antes de fechar/encerrar (H3-1)", () => {
  it("Encerrar abre confirmação e só chama a mutation após Confirmar", async () => {
    render(<JobsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Encerrar" }));

    // A mutation NÃO é chamada direto — aparece a confirmação inline.
    expect(setJobStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: /confirmar encerramento/i,
    });
    expect(dialog).toHaveTextContent(/permanente/i);

    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar mudança de status" }),
    );
    expect(setJobStatus).toHaveBeenCalledOnce();
    expect(setJobStatus).toHaveBeenCalledWith({
      jobId: "job-1",
      status: "encerrada",
    });
  });

  it("Cancelar no encerramento não altera a vaga", async () => {
    render(<JobsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(setJobStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: /confirmar encerramento/i }),
    ).toBeNull();
  });

  it("Fechar também exige confirmação (ação impede novas candidaturas)", async () => {
    render(<JobsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(setJobStatus).not.toHaveBeenCalled();
    screen.getByRole("dialog", { name: /confirmar fechamento/i });

    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar mudança de status" }),
    );
    expect(setJobStatus).toHaveBeenCalledWith({
      jobId: "job-1",
      status: "fechada",
    });
  });

  it("H9-1 — erro de status vira toast amigável, não bloco na vaga", async () => {
    setJobStatus.mockRejectedValueOnce(
      new Error("Você só pode alterar as suas próprias vagas."),
    );

    render(<JobsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar mudança de status" }),
    );

    expect(toast.error).toHaveBeenCalledWith(
      "Você só pode alterar as suas próprias vagas.",
    );
    const item = screen
      .getByText("Estágio em Desenvolvimento Web")
      .closest("li");
    expect(item).not.toBeNull();
    expect(
      within(item as HTMLElement).queryByRole("alert"),
    ).not.toBeInTheDocument();
  });

  it("Reabrir (reversível) continua direto, sem confirmação", async () => {
    const closedJob = { ...job, status: "fechada" } as unknown as Doc<"jobs">;
    mockedUseQuery.mockImplementation(((query: unknown) =>
      query === api.jobs.getMyJobs ? [closedJob] : undefined) as never);

    render(<JobsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(setJobStatus).toHaveBeenCalledOnce();
    expect(setJobStatus).toHaveBeenCalledWith({
      jobId: "job-1",
      status: "aberta",
    });
  });
});
