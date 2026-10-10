/**
 * [RECRUITER_UX_UPGRADE] Master-Detail na aba "Vagas & Pipeline":
 *
 * - A página mostra SÓ a lista de vagas (o Kanban deixa de ficar empilhado
 *   no fundo da página).
 * - O botão "Ver Candidatos" de cada vaga troca a tela inteira para o
 *   Kanban daquela vaga (busca já com a vaga selecionada).
 * - Botão "Voltar para Minhas Vagas" retorna à lista.
 * - JobsPanel standalone (sem a prop) permanece sem o botão — o uso em
 *   testes/páginas isoladas não muda de comportamento.
 *
 * `convex/react` e `convex/_generated/api` são mockados com sentinelas
 * estáveis (a api gerada usa proxies).
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
    render(<RecruiterJobsPage />);

    expect(screen.getByText("Minhas vagas")).toBeInTheDocument();
    // O board (Kanban) não é buscado nem renderizado até escolher a vaga.
    expect(screen.queryByRole("region", { name: /^Em Triagem/ })).toBeNull();
    expect(mockedUseQuery).not.toHaveBeenCalledWith(
      "query:applications.jobBoard",
      expect.anything(),
    );
  });

  it("'Ver Candidatos' troca a tela para o Kanban daquela vaga", async () => {
    render(<RecruiterJobsPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /ver candidatos/i }),
    );

    // A tela inteira vira o pipeline da vaga escolhida.
    expect(
      await screen.findByRole("region", { name: /^Em Triagem/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Minhas vagas")).toBeNull();
    expect(mockedUseQuery).toHaveBeenCalledWith("query:applications.jobBoard", {
      jobId: "job-1",
    });
  });

  it("'Voltar para Minhas Vagas' retorna à lista e fecha o Kanban", async () => {
    render(<RecruiterJobsPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /ver candidatos/i }),
    );
    await screen.findByRole("region", { name: /^Em Triagem/ });

    await userEvent.click(
      screen.getByRole("button", { name: /voltar para minhas vagas/i }),
    );

    expect(screen.getByText("Minhas vagas")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Em Triagem/ })).toBeNull();
  });
});
