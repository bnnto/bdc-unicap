import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { describeUserAgent } from "../../lib/userAgent";
import { Button } from "../ui/button";
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
import {
  AlertTriangle,
  Bell,
  Camera,
  Check,
  Download,
  LogOut,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  Trash2,
  User,
  X,
  ZoomIn,
  ImagePlus,
  type LucideIcon,
} from "lucide-react";
import { flushSync } from "react-dom";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const BANNER_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Configurações — variante "menu lateral" (estilo Ajustes do sistema):
 * um menu de categorias à esquerda e UM painel por vez à direita, ocupando
 * a tela toda. Lógica, mutations e fluxos iguais à versão anterior.
 *
 * `navbar`: a navbar do papel (montada pelo AuthGate).
 */

const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const ROW =
  "flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-slate-100 py-5 first:border-t-0 first:pt-0 last:pb-0";

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

const PRESS = `transition-[background-color,color,box-shadow,transform] duration-[450ms] ${EASE} active:scale-[0.985] active:duration-150 motion-reduce:[transition-property:background-color,color,opacity] motion-reduce:active:scale-100`;

const NAV_ITEM =
  "transition-[color,background-color,transform] duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] active:duration-150 motion-reduce:[transition-property:color,background-color] motion-reduce:active:scale-100";

const NAV_INDICATOR =
  "transition-[transform,width,height] duration-[300ms] ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none";

type ThemeTransitionKind = "circle" | "wipe" | "diagonal" | "fade";

const THEME_TRANSITION: ThemeTransitionKind = "fade";

const THEME_EASE = "cubic-bezier(0.77, 0, 0.175, 1)";

function playThemeTransition(kind: ThemeTransitionKind, x: number, y: number) {
  const root = document.documentElement;
  const reveal = (keyframes: Keyframe[], duration: number) =>
    root.animate(keyframes, {
      duration,
      easing: THEME_EASE,
      pseudoElement: "::view-transition-new(root)",
    });

  switch (kind) {
    case "circle": {
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      reveal(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ],
        900,
      );
      break;
    }
    case "wipe":
      reveal(
        [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        800,
      );
      break;
    case "diagonal":
      reveal(
        [
          { clipPath: "polygon(0 0, 0 0, 0 0)" },
          { clipPath: "polygon(0 0, 200% 0, 0 200%)" },
        ],
        900,
      );
      break;
    case "fade": {
      reveal(
        [
          { opacity: 0, filter: "blur(2px)" },
          { opacity: 1, filter: "blur(0px)" },
        ],
        900,
      );
      root.animate(
        [
          { opacity: 1, filter: "blur(0px)" },
          { opacity: 0, filter: "blur(8px)" },
        ],
        {
          duration: 900,
          easing: THEME_EASE,
          fill: "forwards",
          pseudoElement: "::view-transition-old(root)",
        },
      );
      break;
    }
  }
}

type Pane = "perfil" | "aparencia" | "notificacoes" | "sessoes" | "privacidade";

const PANES: Array<{
  key: Pane;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "perfil",
    label: "Perfil",
    title: "Seu perfil",
    description: "Foto, identidade e resumo da sua conta.",
    icon: User,
  },
  {
    key: "aparencia",
    label: "Aparência",
    title: "Aparência e acessibilidade",
    description: "Ajuste o portal ao seu conforto de leitura.",
    icon: Palette,
  },
  {
    key: "notificacoes",
    label: "Notificações",
    title: "Notificações",
    description: "Escolha o que vale um aviso.",
    icon: Bell,
  },
  {
    key: "sessoes",
    label: "Sessões",
    title: "Sessões recentes",
    description: "Dispositivos onde sua conta está conectada.",
    icon: MonitorSmartphone,
  },
  {
    key: "privacidade",
    label: "Privacidade",
    title: "Privacidade e dados",
    description: "Seus dados são seus: leve uma cópia ou apague tudo.",
    icon: ShieldCheck,
  },
];

