import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: (_target, moduleName) =>
        new Proxy(
          {},
          {
            get: (_inner, fnName) =>
              `query:${String(moduleName)}.${String(fnName)}`,
          },
        ),
    },
  ),
}));

import { useQuery } from "convex/react";
import { ManagerDashboard } from "../../src/components/manager/ManagerDashboard";

const mockedUseQuery = vi.mocked(useQuery);

const SUMMARY = {
  jobs: { open: 12, closed: 4, filled: 9, total: 25 },
  applications: {
    total: 64,
    inProgress: 22,
    finalized: 42,
    approved: 27,
    rejected: 15,
    byStage: {
      inscrito: 22,
      triagem: 9,
      entrevista: 6,
      aprovado: 0,
      reprovado: 0,
    },
  },
  employability: { rate: 64, label: "64%", approved: 27, rejected: 15 },
};

const TTH = {
  averageDays: 21,
  label: "21 dias",
  samplesCount: 9,
  facets: { courses: [], companies: [] },
};

const FUNNEL = {
  steps: [
    {
      stage: "inscrito",
      label: "Inscrito",
      count: 64,
      conversionFromPrevious: null,
    },
    {
      stage: "triagem",
      label: "Em Triagem",
      count: 31,
      conversionFromPrevious: 48,
    },
    {
      stage: "entrevista",
      label: "Entrevista",
      count: 17,
      conversionFromPrevious: 55,
    },
    {
      stage: "aprovado",
      label: "Aprovado",
      count: 9,
      conversionFromPrevious: 53,
    },
  ],
  totalApplications: 64,
};

// [GESTOR_BACKEND] Insights Estratégicos — agregações reais (gestor-only).
const REJECTIONS = {
  total: 38,
  rows: [
    {
      reason: "requisitos_obrigatorios",
      label: "Requisitos obrigatórios",
      count: 18,
      percent: 47,
    },
    {
      reason: "formacao_incompativel",
      label: "Formação incompatível",
      count: 11,
      percent: 29,
    },
  ],
};

const SKILLS_RADAR = [
  { skill: "React", demand: 42, supply: 31 },
  { skill: "SQL", demand: 35, supply: 28 },
  { skill: "Python", demand: 30, supply: 26 },
];

const ENGAGEMENT = { total: 148, incompleteProfiles: 37, noResume: 58 };

function mockQueries() {
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:operational.operationalSummary") return SUMMARY;
    if (query === "query:operational.timeToHireStats") return TTH;
    if (query === "query:operational.pipelineFunnel") return FUNNEL;
    if (query === "query:students.talentPoolCount") return { total: 148 };
    if (query === "query:manager.getRejectionInsights") return REJECTIONS;
    if (query === "query:manager.getSkillsRadar") return SKILLS_RADAR;
    if (query === "query:manager.getEngagementMetrics") return ENGAGEMENT;
    return undefined;
  }) as never);
}

