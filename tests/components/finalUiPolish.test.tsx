/**
 * [FINAL_UI_POLISH_AND_BUGFIX] Correções finais de UI do recrutador:
 *
 * Etapa 1 — Bug Cinza: o sistema de dark mode do projeto remapeia
 * utilidades sólidas (`.dark .bg-slate-50`, `.dark .bg-white`…); classes
 * COM opacidade (`bg-slate-50/60`) escapam ao remapeamento e ficam cinza
 * opaco no dark. As seções do formulário de vaga não podem usá-las.
 *
 * Etapa 2 — Navbar: cada aba do recrutador ganha um ícone lucide com
 * gap-2, sem alterar o texto acessível das abas.
 *
 * Etapas 3/4 — Respiro: métricas p-8, filtros com h-10, sidebar do Banco
 * de Talentos com p-6/gap-6 e cards do Kanban com p-5/gap-4.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStateContext } from "../../src/components/auth/authContext";

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
import App from "../../src/App";
import { JobForm } from "../../src/components/recruiter/JobForm";
import { OperationalPanel } from "../../src/components/operational/OperationalPanel";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";
import { EmptyState } from "../../src/components/ui/emptyState";
import { Inbox } from "lucide-react";

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockReturnValue(undefined);
});

/**
 * Classes de fundo CINZA com opacidade — invisíveis ao remapeamento de
 * dark do projeto (`.dark .bg-slate-50` não casa `bg-slate-50/60`), o
 * que deixa um bloco cinza opaco no tema escuro. Os tons de marca
 * (bg-primary/10 etc.) são padrão do app e estão fora do escopo.
 */
const OPACITY_BG = /bg-slate-\d+\/\d/;

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

describe("Etapa 1 — Bug Cinza no formulário Publicar Vaga (dark mode)", () => {
  it("nenhum campo/seção usa fundo cinza com opacidade (quebra o dark)", () => {
    const { container } = render(<JobForm initial={null} onDone={vi.fn()} />);

    const offenders = Array.from(container.querySelectorAll("[class]")).filter(
      (el) => OPACITY_BG.test(el.getAttribute("class") ?? ""),
    );
    expect(offenders.map((el) => el.getAttribute("class"))).toEqual([]);
  });

  it("seções usam fundo transparente (tema) e inputs continuam no sistema", () => {
    render(<JobForm initial={null} onDone={vi.fn()} />);

    for (const name of ["Sobre a vaga", "Contrato & Remuneração"]) {
      const section = screen.getByRole("group", { name: new RegExp(name) });
      expect(section).toHaveClass("bg-transparent");
    }
    // Textarea e inputs no sistema de tema (bg-white é remapeado no dark).
    const textarea = screen.getByLabelText(/Descrição/);
    expect(textarea).toHaveClass("bg-white");
    expect(textarea).not.toHaveClass("bg-slate-900");
  });

  it("EmptyState também está livre do cinza com opacidade", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Título" description="Descrição" />,
    );

    const offenders = Array.from(container.querySelectorAll("[class]")).filter(
      (el) => OPACITY_BG.test(el.getAttribute("class") ?? ""),
    );
    expect(offenders.map((el) => el.getAttribute("class"))).toEqual([]);
  });
});

describe("Etapa 2 — Navbar com ícones lucide", () => {
  it("cada aba do recrutador tem ícone lucide + gap-2, com o mesmo texto", () => {
    renderAppAuthenticated();
    screen.getByRole("tab", { name: "Dashboard de Métricas" }).click();

    const labels = [
      "Dashboard de Métricas",
      "Banco de Talentos",
      "Vagas & Pipeline",
    ];
    for (const label of labels) {
      const tab = screen.getByRole("tab", { name: label });
      expect(
        tab.querySelector("svg.lucide"),
        `aba "${label}" sem ícone lucide`,
      ).not.toBeNull();
      expect(tab).toHaveClass("gap-2");
    }
  });
});

describe("Etapa 3 — Dashboard e filtros des-sufocados", () => {
  it("cards de métrica do Painel Operacional com p-8", () => {
    mockedUseQuery.mockImplementation(((query: unknown) =>
      query === "query:operational.operationalSummary"
        ? {
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
            employability: {
              rate: 50,
              label: "50%",
              approved: 1,
              rejected: 1,
            },
          }
        : undefined) as never);

    render(<OperationalPanel />);

    const kpi = document.querySelector("div.text-center.shadow-level1");
    expect(kpi).toHaveClass("p-8");
  });

  it("filtros (selects) com altura generosa h-10", () => {
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
      expect(select).toHaveClass("h-10");
    }
  });

  it("sidebar de filtros do Banco de Talentos com p-6 e gap-6", () => {
    mockedUseQuery.mockReturnValue({
      items: [],
      page: 0,
      total: 0,
      hasNext: false,
      hasPrev: false,
    });

    render(<TalentSearchPage />);

    const sidebar = screen.getByRole("form", {
      name: /filtros do banco de talentos/i,
    });
    expect(sidebar).toHaveClass("p-6", "gap-6");
  });
});
