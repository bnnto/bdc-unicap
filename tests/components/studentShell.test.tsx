/**
 * [REFACTOR_ALUNO Etapa 1] — StudentShell: navbar superior com logo à
 * esquerda, abas ao centro (padrão ARIA tabs), avatar com dropdown à
 * direita e container full-width (max-w-[1440px]). Renderiza o App com
 * papel "aluno" — uma tela visível por vez (renderização condicional).
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
  // Estado de carregamento: os painéis renderizam skeletons.
  mockedUseQuery.mockReturnValue(undefined);
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

  it("avatar com menu dropdown: Meu Perfil e Sair", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAluno();
    const trigger = screen.getByRole("button", { name: /menu do perfil/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Meu Perfil",
      "Sair",
    ]);
  });

  it("'Meu Perfil' no dropdown abre a aba de perfil", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    renderAluno();
    await userEvent.click(
      screen.getByRole("button", { name: /menu do perfil/i }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Meu Perfil" }));
    expect(
      screen.getByRole("tabpanel", { name: "Meu Perfil" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("avatar exibe as iniciais do aluno", () => {
    renderAluno();
    expect(screen.getByText("AA")).toBeInTheDocument();
  });
});
