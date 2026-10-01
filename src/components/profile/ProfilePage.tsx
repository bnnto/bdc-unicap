import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { SignOutButton } from "../auth/SignOutButton";
import { useAuthState } from "../auth/authContext";
import { ROLE_LABELS } from "../../lib/roles";
import { formatDay } from "../../lib/formatters";
import { navigateTo } from "../../lib/router";
import { downloadJson } from "../../lib/download";
import {
  FONT_SCALE_STEPS,
  applyPreferences,
  loadPreferences,
  savePreferences,
  type ThemePreferences,
} from "../../lib/preferences";

/**
 * [PERFIL_E_LGPD] Rota `/perfil` — central de configurações e
 * segurança (spec PERFIL_E_LGPD.md):
 *
 * - Etapa 1 — identidade (foto de avatar + sair) e ACESSIBILIDADE:
 *   modo escuro, alto contraste e escala de fonte, persistidos em
 *   localStorage e aplicados no <html>.
 * - Etapa 2 — SEGURANÇA: sessões recentes com a atual marcada, kill
 *   switch "encerrar sessão em outros dispositivos" e notificações.
 * - Etapa 3 — LGPD: portabilidade (download do JSON dos próprios
 *   dados) e o botão vermelho de exclusão com confirmação "EXCLUIR"
 *   (a mutation de cascata roda no servidor — Etapa 4).
 *
 * [S8-2] dona do landmark main único (#conteudo) deste rota.
 */

const MAX_IMAGE_BYTES = 400 * 1024;

