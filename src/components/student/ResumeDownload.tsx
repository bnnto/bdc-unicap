import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  buildResumeDocument,
  buildResumeMarkup,
  formatResumeFileName,
} from "../../lib/resumeDocument";
import {
  printResumeDocument,
  injectResumePrintStyle,
} from "../../lib/resumePrint";
import { Button } from "../ui/button";
import { Download, Eye } from "lucide-react";

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

  useEffect(() => {
    if (showPreview && markup !== null) {
      injectResumePrintStyle(document);
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
          : "Preencha o Bloco 1 (Dados Pessoais) e salve para gerar o PDF do seu currículo."}
      </p>
    );
  }

  function handleDownload(): void {
    // Adicionamos o !doc.ok aqui para o TypeScript ter 100% de certeza que temos os dados
    if (markup === null || doc === null || !doc.ok) return;
    
    // Agora o TypeScript já sabe que doc.student existe!
    const fileName = formatResumeFileName(
      doc.student.fullName,
      doc.student.course,
      doc.student.graduationYear
    );
    
    printResumeDocument(markup, fileName);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Bloco de instrução amigável e destacado */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-sm text-slate-800 dark:bg-primary/10 dark:text-slate-300">
        O seu currículo já está formatado no{" "}
        <strong className="font-semibold text-primary dark:text-white">
          padrão oficial da UNICAP
        </strong>
        . Ao clicar no botão de download, escolha a opção{" "}
        <strong className="font-bold text-primary dark:text-white">
          "Salvar como PDF"
        </strong>{" "}
        na janela de impressão do seu navegador.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={handleDownload}
          aria-label={`Baixar currículo em PDF (${formatResumeFileName(doc.student.fullName, doc.student.course, doc.student.graduationYear)})`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Baixar currículo (PDF)
        </Button>
        <Button
          variant="secondary"
          aria-expanded={showPreview}
          onClick={() => setShowPreview((value) => !value)}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {showPreview ? "Ocultar prévia" : "Visualizar antes de baixar"}
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        Nome sugerido para o arquivo:
        <code className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-slate-600">
          {formatResumeFileName(
            doc.student.fullName,
            doc.student.course,
            doc.student.graduationYear,
          )}
        </code>
      </p>

      {showPreview ? (
        <div
          className="mt-4 overflow-x-auto rounded-xl border border-slate-200 shadow-inner lg:p-8"
          style={{ backgroundColor: 'white', color: 'black' }}
          data-testid="resume-preview"
          dangerouslySetInnerHTML={{ __html: markup ?? "" }}
        />
      ) : null}
    </div>
  );
}
