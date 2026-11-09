/**
 * [RECRUITER_VIEW_PROFILE] Visualização de currículo em SOMENTE
 * LEITURA, extraída do design do Portal do Aluno (ResumeForm) para
 * reuso na página dedicada do candidato (CandidateProfilePage).
 *
 *  - `ResumeBlockContent` renderiza o conteúdo de leitura de UM bloco
 *    (0–6) — é exatamente o markup que o ResumeForm exibe no modo
 *    visualização do aluno (cards `bg-slate-50` com rótulos em caixa
 *    alta), sem nenhum botão de edição.
 *  - `ResumeView` renderiza os 7 blocos completos (cabeçalho + conteúdo)
 *    para o recrutador — cabeçalhos idênticos aos do aluno, porém com
 *    subtítulo de somente leitura e SEM o lápis de edição.
 *  - Os rótulos/ids dos blocos (`BLOCK_LABELS`, `BLOCO_IDS`) e o tipo
 *    `ResumeBlockData` vivem em `resumeBlocks.ts` — fonte única de
 *    verdade compartilhada com o ResumeForm (sem duplicação).
 *
 * Responsividade: textos longos quebram (`overflow-wrap:anywhere`) em vez
 * de estourar a largura, textos auxiliares têm 13px no mobile, os itens
 * com ação quebram de linha em telas estreitas e o botão "Ver certificado"
 * tem 44px de altura em telas de toque.
 */
import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  BLOCK_LABELS,
  BLOCO_IDS,
  LEVEL_LABELS,
  type ResumeBlockData,
} from "./resumeBlocks";
import { CertificateViewer } from "./CertificateViewer";

export type { ResumeBlockData } from "./resumeBlocks";

/** Texto auxiliar: 13px no mobile (legível), 12px de sm para cima. */
const SMALL = "text-[13px] sm:text-xs";

/**
 * [CERT_PDF] Lista de certificações (bloco 7). Cada item com PDF anexado
 * ganha o botão "Ver certificado", que abre o PDF num modal dentro do site
 * (sem baixar). Componente próprio porque precisa de estado.
 */
