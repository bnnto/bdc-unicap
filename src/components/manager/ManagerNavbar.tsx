import { PillNavbar } from "../nav/PillNavbar";
import { PendingRecruitersBadge } from "./PendingRecruitersBadge";
import { PendingJobsBadge } from "./PendingJobsBadge";

export type ManagerTabKey = "dashboard" | "recrutadores" | "moderacao";

type ManagerTabDef = {
  key: ManagerTabKey;
  label: string;
};

export const MANAGER_TABS: ManagerTabDef[] = [
  { key: "dashboard", label: "Painel Estratégico" },
  { key: "recrutadores", label: "Recrutadores" },
  { key: "moderacao", label: "Moderação" },
];

/** Navbar do gestor: abas + badges de pendências sobre a PillNavbar. */
export function ManagerNavbar({
  active,
  onChange,
  userName,
  userImage,
  userActive,
}: {
  /** Aba ativa (o AuthGate guarda um estado único para todos os papéis). */
  active: string | null;
  onChange: (tab: ManagerTabKey) => void;
  userName: string;
  userImage?: string;
  userActive?: boolean;
}) {
  return (
    <PillNavbar
      navLabel="Seções da gestão"
      tabs={MANAGER_TABS.map((tab) => ({
        ...tab,
        badge:
          tab.key === "recrutadores" ? (
            <PendingRecruitersBadge />
          ) : tab.key === "moderacao" ? (
            <PendingJobsBadge />
          ) : undefined,
      }))}
      active={active as ManagerTabKey | null}
      userActive={userActive}
      onChange={onChange}
      userName={userName}
      userImage={userImage}
    />
  );
}