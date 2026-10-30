import { useEffect, useState, useRef } from "react";
import { AuthPage } from "./components/auth/AuthPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { LandingPage } from "./components/landing/LandingPage";
import { ProfilePage } from "./components/profile/ProfilePage";
import {
  isPasswordResetPath,
  navigateTo,
  parseCandidateProfilePath,
  parsePortalPath,
  portalPath,
} from "./lib/router";
import { useAuthState } from "./components/auth/authContext";
import { Kanban, LayoutDashboard, Users } from "lucide-react";
import { ManagerRecruitersPage } from "./components/manager/ManagerRecruitersPage";
import { ManagerModerationPage } from "./components/manager/ManagerModerationPage";
import { ManagerNavbar } from "./components/manager/ManagerNavbar";
import { TalentSearchPage } from "./components/recruiter/talent/TalentSearchPage";
import { RecruiterJobsPage } from "./components/recruiter/RecruiterJobsPage";
import { CandidateProfilePage } from "./components/recruiter/CandidateProfilePage";
import { OperationalPanel } from "./components/recruiter/operational/OperationalPanel";
import { ManagerDashboard } from "./components/manager/ManagerDashboard";
import { ROLE_LABELS } from "./lib/roles";
import { RecruiterApprovalGate } from "./components/recruiter/RecruiterApprovalGate";
import { PillNavbar } from "./components/nav/PillNavbar";
import { StudentShell, STUDENT_TABS, type StudentTab } from "./components/student/StudentShell";

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
type TabKey = "dashboard" | "talentos" | "vagas" | "recrutadores" | "moderacao";

type TabDef = {
  key: TabKey;
  label: string;
  /** [FINAL_UI_POLISH] Ícone lucide ao lado do texto (gap-2). */
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const RECRUITER_TABS: TabDef[] = [
  { key: "dashboard", label: "Dashboard de Métricas", icon: LayoutDashboard },
  { key: "talentos", label: "Banco de Talentos", icon: Users },
  { key: "vagas", label: "Vagas & Pipeline", icon: Kanban },
];

/**
 * [MODERACAO_RECRUTADOR] O gestor modera; não vê banco de talentos nem
 * pipeline. As abas e a navbar do gestor vivem em
 * `components/manager/ManagerNavbar.tsx`.
 */

function AuthGate() {
  const { isLoading, isAuthenticated, user, role } = useAuthState();
  const [studentTab, setStudentTab] = useState<StudentTab>("curriculo");
  const [publicPath, setPublicPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  useEffect(() => {
    const onPopState = () => setPublicPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const portal = parsePortalPath(publicPath);
  const activeTab: TabKey = portal.tab;
  const setActiveTab = (tab: TabKey) => navigateTo(portalPath(tab));

  const sawGuest = useRef(false);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) sawGuest.current = true;
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (user === null || !sawGuest.current) return;
    sawGuest.current = false;
    setActiveTab("dashboard");
    setStudentTab("curriculo");
    navigateTo("/");
  }, [user]);

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
    const name = user.name ?? user.email ?? "usuário";
    const image = user.image ?? undefined;
    const goTab = (tab: TabKey) => setActiveTab(tab);
    const navbar =
      role === "gestor" ? (
        <ManagerNavbar
          active={null}
          userActive
          onChange={goTab}
          userName={name}
          userImage={image}
        />
      ) : role === "aluno" ? (
        <PillNavbar<StudentTab>
          navLabel="Seções do portal"
          tabs={STUDENT_TABS.map(({ key, label }) => ({ key, label }))}
          active={null}
          userActive
          onChange={(tab) => {
            setStudentTab(tab);
            navigateTo("/");
          }}
          userName={name}
          userImage={image}
        />
      ) : (
        <PillNavbar
          navLabel="Seções do portal"
          tabs={RECRUITER_TABS.map(({ key, label }) => ({ key, label }))}
          active={null}
          userActive
          onChange={goTab}
          userName={name}
          userImage={image}
        />
      );
    return (
      <>
        <SkipLink />
        <ProfilePage navbar={navbar} />
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
        <StudentShell tab={studentTab} onTabChange={setStudentTab} />
      </div>
    );
  }

  // [MODERACAO_RECRUTADOR] Recrutador pendente/recusado não entra no
  // portal. Conta sem `approvalStatus` (legada) segue como aprovada.
  if (
    role === "recrutador" &&
    (user.approvalStatus === "pendente" || user.approvalStatus === "recusado")
  ) {
    return (
      <>
        <SkipLink />
        <RecruiterApprovalGate user={user} />
      </>
    );
  }

  // [RECRUITER_VIEW_PROFILE] Rota dedicada `/recrutador/candidato/:id` —
  // só existe do lado do recrutador/gestor; o shell do aluno ignora a
  // rota (voltar ao currículo do próprio aluno).
  const candidateStudentId =
    role === "recrutador" ? parseCandidateProfilePath(publicPath) : null;
  if (candidateStudentId !== null) {
    return (
      <>
        <SkipLink />
        <CandidateProfilePage
          studentId={candidateStudentId}
          navbar={
            <PillNavbar
              navLabel="Seções do portal"
              tabs={RECRUITER_TABS.map(({ key, label }) => ({ key, label }))}
              active={activeTab}
              onChange={setActiveTab}
              userName={user.name ?? user.email ?? "usuário"}
              userImage={user.image ?? undefined}
            />
          }
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      {role === "gestor" ? (
        <ManagerNavbar
          active={activeTab}
          onChange={setActiveTab}
          userName={user.name ?? user.email ?? "usuário"}
          userImage={user.image ?? undefined}
        />
      ) : (
        <PillNavbar
          navLabel="Seções do portal"
          tabs={RECRUITER_TABS.map(({ key, label }) => ({ key, label }))}
          active={activeTab}
          onChange={setActiveTab}
          userName={user.name ?? user.email ?? "usuário"}
          userImage={user.image ?? undefined}
        />
      )}
      <MainLandmark>
        {/* [REFACTOR_UI] Renderização condicional por aba — uma tela por vez. */}
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] px-8 py-8"
        >
          {activeTab === "dashboard" ? (
            role === "gestor" ? (
              <ManagerDashboard />
            ) : (
              <OperationalPanel />
            )
          ) : role === "gestor" && activeTab === "recrutadores" ? (
            <ManagerRecruitersPage />
          ) : role === "gestor" && activeTab === "moderacao" ? (
            <ManagerModerationPage />
          ) : role === "recrutador" && activeTab === "talentos" ? (
            <TalentSearchPage />
          ) : role === "recrutador" && activeTab === "vagas" ? (
            <RecruiterJobsPage jobId={portal.jobId} />
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1">
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