/** Switch acessível (role=switch + aria-checked) do design system. */
function PreferenceSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          checked ? "bg-primary" : "bg-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/** Lê o arquivo como data URL (Promise). */
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao ler o arquivo."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { user, role } = useAuthState();
  const userName = user?.name ?? user?.email ?? "—";

  // ---- Etapa 1: acessibilidade (localStorage) ----
  const [prefs, setPrefs] = useState<ThemePreferences>(() => loadPreferences());
  function commit(next: ThemePreferences) {
    setPrefs(next);
    savePreferences(next);
    applyPreferences(next);
  }
  function toggleTheme() {
    commit({ ...prefs, theme: prefs.theme === "dark" ? "light" : "dark" });
  }
  function toggleContrast() {
    commit({ ...prefs, highContrast: !prefs.highContrast });
  }
  function changeFontSize(delta: 1 | -1) {
    commit({
      ...prefs,
      fontScale: Math.min(
        Math.max(prefs.fontScale + delta, 0),
        FONT_SCALE_STEPS.length - 1,
      ),
    });
  }

  // ---- Etapa 1: foto de avatar ----
  const updateProfile = useMutation(api.users.updateMyProfile);
  const [profileError, setProfileError] = useState<string | null>(null);
  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (file === undefined) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setProfileError("Imagem muito grande — o limite é 400KB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setProfileError(
        "Imagem inválida — envie um arquivo de imagem (PNG, JPEG ou WebP).",
      );
      return;
    }
    setProfileError(null);
    try {
      const image = await readAsDataURL(file);
      await updateProfile({ image });
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Falha ao salvar a foto.",
      );
    }
  }
  async function handleRemoveImage() {
    setProfileError(null);
    try {
      await updateProfile({ image: undefined });
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Falha ao remover a foto.",
      );
    }
  }

  // ---- Etapa 2: sessões + kill switch ----
  const sessions = useQuery(api.users.listMySessions, {});
  const revokeOtherSessions = useMutation(api.users.revokeOtherSessions);
  const [revokeStatus, setRevokeStatus] = useState<string | null>(null);
  async function handleRevokeSessions() {
    try {
      const result = await revokeOtherSessions({});
      setRevokeStatus(
        result.revoked === 1
          ? "1 sessão encerrada."
          : `${result.revoked} sessões encerradas.`,
      );
    } catch (err) {
      setRevokeStatus(
        err instanceof Error ? err.message : "Falha ao encerrar as sessões.",
      );
    }
  }

  // ---- Etapa 2: notificações ----
  const updateNotificationPrefs = useMutation(
    api.users.updateMyNotificationPrefs,
  );
  const jobAlerts = user?.notifyJobAlerts ?? true;
  const applicationUpdates = user?.notifyApplicationUpdates ?? true;
  async function handleNotificationChange(
    key: "jobAlerts" | "applicationUpdates",
    value: boolean,
  ) {
    try {
      await updateNotificationPrefs({
        jobAlerts: key === "jobAlerts" ? value : jobAlerts,
        applicationUpdates:
          key === "applicationUpdates" ? value : applicationUpdates,
      });
    } catch {
      // Preferência local reflete a UI; o servidor mantém a fonte da
      // verdade — erro só é exibido nos fluxos críticos (foto/sessão).
    }
  }

  // ---- Etapa 3: portabilidade ----
  const exportData = useQuery(api.users.getMyDataExport, {});
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  function handleExport() {
    if (exportData === undefined || exportData === null) return;
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(`portal-carreiras-meus-dados-${day}.json`, exportData);
    setExportStatus("Dados exportados com sucesso.");
  }

  // ---- Etapa 3: direito ao esquecimento ----
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmed = confirmWord.trim() === "EXCLUIR";
  async function handleDeleteAccount() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount({});
      setDeleteOpen(false);
      // A cascata apagou usuário e sessões: `me` vira null no servidor
      // reativo e o AuthGate cai na vitrine; a rota também volta a /.
      navigateTo("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Falha ao excluir a conta.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const initials = userName
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-canvas">
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Meu perfil e configurações"
        className="mx-auto w-full max-w-4xl px-6 py-8 outline-none"
      >
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/");
          }}
          className="inline-flex text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← Voltar ao painel
        </a>
        <h1 className="mt-4 font-serif text-3xl font-bold text-primary">
          Meu Perfil &amp; Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Identidade, acessibilidade, segurança e privacidade — tudo num lugar
          só.
        </p>

        {/* Etapa 1 — Identidade e conta. */}
        <Card title="Identidade e conta" accent="primary">
          <div className="flex flex-wrap items-center gap-4">
            {user?.image ? (
              <img
                src={user.image}
                alt="Foto de perfil atual"
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-serif text-xl font-bold text-white"
              >
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{userName}</p>
              <p className="truncate text-xs text-slate-500">
                {user?.email ?? "—"}
              </p>
              <p className="text-xs text-slate-500">
                {role !== null ? ROLE_LABELS[role] : "—"}
              </p>
            </div>
            <div className="ml-auto">
              <SignOutButton />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Input
              label="Alterar foto do perfil"
              type="file"
              accept="image/*"
              hint="PNG, JPEG ou WebP — até 400KB."
              onChange={(event) => void handleImageFile(event)}
            />
            {profileError !== null ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {profileError}
              </p>
            ) : null}
            {user?.image ? (
              <div>
                <Button
                  variant="secondary"
                  onClick={() => void handleRemoveImage()}
                >
                  Remover foto
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Etapa 1 — Aparência e acessibilidade. */}
        <div className="mt-6">
          <Card title="Aparência e acessibilidade" accent="secondary">
            <div className="flex flex-col gap-3">
              <PreferenceSwitch
                label="Modo escuro"
                description="Tema escuro em todo o portal (persistido neste dispositivo)."
                checked={prefs.theme === "dark"}
                onChange={toggleTheme}
              />
              <PreferenceSwitch
                label="Modo de alto contraste"
                description="Mais contraste em cores, bordas e links para leitura confortável."
                checked={prefs.highContrast}
                onChange={toggleContrast}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Tamanho da fonte
                  </p>
                  <p className="text-xs text-slate-500">
                    Ajusta o texto de todo o portal.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    aria-label="Diminuir fonte"
                    disabled={prefs.fontScale === 0}
                    onClick={() => changeFontSize(-1)}
                  >
                    A−
                  </Button>
                  <output
                    aria-live="polite"
                    className="min-w-14 text-center text-sm font-semibold text-slate-700"
                  >
                    {FONT_SCALE_STEPS[prefs.fontScale] ?? 100}%
                  </output>
                  <Button
                    variant="secondary"
                    aria-label="Aumentar fonte"
                    disabled={prefs.fontScale === FONT_SCALE_STEPS.length - 1}
                    onClick={() => changeFontSize(1)}
                  >
                    A+
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Etapa 2 — Segurança e preferências. */}
        <div className="mt-6">
          <Card title="Segurança e preferências" accent="primary">
            <h3 className="text-sm font-semibold text-slate-700">
              Sessões recentes
            </h3>
            {sessions === undefined ? (
              <p
                role="status"
                aria-live="polite"
                className="mt-2 text-sm text-slate-500"
              >
                Carregando sessões…
              </p>
            ) : sessions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma sessão registrada.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {sessions.map((session) => (
                  <li
                    key={session.sessionId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        {session.sessionId}
                      </p>
                      <p className="text-xs text-slate-600">
                        Criada em {formatDay(session.createdAt)} · expira em{" "}
                        {formatDay(session.expiresAt)}
                      </p>
                    </div>
                    {session.isCurrent ? (
                      <span className="rounded-full bg-[#FDF2F4] px-2 py-0.5 text-xs font-bold text-primary">
                        Você está aqui
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Outro dispositivo
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => void handleRevokeSessions()}
              >
                Encerrar sessão em outros dispositivos
              </Button>
              {revokeStatus !== null ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm font-semibold text-success"
                >
                  {revokeStatus}
                </p>
              ) : null}
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-700">
              Notificações
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              <PreferenceSwitch
                label="Alertas de Vagas"
                description="Novas vagas que combinam com o seu perfil."
                checked={jobAlerts}
                onChange={(next) =>
                  void handleNotificationChange("jobAlerts", next)
                }
              />
              <PreferenceSwitch
                label="Atualizações de Candidatura"
                description="Mudanças de etapa nos processos em que você participa."
                checked={applicationUpdates}
                onChange={(next) =>
                  void handleNotificationChange("applicationUpdates", next)
                }
              />
            </div>
          </Card>
        </div>

        {/* Etapa 3 — Privacidade e LGPD. */}
        <div className="mt-6">
          <Card title="Privacidade e LGPD" accent="secondary">
            <p className="text-sm text-slate-600">
              Portabilidade de dados (art. 18, V) e direito ao esquecimento
              (art. 18, VI) da Lei Geral de Proteção de Dados.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                disabled={exportData === undefined || exportData === null}
                onClick={handleExport}
              >
                Exportar meus dados (JSON)
              </Button>
              {exportStatus !== null ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm font-semibold text-success"
                >
                  {exportStatus}
                </p>
              ) : null}
            </div>

            <div className="mt-6 rounded border border-danger bg-white p-4">
              <h3 className="font-serif text-sm font-bold text-danger">
                Zona de perigo
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                A exclusão é imediata e irreversível: apaga seu perfil,
                candidaturas, vagas (para recrutadores), sessões e
                consentimentos — sem como desfazer.
              </p>
              <div className="mt-3">
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteOpen(true);
                    setConfirmWord("");
                    setDeleteError(null);
                  }}
                >
                  Excluir conta
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Modal crítico de exclusão — exige digitar EXCLUIR (Etapa 3). */}
        {deleteOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setDeleteOpen(false);
                setConfirmWord("");
              }
            }}
          >
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-level2">
              <h2
                id="delete-modal-title"
                className="font-serif text-lg font-bold text-danger"
              >
                Excluir conta permanentemente
              </h2>
              <p
                id="delete-modal-description"
                className="mt-1 text-sm text-slate-600"
              >
                Esta ação é imediata e não pode ser desfeita. Seus dados serão
                apagados em cascata (perfil, candidaturas, vagas, sessões e
                consentimentos).
              </p>
              <div className="mt-3">
                <Input
                  label="Digite EXCLUIR para confirmar"
                  value={confirmWord}
                  autoComplete="off"
                  onChange={(event) => setConfirmWord(event.target.value)}
                />
              </div>
              {deleteError !== null ? (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-danger"
                >
                  {deleteError}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmWord("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  aria-label="Sim, excluir minha conta"
                  disabled={!confirmed || deleting}
                  onClick={() => void handleDeleteAccount()}
                >
                  {deleting ? "Excluindo…" : "Sim, excluir minha conta"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
