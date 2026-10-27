/**
 * [RECRUITER_VIEW_PROFILE] Visualização de currículo em SOMENTE
 * LEITURA, extraída do design do Portal do Aluno (ResumeForm) para
 * reuso na página dedicada do candidato (CandidateProfilePage).
 *
 *  - `ResumeBlockContent` renderiza o conteúdo de leitura de UM bloco
 *    (0–6) — é exatamente o markup que o ResumeForm exibe no modo
 *    visualização do aluno, sem nenhum botão de edição.
 *  - `ResumeView` renderiza os 7 blocos completos (cabeçalho + conteúdo)
 *    para o recrutador — cabeçalhos idênticos aos do aluno, porém com
 *    subtítulo de somente leitura e SEM o lápis de edição.
 *  - Os rótulos/ids dos blocos (`BLOCK_LABELS`, `BLOCO_IDS`) e o tipo
 *    `ResumeBlockData` vivem em `resumeBlocks.ts` — fonte única de
 *    verdade compartilhada com o ResumeForm (sem duplicação).
 *
 * [REFACTOR_ALUNO visual] — pares rótulo/valor em tom de fundo (sem
 * caixa com borda), rótulos em caixa de frase (sem caixa alta espaçada),
 * URLs quebram só quando precisam (`break-words`) e chips nunca
 * encolhem (`whitespace-nowrap`).
 */
import {
  BLOCK_LABELS,
  BLOCO_IDS,
  LEVEL_LABELS,
  type ResumeBlockData,
} from "./resumeBlocks";

export type { ResumeBlockData } from "./resumeBlocks";

/** Rótulo de um par rótulo/valor dentro da caixa em tom de fundo. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium text-slate-500">{children}</span>
  );
}

/** Valor do par rótulo/valor (tinta cheia, quebra só quando precisa). */
function FieldValue({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`mt-0.5 block break-words text-sm font-medium text-slate-800 ${className}`}
    >
      {children}
    </span>
  );
}

/** Caixa de conteúdo em tom de fundo (superfície separada por tom, não por linha). */
function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm">{children}</p>
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
    <div className="space-y-3">
      {blockIndex === 0 && (
        <>
          <FieldBox>
            <FieldLabel>Headline</FieldLabel>
            <FieldValue>{data.headline || "—"}</FieldValue>
          </FieldBox>
          <FieldBox>
            <FieldLabel>Resumo profissional</FieldLabel>
            <FieldValue className="whitespace-pre-wrap">
              {data.summary || "—"}
            </FieldValue>
          </FieldBox>
        </>
      )}

      {blockIndex === 1 && (
        <>
          <FieldBox>
            <FieldLabel>Curso</FieldLabel>
            <FieldValue>{data.course}</FieldValue>
          </FieldBox>
          {data.academicHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum item no histórico acadêmico ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.academicHistory.map((entry, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="min-w-0 break-words text-slate-800">
                    {entry.item}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
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
          <FieldBox>
            <FieldLabel>LinkedIn</FieldLabel>
            <FieldValue>
              {contactBlocked
                ? "Contato não liberado pelo aluno"
                : data.linkedinUrl || "Não cadastrado"}
            </FieldValue>
          </FieldBox>
          <FieldBox>
            <FieldLabel>Portfólio</FieldLabel>
            <FieldValue>
              {contactBlocked
                ? "Contato não liberado pelo aluno"
                : data.portfolioUrl || "Não cadastrado"}
            </FieldValue>
          </FieldBox>
          <FieldBox>
            <FieldLabel>GitHub</FieldLabel>
            <FieldValue>{data.githubUrl || "Não cadastrado"}</FieldValue>
          </FieldBox>
          <FieldBox>
            <FieldLabel>Currículo Lattes</FieldLabel>
            <FieldValue>{data.lattesUrl || "Não cadastrado"}</FieldValue>
          </FieldBox>
        </div>
      )}

      {blockIndex === 3 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Competências atuais"
        >
          {data.skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma competência adicionada ainda.
            </p>
          ) : (
            data.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
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
                className="rounded-lg bg-slate-50 px-4 py-3 text-sm"
              >
                <span className="block break-words text-slate-800">
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
                  className="rounded-lg bg-slate-50 px-4 py-3 text-sm"
                >
                  <p className="break-words font-semibold text-slate-800">
                    {exp.company} — {exp.role}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                    {exp.period}
                  </p>
                  {exp.description ? (
                    <p className="mt-2 leading-relaxed text-slate-600">
                      {exp.description}
                    </p>
                  ) : null}
                </div>
              ))}
              {data.projectsText ? (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <span className="block text-xs font-medium text-slate-500">
                    Projetos de Extensão
                  </span>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {data.projectsText}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {blockIndex === 6 && (
        <div className="space-y-2">
          {data.certifications.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma certificação registrada.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.certifications.map((item, index) => (
                <li key={index} className="break-words text-sm text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
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
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {block.index + 1}. {block.heading}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dados fornecidos pelo próprio candidato — somente leitura.
            </p>
          </div>
          <ResumeBlockContent blockIndex={block.index} data={data} />
        </section>
      ))}
    </div>
  );
}