describe("REFACTOR_GESTOR — Painel Estratégico (Etapa 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
  });

  it("header com o título do painel e botões de exportação à direita", () => {
    render(<ManagerDashboard />);
    expect(
      screen.getByRole("heading", {
        name: /painel estratégico de carreiras & empregabilidade/i,
      }),
    ).toBeInTheDocument();
    const actions = screen.getByRole("group", {
      name: /exportações do painel/i,
    });
    expect(
      within(actions).getByRole("button", { name: /exportar relatório pdf/i }),
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole("button", { name: /exportar planilha/i }),
    ).toBeInTheDocument();
  });

  it("barra de filtros com cursos, semestre e botão Atualizar", () => {
    render(<ManagerDashboard />);
    expect(
      screen.getByRole("combobox", { name: /curso/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /semestre/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^atualizar$/i }),
    ).toBeInTheDocument();
  });

  it("4 KPIs no topo com dados reais quando disponíveis", () => {
    render(<ManagerDashboard />);
    expect(screen.getByTestId("kpi-oportunidades")).toHaveTextContent("12");
    expect(screen.getByTestId("kpi-empregabilidade")).toHaveTextContent("64%");
    expect(screen.getByTestId("kpi-tempo-contratacao")).toHaveTextContent("21");
    expect(screen.getByTestId("kpi-talentos")).toHaveTextContent("148");
  });

  it("funil de conversão com as 4 etapas e barras horizontais", () => {
    render(<ManagerDashboard />);
    const funnel = screen.getByTestId("manager-funnel");
    expect(within(funnel).getByText(/funil de conversão/i)).toBeInTheDocument();
    for (const label of ["Inscrito", "Em Triagem", "Entrevista", "Aprovado"]) {
      expect(within(funnel).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(funnel).getByTestId("funnel-bar-inscrito"),
    ).toBeInTheDocument();
  });

  it("empregabilidade por curso com barras ranqueadas", () => {
    render(<ManagerDashboard />);
    const section = screen.getByTestId("manager-course-employability");
    const bars = within(section).getAllByTestId(/^course-bar-/);
    expect(bars.length).toBeGreaterThan(3);
  });

  it("tabela de empresas parceiras com colunas do plano", () => {
    render(<ManagerDashboard />);
    const table = screen.getByRole("table", {
      name: /empresas parceiras/i,
    });
    const headers = Array.from(
      table.querySelector("thead")?.querySelectorAll("th") ?? [],
    ).map((th) => th.textContent);
    expect(headers).toEqual([
      "Empresa",
      "Vagas Publicadas",
      "Contratados",
      "Status",
    ]);
  });

  it("insights estratégicos: reprovações, radar de competências e termômetro", () => {
    render(<ManagerDashboard />);
    expect(
      screen.getByTestId("manager-insight-rejections"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("manager-insight-skillgaps")).toBeInTheDocument();
    expect(
      screen.getByTestId("manager-insight-engagement"),
    ).toBeInTheDocument();
    // Termômetro exibe os contadores do engajamento.
    const engagement = screen.getByTestId("manager-insight-engagement");
    expect(
      within(engagement).getByText(/perfil incompleto/i),
    ).toBeInTheDocument();
    expect(within(engagement).getByText(/sem currículo/i)).toBeInTheDocument();
  });

  it("seções ainda mockadas (curso/parceiras) mantêm o badge de exemplo", () => {
    render(<ManagerDashboard />);
    // [GESTOR_BACKEND] apenas empregabilidade por curso e empresas
    // parceiras permanecem de exemplo; os insights agora são reais.
    expect(screen.getAllByText(/dados de exemplo/i)).toHaveLength(2);
    for (const testId of [
      "manager-insight-rejections",
      "manager-insight-skillgaps",
      "manager-insight-engagement",
    ]) {
      expect(
        within(screen.getByTestId(testId)).queryByText(/dados de exemplo/i),
      ).toBeNull();
    }
  });

  it("insights estratégicos exibem os dados reais das queries do gestor", () => {
    render(<ManagerDashboard />);
    const rejections = screen.getByTestId("manager-insight-rejections");
    expect(
      within(rejections).getByText(/requisitos obrigatórios/i),
    ).toBeInTheDocument();
    expect(within(rejections).getByText("47%")).toBeInTheDocument();

    const radar = screen.getByTestId("manager-insight-skillgaps");
    expect(within(radar).getByText(/42 pedem · 31 têm/i)).toBeInTheDocument();

    const engagement = screen.getByTestId("manager-insight-engagement");
    expect(within(engagement).getByText("37")).toBeInTheDocument();
    expect(within(engagement).getByText("58")).toBeInTheDocument();
  });

  it("estado de carregamento dos KPIs antes das queries chegarem", () => {
    mockedUseQuery.mockReturnValue(undefined);
    render(<ManagerDashboard />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
