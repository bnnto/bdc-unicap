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
      {" "}
      <header className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Portal do Aluno
        </p>
        <h1 className="font-serif text-2xl font-bold text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Seus dados validam o vínculo com a UNICAP e compõem o banco de
          talentos — visível a recrutadores conforme sua escolha de privacidade.
          Use o currículo abaixo para destacar headline, experiências e
          histórico acadêmico.
        </p>
        {/* [UX-P3] H8-1 — sumário por âncoras para a página longa. */}
        <nav
          aria-label="Seções desta página"
          className="mt-3 flex flex-wrap gap-2"
        >
          {[
            { href: "#secao-cadastro", label: "Cadastro" },
            { href: "#secao-privacidade", label: "Privacidade" },
            { href: "#secao-curriculo", label: "Currículo" },
            { href: "#secao-oportunidades", label: "Oportunidades" },
            { href: "#secao-candidaturas", label: "Minhas candidaturas" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-primary hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      {/* [S8-2]: headingLevel=2 — sob o h1 da página, sem saltos (1.3.1). */}
      <Card title="Cadastro do aluno" accent="primary" headingLevel={2}>
        <span id="secao-cadastro" className="sr-only">
          Cadastro
        </span>
        <StudentProfileForm />
      </Card>
      <div className="mt-6" id="secao-privacidade">
        <PrivacySettings />
      </div>
      <div className="mt-6" id="secao-curriculo">
        <Card title="Currículo Vitae" accent="secondary" headingLevel={2}>
          <ResumeForm />
          <div
            className="my-4 border-t border-slate-200"
            role="separator"
            aria-hidden="true"
          />
          <ResumeDownload />
        </Card>
      </div>
      <div className="mt-6" id="secao-oportunidades">
        <JobOpportunities />
      </div>
      <div className="mt-6" id="secao-candidaturas">
        <MyApplicationsPage />
      </div>
    </div>
  );
}
