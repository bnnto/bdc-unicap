/**
 * [S8-2] Foco visível e landmarks corretos (CA 2) — navegação por teclado.
 *
 * Verifica, componente a componente:
 * 1. Anel de foco com contraste AA (bordô/primário, não dourado puro —
 *    WCAG 1.4.11); nada remove o outline sem substituí-lo por anel visível;
 * 2. Landmarks explícitos (banner, main, contentinfo, navigation com nome
 *    acessível) e estrutura de títulos sem saltos de nível (1.3.1);
 * 3. Skip-link "Pular para o conteúdo" como primeiro elemento focável,
 *    invisível até receber foco (WCAG 2.4.1).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../convex/_generated/api", () => ({
  // Proxy: api.<módulo>.<função> vira a sentinela "query:módulo.função" —
  // os componentes só passam essas referências ao useQuery mockado.
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
import App from "../../src/App";
import { AuthStateContext } from "../../src/components/auth/authContext";
import { AuthPage } from "../../src/components/auth/AuthPage";
import { StudentHomePage } from "../../src/components/student/StudentHomePage";
import { MyApplicationsPage } from "../../src/components/student/MyApplicationsPage";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";
import { OperationalPanel } from "../../src/components/operational/OperationalPanel";
import { Button } from "../../src/components/ui/button";
import { Card } from "../../src/components/ui/card";
import { Input } from "../../src/components/ui/input";

const mockedUseQuery = vi.mocked(useQuery);

/**
 * Mock do useQuery: fora da página pública tudo fica "carregando"
 * (undefined — estados de skeleton já cobertos pelos testes existentes);
 * a lista pública recebe [] (estado vazio orientador).
 */
const SUMMARY_CARREGADO = {
  jobs: { open: 1, closed: 0, filled: 0, total: 1 },
  applications: {
    total: 2,
    inProgress: 1,
    finalized: 1,
    approved: 0,
    rejected: 1,
    byStage: {
      inscrito: 1,
      triagem: 0,
      entrevista: 0,
      aprovado: 0,
      reprovado: 1,
    },
  },
  employability: { rate: 0, label: "0%", approved: 0, rejected: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) => {
    // Painéis de gestor/recrutador: listas vazias = painel renderizado.
    if (query === "query:operational.operationalSummary")
      return SUMMARY_CARREGADO;
    if (query === "query:students.searchTalent") {
      return { items: [], page: 0, total: 0, hasNext: false, hasPrev: false };
    }
    return undefined;
  }) as never);
  vi.mocked(useMutation).mockImplementation((() =>
    vi.fn().mockResolvedValue({})) as never);
});

/** Anel de foco AA (bordô) — exigido em todos os interativos. */
const FOCUS_RING_AA = [
  "focus-visible:ring-2",
  "focus-visible:ring-primary",
  "focus-visible:ring-offset-2",
];

describe("S8-2 CA 2 — foco visível com contraste AA (WCAG 2.4.7 / 1.4.11)", () => {
  it("Button — todas as variantes usam anel de foco bordô (não dourado)", () => {
    for (const variant of [
      "primary",
      "secondary",
      "accent",
      "danger",
    ] as const) {
      const { unmount } = render(<Button variant={variant}>Ação</Button>);
      const el = screen.getByRole("button", { name: "Ação" });
      for (const part of FOCUS_RING_AA) {
        expect(el.className, `${variant}: ${part}`).toContain(part);
      }
      expect(el.className).not.toContain("ring-secondary");
      unmount();
    }
  });

  it("Input — anel de foco bordô sólido (não alpha primary/15)", () => {
    render(<Input label="E-mail" />);
    const el = screen.getByLabelText("E-mail");
    expect(el.className).toContain("focus:ring-primary");
    expect(el.className).not.toContain("ring-primary/15");
    expect(el.className).toContain("focus:ring-offset-1");
  });

  it("Card — aceita headingLevel para corrigir a hierarquia de títulos", () => {
    render(
      <Card title="Seção da página" headingLevel={2}>
        x
      </Card>,
    );
    const heading = screen.getByRole("heading", { name: "Seção da página" });
    expect(heading.tagName).toBe("H2");
  });

  it("AuthPage — abas concentram foco visível e anunciam estado (aria-selected)", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<AuthPage />);

    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Entrar" })).toHaveFocus();

    await userEvent.tab();
    const abaCriar = screen.getByRole("tab", { name: "Criar conta" });
    expect(abaCriar).toHaveFocus();
    // O estado da aba muda com o clique (padrão de abas da página).
    await userEvent.click(abaCriar);
    expect(abaCriar).toHaveAttribute("aria-selected", "true");
    expect(abaCriar.className).toContain("focus-visible:ring-primary");
  });

  it("AuthPage — checkbox do termo LGPD é operável por teclado", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<AuthPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Criar conta" }));

    const checkbox = screen.getByRole("checkbox", {
      name: /termo de consentimento/i,
    });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("CSS global — :focus-visible mantém contorno e offset (nunca outline none)", () => {
    const css = readGlobalCss();
    const focusBlock = css.match(/:focus-visible\s*\{[^}]*\}/);
    expect(focusBlock).not.toBeNull();
    expect(focusBlock?.[0]).toContain("outline");
    expect(focusBlock?.[0]).not.toContain("outline: none");
    expect(focusBlock?.[0]).toContain("outline-offset");
  });
});

