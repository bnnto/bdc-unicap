/**
 * [UX-P3] Polimento: H6-2 (idade da candidatura no card do Kanban),
 * H1-4 (skeleton das seções do painel) e H4-2 (empty state da busca de
 * talentos orienta o próximo passo).
 */
import { fireEvent, render, screen } from "@testing-library/react";
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
    operational: {
      operationalSummary: "query:operational.operationalSummary",
      timeToHireStats: "query:operational.timeToHireStats",
      pipelineFunnel: "query:operational.pipelineFunnel",
      activeRankings: "query:operational.activeRankings",
    },
    students: {
      searchTalent: "query:students.searchTalent",
    },
  },
}));

import { useQuery, useMutation } from "convex/react";
import { JobKanban } from "../../src/components/recruiter/JobKanban";
import { OperationalPanel } from "../../src/components/operational/OperationalPanel";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const DAY = 24 * 60 * 60 * 1000;

const job = { _id: "job-1", title: "Estágio em Desenvolvimento Web" };

const boardApplication = {
  applicationId: "app-1",
  studentId: "s1",
  fullName: "Maria da Silva",
  course: "Ciência da Computação",
  stage: "triagem",
  matchScore: 75,
  appliedAt: Date.now() - 3 * DAY,
  contactReleased: false,
  releaseReason: "sem_autorizacao",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMutation.mockImplementation(
    () => vi.fn().mockResolvedValue({}) as never,
  );
});

describe("JobKanban — idade da candidatura (H6-2)", () => {
  it("card mostra quando o candidato se inscreveu (reconhecimento)", async () => {
    mockedUseQuery.mockImplementation(((query: unknown, args: unknown) => {
      if (query === "query:jobs.myJobs") return [job];
      if (query === "query:applications.jobBoard") {
        return args === undefined
          ? undefined
          : { job, items: [boardApplication] };
      }
      return undefined;
    }) as never);

    render(<JobKanban />);
    await userEvent.click(
      screen.getByRole("button", { name: "Estágio em Desenvolvimento Web" }),
    );

    const card = screen.getByText("Maria da Silva").closest("article");
    expect(card).toHaveTextContent(/candidatou-se em \d{2}\/\d{2}\/\d{4}/i);
  });
});

describe("OperationalPanel — skeleton das seções (H1-4)", () => {
  it("seções em carregamento exibem blocos pulsantes, mantendo o layout", () => {
    mockedUseQuery.mockImplementation(((query: unknown) => {
      // Summary carregado; demais métricas ainda carregando.
      if (query === "query:operational.operationalSummary") {
        return {
          jobs: { open: 2, closed: 1, filled: 1, total: 4 },
          applications: {
            total: 5,
            inProgress: 3,
            finalized: 2,
            approved: 1,
            rejected: 1,
            byStage: {
              inscrito: 2,
              triagem: 1,
              entrevista: 0,
              aprovado: 1,
              reprovado: 1,
            },
          },
          employability: { rate: 50, label: "50%", approved: 1, rejected: 1 },
        };
      }
      return undefined;
    }) as never);

    render(<OperationalPanel />);

    // TTH/funil/rankings em carga: blocos pulsantes (skeletons).
    const pulses = document.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(3);
    // E não há texto "…" solto nas seções.
    expect(screen.queryByText(/carregando funil…/i)).toBeNull();
  });

  it("após o carregamento, as métricas substituem os skeletons", () => {
    mockedUseQuery.mockImplementation(((query: unknown) => {
      if (query === "query:operational.operationalSummary") {
        return {
          jobs: { open: 2, closed: 1, filled: 1, total: 4 },
          applications: {
            total: 5,
            inProgress: 3,
            finalized: 2,
            approved: 1,
            rejected: 1,
            byStage: {
              inscrito: 2,
              triagem: 1,
              entrevista: 0,
              aprovado: 1,
              reprovado: 1,
            },
          },
          employability: { rate: 50, label: "50%", approved: 1, rejected: 1 },
        };
      }
      if (query === "query:operational.timeToHireStats") {
        return {
          averageDays: 12,
          label: "12 dias",
          samplesCount: 2,
          facets: { courses: ["CC"], companies: ["Alpha"] },
        };
      }
      if (query === "query:operational.pipelineFunnel") {
        return {
          steps: [
            {
              stage: "inscrito",
              label: "Inscrito",
              count: 2,
              conversionFromPrevious: null,
            },
            {
              stage: "triagem",
              label: "Em Triagem",
              count: 1,
              conversionFromPrevious: 50,
            },
            {
              stage: "entrevista",
              label: "Entrevista",
              count: 0,
              conversionFromPrevious: 0,
            },
            {
              stage: "aprovado",
              label: "Aprovado",
              count: 1,
              conversionFromPrevious: 100,
            },
          ],
          totalApplications: 4,
        };
      }
      if (query === "query:operational.activeRankings") {
        return {
          limit: 5,
          topCompanies: [],
          topJobs: [],
        };
      }
      return undefined;
    }) as never);

    render(<OperationalPanel />);

    // Métrica carregada substitui o skeleton do TTH.
    expect(screen.getByText("12 dias")).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});

describe("TalentSearchPage — empty state orientado (H4-2)", () => {
  it("busca sem resultados explica e sugere ação de desmarcar filtros", () => {
    mockedUseQuery.mockReturnValue({
      items: [],
      page: 0,
      total: 0,
      hasNext: false,
      hasPrev: false,
    });

    render(<TalentSearchPage />);

    expect(screen.getByText(/nenhum talento encontrado/i)).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: /limpar filtros/i });
    fireEvent.click(cta);
    // Após limpar, o filtro de idioma volta ao estado vazio.
    expect(screen.getByLabelText("Idioma")).toHaveValue("");
  });
});