function CertificationsList({
  items,
}: {
  items: ResumeBlockData["certifications"];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const opened = openIndex !== null ? items[openIndex] : undefined;

  function close(): void {
    const index = openIndex;
    setOpenIndex(null);
    if (index !== null) {
      requestAnimationFrame(() =>
        triggerRefs.current[index]?.focus({ preventScroll: true }),
      );
    }
  }

  return (
    <>
      {items.map((item, index) => (
        // flex-wrap: em telas estreitas o botão desce para a linha de baixo
        // em vez de espremer o nome da certificação.
        <div
          key={index}
          className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-700"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
            {item.name}
          </span>
          {item.url ? (
            <button
              type="button"
              ref={(node) => {
                triggerRefs.current[index] = node;
              }}
              onClick={() => setOpenIndex(index)}
              aria-label={`Ver certificado: ${item.name}`}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-4 font-semibold text-primary transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:active:scale-100 sm:h-9 sm:px-3 [@media(hover:hover)]:hover:bg-primary [@media(hover:hover)]:hover:text-white [@media(pointer:coarse)]:h-11 ${SMALL}`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Ver certificado
            </button>
          ) : null}
        </div>
      ))}
      {opened?.url ? (
        <CertificateViewer
          title={opened.name}
          url={opened.url}
          onClose={close}
        />
      ) : null}
    </>
  );
}

/**
 * Conteúdo de leitura de UM bloco do currículo (0–6) — markup idêntico
 * à visualização do ResumeForm do aluno, sem qualquer controle de
 * edição. Usado pelo portal do aluno (modo view) e pela CandidateProfilePage.
 */
export function ResumeBlockContent({
  blockIndex,
  data,
}: {
  blockIndex: number;
  data: ResumeBlockData;
}) {
  const contactBlocked = data.contactBlocked === true;
  return (
    <div className="min-w-0 space-y-4">
      {blockIndex === 0 && (
        <>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Headline
            </span>
            <span className="font-medium text-slate-800 [overflow-wrap:anywhere]">
              {data.headline || "—"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resumo profissional
            </span>
            <span className="whitespace-pre-wrap font-medium text-slate-800 [overflow-wrap:anywhere]">
              {data.summary || "—"}
            </span>
          </p>
        </>
      )}

      {blockIndex === 1 && (
        <>
          {data.course.trim().length > 0 ? (
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Curso
              </span>
              <span className="font-medium text-slate-800 [overflow-wrap:anywhere]">
                {data.course}
              </span>
            </p>
          ) : null}
          {data.academicHistory.length === 0 ? (
            // O histórico é complemento: com o curso já informado, não há
            // o que avisar. O aviso só aparece quando não há nada de formação.
            data.course.trim().length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma formação cadastrada ainda.
              </p>
            ) : null
          ) : (
            <ul className="flex flex-col gap-2">
              {data.academicHistory.map((entry, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 text-slate-800 [overflow-wrap:anywhere]">
                    {entry.item}
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-xs text-slate-500">
                    {entry.year}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {blockIndex === 2 && (
        <div className="space-y-2">
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              LinkedIn
            </span>
            <span className="break-all font-medium text-slate-800">
              {contactBlocked
                ? "Contato não liberado pelo aluno"
                : data.linkedinUrl || "Não cadastrado"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Portfólio
            </span>
            <span className="break-all font-medium text-slate-800">
              {contactBlocked
                ? "Contato não liberado pelo aluno"
                : data.portfolioUrl || "Não cadastrado"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              GitHub
            </span>
            <span className="break-all font-medium text-slate-800">
              {data.githubUrl || "Não cadastrado"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Currículo Lattes
            </span>
            <span className="break-all font-medium text-slate-800">
              {data.lattesUrl || "Não cadastrado"}
            </span>
          </p>
        </div>
      )}

      {blockIndex === 3 && (
        <div className="flex flex-wrap gap-2" aria-label="Competências atuais">
          {data.skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma competência adicionada ainda.
            </p>
          ) : (
            data.skills.map((skill) => (
              <span
                key={skill}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700 [overflow-wrap:anywhere] ${SMALL}`}
              >
                {skill}
              </span>
            ))
          )}
        </div>
      )}

      {blockIndex === 4 && (
        <ul className="flex flex-col gap-2">
          {data.languages.length === 0 ? (
            <li className="text-sm text-slate-500">
              Nenhum idioma cadastrado ainda.
            </li>
          ) : (
            data.languages.map((language, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {language.name} — {LEVEL_LABELS[language.level]}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {blockIndex === 5 && (
        <div className="space-y-3">
          {data.experiences.length === 0 && !data.projectsText ? (
            <p className="text-sm text-slate-500">
              Nenhum projeto de extensão ou experiência registada.
            </p>
          ) : (
            <>
              {data.experiences.map((exp, index) => (
                <div
                  key={index}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                >
                  <p className="font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {exp.company} — {exp.role}
                  </p>
                  <p className={`text-slate-500 ${SMALL}`}>{exp.period}</p>
                  {exp.description ? (
                    <p
                      className={`mt-2 whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere] ${SMALL}`}
                    >
                      {exp.description}
                    </p>
                  ) : null}
                </div>
              ))}
              {data.projectsText ? (
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Projetos de Extensão
                  </p>
                  <p
                    className={`mt-1 whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere] ${SMALL}`}
                  >
                    {data.projectsText}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {blockIndex === 6 && (
        <div className="space-y-3">
          {data.certifications.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma certificação registrada.
            </p>
          ) : (
            <CertificationsList items={data.certifications} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Currículo completo em SOMENTE LEITURA (7 blocos) — usado pela
 * CandidateProfilePage do recrutador. Cabeçalhos espelham os do portal
 * do aluno, mas sem lápis, sem formulário e com subtítulo de leitura.
 */
export function ResumeView({ data }: { data: ResumeBlockData }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-5 sm:gap-6"
      aria-label="Currículo (somente leitura)"
    >
      {BLOCK_LABELS.map((block) => (
        <section
          key={block.index}
          id={`bloco-${BLOCO_IDS[block.index]}`}
          className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-level1 sm:p-6"
        >
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-primary [overflow-wrap:anywhere]">
                {block.index + 1}. {block.heading}
              </h2>
              <p className={`mt-0.5 text-slate-500 ${SMALL}`}>
                Dados fornecidos pelo próprio candidato — somente leitura.
              </p>
            </div>
            <ResumeBlockContent blockIndex={block.index} data={data} />
          </div>
        </section>
      ))}
    </div>
  );
}