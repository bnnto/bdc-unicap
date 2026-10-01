/**
 * [REFACTOR_ALUNO Etapa 3] — Mural de Oportunidades estilo LinkedIn:
 * busca por cargo/skill, filtros (contrato, localidade, salário), cards
 * detalhados com destaque do Percentual de Compatibilidade (R8, score
 * vindo do servidor) e candidatura em um clique.
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    applications: {
      openJobs: "query:applications.openJobs",
      myApplications: "query:applications.myApplications",
      applyToJob: "mut:applications.applyToJob",
      acceptProcess: "mut:applications.acceptProcess",
      revokeProcessAcceptance: "mut:applications.revokeProcessAcceptance",
    },
    students: {
      myProfile: "query:students.myProfile",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { JobOpportunities } from "../../src/components/student/JobOpportunities";

/** Cards filhos diretos do feed (ignora li's aninhados de pré-requisitos). */
function cardsOf(feed: HTMLElement): HTMLElement[] {
  const cards: HTMLElement[] = [];
  for (const child of feed.children) {
    if (child instanceof HTMLLIElement) cards.push(child);
  }
  return cards;
}

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const applyToJob = vi.fn().mockResolvedValue({ matchScore: 88 });

const ESTAGIO = {
  _id: "job-1",
  title: "Estágio em Desenvolvimento Web",
  description:
    "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
  prerequisites: [{ item: "React", required: true }],
  contractType: "estagio",
  salaryMin: 1500,
  salaryMax: 2200,
  location: "Recife, PE",
  status: "aberta",
  matchScore: 88,
  publishedAt: 2000,
};

const CLT = {
  _id: "job-2",
  title: "Analista de Dados Jr",
  description: "Dashboards em Power BI e SQL para a coordenação de cursos.",
  prerequisites: [{ item: "SQL", required: true }],
  contractType: "clt",
  salaryMin: 3200,
  salaryMax: 4800,
  location: "Olinda, PE",
  status: "aberta",
  matchScore: 41,
  publishedAt: 1000,
};

const PROFILE = {
  _id: "s1",
  fullName: "Maria da Silva",
  skills: ["React"],
  availability: "estagio",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:applications.openJobs") return [ESTAGIO, CLT];
    if (query === "query:applications.myApplications") return [];
    if (query === "query:students.myProfile") return PROFILE;
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:applications.applyToJob"
      ? applyToJob
      : vi.fn().mockResolvedValue({})) as never);
});

describe("Mural estilo LinkedIn — filtros (Etapa 3.2)", () => {
  it("busca por cargo/skill + filtros de contrato, localidade e salário", () => {
    render(<JobOpportunities />);
    expect(
      screen.getByRole("searchbox", { name: /buscar vagas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /tipo de contrato/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /localidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /salário mínimo/i }),
    ).toBeInTheDocument();
  });

  it("listagem em cards detalhados (título, contrato, salário, local)", () => {
    render(<JobOpportunities />);
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const cards = cardsOf(feed);
    expect(cards).toHaveLength(2);

    const first = cards[0]!;
    expect(
      within(first).getByText("Estágio em Desenvolvimento Web"),
    ).toBeInTheDocument();
    expect(within(first).getByText(/R\$ 1\.500/)).toBeInTheDocument();
    expect(within(first).getByText(/Recife, PE/)).toBeInTheDocument();
    // Rótulo exato do contrato (o título da vaga também contém "Estágio").
    expect(
      within(first).getByText("Estágio", { exact: true }),
    ).toBeInTheDocument();
  });

  it("busca filtra o feed em tempo real", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<JobOpportunities />);
    await userEvent.type(
      screen.getByRole("searchbox", { name: /buscar vagas/i }),
      "analista",
    );
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const cards = cardsOf(feed);
    expect(cards).toHaveLength(1);
    expect(
      within(cards[0]!).getByText("Analista de Dados Jr"),
    ).toBeInTheDocument();
  });

  it("filtro de contrato esconde vagas de outro tipo", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<JobOpportunities />);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /tipo de contrato/i }),
      "clt",
    );
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    expect(cardsOf(feed)).toHaveLength(1);
    expect(within(feed).getByText("Analista de Dados Jr")).toBeInTheDocument();
  });

  it("salário mínimo esconde vagas abaixo do piso", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<JobOpportunities />);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /salário mínimo/i }),
      "3000",
    );
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const cards = cardsOf(feed);
    expect(cards).toHaveLength(1);
    expect(
      within(cards[0]!).getByText("Analista de Dados Jr"),
    ).toBeInTheDocument();
  });
});

describe("Mural estilo LinkedIn — destaque de compatibilidade (Etapa 3.4)", () => {
  it("cada card destaca o percentual de compatibilidade", () => {
    render(<JobOpportunities />);
    expect(screen.getByText("88% de compatibilidade")).toBeInTheDocument();
    expect(screen.getByText("41% de compatibilidade")).toBeInTheDocument();
  });

  it("o percentual vem do servidor em openJobs (R8)", () => {
    render(<JobOpportunities />);
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const cards = cardsOf(feed);
    expect(
      within(cards[0]!).getByLabelText(/compatibilidade de 88%/i),
    ).toBeInTheDocument();
  });
});

describe("Mural estilo LinkedIn — candidatura e pré-requisitos", () => {
  it("candidatura em um clique com feedback de sucesso", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<JobOpportunities />);
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const card = cardsOf(feed)[0]!;
    await userEvent.click(
      within(card).getByRole("button", { name: /candidatar-se/i }),
    );
    expect(applyToJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /candidatura registrada/i,
    );
  });

  it("pré-requisito obrigatório não atendido bloqueia com aviso claro", () => {
    mockedUseQuery.mockImplementation(((query: unknown) => {
      if (query === "query:applications.openJobs")
        return [
          { ...ESTAGIO, prerequisites: [{ item: "COBOL", required: true }] },
        ];
      if (query === "query:applications.myApplications") return [];
      if (query === "query:students.myProfile")
        return { ...PROFILE, skills: ["React"] };
      return undefined;
    }) as never);
    render(<JobOpportunities />);
    const feed = screen.getByRole("list", { name: /vagas encontradas/i });
    const card = cardsOf(feed)[0]!;
    expect(within(card).getByRole("alert")).toHaveTextContent(
      /requisito obrigatório não atendido: COBOL/i,
    );
    expect(
      within(card).getByRole("button", { name: /candidatar-se/i }),
    ).toBeDisabled();
  });
});