/** Lê o CSS global (cacheado) para auditar a regra de foco. */
let cachedGlobalCss: string | undefined;
function readGlobalCss(): string {
  if (cachedGlobalCss === undefined) {
    cachedGlobalCss = readFileSync(resolve("src/index.css"), "utf8");
  }
  return cachedGlobalCss;
}

describe("S8-2 CA 2 — landmarks corretos (WCAG 1.3.1)", () => {
  it("App — autenticado: banner + main nomeado, sem aninhamento", () => {
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: true,
          user: {
            _id: "u1" as never,
            name: "Recrutador",
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

    const main = screen.getByRole("main", { name: "Conteúdo principal" });
    expect(main).toHaveAttribute("id", "conteudo");
    expect(main).toHaveAttribute("tabIndex", "-1");

    const banners = screen.getAllByRole("banner");
    expect(banners).toHaveLength(1);
    // Nenhum main aninhado dentro do main do App.
    expect(main.querySelectorAll('[role="main"], main')).toHaveLength(0);
  });

  it("App — visitante: AuthPage como main único e sem banner", () => {
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: null,
        }}
      >
        <App />
      </AuthStateContext.Provider>,
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    // O main do visitante contém o formulário de autenticação (aba Entrar).
    expect(mains[0]).toHaveTextContent(/entrar/i);
  });

  it("App — skip-link é o primeiro focável, pula o header e some até receber foco", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: null,
        }}
      >
        <App />
      </AuthStateContext.Provider>,
    );

    const skip = screen.getByRole("link", { name: /pular para o conteúdo/i });
    expect(skip).toHaveAttribute("href", "#conteudo");
    expect(skip.className).toContain("sr-only");
    expect(skip.className).toContain("focus:not-sr-only");

    await userEvent.tab();
    expect(skip).toHaveFocus();

    await userEvent.tab();
    // Depois do skip, o próximo focável é a aba Entrar (header pulado).
    expect(screen.getByRole("tab", { name: "Entrar" })).toHaveFocus();
  });

  it("App — skip-link também existe no fluxo público (R9)", () => {
    // jsdom não permite stub de window.location; muda a rota via History API.
    window.history.pushState({}, "", "/extensao");
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: null,
        }}
      >
        <App />
      </AuthStateContext.Provider>,
    );

    expect(
      screen.getByRole("link", { name: /pular para o conteúdo/i }),
    ).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });

  it("AuthPage — landmark banner presente junto do main", () => {
    render(<AuthPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("main", { name: /autenticação/i }),
    ).toBeInTheDocument();
  });

  it("StudentHomePage — nav de âncoras com nome acessível e títulos sem saltos", () => {
    mockedUseQuery.mockReturnValue([] as never);
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: true,
          user: null,
          role: "aluno",
        }}
      >
        <StudentHomePage />
      </AuthStateContext.Provider>,
    );

    expect(
      screen.getByRole("navigation", { name: "Seções desta página" }),
    ).toBeInTheDocument();

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels.length).toBeGreaterThan(0);
    const first = levels[0] ?? 9;
    expect(first).toBeLessThanOrEqual(2);
    for (let i = 1; i < levels.length; i++) {
      const previous = levels[i - 1] ?? 9;
      expect(levels[i], `salto de título na posição ${i}`).toBeLessThanOrEqual(
        previous + 1,
      );
    }
  });

  it("MyApplicationsPage — main local vira região nomeada", () => {
    render(<MyApplicationsPage />);
    expect(screen.queryByRole("main")).toBeNull();
    expect(
      screen.getByRole("region", { name: /minhas candidaturas/i }),
    ).toBeInTheDocument();
  });

  it("TalentSearchPage — região nomeada e sem main aninhado", () => {
    render(<TalentSearchPage />);
    expect(screen.queryByRole("main")).toBeNull();
    expect(
      screen.getByRole("region", { name: /busca de talentos/i }),
    ).toBeInTheDocument();
  });

  it("OperationalPanel — região nomeada e sem main aninhado", () => {
    render(<OperationalPanel />);
    expect(screen.queryByRole("main")).toBeNull();
    expect(
      screen.getByRole("region", { name: /painel operacional/i }),
    ).toBeInTheDocument();
  });
});
