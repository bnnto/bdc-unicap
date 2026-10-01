/**
 * [PERFIL_E_LGPD] Página /perfil — central de configurações e
 * segurança. Testa a presença das seções e o comportamento dos
 * controles: toggles de acessibilidade (persistência + efeito no
 * documento), kill switch de sessões, notificações, portabilidade JSON
 * e o botão vermelho de exclusão com confirmação "EXCLUIR".
 *
 * `convex/react`, `@convex-dev/auth/react` e a api gerada são mockados
 * (sentinelas estáveis contra os proxies do Convex).
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    users: {
      listMySessions: "query:users.listMySessions",
      getMyDataExport: "query:users.getMyDataExport",
      updateMyProfile: "mut:users.updateMyProfile",
      updateMyNotificationPrefs: "mut:users.updateMyNotificationPrefs",
      revokeOtherSessions: "mut:users.revokeOtherSessions",
      recordMySession: "mut:users.recordMySession",
      deleteMyAccount: "mut:users.deleteMyAccount",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ProfilePage } from "../../src/components/profile/ProfilePage";
import { AuthStateContext } from "../../src/components/auth/authContext";
import { STORAGE_KEY } from "../../src/lib/preferences";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const sessionsFixture = [
  {
    sessionId: "sess-atual",
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    isCurrent: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  {
    // Sem User-Agent registrado (fallback humano — nunca o ID cru).
    sessionId: "sess-celular",
    createdAt: Date.now() - 5000,
    expiresAt: Date.now() + 20 * 24 * 60 * 60 * 1000,
    isCurrent: false,
    userAgent: null,
  },
];

const exportFixture = {
  exportedAt: Date.now(),
  usuario: {
    id: "u1",
    email: "aluna@unicap.br",
    name: "Maria da Silva",
    role: "aluno",
    active: true,
    image: null,
    notifyJobAlerts: true,
    notifyApplicationUpdates: true,
  },
  consentimentos: [{ termVersion: "v1", acceptedAt: Date.now() }],
  perfilAluno: { fullName: "Maria da Silva" },
  candidaturas: [],
  vagasPublicadas: [],
};

const updateMyProfile = vi
  .fn()
  .mockResolvedValue({ image: "data:image/png;base64,AA" });
const updateMyNotificationPrefs = vi
  .fn()
  .mockResolvedValue({ jobAlerts: false, applicationUpdates: true });
const revokeOtherSessions = vi
  .fn()
  .mockResolvedValue({ revoked: 1, keptCurrent: true });
const recordMySession = vi.fn().mockResolvedValue({ recorded: true });
const deleteMyAccount = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark", "high-contrast");
  document.documentElement.style.fontSize = "";
  window.history.pushState({}, "", "/perfil");

  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:users.listMySessions") return sessionsFixture;
    if (query === "query:users.getMyDataExport") return exportFixture;
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) => {
    if (mutation === "mut:users.updateMyProfile") return updateMyProfile;
    if (mutation === "mut:users.updateMyNotificationPrefs")
      return updateMyNotificationPrefs;
    if (mutation === "mut:users.revokeOtherSessions")
      return revokeOtherSessions;
    if (mutation === "mut:users.recordMySession") return recordMySession;
    return deleteMyAccount;
  }) as never);
});

function renderPerfil() {
  return render(
    <AuthStateContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: true,
        user: {
          _id: "u1" as never,
          name: "Maria da Silva",
          email: "aluna@unicap.br",
          role: "aluno",
          _creationTime: 0,
        },
        role: "aluno",
      }}
    >
      <ProfilePage />
    </AuthStateContext.Provider>,
  );
}

describe("ProfilePage — presença das seções (Etapa 1/2/3)", () => {
  it("renderiza as quatro seções centrais com h1 único", () => {
    renderPerfil();
    expect(
      screen.getByRole("heading", { level: 1, name: /meu perfil/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /identidade e conta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /acessibilidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /segurança/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /lgpd/i })).toBeInTheDocument();
    // Botão de sair (Etapa 1.1).
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeInTheDocument();
  });

  it("landmark main único com id do skip-link (#conteudo)", () => {
    renderPerfil();
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "conteudo");
  });
});

describe("ProfilePage — acessibilidade: tema, contraste e fontes (Etapa 1)", () => {
  it("toggle Modo escuro liga a classe dark no documento e persiste", async () => {
    const user = userEvent.setup();
    renderPerfil();

    const toggle = screen.getByRole("switch", { name: /modo escuro/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      theme?: string;
    };
    expect(stored.theme).toBe("dark");

    await user.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggle Modo de alto contraste aplica a classe high-contrast", async () => {
    const user = userEvent.setup();
    renderPerfil();

    const toggle = screen.getByRole("switch", { name: /alto contraste/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(
      true,
    );
  });

  it("controles de fonte aumentam e diminuem o tamanho raiz", async () => {
    const user = userEvent.setup();
    renderPerfil();

    const increase = screen.getByRole("button", { name: /aumentar fonte/i });
    const decrease = screen.getByRole("button", { name: /diminuir fonte/i });
    // No mínimo: diminuir começa desabilitado.
    expect(decrease).toBeDisabled();

    await user.click(increase);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    await user.click(increase);
    expect(document.documentElement.style.fontSize).toBe("125%");
    expect(increase).toBeDisabled(); // no máximo

    await user.click(decrease);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
  });
});

describe("ProfilePage — segurança: kill switch de sessões (Etapa 2)", () => {
  it("humaniza as sessões: navegador+SO, sem IDs criptográficos crus", () => {
    renderPerfil();
    expect(screen.getByText("Chrome no Windows")).toBeInTheDocument();
    expect(screen.getByText(/você está aqui/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sessão ativa em outro dispositivo/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sess-celular/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sess-atual/i)).not.toBeInTheDocument();
  });

  it("container da página usa a largura total do portal (1440px)", () => {
    renderPerfil();
    const main = screen.getByRole("main");
    expect(main.className).toContain("max-w-[1440px]");
  });

  it("registra o User-Agent da sessão atual na montagem", async () => {
    renderPerfil();
    await waitFor(() => {
      expect(recordMySession).toHaveBeenCalledTimes(1);
    });
    const args = recordMySession.mock.calls[0]?.[0] as { userAgent?: unknown };
    expect(typeof args.userAgent).toBe("string");
    expect((args.userAgent as string).length).toBeGreaterThan(0);
  });

  it("botão encerrar sessões chama o kill switch e confirma por toast", async () => {
    const user = userEvent.setup();
    renderPerfil();

    await user.click(
      screen.getByRole("button", {
        name: /encerrar sessão em todos os outros dispositivos/i,
      }),
    );
    expect(revokeOtherSessions).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("1 sessão encerrada.");
  });

  it("switches de notificação persistem as preferências no usuário", async () => {
    const user = userEvent.setup();
    renderPerfil();

    const jobAlerts = screen.getByRole("switch", { name: /alertas de vagas/i });
    expect(jobAlerts).toHaveAttribute("aria-checked", "true");
    await user.click(jobAlerts);
    expect(updateMyNotificationPrefs).toHaveBeenCalledWith({
      jobAlerts: false,
      applicationUpdates: true,
    });
  });
});

describe("ProfilePage — LGPD: portabilidade e exclusão (Etapa 3)", () => {
  it("exportar meus dados dispara o download do JSON", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderPerfil();

    await user.click(
      screen.getByRole("button", { name: /exportar meus dados/i }),
    );
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Dados exportados com sucesso.");
    clickSpy.mockRestore();
  });

  it("modal de exclusão exige digitar EXCLUIR e cancelar não exclui", async () => {
    const user = userEvent.setup();
    renderPerfil();

    await user.click(screen.getByRole("button", { name: /excluir conta/i }));
    const dialog = screen.getByRole("dialog", {
      name: /excluir conta permanentemente/i,
    });
    const confirm = within(dialog).getByRole("button", {
      name: /sim, excluir minha conta/i,
    });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/digite EXCLUIR/i), "apagar");
    expect(confirm).toBeDisabled();
    expect(deleteMyAccount).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: /^cancelar$/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /excluir conta permanentemente/i }),
    ).not.toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it("confirmação com EXCLUIR exclui a conta e volta para a vitrine", async () => {
    const user = userEvent.setup();
    renderPerfil();

    await user.click(screen.getByRole("button", { name: /excluir conta/i }));
    const dialog = screen.getByRole("dialog", {
      name: /excluir conta permanentemente/i,
    });
    await user.type(
      within(dialog).getByLabelText(/digite EXCLUIR/i),
      "EXCLUIR",
    );
    const confirm = within(dialog).getByRole("button", {
      name: /sim, excluir minha conta/i,
    });
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(deleteMyAccount).toHaveBeenCalledOnce();
    });
    expect(window.location.pathname).toBe("/");
  });
});

describe("ProfilePage — foto de perfil (Etapa 1.1)", () => {
  it("arquivo além do limite mostra erro sem chamar a mutation", async () => {
    renderPerfil();
    const input = screen.getByLabelText(/alterar foto do perfil/i);
    const bigFile = new File([new Uint8Array(500 * 1024)], "grande.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Imagem muito grande — o limite é 400KB.",
      );
    });
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it("arquivo válido vira data URL e grava no usuário", async () => {
    renderPerfil();
    const input = screen.getByLabelText(/alterar foto do perfil/i);
    const file = new File(["abc"], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledOnce();
    });
    const args = updateMyProfile.mock.calls[0]?.[0] as {
      image?: string;
    };
    expect(args.image).toMatch(/^data:image\/png;base64,/);
  });
});
