import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  buildResumeDocument,
  buildResumeMarkup,
  formatResumeFileName,
} from "../../lib/resumeDocument";
import {
  clearResumePrintContainer,
  printResumeDocument,
  renderResumeIntoPrintContainer,
} from "../../lib/resumePrint";
import { Button } from "../ui/button";

/**
 * Download do Currículo Vitae em PDF (issue [S2-2]) — sem libs pesadas:
 * o template institucional UNICAP é montado pela regra pura
 * `buildResumeDocument` e impresso pelo próprio navegador
 * (`window.print()` → "Salvar como PDF"), sempre a partir dos dados
 * salvos do formulário (CA 1) com identidade UNICAP (CA 2).
 */
export function ResumeDownload() {
  const profile = useQuery(api.students.myProfile, {});
  const [showPreview, setShowPreview] = useState(false);

  const doc = useMemo(() => {
    if (profile === undefined || profile === null) return null;
    return buildResumeDocument({
      student: {
        fullName: profile.fullName,
        enrollment: profile.enrollment,
        course: profile.course,
        status: profile.status,
        graduationYear: profile.graduationYear,
        semester: profile.semester ?? null,
        location: profile.location ?? null,
        linkedinUrl: profile.linkedinUrl ?? null,
        portfolioUrl: profile.portfolioUrl ?? null,
        availability: profile.availability,
        // [REFACTOR_ALUNO] coluna lateral do CV: skills e idiomas.
        skills: profile.skills ?? [],
        languages: (profile.languages ?? []).map((language) => ({
          name: language.name,
          level: language.level,
        })),
      },
      resume: profile.resumeData ?? null,
    });
  }, [profile]);

  const markup = useMemo(
    () => (doc !== null && doc.ok ? buildResumeMarkup(doc) : null),
    [doc],
  );

  // Prévia ao vivo: o mesmo template usado no PDF fica na tela.
  useEffect(() => {
    if (showPreview && markup !== null) {
      renderResumeIntoPrintContainer(document, markup);
      return () => clearResumePrintContainer(document);
    }
  }, [showPreview, markup]);

  if (profile === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando currículo…
      </p>
    );
  }

  if (doc === null || !doc.ok) {
    const reason = doc !== null && !doc.ok ? doc.reason : "perfil_inexistente";
    return (
      <p className="text-sm text-slate-600">
        {reason === "curriculo_inexistente"
          ? "Salve o currículo no formulário acima antes de gerar o PDF."
          : "Complete o cadastro do perfil antes de gerar o currículo."}
      </p>
    );
  }

  function handleDownload(): void {
    if (markup === null) return;
    printResumeDocument(markup);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Gere o PDF a partir dos dados salvos no formulário, no template
        institucional UNICAP. Na janela de impressão, escolha “Salvar como PDF”
        — o arquivo sai com o seu nome e curso.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={handleDownload}
          aria-label={`Baixar currículo em PDF (${formatResumeFileName(doc.student.fullName, doc.student.course, doc.student.graduationYear)})`}
        >
          Baixar currículo (PDF)
        </Button>
        <Button
          variant="secondary"
          aria-expanded={showPreview}
          onClick={() => setShowPreview((value) => !value)}
        >
          {showPreview ? "Ocultar prévia" : "Visualizar antes de baixar"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Arquivo sugerido:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">
          {formatResumeFileName(
            doc.student.fullName,
            doc.student.course,
            doc.student.graduationYear,
          )}
        </code>
      </p>
      {showPreview ? (
        // O markup já traz o wrapper .unicap-resume-doc — este container
        // é só a moldura da prévia na página (mesmo estilo do PDF).
        <div
          className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
          data-testid="resume-preview"
          dangerouslySetInnerHTML={{ __html: markup ?? "" }}
        />
      ) : null}
    </div>
  );
}
