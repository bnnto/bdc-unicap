/**
 * [FIX_PADDING_AND_LAYOUT_CRITICAL] Regra de ouro: TODO container com
 * `border` / fundo de card precisa de padding (p-6) para que nenhum
 * texto, input ou botão toque fisicamente na borda.
 *
 * Causa raiz: o componente partilhado `ui/Card` (border + bg-white +
 * shadow) NÃO tinha padding — o título e o conteúdo de todas as telas
 * (Dashboard, Minhas Vagas, Pipeline Kanban) batiam na linha. Corrigir o
 * Card propaga respiro a todo o app de uma vez.
 *
 * Reforços pontuais: card do aluno no Banco de Talentos (p-6), cards de
 * vaga (p-6), barra de filtros do Painel Operacional (p-6) e gap-6 entre
 * as secções do formulário de vaga.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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

import { useQuery, useMutation } from "convex/react";
import { Card } from "../../src/components/ui/card";
import { JobsPanel } from "../../src/components/recruiter/JobsPanel";
import { JobForm } from "../../src/components/recruiter/JobForm";
import { OperationalPanel } from "../../src/components/recruiter/operational/OperationalPanel";
import { TalentSearchPage } from "../../src/components/recruiter/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const job = {
  _id: "job-1",
  title: "Estágio em Desenvolvimento Web",
  description: "Descrição longa o suficiente para o card.",
  contractType: "estagio" as const,
  salaryMin: 1500,
  salaryMax: 2000,
  location: "Recife/PE",
  status: "aberta" as const,
  publishedAt: Date.now(),
  expiresAt: Date.now(),
  prerequisites: [{ item: "SQL", required: true }],
  recruiterId: "r1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:jobs.getMyJobs") return [job];
    if (query === "query:operational.operationalSummary") {
      return {
        jobs: { open: 1, closed: 0, filled: 0, total: 1 },
        applications: {
          total: 0,
          inProgress: 0,
          finalized: 0,
          approved: 0,
          rejected: 0,
          byStage: {
            inscrito: 0,
            triagem: 0,
            entrevista: 0,
            aprovado: 0,
            reprovado: 0,
          },
        },
        employability: { rate: 0, label: "0%", approved: 0, rejected: 0 },
      };
    }
    if (query === "query:students.searchTalent") {
      return {
        items: [
          {
            studentId: "s1",
            fullName: "Maria da Silva",
            course: "CC",
            status: "ativo" as const,
            graduationYear: 2026,
            semester: 8,
            location: "Recife/PE",
            availability: ["estagio"] as ["estagio"],
            summary: "Resumo",
            skills: ["SQL"],
            languages: [],
            headline: null,
            contactAllowed: false,
            linkedinUrl: null,
            portfolioUrl: null,
          },
        ],
        total: 1,
        page: 0,
        pageCount: 1,
        hasNext: false,
        hasPrev: false,
      };
    }
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation(
    () => vi.fn().mockResolvedValue({ ok: true }) as never,
  );
});

describe("Regra de ouro — componente partilhado Card com padding", () => {
  it("Card (ui) aplica p-6 para o conteúdo nunca tocar na borda", () => {
    render(<Card title="Título">Conteúdo</Card>);
    // Causa raiz: o Card global não tinha padding — todas as telas sufocavam.
    expect(screen.getByTestId("card")).toHaveClass("p-6");
  });

  it("o mesmo vale com acento (border-l-4) — continua com p-6", () => {
    render(
      <Card title="Título" accent="primary">
        x
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("p-6", "border-l-primary");
  });
});

describe("Etapa 1 — Dashboard (Painel Operacional) com respiro", () => {
  it("barra de filtros do painel tem p-6 (não colada às bordas)", () => {
    render(<OperationalPanel />);
    const filters = screen.getByTestId("dashboard-filters");
    expect(filters).toHaveClass("p-6");
  });

  it("cards 'Taxa de Empregabilidade' etc. herdam p-6 do Card", () => {
    render(<OperationalPanel />);
    const card = screen
      .getByText("Taxa de Empregabilidade")
      .closest("[data-testid=card]");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("p-6");
  });
});

describe("Etapa 2 — Banco de Talentos com respiro", () => {
  it("card do aluno tem p-6 (avatar/botões não batem na borda)", () => {
    render(<TalentSearchPage />);
    const article = screen.getByText("Maria da Silva").closest("article");
    expect(article).not.toBeNull();
    expect(article).toHaveClass("p-6");
  });
});

describe("Etapa 3 — Formulário de vaga com espaçamento", () => {
  it("form usa gap-6 (secções espaçadas, não esmagadas)", () => {
    const { container } = render(<JobForm initial={null} onDone={vi.fn()} />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toHaveClass("gap-6");
  });

  it("secções 'Sobre a vaga' e 'Contrato' mantêm padding generoso (p-8)", () => {
    render(<JobForm initial={null} onDone={vi.fn()} />);
    for (const name of ["Sobre a vaga", "Contrato & Remuneração"]) {
      const section = screen.getByRole("group", { name: new RegExp(name) });
      expect(section).toHaveClass("p-8");
    }
  });
});

describe("Etapa 4 — Minhas Vagas com respiro", () => {
  it("wrapper 'Minhas vagas' herda p-6 do Card", () => {
    render(<JobsPanel />);
    const wrapper = screen
      .getByText("Minhas vagas")
      .closest("[data-testid=card]");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("p-6");
  });

  it("card individual da vaga tem p-6 (conteúdo não colado)", () => {
    render(<JobsPanel />);
    const card = screen
      .getByText("Estágio em Desenvolvimento Web")
      .closest("li");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("p-6");
  });
});
