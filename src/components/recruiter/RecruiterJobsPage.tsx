import { useState } from "react";
import { JobsPanel } from "./JobsPanel";
import { JobKanban } from "./JobKanban";

/**
 * [RECRUITER_UX_UPGRADE] Aba "Vagas & Pipeline" em modelo Master-Detail:
 *
 * - A página mostra SÓ a lista de vagas (o Kanban deixa de estar empilhado
 *   no fundo da página, competindo por espaço).
 * - "Ver Candidatos" na vaga troca a tela inteira para o Kanban daquela
 *   vaga (busca já com a vaga selecionada).
 * - "Voltar para Minhas Vagas" retorna à lista.
 */
export function RecruiterJobsPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  if (selectedJobId !== null) {
    return (
      <JobKanban
        initialJobId={selectedJobId}
        onBack={() => setSelectedJobId(null)}
      />
    );
  }

  return <JobsPanel onViewCandidates={(jobId) => setSelectedJobId(jobId)} />;
}
