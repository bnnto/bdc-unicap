/**
 * [RECRUITER_UX_UPGRADE] Respiro visual do lado do recrutador:
 *
 * - Colunas do Kanban com altura limitada + scroll vertical interno:
 *   muitos candidatos na mesma etapa não partem o ecrã.
 * - Cards dos candidatos com padding generoso e ações espaçadas
 *   (nada colado às bordas).
 * - Filtros do Banco de Talentos com respiro entre o texto e a seta do
 *   dropdown (padding à direita em todos os selects).
 * - Métricas do Painel Operacional com padding generoso e ícone lucide.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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
    operational: {
      operationalSummary: "query:operational.operationalSummary",
    },
    students: {
      searchTalent: "query:students.searchTalent",
    },
  },
}));

import { useQuery, useMutation } from "convex/react";
import { JobKanban } from "../../src/components/recruiter/JobKanban";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";
import { OperationalPanel } from "../../src/components/operational/OperationalPanel";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const job = { _id: "job-1", title: "Estágio em Desenvolvimento Web" };

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

async function renderBoard(initialJobId?: string) {
  if (initialJobId !== undefined) {
    render(<JobKanban initialJobId={initialJobId} />);
    return;
  }
  render(<JobKanban />);
  await userEvent.click(
    screen.getByRole("button", { name: "Estágio em Desenvolvimento Web" }),
  );
}

describe("JobKanban — colunas com scroll vertical (muitos candidatos)", () => {
  it("todas as colunas têm altura limitada e scroll interno", async () => {
    await renderBoard("job-1");

    const columns = screen.getAllByRole("region");
    expect(columns.length).toBeGreaterThanOrEqual(5);
    for (const column of columns) {
      expect(column.className).toMatch(/max-h-/);
      expect(
        column.querySelector(".overflow-y-auto"),
        "coluna sem container de scroll vertical",
      ).not.toBeNull();
    }
  });

  it("card do candidato tem padding generoso e ações espaçadas (sem colar)", async () => {
    await renderBoard("job-1");

    const card = screen.getByText("Maria da Silva").closest("article");
    expect(card).not.toBeNull();
    if (card === null) return;
    expect(card).toHaveClass("p-4");

    const actions = within(card).getByRole("button", {
      name: "Ver Perfil",
    }).parentElement;
    expect(actions).not.toBeNull();
    expect(actions?.className).toContain("flex-wrap");
    expect(actions?.className).toMatch(/gap-/);
  });
});

describe("JobKanban — fluxo Master-Detail (initialJobId + onBack)", () => {
  it("com initialJobId abre direto no board (sem passar pelo seletor de vagas)", async () => {
    await renderBoard("job-1");

    expect(
      screen.getByRole("region", { name: /^Em Triagem/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Estágio em Desenvolvimento Web" }),
    ).toBeNull();
  });

  it("com onBack exibe 'Voltar para Minhas Vagas' e devolve o clique", async () => {
    const onBack = vi.fn();
    render(<JobKanban initialJobId="job-1" onBack={onBack} />);

    await userEvent.click(
      screen.getByRole("button", { name: /voltar para minhas vagas/i }),
    );

    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("TalentSearchPage — filtros com respiro (seta do dropdown)", () => {
  it("todos os selects têm padding à direita para a seta não encavalitar no texto", () => {
    mockedUseQuery.mockReturnValue({
      items: [],
      page: 0,
      total: 0,
      hasNext: false,
      hasPrev: false,
    });

    render(<TalentSearchPage />);

    const selects = document.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select).toHaveClass("pr-9");
    }
  });
});

describe("OperationalPanel — métricas com respiro e ícone", () => {
  it("cards de métrica com padding generoso e ícone lucide", () => {
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
      return undefined;
    }) as never);

    render(<OperationalPanel />);

    const kpi = document.querySelector("div.text-center.shadow-level1");
    expect(kpi).not.toBeNull();
    expect(kpi).toHaveClass("p-6");
    expect(kpi?.querySelector("svg.lucide")).not.toBeNull();
  });
});
