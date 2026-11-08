import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// logo abaixo dos outros vi.mock(...), antes dos imports dos componentes
vi.mock("../../src/lib/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/router")>();
  return { ...actual, navigateTo: vi.fn() };
});

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      getMyJobs: "query:jobs.getMyJobs",
      setJobStatus: "mut:jobs.setJobStatus",
      renewJob: "mut:jobs.renewJob",
    },
    applications: {
      jobBoard: "query:applications.jobBoard",
      moveApplication: "mut:applications.moveApplication",
      rejectApplication: "mut:applications.rejectApplication",
      trackProfileView: "mut:applications.trackProfileView",
    },
  },
}));

import { navigateTo, portalPath } from "../../src/lib/router";
import { useQuery, useMutation } from "convex/react";
import { RecruiterJobsPage } from "../../src/components/recruiter/RecruiterJobsPage";
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

const boardApplication = {
  applicationId: "app-1",
  studentId: "s1",
  fullName: "Maria da Silva",
  course: "Ciência da Computação",
  stage: "triagem" as const,
  matchScore: 82,
  appliedAt: Date.now(),
  contactReleased: false,
  releaseReason: "sem_autorizacao" as const,
};

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
  mockedUseMutation.mockImplementation(
    () => vi.fn().mockResolvedValue({ ok: true }) as never,
  );
});

describe("JobsPanel — ação 'Ver Candidatos' (Master-Detail)", () => {
  it("sem a prop onViewCandidates, o painel standalone não exibe o botão", () => {
    render(<JobsPanel />);
    expect(
      screen.queryByRole("button", { name: /ver candidatos/i }),
    ).toBeNull();
  });

  it("com a prop, cada vaga ganha 'Ver Candidatos' e devolve o id da vaga", async () => {
    const onViewCandidates = vi.fn();
    render(<JobsPanel onViewCandidates={onViewCandidates} />);

    await userEvent.click(
      screen.getByRole("button", { name: /ver candidatos/i }),
    );

    expect(onViewCandidates).toHaveBeenCalledOnce();
    expect(onViewCandidates).toHaveBeenCalledWith("job-1");
  });
});

describe("RecruiterJobsPage — Master-Detail (lista ⇄ Kanban)", () => {
  it("a página abre SÓ com a lista de vagas (sem Kanban escondido no fluxo)", () => {
    render(<RecruiterJobsPage jobId={null} />);

    expect(screen.getByText("Minhas vagas")).toBeInTheDocument();
    // O board (Kanban) não é buscado nem renderizado até escolher a vaga.
    expect(screen.queryByRole("region", { name: /^Em Triagem/ })).toBeNull();
    expect(mockedUseQuery).not.toHaveBeenCalledWith(
      "query:applications.jobBoard",
      expect.anything(),
    );
  });

  it("'Ver Candidatos' navega para a vaga e a rota mostra o Kanban dela", async () => {
    const { rerender } = render(<RecruiterJobsPage jobId={null} />);

    await userEvent.click(
      screen.getByRole("button", { name: /ver candidatos/i }),
    );
    expect(navigateTo).toHaveBeenCalledWith(portalPath("vagas", "job-1"));

    // Simula o roteador entregando o jobId da nova rota.
    rerender(<RecruiterJobsPage jobId="job-1" />);

    expect(
      await screen.findByRole("region", { name: /^Em Triagem/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Minhas vagas")).toBeNull();
    expect(mockedUseQuery).toHaveBeenCalledWith("query:applications.jobBoard", {
      jobId: "job-1",
    });
  });

  it("'Voltar para Minhas Vagas' navega para a lista e fecha o Kanban", async () => {
    const { rerender } = render(<RecruiterJobsPage jobId="job-1" />);
    await screen.findByRole("region", { name: /^Em Triagem/ });

    await userEvent.click(
      screen.getByRole("button", { name: /voltar para minhas vagas/i }),
    );
    expect(navigateTo).toHaveBeenCalledWith(portalPath("vagas"));

    rerender(<RecruiterJobsPage jobId={null} />);

    expect(screen.getByText("Minhas vagas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Em Triagem/ })).toBeNull();
  });
});