function RowText({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="min-w-0 max-w-lg">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      {description !== undefined ? (
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

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
    <div className={ROW}>
      <RowText label={label} description={description} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-[450ms] ${EASE} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          checked ? "bg-primary" : "bg-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-[450ms] ${EASE} ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Cartão de tema com miniatura de "janela". Rádio nativo (teclado e leitor
 * de tela de graça); as cores são fixas para mostrar o tema que o cartão
 * representa, independente do tema atual.
 */
function ThemeOption({
  value,
  label,
  checked,
  onSelect,
}: {
  value: "light" | "dark";
  label: string;
  checked: boolean;
  onSelect: (
    value: "light" | "dark",
    origin?: { x: number; y: number },
  ) => void;
}) {
  const dark = value === "dark";
  const bg = dark ? "#0f1218" : "#f8f9fa";
  const surface = dark ? "#171b22" : "#ffffff";
  const line = dark ? "#3a4356" : "#e2e8f0";
  const accent = dark ? "#e9b8c3" : "#6b1426";
  const edge = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  return (
    <label className="group block cursor-pointer">
      <input
        type="radio"
        name="theme"
        value={value}
        checked={checked}
        onChange={(event) => {
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          onSelect(
            value,
            rect
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : undefined,
          );
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        style={{ background: bg }}
        className={`flex h-40 gap-3 rounded-3xl p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] transition-[box-shadow,transform] duration-[450ms] ${EASE} group-active:scale-[0.985] peer-checked:shadow-[0_0_0_3px_#6b1426] peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 dark:peer-checked:shadow-[0_0_0_3px_#e9b8c3]`}
      >
        <span
          className="flex w-1/4 flex-col gap-2 rounded-xl p-2.5"
          style={{ background: surface, boxShadow: `0 0 0 1px ${edge}` }}
        >
          <span
            className="h-2 w-full rounded-full"
            style={{ background: accent }}
          />
          <span
            className="h-1.5 w-3/4 rounded-full"
            style={{ background: line }}
          />
          <span
            className="h-1.5 w-1/2 rounded-full"
            style={{ background: line }}
          />
        </span>
        <span className="flex flex-1 flex-col gap-3">
          <span
            className="h-3 w-1/3 rounded-full"
            style={{ background: accent }}
          />
          <span className="flex flex-1 gap-3">
            <span
              className="flex-1 rounded-xl"
              style={{ background: surface, boxShadow: `0 0 0 1px ${edge}` }}
            />
            <span
              className="flex-1 rounded-xl"
              style={{ background: surface, boxShadow: `0 0 0 1px ${edge}` }}
            />
          </span>
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between px-1 text-sm font-semibold text-slate-900">
        {label}
        <Check
          aria-hidden="true"
          className="h-4 w-4 text-primary opacity-0 transition-opacity duration-[450ms] peer-checked:opacity-100"
        />
      </span>
    </label>
  );
}

function PaneHeader({
  id,
  icon: Icon,
  title,
  description,
  aside,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FDF2F4] text-primary"
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2
            id={id}
            className="font-serif text-2xl font-bold tracking-tight text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function ProfilePage({ navbar }: { navbar?: ReactNode }) {
  const { user, role } = useAuthState();
  const userName = user?.name ?? user?.email ?? "—";
  const headingId = useId();
  const [pane, setPane] = useState<Pane>("perfil");
  const current = PANES.find((item) => item.key === pane) ?? PANES[0]!;

  // ---- Indicador deslizante do menu ----
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Partial<Record<Pane, HTMLButtonElement | null>>>({});
  const paneRef = useRef<Pane>(pane);
  const [indicator, setIndicator] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [snap, setSnap] = useState(false); // true = reposiciona sem animar

  const measureIndicator = useCallback(() => {
    const el = itemRefs.current[paneRef.current];
    if (!el) return;
    setIndicator({
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    });
  }, []);

  // Mede antes do paint: no primeiro render o indicador já nasce no lugar certo.
  useLayoutEffect(() => {
    paneRef.current = pane;
    measureIndicator();
  }, [pane, measureIndicator]);

  // Mudou o layout (breakpoint, rotação): reposiciona sem "voar" pela tela.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      setSnap(true);
      measureIndicator();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setSnap(false)),
      );
    });
    observer.observe(list);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [measureIndicator]);

  // ---- Etapa 1: acessibilidade (localStorage) ----
  const [prefs, setPrefs] = useState<ThemePreferences>(() => loadPreferences());
  function commit(next: ThemePreferences) {
    setPrefs(next);
    savePreferences(next);
    applyPreferences(next);
  }
  
  function selectTheme(
    theme: "light" | "dark",
    origin?: { x: number; y: number },
  ) {
    if (theme === prefs.theme) return;
    const next = { ...prefs, theme };

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Sem suporte (ou reduced motion): troca instantânea.
    if (!doc.startViewTransition || reduceMotion) {
      commit(next);
      return;
    }

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;

    const transition = doc.startViewTransition(() => {
      flushSync(() => commit(next));
    });

    void transition.ready
      .then(() => playThemeTransition(THEME_TRANSITION, x, y))
      .catch(() => {
        // Transição pulada (ex.: aba em segundo plano): o tema já foi aplicado.
      });
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

  // ---- Etapa 1: foto de avatar (upload direto + visualização) ----
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const saveAvatar = useMutation(api.users.saveAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (file === undefined) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande — o limite é 2MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(
        "Imagem inválida — envie um arquivo de imagem (PNG, JPEG ou WebP).",
      );
      return;
    }
    try {
      const uploadUrl = await generateAvatarUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Falha no envio da foto.");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      const result = await saveAvatar({ storageId });
      if (result.ok) toast.success("Foto de perfil atualizada.");
      else toast.error(result.error);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    }
  }

  async function handleRemoveImage() {
    try {
      await removeAvatar({});
      toast.success("Foto de perfil removida.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    }
  }

  // ---- Banner do perfil (só aluno) ----
  const isStudent = role === "aluno";
  const bannerUrl = useQuery(api.students.myBannerUrl, isStudent ? {} : "skip");
  const generateBannerUploadUrl = useMutation(api.students.generateBannerUploadUrl);
  const saveBanner = useMutation(api.students.saveBanner);
  const removeBanner = useMutation(api.students.removeBanner);
  const [bannerBusy, setBannerBusy] = useState(false);

  async function handleBannerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    if (!BANNER_TYPES.includes(file.type)) {
      toast.error("Imagem inválida — envie PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      toast.error("Imagem muito grande — o limite é 5MB.");
      return;
    }
    setBannerBusy(true);
    try {
      const uploadUrl = await generateBannerUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Falha no envio do banner.");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      const result = await saveBanner({ storageId });
      if (result.ok) toast.success("Banner atualizado.");
      else toast.error(result.error);
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBannerBusy(false);
    }
  }

  async function handleRemoveBanner() {
    setBannerBusy(true);
    try {
      await removeBanner({});
      toast.success("Banner removido.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBannerBusy(false);
    }
  }

  // ---- Etapa 2: sessões + kill switch ----
  const sessions = useQuery(api.users.listMySessions, {});
  const revokeOtherSessions = useMutation(api.users.revokeOtherSessions);
  const recordMySession = useMutation(api.users.recordMySession);
  useEffect(() => {
    const userAgent =
      typeof navigator === "undefined" ? "" : navigator.userAgent;
    async function record() {
      try {
        await recordMySession({ userAgent });
      } catch {
        // Humanização é best-effort: falha nunca quebra a página.
      }
    }
    void record();
  }, [recordMySession]);
  async function handleRevokeSessions() {
    try {
      const result = await revokeOtherSessions({});
      toast.success(
        result.revoked === 1
          ? "1 sessão encerrada."
          : `${result.revoked} sessões encerradas.`,
      );
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
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
      // Preferência local reflete a UI; o servidor mantém a fonte da verdade
    }
  }

  // ---- Etapa 3: portabilidade ----
  const exportData = useQuery(api.users.getMyDataExport, {});
  function handleExport() {
    if (exportData === undefined || exportData === null) return;
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(`portal-carreiras-meus-dados-${day}.json`, exportData);
    toast.success("Dados exportados com sucesso.");
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
      navigateTo("/");
    } catch (err) {
      setDeleteError(friendlyErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  // Esc fecha os dois modais (exclusão e foto ampliada).
  useEffect(() => {
    if (!deleteOpen && viewingImage === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDeleteOpen(false);
      setConfirmWord("");
      setViewingImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteOpen, viewingImage]);

  const initials = userName
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarRing = "ring-4 ring-white dark:ring-[#171b22]";

  return (
    <div className="min-h-screen bg-canvas">
      {navbar}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Meu perfil e configurações"
        className="mx-auto w-full max-w-[1440px] px-8 pb-20 pt-8 outline-none"
      >
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Configurações
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Identidade, acessibilidade, segurança e privacidade, tudo num lugar
            só.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Menu: lateral no desktop, faixa rolável no celular. */}
          <nav
            aria-label="Seções das configurações"
            className={`${SURFACE} p-3 xl:sticky xl:top-28`}
          >
            <div className="hidden items-center gap-3 px-3 pb-4 pt-2 xl:flex">
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
                >
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {userName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {role !== null ? ROLE_LABELS[role] : "—"}
                </p>
              </div>
            </div>
            <ul
              ref={listRef}
              className="relative flex gap-1 overflow-x-auto xl:flex-col xl:overflow-visible xl:border-t xl:border-slate-100 xl:pt-3"
            >
              {indicator !== null ? (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-0 top-0 rounded-2xl bg-[#FDF2F4] ${
                    snap ? "" : NAV_INDICATOR
                  }`}
                  style={{
                    width: indicator.w,
                    height: indicator.h,
                    transform: `translate(${indicator.x}px, ${indicator.y}px)`,
                  }}
                />
              ) : null}
              {PANES.map((item) => {
                const active = item.key === pane;
                return (
                  <li key={item.key} className="shrink-0 xl:shrink">
                    <button
                      ref={(node) => {
                        itemRefs.current[item.key] = node;
                      }}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setPane(item.key)}
                      className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${NAV_ITEM} ${
                        active
                          ? "text-primary"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                      }`}
                    >
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Painel da categoria escolhida (fade ao trocar). */}
          <section
            key={pane}
            aria-labelledby={headingId}
            className={`view-enter ${SURFACE} min-h-[34rem] p-8 xl:p-10`}
          >
            <PaneHeader
              id={headingId}
              icon={current.icon}
              title={current.title}
              description={current.description}
              aside={
                pane === "sessoes" ? (
                  <Button
                    variant="secondary"
                    onClick={() => void handleRevokeSessions()}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Encerrar nos outros dispositivos
                  </Button>
                ) : undefined
              }
            />

            {pane === "perfil" ? (
              <>
                <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
                  {/* Avatar com aro bordô e dourado. */}
                  <div className="shrink-0 rounded-full bg-[conic-gradient(from_200deg,#6b1426,#c89d3c,#6b1426)] p-[3px]">
                    {user?.image ? (
                      <button
                        type="button"
                        onClick={() => setViewingImage(user.image!)}
                        aria-label="Ver foto de perfil ampliada"
                        className={`group relative block h-52 w-52 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-primary ${avatarRing}`}
                      >
                        <img
                          src={user.image}
                          alt="Sua foto de perfil"
                          className={`h-full w-full object-cover transition-transform duration-[450ms] ${EASE} group-hover:scale-105`}
                        />
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-[450ms] group-hover:opacity-100 group-focus-visible:opacity-100"
                        >
                          <ZoomIn className="h-8 w-8 text-white" />
                        </span>
                      </button>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`flex h-52 w-52 items-center justify-center rounded-full bg-primary font-serif text-7xl font-bold text-white ${avatarRing}`}
                      >
                        {initials}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 text-center lg:text-left">
                    <p className="break-words font-serif text-4xl font-bold tracking-tight text-slate-900">
                      {userName}
                    </p>
                    <p className="mt-2 break-all text-base text-slate-600">
                      {user?.email ?? "—"}
                    </p>
                    <p className="mt-4">
                      <span className="inline-flex rounded-full bg-[#FDF2F4] px-3 py-1 text-xs font-semibold text-primary">
                        {role !== null ? ROLE_LABELS[role] : "—"}
                      </span>
                    </p>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-2 lg:justify-start [&>*]:h-10 [&>*]:rounded-xl">
                      <label
                        className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${PRESS}`}
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {user?.image ? "Trocar foto" : "Adicionar foto"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => void handleImageFile(event)}
                        />
                      </label>
                      {user?.image ? (
                        <Button
                          variant="secondary"
                          onClick={() => void handleRemoveImage()}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remover
                        </Button>
                      ) : null}
                      <SignOutButton />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Foto em PNG, JPEG ou WebP, até 2MB.
                    </p>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Stat
                    label="Sessões ativas"
                    value={sessions === undefined ? "—" : String(sessions.length)}
                  />
                  <Stat
                    label="Tema"
                    value={prefs.theme === "dark" ? "Escuro" : "Claro"}
                  />
                  <Stat
                    label="Tamanho da fonte"
                    value={`${FONT_SCALE_STEPS[prefs.fontScale] ?? 100}%`}
                  />
                </div>
                {isStudent ? (
                  <div className="mt-10">
                    <p className="text-sm font-semibold text-slate-900">
                      Banner do perfil
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Aparece no topo do seu perfil para recrutadores. Ideal:
                      1600×400px, PNG, JPEG ou WebP, até 5MB.
                    </p>
                    <div className="relative mt-4 h-32 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#4f0d1c,#6b1426_45%,#8f2238)] sm:h-40">
                      {bannerUrl ? (
                        <img
                          src={bannerUrl}
                          alt="Prévia do seu banner"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label
                        className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${PRESS} ${
                          bannerBusy ? "pointer-events-none opacity-60" : ""
                        }`}
                      >
                        <ImagePlus className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {bannerBusy
                            ? "Enviando…"
                            : bannerUrl
                              ? "Trocar banner"
                              : "Adicionar banner"}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={bannerBusy}
                          onChange={(event) => void handleBannerFile(event)}
                        />
                      </label>
                      {bannerUrl ? (
                        <Button
                          variant="secondary"
                          disabled={bannerBusy}
                          onClick={() => void handleRemoveBanner()}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {pane === "aparencia" ? (
              <>
                <div
                  role="group"
                  aria-label="Tema"
                  className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2"
                >
                  <ThemeOption
                    value="light"
                    label="Claro"
                    checked={prefs.theme !== "dark"}
                    onSelect={selectTheme}
                  />
                  <ThemeOption
                    value="dark"
                    label="Escuro"
                    checked={prefs.theme === "dark"}
                    onSelect={selectTheme}
                  />
                </div>
                <div className="border-t border-slate-100 pt-6">
                  <PreferenceSwitch
                    label="Alto contraste"
                    description="Mais contraste em cores, bordas e links para leitura confortável."
                    checked={prefs.highContrast}
                    onChange={toggleContrast}
                  />
                  <div className={ROW}>
                    <RowText
                      label="Tamanho da fonte"
                      description="Ajusta o texto de todo o portal."
                    />
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
                        className="min-w-14 text-center text-sm font-semibold tabular-nums text-slate-900"
                      >
                        {FONT_SCALE_STEPS[prefs.fontScale] ?? 100}%
                      </output>
                      <Button
                        variant="secondary"
                        aria-label="Aumentar fonte"
                        disabled={
                          prefs.fontScale === FONT_SCALE_STEPS.length - 1
                        }
                        onClick={() => changeFontSize(1)}
                      >
                        A+
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {pane === "notificacoes" ? (
              <div>
                {role !== "recrutador" ? (
                  <PreferenceSwitch
                    label="Alertas de vagas"
                    description="Novas vagas que combinam com o seu perfil."
                    checked={jobAlerts}
                    onChange={(next) =>
                      void handleNotificationChange("jobAlerts", next)
                    }
                  />
                ) : null}
                <PreferenceSwitch
                  label="Atualizações de candidatura"
                  description="Mudanças de etapa nos processos em que você participa."
                  checked={applicationUpdates}
                  onChange={(next) =>
                    void handleNotificationChange("applicationUpdates", next)
                  }
                />
              </div>
            ) : null}

            {pane === "sessoes" ? (
              sessions === undefined ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="animate-pulse space-y-3"
                >
                  <span className="sr-only">Carregando sessões…</span>
                  <div className="h-16 rounded-2xl bg-slate-100" />
                  <div className="h-16 rounded-2xl bg-slate-100" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma sessão registrada.
                </p>
              ) : (
                <ul aria-label="Sessões recentes">
                  {sessions.map((session) => (
                    <li key={session.sessionId} className={ROW}>
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          aria-hidden="true"
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
                        >
                          <MonitorSmartphone className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {describeUserAgent(session.userAgent) ??
                              "Sessão ativa em outro dispositivo"}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                            Criada em {formatDay(session.createdAt)} · expira em{" "}
                            {formatDay(session.expiresAt)}
                          </p>
                        </div>
                      </div>
                      {session.isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-success"
                          />
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
              )
            ) : null}

            {pane === "privacidade" ? (
              <>
                <div className={ROW}>
                  <RowText
                    label="Exportar meus dados"
                    description="Uma cópia de tudo que o portal guarda sobre você, em JSON."
                  />
                  <Button
                    variant="primary"
                    disabled={exportData === undefined || exportData === null}
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Exportar (JSON)
                  </Button>
                </div>

                <div className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/5 p-7">
                  <h3 className="flex items-center gap-2.5 font-serif text-lg font-bold tracking-tight text-danger">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    Excluir Conta
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                    <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                      A exclusão é imediata e irreversível: apaga seu perfil,
                      sessões e
                      consentimentos, sem possibilidade de desfazer.
                    </p>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setDeleteOpen(true);
                        setConfirmWord("");
                        setDeleteError(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Excluir conta
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>

        {/* Modal crítico de exclusão — exige digitar EXCLUIR. */}
        {deleteOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
            className="view-enter fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setDeleteOpen(false);
                setConfirmWord("");
              }
            }}
          >
            <div className={`${SURFACE} w-full max-w-md p-7`}>
              <h2
                id="delete-modal-title"
                className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-danger"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                Excluir conta permanentemente
              </h2>
              <p
                id="delete-modal-description"
                className="mt-2 text-sm leading-relaxed text-slate-600"
              >
                Esta ação é imediata e não pode ser desfeita. Seus dados serão
                apagados em cascata (perfil, candidaturas, vagas, sessões e
                consentimentos).
              </p>
              <div className="mt-5">
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
              <div className="mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmWord("");
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  aria-label="Sim, excluir minha conta"
                  disabled={!confirmed || deleting}
                  onClick={() => void handleDeleteAccount()}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {deleting ? "Excluindo…" : "Sim, excluir minha conta"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Lightbox para visualizar a foto em tela cheia. */}
        {viewingImage ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Visualização da foto de perfil"
            className="view-enter fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setViewingImage(null)}
          >
            <div className="relative flex max-h-full max-w-3xl items-center justify-center">
              <button
                type="button"
                className="absolute -right-2 -top-14 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white sm:-right-14 sm:top-0"
                onClick={() => setViewingImage(null)}
                aria-label="Fechar visualização"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
              <img
                src={viewingImage}
                alt="Sua foto de perfil ampliada"
                className="max-h-[85vh] w-auto rounded-3xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}