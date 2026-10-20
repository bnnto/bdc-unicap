import type { Doc } from "../../../convex/_generated/dataModel";
import { navigateTo } from "../../lib/router";
import { Button } from "../ui/button";
import { LogOut } from "lucide-react";

/**
 * [MODERACAO_RECRUTADOR] Tela exibida ao recrutador enquanto o cadastro
 * está pendente ou depois de recusado/revogado. O acesso real é barrado
 * no servidor (guards); aqui só explicamos a situação.
 */
export function RecruiterApprovalGate({ user }: { user: Doc<"users"> }) {
  const refused = user.approvalStatus === "recusado";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Situação do cadastro"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-level2 outline-none"
      >
        <h1 className="font-serif text-2xl font-bold text-primary">
          {refused ? "Cadastro não aprovado" : "Aguardando aprovação"}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {refused
            ? "A coordenação não aprovou o seu cadastro de recrutador."
            : "Seu cadastro foi enviado e está em análise pela coordenação. Você será avisado por e-mail quando houver uma decisão."}
        </p>
        {refused && user.approvalReason ? (
          <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">Motivo: </span>
            {user.approvalReason}
          </p>
        ) : null}
        <div className="mt-6">
          <Button variant="primary" onClick={() => navigateTo("/perfil")}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Configurações e sair
          </Button>
        </div>
      </main>
    </div>
  );
}