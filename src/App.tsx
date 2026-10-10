import { useEffect, useState } from "react";
import { AuthPage } from "./components/auth/AuthPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { LandingPage } from "./components/landing/LandingPage";
import { ProfilePage } from "./components/profile/ProfilePage";
import {
  isPasswordResetPath,
  navigateTo,
  parseCandidateProfilePath,
} from "./lib/router";
import { useAuthState } from "./components/auth/authContext";
import { StudentShell } from "./components/student/StudentShell";
import { TalentSearchPage } from "./components/talent/TalentSearchPage";
import { RecruiterJobsPage } from "./components/recruiter/RecruiterJobsPage";
import { CandidateProfilePage } from "./components/recruiter/CandidateProfilePage";
import { OperationalPanel } from "./components/operational/OperationalPanel";
import { ManagerDashboard } from "./components/manager/ManagerDashboard";
import { ROLE_LABELS } from "./lib/roles";

/**
 * Shell da aplicação (issue [S1-1]): usuários autenticados veem o painel
 * inicial com seu papel; visitantes veem a Landing Page pública em "/"
 * ([UX_UPGRADE] Etapa 1 — a vitrine) e a página de autenticação em
 * "/login".
 *
 * [S8-2] Acessibilidade WCAG AA: skip-link de teclado (2.4.1) e um único
 * landmark main nomeado (#conteudo) envolvendo todo o conteúdo.
 *
 * [REFACTOR_UI] Etapa 2 — o painel do recrutador/gestor usa abas na Navbar
 * (renderização condicional, uma tela visível por vez) em layout de
 * largura total; nada de painéis empilhados no meio da página.
 *
 * [REFACTOR_GESTOR] Etapa 2 — o módulo de Projetos de Extensão foi
 * cancelado: sem rotas públicas (R9/extensão) e sem dashboard de
 * extensão; a aba Dashboard do gestor exibe o Painel Estratégico.
 */

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
 * ao centro (padrão ARIA tabs — o conteúdo troca por clique) e avatar do
 * perfil à direita. Cada aba controla um painel embaixo (aria-controls).
 *
 * [UX_REFINEMENT Etapa 3] — sem menu dropdown: clicar no avatar/nome
 * leva direto à central de configurações (/perfil), onde também mora o
 * "Sair".
 */
function RecruiterNavbar({
  active,
  onChange,
  userName,
  userImage,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  userName: string;
  /** [PERFIL_E_LGPD] foto de avatar (data URL) quando definida. */
  userImage?: string;
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

        {/* Direita: avatar + nome como um único botão para /perfil
            ([UX_REFINEMENT] Etapa 3 — o "Sair" vive em /perfil). */}
        <div className="order-2 flex items-center gap-3 lg:order-3">
          <button
            type="button"
            aria-label="Meu perfil e configurações"
            onClick={() => navigateTo("/perfil")}
            className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-[#FDF2F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {userImage ? (
              <img
                src={userImage}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
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
            )}
            <span className="hidden text-sm font-semibold text-slate-600 sm:block">
              {userName}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated, user, role } = useAuthState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  // [UX_UPGRADE] Etapa 1 — roteamento público sem router: "/" mostra a
  // Landing Page e "/login" a AuthPage; popstate cobre voltar/avançar.
  const [publicPath, setPublicPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  useEffect(() => {
    const onPopState = () => setPublicPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  // [ONBOARDING_RECOVERY] Rota pública de recuperação de senha: funciona
  // com ou sem sessão (o link do e-mail abre direto, sem passar pelo login).
  if (isPasswordResetPath(publicPath)) {
    // ResetPasswordPage é dona do próprio landmark main (#conteudo).
    return (
      <>
        <SkipLink />
        <ResetPasswordPage />
      </>
    );
  }

  if (!isAuthenticated || user === null) {
    // Visitante: Landing Page na raiz (vitrine pública) e AuthPage em
    // /login. ([REFACTOR_GESTOR] a divulgação pública de extensão (R9)
    // não existe mais — módulo cancelado.)
    // [S8-2]: LandingPage e AuthPage são donas do próprio landmark main.
    const navigate = (path: string) => navigateTo(path);
    const isLoginRoute =
      publicPath === "/login" || publicPath.startsWith("/login/");
    return (
      <>
        <SkipLink />
        {isLoginRoute ? <AuthPage /> : <LandingPage onNavigate={navigate} />}
      </>
    );
  }

  if (publicPath === "/perfil") {
    // [PERFIL_E_LGPD] rota autenticada da central de configurações e
    // segurança — vale para qualquer papel (aluno, recrutador, gestor).
    // A exclusão da conta derruba `me` no servidor reativo e o AuthGate
    // volta a cair na vitrine.
    return (
      <>
        <SkipLink />
        <ProfilePage />
      </>
    );
  }

  if (role === "aluno") {
    // [REFACTOR_ALUNO Etapa 1] — shell com navbar de abas + avatar; o
    // landmark main único (#conteudo) é do próprio shell, para o
    // skip-link cair direto nos painéis das abas.
    return (
      <div className="min-h-screen bg-canvas">
        <SkipLink />
        <StudentShell />
      </div>
    );
  }

  const isRecruiterSide = role === "recrutador" || role === "gestor";

  // [RECRUITER_VIEW_PROFILE] Rota dedicada `/recrutador/candidato/:id` —
  // só existe do lado do recrutador/gestor; o shell do aluno ignora a
  // rota (voltar ao currículo do próprio aluno).
  const candidateStudentId = isRecruiterSide
    ? parseCandidateProfilePath(publicPath)
    : null;
  if (candidateStudentId !== null) {
    return (
      <>
        <SkipLink />
        <CandidateProfilePage studentId={candidateStudentId} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      <RecruiterNavbar
        active={activeTab}
        onChange={setActiveTab}
        userName={user.name ?? user.email ?? "usuário"}
        userImage={user.image ?? undefined}
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
            /* [REFACTOR_GESTOR] Etapa 4 — o gestor recebe o Painel
               Estratégico; o recrutador mantém o Painel Operacional. */
            role === "gestor" ? (
              <ManagerDashboard />
            ) : (
              <OperationalPanel />
            )
          ) : isRecruiterSide && activeTab === "talentos" ? (
            <TalentSearchPage />
          ) : isRecruiterSide && activeTab === "vagas" ? (
            /* [RECRUITER_UX_UPGRADE] Master-Detail: a aba mostra a lista de
               vagas; o Kanban abre a tela inteira ao clicar em "Ver
               Candidatos" (com botão de voltar). */
            <RecruiterJobsPage />
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
            </section>
          )}
        </div>
      </MainLandmark>
    </div>
  );
}
