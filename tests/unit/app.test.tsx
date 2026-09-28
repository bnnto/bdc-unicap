import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { AuthStateContext } from "../../src/components/auth/authContext";

describe("App (smoke test do scaffold)", () => {
  it("renderiza o título do portal", () => {
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
      screen.getByRole("heading", { name: /portal de carreiras/i }),
    ).toBeInTheDocument();
  });
});
