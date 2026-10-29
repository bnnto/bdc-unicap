import { useAuthState } from "../auth/authContext";
import { PillNavbar } from "../nav/PillNavbar";
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
 */

export type StudentTab = "curriculo" | "oportunidades" | "candidaturas";

export const STUDENT_TABS: Array<{ key: StudentTab; label: string; icon: LucideIcon }> = [
  { key: "curriculo", label: "Meu Currículo", icon: FileText },
  { key: "oportunidades", label: "Oportunidades", icon: Briefcase },
  { key: "candidaturas", label: "Minhas Candidaturas", icon: Send },
];

export function StudentShell({
  tab,
  onTabChange,
}: {
  tab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
}) {
  const { user } = useAuthState();
  const userName = user?.name ?? user?.email ?? "Aluno";
  const active = tab;

  return (
    <>
      <PillNavbar
        navLabel="Seções do portal"
        tabs={STUDENT_TABS.map(({ key, label }) => ({ key, label }))}
        active={active}
        onChange={onTabChange}
        userName={userName}
        userImage={user?.image ?? undefined}
      />

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
