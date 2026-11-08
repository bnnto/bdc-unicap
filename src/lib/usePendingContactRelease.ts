import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Candidaturas em que o aluno AINDA NÃO liberou o contato (R6 / LGPD).
 *
 * Regra: `processAccepted === false` e processo ainda não encerrado como
 * "reprovado" (não faz sentido cobrar liberação de contato de quem já foi
 * reprovado). É a mesma regra usada pela página de candidaturas, para o
 * número do badge, o aviso e os cards nunca divergirem.
 */
export function isContactPending(application: {
  stage: string;
  processAccepted: boolean;
}): boolean {
  return application.stage !== "reprovado" && !application.processAccepted;
}

export type PendingContactRelease = {
  /** Candidaturas com contato ainda não liberado. */
  pending: number;
  /** Total de candidaturas do aluno. */
  total: number;
  isLoading: boolean;
};

export function usePendingContactRelease(): PendingContactRelease {
  // Mesma query da página → o Convex reaproveita a assinatura (sem custo extra).
  const applications = useQuery(api.applications.myApplications, {});
  if (applications === undefined) {
    return { pending: 0, total: 0, isLoading: true };
  }
  return {
    pending: applications.filter(isContactPending).length,
    total: applications.length,
    isLoading: false,
  };
}