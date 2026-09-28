import { useState } from "react";
import { AuthPage } from "./components/auth/AuthPage";
import { SignOutButton } from "./components/auth/SignOutButton";
import { useAuthState } from "./components/auth/authContext";
import { StudentHomePage } from "./components/student/StudentHomePage";
import { TalentSearchPage } from "./components/talent/TalentSearchPage";
import { JobsPanel } from "./components/recruiter/JobsPanel";
import { JobKanban } from "./components/recruiter/JobKanban";
import { OperationalPanel } from "./components/operational/OperationalPanel";
import { ROLES, ROLE_LABELS } from "./lib/roles";
import { ExtensionProjectsPublicPage } from "./components/extension/ExtensionProjectsPublicPage";
import { ExtensionDashboard } from "./components/extension/ExtensionDashboard";

/**
 * Shell da aplicação (issue [S1-1]): usuários autenticados veem o painel
 * inicial com seu papel; visitantes veem a página de autenticação —
 * exceto na divulgação pública ([S7-3], R9), acessível sem login.
 *
 * [S8-2] Acessibilidade WCAG AA: skip-link de teclado (2.4.1) e um único
 * landmark main nomeado (#conteudo) envolvendo todo o conteúdo.
 *
 * [REFACTOR_UI] Etapa 2 — o painel do recrutador/gestor usa abas na Navbar
 * (renderização condicional, uma tela visível por vez) em layout de
 * largura total; nada de painéis empilhados no meio da página.
 */

/** Rotas públicas (R9, [S7-3]): acessíveis sem autenticação. */
const PUBLIC_PATHS = new Set(["/extensao"]);

function isPublicPath(): boolean {
  return PUBLIC_PATHS.has(window.location.pathname);
}

export default function App() {
  return <AuthGate />;
}

/**
 * [S8-2] Skip-link — primeiro elemento da tabulação; pula direto para o
 * conteúdo principal (WCAG 2.4.1). Invisível até receber foco.
 */
function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-level2"
    >
      Pular para o conteúdo
    </a>
  );
}

/** [S8-2] Landmark main único, com destino do skip-link. */
function MainLandmark({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="conteudo"
      tabIndex={-1}
      aria-label="Conteúdo principal"
      // O contorno no main é feedback redundante do skip-link; o foco
      // visível real fica nos controles focáveis subsequentes (2.4.7).
      className="outline-none"
    >
      {children}
    </main>
  );
}

/** Abas do portal (REFACTOR_UI Etapa 2). */
type TabKey = "dashboard" | "talentos" | "vagas";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard de Métricas" },
  { key: "talentos", label: "Banco de Talentos" },
  { key: "vagas", label: "Vagas & Pipeline" },
];

/**
 * Navbar com abas acessíveis (REFACTOR_UI Etapa 2): logo à esquerda, abas
 * ao centro (padrão ARIA tabs — o conteúdo troca por clique) e perfil +
 * Sair à direita. Cada aba controla um painel embaixo (aria-controls).
 */
function RecruiterNavbar({
  active,
  onChange,
  userName,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  userName: string;
}) {
  return (
    <header className="border-b border-slate-200 bg-white shadow-level1">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-3">
        {/* Esquerda: logo institucional. */}
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-white"
          >
            UC
          </span>
          <div>
            <p className="font-serif text-lg font-bold leading-tight text-primary">
              Portal de Carreiras — UNICAP
            </p>
            <p className="text-xs text-slate-500">
              Autenticado como {userName}
            </p>
          </div>
        </div>

        {/* Centro: abas de navegação (padrão ARIA tabs). */}
        <nav aria-label="Seções do portal" className="order-3 lg:order-2">
          <ul className="flex flex-wrap items-center gap-1" role="tablist">
            {TABS.map((tab) => (
              <li key={tab.key} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active === tab.key}
                  aria-controls={`panel-${tab.key}`}
                  id={`tab-${tab.key}`}
                  onClick={() => onChange(tab.key)}
                  className={`rounded px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    active === tab.key
                      ? "border-b-2 border-secondary bg-[#FDF2F4] text-primary"
                      : "border-b-2 border-transparent text-slate-600 hover:bg-[#FDF2F4] hover:text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Direita: perfil + Sair. */}
        <div className="order-2 flex items-center gap-3 lg:order-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF2F4] text-xs font-bold text-primary"
          >
            {userName
              .split(" ")
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join("")}
          </span>
          <span className="sr-only">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated, user, role } = useAuthState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-500">Carregando…</p>
      </div>
    );
  }

  if (!isAuthenticated || user === null) {
    // R9 ([S7-3]): a divulgação pública de projetos de extensão é aberta
    // sem login; qualquer outra rota de visitante cai na autenticação.
    // [S8-2]: AuthPage e a página pública são donas do próprio landmark
    // main (com o destino do skip-link) — sem wrapper duplicado aqui.
    return (
      <>
        <SkipLink />
        {isPublicPath() ? <ExtensionProjectsPublicPage /> : <AuthPage />}
      </>
    );
  }

  if (role === "aluno") {
    return (
      <div className="min-h-screen bg-canvas">
        <SkipLink />
        <header className="border-b border-slate-200 bg-white shadow-level1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-3">
            <p className="font-serif text-lg font-bold text-primary">
              Portal de Carreiras — UNICAP
            </p>
            <p className="text-xs text-slate-500">
              Autenticado como {user.name} ·{" "}
              {role !== null ? ROLE_LABELS[role] : ""}
            </p>
          </div>
        </header>
        <MainLandmark>
          <StudentHomePage />
        </MainLandmark>
      </div>
    );
  }

  const isRecruiterSide = role === "recrutador" || role === "gestor";

  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      <RecruiterNavbar
        active={activeTab}
        onChange={setActiveTab}
        userName={user.name ?? user.email ?? "usuário"}
      />
      <MainLandmark>
        {/* [REFACTOR_UI] Renderização condicional por aba — uma tela por vez. */}
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] px-6 py-6"
        >
          {isRecruiterSide && activeTab === "dashboard" ? (
            <>
              {role === "gestor" ? (
                <div className="mb-6">
                  <ExtensionDashboard />
                </div>
              ) : null}
              <OperationalPanel />
            </>
          ) : isRecruiterSide && activeTab === "talentos" ? (
            <TalentSearchPage />
          ) : isRecruiterSide && activeTab === "vagas" ? (
            <div className="flex flex-col gap-8">
              <JobsPanel />
              <JobKanban />
            </div>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1">
              {/* [S8-2] h2 em vez de h1: o h1 da página é o título do portal
                  no header (sem dois h1 na mesma página). */}
              <h2 className="font-serif text-2xl font-bold text-primary">
                Bem-vindo(a), {user.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Painel do papel “{role !== null ? ROLE_LABELS[role] : "—"}”.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Papéis disponíveis:{" "}
                {ROLES.map((r) => ROLE_LABELS[r]).join(", ")}.
              </p>
            </section>
          )}
        </div>
      </MainLandmark>
    </div>
  );
}
