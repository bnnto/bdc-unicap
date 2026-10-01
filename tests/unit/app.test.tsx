import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
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

function renderAsVisitor() {
  return render(
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
}

describe("App — rota pública e autenticação (UX_UPGRADE)", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("visitante na raiz / vê a Landing Page (vitrine pública)", () => {
    window.history.pushState({}, "", "/");
    renderAsVisitor();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /o seu futuro começa aqui/i,
      }),
    ).toBeInTheDocument();
  });

  it("visitante em /login vê a AuthPage", () => {
    window.history.pushState({}, "", "/login");
    renderAsVisitor();
    expect(
      screen.getByRole("heading", { name: /portal de carreiras/i }),
    ).toBeInTheDocument();
  });

  it("usuário autenticado em /perfil vê a central de configurações", () => {
    window.history.pushState({}, "", "/perfil");
    render(
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
    expect(
      screen.getByRole("heading", { level: 1, name: /meu perfil/i }),
    ).toBeInTheDocument();
  });

  it("CTA Entrar como Aluno leva do / para /login", () => {
    window.history.pushState({}, "", "/");
    renderAsVisitor();

    const [primeiroCta] = screen.getAllByRole("link", {
      name: /entrar como aluno/i,
    });
    fireEvent.click(primeiroCta!);
    expect(window.location.pathname).toBe("/login");
    expect(
      screen.getByRole("heading", { name: /portal de carreiras/i }),
    ).toBeInTheDocument();
  });
});
