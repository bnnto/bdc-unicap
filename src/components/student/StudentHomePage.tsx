import { Card } from "../ui/card";
import { StudentProfileForm } from "./StudentProfileForm";
import { PrivacySettings } from "./PrivacySettings";
import { ResumeForm } from "./ResumeForm";
import { ResumeDownload } from "./ResumeDownload";
import { JobOpportunities } from "./JobOpportunities";
import { MyApplicationsPage } from "./MyApplicationsPage";

/**
 * Home do aluno (issue [S1-3]): cadastro/edição do perfil em Card
 * institucional. Rotas por papel são renderizadas pelo App via useAuthState.
 */
export function StudentHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-secondary">
          Portal do Aluno
        </p>
        <h1 className="font-serif text-2xl font-bold text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dados usados para validar seu vínculo com a UNICAP (R1) e compor o
          banco de talentos — visível a recrutadores conforme sua escolha de
          privacidade ([S1-4]). Use o currículo abaixo para destacar headline,
          experiências e histórico acadêmico ([S2-1]).
        </p>
      </header>
      <Card title="Cadastro do aluno" accent="primary">
        <StudentProfileForm />
      </Card>
      <div className="mt-6">
        <PrivacySettings />
      </div>
      <div className="mt-6">
        <Card title="Currículo Vitae" accent="secondary">
          <ResumeForm />
          <div
            className="my-4 border-t border-slate-200"
            role="separator"
            aria-hidden="true"
          />
          <ResumeDownload />
        </Card>
      </div>
      <div className="mt-6">
        <JobOpportunities />
      </div>
      <div className="mt-6">
        <MyApplicationsPage />
      </div>
    </div>
  );
}
