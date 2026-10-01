import { Card } from "../ui/card";
import { StudentProfileForm } from "./StudentProfileForm";
import { PrivacySettings } from "./PrivacySettings";

/**
 * "Meu Perfil" do aluno (issues [S1-3]/[S1-4]) — cadastro e privacidade.
 *
 * [REFACTOR_ALUNO Etapa 1] — o portal virou abas na Navbar: Currículo,
 * Oportunidades e Candidaturas têm telas próprias no StudentShell; esta
 * página é acessada pelo menu do avatar ("Meu Perfil").
 */
export function StudentHomePage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Portal do Aluno
        </p>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Seus dados validam o vínculo com a UNICAP e compõem o banco de
          talentos — visível a recrutadores conforme sua escolha de privacidade.
          Edite seu currículo na aba “Meu Currículo”.
        </p>
        {/* [UX-P3] H8-1 — sumário por âncoras para a página longa. */}
        <nav
          aria-label="Seções desta página"
          className="mt-3 flex flex-wrap gap-2"
        >
          {[
            { href: "#secao-cadastro", label: "Cadastro" },
            { href: "#secao-privacidade", label: "Privacidade" },
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
      <div id="secao-cadastro">
        <Card title="Cadastro do aluno" accent="primary" headingLevel={2}>
          <StudentProfileForm />
        </Card>
      </div>
      <div className="mt-6" id="secao-privacidade">
        <PrivacySettings />
      </div>
    </div>
  );
}
