/**
 * [UX-P2] H1-1 — Feedback de pending nas ações da vaga: enquanto a
 * mutation está em voo, os botões de ação ficam desabilitados (evita
 * cliques duplicados e corridas). Reabrir usado como ação observada.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      myJobs: "query:jobs.myJobs",
      setJobStatus: "mut:jobs.setJobStatus",
      renewJob: "mut:jobs.renewJob",
    },
  },
}));

import { useQuery, useMutation } from "convex/react";
import { JobsPanel } from "../../src/components/recruiter/JobsPanel";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const DAY = 24 * 60 * 60 * 1000;

const closedJob = {
  _id: "job-1",
  _creationTime: 0,
  recruiterId: "r1",
  title: "Estágio em Desenvolvimento Web",
  description: "Apoio no desenvolvimento web.",
  prerequisites: [],
  contractType: "estagio",
  status: "fechada",
  publishedAt: Date.now(),
  expiresAt: Date.now() + 20 * DAY,
} as unknown as Doc<"jobs">;

const setJobStatus = vi.fn().mockResolvedValue({ ok: true });
const renewJob = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:jobs.myJobs" ? [closedJob] : undefined) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:jobs.setJobStatus" ? setJobStatus : renewJob) as never);
});

describe("JobsPanel — pending nas ações da vaga (H1-1)", () => {
  it("durante a mutation os botões de ação ficam desabilitados", async () => {
    let resolveStatus: (value: unknown) => void = () => {};
    setJobStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );

    render(<JobsPanel />);

    const reopen = screen.getByRole("button", { name: "Reabrir" });
    await userEvent.click(reopen);

    expect(reopen).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Renovar (30 dias)" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();

    resolveStatus({ ok: true });
  });

  it("após a conclusão os botões voltam a habilitar", async () => {
    render(<JobsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Renovar (30 dias)" }),
      ).toBeEnabled();
    });
    expect(setJobStatus).toHaveBeenCalledOnce();
  });
});
