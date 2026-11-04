/**
 * [PERFIL_E_LGPD] Página /perfil: central de configurações em abas
 * (Perfil, Aparência, Notificações, Sessões, Privacidade). Só um painel
 * fica na tela por vez, então cada teste clica na aba antes de procurar
 * o controle dela.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      updateMyNotificationPrefs: "mut:users.updateMyNotificationPrefs",
      revokeOtherSessions: "mut:users.revokeOtherSessions",
      recordMySession: "mut:users.recordMySession",
      deleteMyAccount: "mut:users.deleteMyAccount",
      generateAvatarUploadUrl: "mut:users.generateAvatarUploadUrl",
      saveAvatar: "mut:users.saveAvatar",
      removeAvatar: "mut:users.removeAvatar",
    },
    students: {
      myBannerUrl: "query:students.myBannerUrl",
      generateBannerUploadUrl: "mut:students.generateBannerUploadUrl",
      saveBanner: "mut:students.saveBanner",
      removeBanner: "mut:students.removeBanner",
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
    // Sem User-Agent registrado (fallback humano, nunca o ID cru).
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

const generateAvatarUploadUrl = vi
  .fn()
  .mockResolvedValue("https://upload.test/avatar");
const saveAvatar = vi.fn().mockResolvedValue({ ok: true });
const removeAvatar = vi.fn().mockResolvedValue({ ok: true });
const updateMyNotificationPrefs = vi
  .fn()
  .mockResolvedValue({ jobAlerts: false, applicationUpdates: true });
const revokeOtherSessions = vi
  .fn()
  .mockResolvedValue({ revoked: 1, keptCurrent: true });
const recordMySession = vi.fn().mockResolvedValue({ recorded: true });
const deleteMyAccount = vi.fn().mockResolvedValue({ ok: true });

const MUTATIONS: Record<string, ReturnType<typeof vi.fn>> = {
  "mut:users.generateAvatarUploadUrl": generateAvatarUploadUrl,
  "mut:users.saveAvatar": saveAvatar,
  "mut:users.removeAvatar": removeAvatar,
  "mut:users.updateMyNotificationPrefs": updateMyNotificationPrefs,
  "mut:users.revokeOtherSessions": revokeOtherSessions,
  "mut:users.recordMySession": recordMySession,
  "mut:users.deleteMyAccount": deleteMyAccount,
  "mut:students.generateBannerUploadUrl": vi
    .fn()
    .mockResolvedValue("https://upload.test/banner"),
  "mut:students.saveBanner": vi.fn().mockResolvedValue({ ok: true }),
  "mut:students.removeBanner": vi.fn().mockResolvedValue({ ok: true }),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark", "high-contrast");
  document.documentElement.style.fontSize = "";
  window.history.pushState({}, "", "/perfil");

  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:users.listMySessions") return sessionsFixture;
    if (query === "query:users.getMyDataExport") return exportFixture;
    if (query === "query:students.myBannerUrl") return null;
    return undefined;
  }) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    MUTATIONS[String(mutation)] ?? vi.fn()) as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

/** Clica numa aba do menu lateral (o nome é o texto exato do botão). */
async function irPara(aba: string) {
  await userEvent.click(screen.getByRole("button", { name: aba }));
}

describe("ProfilePage: estrutura em abas", () => {
  it("abre em Perfil e mostra o painel de cada aba, um por vez", async () => {
    renderPerfil();
    expect(
      screen.getByRole("heading", { level: 1, name: /configurações/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Seu perfil" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Perfil" }),
    ).toHaveAttribute("aria-current", "page");
    // Controles de outras abas não aparecem na aba Perfil.
    expect(
      screen.queryByRole("switch", { name: /alto contraste/i }),
    ).not.toBeInTheDocument();

    const abas: Array<[string, string]> = [
      ["Aparência", "Aparência e acessibilidade"],
      ["Notificações", "Notificações"],
      ["Sessões", "Sessões recentes"],
      ["Privacidade", "Privacidade e dados"],
    ];
    for (const [aba, titulo] of abas) {
      await irPara(aba);
      expect(
        screen.getByRole("heading", { level: 2, name: titulo }),
      ).toBeInTheDocument();
    }
  });

  it("landmark main único com id do skip-link (#conteudo)", () => {
    renderPerfil();
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "conteudo");
  });

  it("container da página usa a largura total do portal (1440px)", () => {
    renderPerfil();
    const main = screen.getByRole("main");
    expect(main.className).toContain("max-w-[1440px]");
  });
});

