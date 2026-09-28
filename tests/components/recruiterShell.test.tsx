import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES, ROLE_LABELS, type Role } from "../../src/lib/roles";
import { AuthStateContext } from "../../src/components/auth/authContext";
import App from "../../src/App";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:students.searchTalent"
      ? TALENT_FIXTURE
      : undefined) as never);
});

/**
 * [REFACTOR_UI] Etapa 1 — o papel "empresa" foi descontinuado: a fonte
 * única ROLES/ROLE_LABELS não pode mais expor a opção no cadastro.
 */
describe("REFACTOR_UI — papel 'empresa' descontinuado (fonte única)", () => {
  it("ROLES contém apenas aluno, recrutador e gestor", () => {
    expect(ROLES).toEqual(["aluno", "recrutador", "gestor"]);
  });

  it("ROLE_LABELS não tem a entrada 'empresa'", () => {
    expect(ROLE_LABELS).not.toHaveProperty("empresa");
    expect(ROLE_LABELS.recrutador).toBe("Recrutador");
  });

  it("papéis de recrutador seguem válidos para o cast de contexto", () => {
    const allowed: Role[] = ["recrutador", "gestor"];
    expect(allowed).toHaveLength(2);
  });
});

/**
 * [REFACTOR_UI] Etapa 2 — shell com Navbar de abas: as três telas do
 * recrutador ficam em renderização condicional (uma visível por vez),
 * com tabs acessíveis (landmarks e hierarquia preservados).
 */
function renderAppAuthenticated() {
  return render(
    <AuthStateContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: true,
        user: {
          _id: "u1" as never,
          name: "Recrutador Exemplo",
          email: "recrutador@unicap.br",
          role: "recrutador",
          _creationTime: 0,
        },
        role: "recrutador",
      }}
    >
      <App />
    </AuthStateContext.Provider>,
  );
}

describe("REFACTOR_UI — Navbar de abas do recrutador (App)", () => {
  it("exibe navbar com 3 abas: Dashboard, Banco de Talentos, Vagas & Pipeline", () => {
    renderAppAuthenticated();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const tabs = within(nav).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Dashboard de Métricas",
      "Banco de Talentos",
      "Vagas & Pipeline",
    ]);
  });

  it("aba ativa tem aria-selected=true e o painel correspondente é o único visível", () => {
    renderAppAuthenticated();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const [dashboard, talentos, vagas] = within(nav).getAllByRole("tab");
    expect(dashboard).toHaveAttribute("aria-selected", "true");
    expect(talentos).toHaveAttribute("aria-selected", "false");
    expect(vagas).toHaveAttribute("aria-selected", "false");

    const panel = screen.getByRole("tabpanel", {
      name: "Dashboard de Métricas",
    });
    expect(panel).toBeInTheDocument();
    expect(
      screen.queryByRole("tabpanel", { name: "Banco de Talentos" }),
    ).toBeNull();
    expect(
      screen.queryByRole("tabpanel", { name: "Vagas & Pipeline" }),
    ).toBeNull();
  });

  it("clicar em 'Banco de Talentos' troca o painel visível", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAppAuthenticated();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const tabs = within(nav).getAllByRole("tab");
    const talentos = tabs[1];
    if (talentos === undefined) throw new Error("aba ausente");
    await userEvent.click(talentos);

    expect(talentos).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tabpanel", { name: "Banco de Talentos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tabpanel", { name: "Dashboard de Métricas" }),
    ).toBeNull();
  });

  it("clicar em 'Vagas & Pipeline' troca o painel visível", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAppAuthenticated();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const tabs = within(nav).getAllByRole("tab");
    const vagas = tabs[2];
    if (vagas === undefined) throw new Error("aba ausente");
    await userEvent.click(vagas);

    expect(vagas).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tabpanel", { name: "Vagas & Pipeline" }),
    ).toBeInTheDocument();
  });
});

/**
 * [REFACTOR_UI] Etapa 3 — Banco de Talentos com a estrutura da referência:
 * busca larga com contagem + Limpar à direita; layout de duas colunas
 * (sidebar de filtros + conteúdo com Ordenar por); grid de cards 2
 * colunas; paginação centralizada no rodapé.
 */
const TALENT_FIXTURE = {
  items: [
    {
      studentId: "s1",
      fullName: "Maria da Silva",
      course: "Ciência da Computação",
      status: "ativo",
      graduationYear: 2026,
      semester: 8,
      location: "Recife/PE",
      availability: "estagio",
      summary:
        "Aluno ativo · Ciência da Computação · 8º semestre (conclusão 2026)",
      skills: ["React", "SQL"],
      languages: [{ name: "Inglês", level: "intermediario" }],
      headline: null,
      contactAllowed: true,
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

describe("REFACTOR_UI — tela Banco de Talentos (referência visual)", () => {
  it("barra de busca superior larga com contagem 'Estudantes Disponíveis' e botão Limpar à direita", () => {
    render(<TalentSearchPage />);
    expect(
      screen.getByRole("searchbox", { name: /buscar talentos/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/estudantes disponíveis/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^limpar$/i }),
    ).toBeInTheDocument();
  });

  it("sidebar com grupos de filtros e dropdown 'Ordenar por' no conteúdo", () => {
    render(<TalentSearchPage />);
    expect(
      screen.getByRole("group", { name: /área & curso/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /previsão de conclusão/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /competências/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /ordenar por/i }),
    ).toBeInTheDocument();
  });

  it("cards em grid de 2 colunas com ações 'Visualizar Perfil & CV' e 'Convidar'", () => {
    render(<TalentSearchPage />);
    const grid = screen.getByRole("list", { name: /talentos encontrados/i });
    expect(grid).toHaveClass("grid", "lg:grid-cols-2");
    const first = screen.getAllByRole("listitem")[0];
    if (first === undefined) throw new Error("card ausente");
    expect(
      within(first).getByRole("button", {
        name: /visualizar perfil & cv/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(first).getByRole("button", { name: /convidar/i }),
    ).toBeInTheDocument();
  });

  it("paginação centralizada no rodapé", () => {
    render(<TalentSearchPage />);
    const pag = screen.getByRole("navigation", {
      name: /paginação de resultados/i,
    });
    expect(pag.className).toContain("justify-center");
  });
});
