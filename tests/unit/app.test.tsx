import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { AuthStateContext } from "../../src/components/auth/authContext";

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
