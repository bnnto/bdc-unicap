import { useState } from "react";
import { useAuthState } from "../auth/authContext";
import { navigateTo } from "../../lib/router";
import { ResumeBuilderPage } from "./ResumeBuilderPage";
import { JobOpportunities } from "./JobOpportunities";
import { MyApplicationsPage } from "./MyApplicationsPage";
import { Briefcase, FileText, Send, type LucideIcon } from "lucide-react";

/**
 * [REFACTOR_ALUNO Etapa 1] — StudentShell: navbar superior em largura
 * total (container max-w-[1440px]) com logo UNICAP à esquerda, abas ao
 * centro (padrão ARIA tabs — uma tela visível por vez) e avatar à
 * direita.
 *
 * [UX_REFINEMENT Etapa 3] — sem menu dropdown: avatar/nome é um botão
 * que leva direto à central de configurações (/perfil); o "Sair" vive
 * dentro de /perfil.
 *
 * [S8-2] — as abas usam role=tablist/tab/tabpanel com aria-controls;
 * o landmark main continua único no App.
 *
 * [REFACTOR_ALUNO visual] — barra plana (borda, sem sombra), abas como
 * sublinhado de 2px sobre uma régua full-width: a navegação recua e o
 * estado ativo é a única cor de marca na linha. Movimento só como
 * feedback (cor em 150ms), com `motion-safe` para quem pede menos
 * movimento.
 */

export type StudentTab = "curriculo" | "oportunidades" | "candidaturas";

const TABS: Array<{ key: StudentTab; label: string; icon: LucideIcon }> = [
  { key: "curriculo", label: "Meu Currículo", icon: FileText },
  { key: "oportunidades", label: "Oportunidades", icon: Briefcase },
  { key: "candidaturas", label: "Minhas Candidaturas", icon: Send },
];

/** Iniciais do avatar: primeira + última palavra em caixa alta. */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function StudentShell() {
  const { user } = useAuthState();
  const userName = user?.name ?? user?.email ?? "Aluno";
  const [active, setActive] = useState<StudentTab>("curriculo");

  function selectTab(tab: StudentTab) {
    setActive(tab);
  }

  return (
    <div className="student-app min-h-screen bg-[#F6F4F0] dark:bg-[#101318]">
      <header className="border-b border-slate-200 bg-[#F6F4F0] dark:border-slate-700 dark:bg-[#171b22]">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary font-serif text-sm font-bold text-white"
            >
              UC
            </span>
            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-bold leading-tight text-primary sm:text-base">
                Banco de Currículos — UNICAP
              </p>
              <p className="text-xs text-slate-500">Portal do Aluno</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Meu perfil e configurações"
            title={userName}
            onClick={() => navigateTo("/perfil")}
            className="flex max-w-[12rem] shrink-0 items-center gap-2 rounded-full p-1 pr-2 transition-colors duration-150 ease-soft hover:bg-[#FDF2F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:max-w-[14rem] sm:pr-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-white">
              {user?.image ? (
                <img src={user.image} alt="" className="h-9 w-9 object-cover" />
              ) : (
                initialsOf(userName)
              )}
            </span>
            <span className="hidden min-w-0 truncate text-sm font-semibold text-slate-700 sm:block">
              {userName}
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#F6F4F0] px-4 py-3 sm:px-6 lg:min-h-[calc(100vh-65px)] lg:border-b-0 lg:border-r lg:px-4 lg:py-7 dark:border-slate-700 dark:bg-[#151a21]">
          <nav aria-label="Seções do portal">
            <p className="mb-3 hidden px-3 text-xs font-semibold text-slate-500 lg:block">
              Área do estudante
            </p>
            <ul className="grid grid-cols-3 gap-1 lg:flex lg:flex-col" role="tablist">
              {TABS.map((tab) => (
                <li key={tab.key} role="presentation" className="min-w-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active === tab.key}
                    aria-controls={`panel-${tab.key}`}
                    id={`tab-${tab.key}`}
                    onClick={() => selectTab(tab.key)}
                    className={`relative flex min-h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-[11px] leading-tight transition-colors duration-150 ease-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-2 sm:text-xs lg:justify-start lg:px-3 lg:text-sm ${
                      active === tab.key
                        ? "bg-white/70 font-semibold text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary dark:bg-[#252b34]/70 dark:text-[#f0b7c3] dark:after:bg-[#f0b7c3] lg:bg-transparent lg:after:bottom-2 lg:after:left-0 lg:after:right-auto lg:after:top-2 lg:after:h-auto lg:after:w-0.5"
                        : "font-medium text-slate-600 hover:bg-white/70 hover:text-primary dark:text-slate-300 dark:hover:bg-[#202630] dark:hover:text-[#f0b7c3]"
                    }`}
                  >
                    {(() => {
                      const Icon = tab.icon;
                      return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
                    })()}
                    <span className="min-w-0 break-words">{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Painéis: uma tela visível por vez; o landmark main permanece único. */}
        <main
          id="conteudo"
          tabIndex={-1}
          aria-label="Conteúdo principal"
          className="min-w-0 bg-white px-4 py-5 outline-none sm:px-6 sm:py-6 lg:my-2 lg:mr-2 lg:rounded-2xl lg:border lg:border-slate-200 lg:px-8 lg:py-7 dark:bg-[#171b22] dark:lg:border-slate-700"
        >
          {active === "curriculo" ? (
            <div role="tabpanel" id="panel-curriculo" aria-labelledby="tab-curriculo" tabIndex={-1}>
              <ResumeBuilderPage />
            </div>
          ) : null}
          {active === "oportunidades" ? (
            <div role="tabpanel" id="panel-oportunidades" aria-labelledby="tab-oportunidades" tabIndex={-1}>
              <JobOpportunities />
            </div>
          ) : null}
          {active === "candidaturas" ? (
            <div role="tabpanel" id="panel-candidaturas" aria-labelledby="tab-candidaturas" tabIndex={-1}>
              <MyApplicationsPage />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
