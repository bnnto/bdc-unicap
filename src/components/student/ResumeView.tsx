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
 */
import {
  BLOCK_LABELS,
  BLOCO_IDS,
  LEVEL_LABELS,
  type ResumeBlockData,
} from "./resumeBlocks";

export type { ResumeBlockData } from "./resumeBlocks";

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
    <div className="space-y-4">
      {blockIndex === 0 && (
        <>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Headline
            </span>
            <span className="font-medium text-slate-800">
              {data.headline || "—"}
            </span>
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resumo profissional
            </span>
            <span className="whitespace-pre-wrap font-medium text-slate-800">
              {data.summary || "—"}
            </span>
          </p>
        </>
      )}

      {blockIndex === 1 && (
        <>
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Curso
            </span>
            <span className="font-medium text-slate-800">{data.course}</span>
          </p>
          {data.academicHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum item no histórico acadêmico ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.academicHistory.map((entry, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-words text-slate-800">
                    {entry.item}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">
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
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
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
                <span>
                  {language.name} — {LEVEL_LABELS[language.level]}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {blockIndex === 5 && (
        <div className="space-y-3">
          {data.experiences.map((exp, index) => (
            <div
              key={index}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
            >
              <p className="font-semibold text-slate-800">
                {exp.company} — {exp.role}
              </p>
              <p className="text-xs text-slate-500">{exp.period}</p>
              {exp.description ? (
                <p className="mt-2 text-xs text-slate-600">{exp.description}</p>
              ) : null}
            </div>
          ))}
          {data.projectsText ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Projetos de Extensão
              </p>
              <p className="mt-1 text-xs text-slate-600">{data.projectsText}</p>
            </div>
          ) : null}
        </div>
      )}

      {blockIndex === 6 && (
        <div className="space-y-2">
          {data.certifications.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma certificação registrada.
            </p>
          ) : (
            data.certifications.map((item, index) => (
              <p
                key={index}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                  {index + 1}
                </span>
                {item}
              </p>
            ))
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
      className="flex flex-col gap-6"
      aria-label="Currículo (somente leitura)"
    >
      {BLOCK_LABELS.map((block) => (
        <section
          key={block.index}
          id={`bloco-${BLOCO_IDS[block.index]}`}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-level1"
        >
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-primary">
                {block.index + 1}. {block.heading}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
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
