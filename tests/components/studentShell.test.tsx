/**
 * [REFACTOR_ALUNO Etapa 1] — StudentShell: navbar superior com logo à
 * esquerda, abas ao centro (padrão ARIA tabs), avatar à direita e
 * container full-width (max-w-[1440px]). Renderiza o App com papel
 * "aluno" — uma tela visível por vez (renderização condicional).
 *
 * [UX_REFINEMENT Etapa 3] — sem dropdown no header: o avatar/nome é um
 * botão que leva direto à rota /perfil; o "Sair" vive dentro de /perfil.
 */
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStateContext } from "../../src/components/auth/authContext";
import App from "../../src/App";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  // Função por chamada: a /perfil montada pelo avatar usa mutations.
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
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

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
  // Estado de carregamento: os painéis renderizam skeletons.
  mockedUseQuery.mockReturnValue(undefined);
});

// [PERFIL_E_LGPD] a navegação para /perfil muda a rota via History
// API — reseta para que cada teste monte o shell de novo.
afterEach(() => {
  window.history.pushState({}, "", "/");
});

function renderAluno() {
  return render(
    <AuthStateContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: true,
        user: {
          _id: "u1" as never,
          name: "Ana Aluno",
          email: "ana@unicap.br",
          role: "aluno",
          _creationTime: 0,
        },
        role: "aluno",
      }}
    >
      <App />
    </AuthStateContext.Provider>,
  );
}

describe("StudentShell — navbar com abas (Etapa 1)", () => {
  it("exibe as 3 abas centrais na ordem do REFACTOR_ALUNO", () => {
    renderAluno();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const tabs = within(nav).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Meu Currículo",
      "Oportunidades",
      "Minhas Candidaturas",
    ]);
  });

  it("aba 'Meu Currículo' é a padrão e só ela aparece", () => {
    renderAluno();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const [curriculo, oportunidades, candidaturas] =
      within(nav).getAllByRole("tab");
    expect(curriculo).toHaveAttribute("aria-selected", "true");
    expect(oportunidades).toHaveAttribute("aria-selected", "false");
    expect(candidaturas).toHaveAttribute("aria-selected", "false");

    expect(
      screen.getByRole("tabpanel", { name: "Meu Currículo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tabpanel", { name: "Oportunidades" }),
    ).toBeNull();
  });

  it("clicar em 'Oportunidades' troca o painel visível", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAluno();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    await userEvent.click(within(nav).getAllByRole("tab")[1]!);
    expect(
      screen.getByRole("tabpanel", { name: "Oportunidades" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tabpanel", { name: "Meu Currículo" }),
    ).toBeNull();
  });

  it("clicar em 'Minhas Candidaturas' troca o painel visível", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAluno();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    await userEvent.click(within(nav).getAllByRole("tab")[2]!);
    expect(
      screen.getByRole("tabpanel", { name: "Minhas Candidaturas" }),
    ).toBeInTheDocument();
  });

  it("não existe aba 'Meu Perfil' — o perfil fica só no /perfil do avatar", () => {
    renderAluno();
    const nav = screen.getByRole("navigation", { name: /seções do portal/i });
    const labels = within(nav)
      .getAllByRole("tab")
      .map((tab) => tab.textContent);
    expect(labels).not.toContain("Meu Perfil");
    expect(screen.queryByRole("tabpanel", { name: "Meu Perfil" })).toBeNull();
  });
});

describe("StudentShell — logo, container full-width e avatar (Etapa 1)", () => {
  it("logo UNICAP à esquerda com identidade do portal", () => {
    renderAluno();
    expect(screen.getByText(/portal de carreiras/i)).toBeInTheDocument();
    expect(screen.getByText("UC")).toBeInTheDocument();
  });

  it("container full-width max-w-[1440px] no header", () => {
    const { container } = renderAluno();
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const wide = header!.querySelector(".max-w-\\[1440px\\]");
    expect(wide).not.toBeNull();
  });

  it("sem dropdown no header: avatar/nome é um único botão", () => {
    renderAluno();
    expect(screen.queryByRole("menu")).toBeNull();
    // O Sair não fica mais no header — vive em /perfil (Etapa 3).
    expect(screen.queryByRole("button", { name: /^sair$/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /meu perfil e configurações/i }),
    ).toBeInTheDocument();
  });

  it("clique no avatar leva à rota /perfil (Etapa 3)", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAluno();
    await userEvent.click(
      screen.getByRole("button", { name: /meu perfil e configurações/i }),
    );
    expect(window.location.pathname).toBe("/perfil");
    expect(
      screen.getByRole("heading", { level: 1, name: /meu perfil/i }),
    ).toBeInTheDocument();
    // Dentro de /perfil o utilizador encerra sessão pelo botão Sair.
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeInTheDocument();
  });

  it("avatar exibe as iniciais do aluno", () => {
    renderAluno();
    expect(screen.getByText("AA")).toBeInTheDocument();
  });
});
