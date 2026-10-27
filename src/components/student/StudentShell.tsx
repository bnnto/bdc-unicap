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
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          {/* Esquerda: logo institucional UNICAP. */}
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-white"
            >
              UC
            </span>
            <div className="min-w-0">
              <p className="font-serif text-lg font-bold leading-tight text-primary">
                Banco de Currículos — UNICAP
              </p>
              <p className="text-xs text-slate-500">Portal do Aluno</p>
            </div>
          </div>

          {/* Centro: abas de navegação (padrão ARIA tabs) sobre uma
              régua full-width — sublinhado de 2px marca o ativo. */}
          <nav aria-label="Seções do portal" className="order-3 lg:order-2">
            <ul
              className="flex flex-wrap items-center gap-1 border-b border-slate-200"
              role="tablist"
            >
              {TABS.map((tab) => (
                <li key={tab.key} role="presentation" className="flex">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active === tab.key}
                    aria-controls={`panel-${tab.key}`}
                    id={`tab-${tab.key}`}
                    onClick={() => selectTab(tab.key)}
                    className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors duration-150 ease-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      active === tab.key
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent font-medium text-slate-500 hover:text-primary"
                    }`}
                  >
                    {(() => {
                      const Icon = tab.icon;
                      return (
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      );
                    })()}
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Direita: avatar + nome como um único botão que leva à
              central de configurações /perfil ([UX_REFINEMENT] Etapa 3 —
              sem dropdown; o "Sair" está dentro de /perfil). O nome
              truncado guarda o valor completo em `title` (resiliência). */}
          <div className="order-2 flex items-center gap-2 lg:order-3">
            <button
              type="button"
              aria-label="Meu perfil e configurações"
              title={userName}
              onClick={() => navigateTo("/perfil")}
              className="flex max-w-[14rem] items-center gap-2 rounded-full p-0.5 pr-3 transition-colors duration-150 ease-soft hover:bg-[#FDF2F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-white">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-9 w-9 object-cover"
                  />
                ) : (
                  initialsOf(userName)
                )}
              </span>
              <span className="hidden truncate text-sm font-semibold text-slate-700 sm:block">
                {userName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Painéis: uma tela visível por vez (renderização condicional).
          [S8-2] landmark main único do fluxo do aluno (#conteudo). */}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Conteúdo principal"
        className="outline-none"
      >
        {active === "curriculo" ? (
          <div
            role="tabpanel"
            id="panel-curriculo"
            aria-labelledby="tab-curriculo"
            tabIndex={-1}
          >
            <ResumeBuilderPage />
          </div>
        ) : null}
        {active === "oportunidades" ? (
          <div
            role="tabpanel"
            id="panel-oportunidades"
            aria-labelledby="tab-oportunidades"
            tabIndex={-1}
          >
            <JobOpportunities />
          </div>
        ) : null}
        {active === "candidaturas" ? (
          <div
            role="tabpanel"
            id="panel-candidaturas"
            aria-labelledby="tab-candidaturas"
            tabIndex={-1}
          >
            <MyApplicationsPage />
          </div>
        ) : null}
      </main>
    </>
  );
}
