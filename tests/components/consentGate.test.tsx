/**
 * [UX-P2] H1-3/H9-3 — O aceite do Termo LGPD dá feedback (pending) e
 * recupera erros: falha na mutation exibe alerta acessível e permite
 * tentar novamente (nenhum erro silencioso).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    consents: {
      myStatus: "query:consents.myStatus",
      acceptCurrentTerm: "mut:consents.acceptCurrentTerm",
    },
  },
}));

vi.mock("../../src/components/auth/authContext", () => ({
  useAuthState: () => ({ isAuthenticated: true, isLoading: false }),
}));

import { useQuery, useMutation } from "convex/react";
import { ConsentGate } from "../../src/components/auth/ConsentGate";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const accept = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:consents.myStatus"
      ? { authenticated: true, active: false }
      : undefined) as never);
  mockedUseMutation.mockReturnValue(accept as never);
});

describe("ConsentGate — aceite com feedback e recuperação de erro (H1-3)", () => {
  it("exibe a tela de consentimento e aceita com sucesso", async () => {
    accept.mockResolvedValue({ ok: true });
    render(
      <ConsentGate>
        <p>Conteúdo protegido</p>
      </ConsentGate>,
    );

    expect(screen.queryByText("Conteúdo protegido")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /Li e aceito o termo/i }),
    );
    expect(accept).toHaveBeenCalledOnce();
  });

  it("durante o aceite o botão fica desabilitado (feedback de pending)", async () => {
    let resolveAccept: (value: unknown) => void = () => {};
    accept.mockReturnValue(
      new Promise((resolve) => {
        resolveAccept = resolve;
      }),
    );
    render(
      <ConsentGate>
        <p>Conteúdo protegido</p>
      </ConsentGate>,
    );

    const button = screen.getByRole("button", { name: /Li e aceito o termo/i });
    await userEvent.click(button);
    expect(button).toBeDisabled();

    resolveAccept({ ok: true });
  });

  it("falha no aceite exibem alerta acessível e o botão volta a habilitar", async () => {
    accept.mockRejectedValueOnce(
      new Error("Sessão expirada. Entre novamente."),
    );
    render(
      <ConsentGate>
        <p>Conteúdo protegido</p>
      </ConsentGate>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Li e aceito o termo/i }),
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sessão expirada. Entre novamente.");
    expect(
      screen.getByRole("button", { name: /Li e aceito o termo/i }),
    ).toBeEnabled();
  });
});
