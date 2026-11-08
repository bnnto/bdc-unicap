import { useAuthState } from "../auth/authContext";
import { PillNavbar } from "../nav/PillNavbar";
import { ResumeBuilderPage } from "./ResumeBuilderPage";
import { JobOpportunities } from "./JobOpportunities";
import { MyApplicationsPage } from "./MyApplicationsPage";
import { PendingBadge } from "./PendingBadge";
import { usePendingContactRelease } from "../../lib/usePendingContactRelease";
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
 * Contato não liberado: a aba "Minhas Candidaturas" ganha um badge com a
 * quantidade de vagas pendentes. O aviso completo vive só na própria página.
 */

export type StudentTab = "curriculo" | "oportunidades" | "candidaturas";

export const STUDENT_TABS: Array<{ key: StudentTab; label: string; icon: LucideIcon }> = [
  { key: "curriculo", label: "Meu Currículo", icon: FileText },
  { key: "oportunidades", label: "Oportunidades", icon: Briefcase },
  { key: "candidaturas", label: "Minhas Candidaturas", icon: Send },
];

/**
 * A aba ativa vive na URL (/aluno/curriculo, /aluno/oportunidades,
 * /aluno/candidaturas) — assim F5 mantém o aluno onde ele estava e o botão
 * "voltar" do navegador funciona. Qualquer outro caminho cai em "curriculo".
 */
export function studentTabPath(tab: StudentTab): string {
  return `/aluno/${tab}`;
}

export function parseStudentTabPath(pathname: string): StudentTab {
  const match = /^\/aluno\/([^/]+)\/?$/.exec(pathname);
  const found = STUDENT_TABS.find((t) => t.key === match?.[1]);
  return found?.key ?? "curriculo";
}

/**
 * Navbar do aluno com o badge de pendências. Também é usada em /perfil
 * (App.tsx), para o número aparecer lá também.
 */
export function StudentPillNavbar({
  active,
  onChange,
  userName,
  userImage,
  userActive,
}: {
  active: StudentTab | null;
  onChange: (tab: StudentTab) => void;
  userName: string;
  userImage?: string;
  userActive?: boolean;
}) {
  const { pending } = usePendingContactRelease();
  return (
    <PillNavbar<StudentTab>
      navLabel="Seções do portal"
      tabs={STUDENT_TABS.map(({ key, label }) => ({
        key,
        label,
        badge:
          key === "candidaturas" && pending > 0 ? (
            <PendingBadge count={pending} />
          ) : undefined,
      }))}
      active={active}
      userActive={userActive}
      onChange={onChange}
      userName={userName}
      userImage={userImage}
    />
  );
}

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
      <StudentPillNavbar
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