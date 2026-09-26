import { AuthPage } from "./components/auth/AuthPage";
import { SignOutButton } from "./components/auth/SignOutButton";
import { useAuthState } from "./components/auth/authContext";
import { StudentHomePage } from "./components/student/StudentHomePage";
import { TalentSearchPage } from "./components/talent/TalentSearchPage";
import { JobsPanel } from "./components/recruiter/JobsPanel";
import { JobKanban } from "./components/recruiter/JobKanban";
import { ROLE_LABELS } from "./lib/roles";

/**
 * Shell da aplicação (issue [S1-1]): usuários autenticados veem o painel
 * inicial com seu papel; visitantes veem a página de autenticação.
 * As rotas por domínio (aluno, recrutador, gestor) chegam nas próximas issues
 * de S1 (SPRINTS.md §S1-3..S1-5).
 */
export default function App() {
  return <AuthGate />;
}

function AuthGate() {
  const { isLoading, isAuthenticated, user, role } = useAuthState();

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
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white shadow-level1">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-serif text-lg font-bold text-primary">
              Portal de Carreiras — UNICAP
            </p>
            <p className="text-xs text-slate-500">
              Autenticado como {user.name} ·{" "}
              {role !== null ? ROLE_LABELS[role] : ""}
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main>
        {role === "aluno" ? (
          <StudentHomePage />
        ) : role === "recrutador" || role === "gestor" || role === "empresa" ? (
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-6">
              <JobsPanel />
            </div>
            <div className="mb-6">
              <JobKanban />
            </div>
            <TalentSearchPage />
          </div>
        ) : (
          <section className="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-level1">
            <h1 className="font-serif text-2xl font-bold text-primary">
              Bem-vindo(a), {user.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Painel do papel “{role !== null ? ROLE_LABELS[role] : "—"}” chega
              nas próximas issues da Sprint 1 (SPRINTS.md §S1-4..S1-5 e S3+).
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