describe("ProfilePage: aparência e acessibilidade (aba Aparência)", () => {
  it("escolher Escuro aplica a classe dark no documento e persiste", async () => {
    renderPerfil();
    await irPara("Aparência");

    const escuro = screen.getByRole("radio", { name: /escuro/i });
    await userEvent.click(escuro);
    expect(escuro).toBeChecked();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      theme?: string;
    };
    expect(stored.theme).toBe("dark");

    await userEvent.click(screen.getByRole("radio", { name: /claro/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("switch de alto contraste aplica a classe high-contrast", async () => {
    renderPerfil();
    await irPara("Aparência");

    const toggle = screen.getByRole("switch", { name: /alto contraste/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(
      true,
    );
  });

  it("controles de fonte aumentam e diminuem o tamanho raiz", async () => {
    renderPerfil();
    await irPara("Aparência");

    const increase = screen.getByRole("button", { name: "Aumentar fonte" });
    const decrease = screen.getByRole("button", { name: "Diminuir fonte" });
    // No mínimo: diminuir começa desabilitado.
    expect(decrease).toBeDisabled();

    await userEvent.click(increase);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    await userEvent.click(increase);
    expect(document.documentElement.style.fontSize).toBe("125%");
    expect(increase).toBeDisabled(); // no máximo

    await userEvent.click(decrease);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
  });
});

describe("ProfilePage: sessões (aba Sessões)", () => {
  it("humaniza as sessões: navegador e SO, sem IDs crus", async () => {
    renderPerfil();
    await irPara("Sessões");
    expect(screen.getByText("Chrome no Windows")).toBeInTheDocument();
    expect(screen.getByText(/você está aqui/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sessão ativa em outro dispositivo/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sess-celular/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sess-atual/i)).not.toBeInTheDocument();
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

  it("botão Encerrar nos outros dispositivos chama o kill switch e confirma por toast", async () => {
    renderPerfil();
    await irPara("Sessões");
    await userEvent.click(
      screen.getByRole("button", {
        name: /encerrar nos outros dispositivos/i,
      }),
    );
    expect(revokeOtherSessions).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("1 sessão encerrada.");
  });
});

describe("ProfilePage: notificações (aba Notificações)", () => {
  it("switch de alertas de vagas persiste a preferência no usuário", async () => {
    renderPerfil();
    await irPara("Notificações");

    const jobAlerts = screen.getByRole("switch", { name: /alertas de vagas/i });
    expect(jobAlerts).toHaveAttribute("aria-checked", "true");
    await userEvent.click(jobAlerts);
    expect(updateMyNotificationPrefs).toHaveBeenCalledWith({
      jobAlerts: false,
      applicationUpdates: true,
    });
  });
});

describe("ProfilePage: privacidade e dados (aba Privacidade)", () => {
  it("Exportar (JSON) dispara o download do arquivo", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderPerfil();
    await irPara("Privacidade");

    await userEvent.click(
      screen.getByRole("button", { name: /exportar \(json\)/i }),
    );
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      "Dados exportados com sucesso.",
    );
    clickSpy.mockRestore();
  });

  it("modal de exclusão exige digitar EXCLUIR e cancelar não exclui", async () => {
    renderPerfil();
    await irPara("Privacidade");

    await userEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    const dialog = screen.getByRole("dialog", {
      name: /excluir conta permanentemente/i,
    });
    const confirm = within(dialog).getByRole("button", {
      name: /sim, excluir minha conta/i,
    });
    expect(confirm).toBeDisabled();

    await userEvent.type(
      within(dialog).getByLabelText(/digite EXCLUIR/i),
      "apagar",
    );
    expect(confirm).toBeDisabled();
    expect(deleteMyAccount).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /^cancelar$/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /excluir conta permanentemente/i }),
    ).not.toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it("confirmação com EXCLUIR exclui a conta e volta para a vitrine", async () => {
    renderPerfil();
    await irPara("Privacidade");

    await userEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    const dialog = screen.getByRole("dialog", {
      name: /excluir conta permanentemente/i,
    });
    await userEvent.type(
      within(dialog).getByLabelText(/digite EXCLUIR/i),
      "EXCLUIR",
    );
    const confirm = within(dialog).getByRole("button", {
      name: /sim, excluir minha conta/i,
    });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(deleteMyAccount).toHaveBeenCalledOnce();
    });
    expect(window.location.pathname).toBe("/");
  });
});

describe("ProfilePage: foto de perfil (aba Perfil)", () => {
  it("arquivo acima de 2MB mostra erro sem enviar nada", async () => {
    renderPerfil();
    const input = screen.getByLabelText(/adicionar foto|trocar foto/i);
    const bigFile = new File([new Uint8Array(3 * 1024 * 1024)], "grande.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Imagem muito grande — o limite é 2MB.",
      );
    });
    expect(generateAvatarUploadUrl).not.toHaveBeenCalled();
    expect(saveAvatar).not.toHaveBeenCalled();
  });

  it("arquivo válido é enviado ao storage e salvo no perfil", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "st_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPerfil();
    const input = screen.getByLabelText(/adicionar foto|trocar foto/i);
    const file = new File(["abc"], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveAvatar).toHaveBeenCalledWith({ storageId: "st_1" });
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.test/avatar",
      expect.objectContaining({ method: "POST" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Foto de perfil atualizada.");
  });
});