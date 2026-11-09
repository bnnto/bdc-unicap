import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  buildResumeDocument,
  buildResumeMarkup,
  formatResumeFileName,
} from "../../../lib/resumeDocument";
import {
  printResumeDocument,
  injectResumePrintStyle,
} from "../../../lib/resumePrint";
import { Button } from "../../ui/button";
import { Download, Eye } from "lucide-react";

/**
 * Download do Currículo Vitae em PDF (issue [S2-2]) — sem libs pesadas:
 * o template institucional UNICAP é montado pela regra pura
 * `buildResumeDocument` e impresso pelo próprio navegador
 * (`window.print()` → "Salvar como PDF"), sempre a partir dos dados
 * salvos do formulário (CA 1) com identidade UNICAP (CA 2).
 *
 * Responsividade: botões em largura total (44px) no celular; a prévia do
 * documento (layout de página) rola na horizontal dentro de uma região
 * focável, sem estourar a largura da tela.
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
        // [CV_LAYOUT_V2] contatos do cabeçalho do PDF.
        phone: profile.phone ?? null,
        email: profile.email ?? null,
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
    <div className="flex min-w-0 flex-col gap-5">
      {/* Bloco de instrução amigável e destacado */}
      <div className="rounded-xl bg-[#FDF2F4] p-4 text-sm leading-relaxed text-slate-700 sm:p-6">
        O seu currículo já está formatado no{" "}
        <strong className="font-semibold text-primary">
          padrão oficial da UNICAP
        </strong>
        . Ao clicar no botão de download, escolha a opção{" "}
        <strong className="font-semibold text-primary">
          "Salvar como PDF"
        </strong>{" "}
        na janela de impressão do seu navegador.
      </div>

      {/* Mobile: botões empilhados em largura total (44px). sm+: em linha. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-auto [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto">
          <Button
            variant="primary"
            onClick={handleDownload}
            aria-label={`Baixar currículo em PDF (${formatResumeFileName(doc.student.fullName, doc.student.course, doc.student.graduationYear)})`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar currículo (PDF)
          </Button>
        </div>
        <div className="w-full sm:w-auto [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto">
          <Button
            variant="secondary"
            aria-expanded={showPreview}
            onClick={() => setShowPreview((value) => !value)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {showPreview ? "Ocultar prévia" : "Visualizar antes de baixar"}
          </Button>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500 sm:text-xs">
        Nome sugerido para o arquivo:
        <code className="min-w-0 max-w-full break-all rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-slate-600">
          {formatResumeFileName(
            doc.student.fullName,
            doc.student.course,
            doc.student.graduationYear,
          )}
        </code>
      </p>

      {showPreview ? (
        <>
          {/* A folha do currículo é fluida (largura 100% até 210mm), então
              raramente rola; a região continua focável e com rolagem
              contida como rede de segurança (ex.: URLs enormes). */}
          <div
            role="region"
            aria-label="Prévia do currículo"
            tabIndex={0}
            className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4 lg:p-8"
            style={{ backgroundColor: 'white', color: 'black' }}
            data-testid="resume-preview"
            dangerouslySetInnerHTML={{ __html: markup ?? "" }}
          />
        </>
      ) : null}
    </div>
  );
}