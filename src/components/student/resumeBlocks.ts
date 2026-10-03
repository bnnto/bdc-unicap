/**
 * [RECRUITER_VIEW_PROFILE] Metadados dos 7 blocos do currículo,
 * compartilhados pelo portal do aluno (ResumeForm) e pela página de
 * somente leitura do recrutador (ResumeView/CandidateProfilePage).
 *
 * Módulo SEM componentes de propósito: os rótulos são constantes puras
 * (e o lint `react-refresh/only-export-components` exige que constantes
 * vivam fora de arquivos de componente).
 */
import type { LanguageEntry } from "../../lib/skills";

/**
 * Rótulos dos 7 blocos do currículo (ícone de lápis em cada um no
 * portal do aluno, Etapa 2 do UX_REFINEMENT). `label` curto vai no
 * aria-label do lápis; `heading` rico é o título h2 exibido na página
 * (spec dos 7 blocos).
 */
export const BLOCK_LABELS: Array<{
  index: number;
  label: string;
  heading: string;
}> = [
  {
    index: 0,
    label: "Dados Pessoais",
    heading: "Dados Pessoais & Apresentação Profissional",
  },
  {
    index: 1,
    label: "Formação",
    heading: "Formação Acadêmica Institucional UNICAP",
  },
  {
    index: 2,
    label: "Links",
    heading: "Links Profissionais, Portfólio & Lattes",
  },
  {
    index: 3,
    label: "Competências",
    heading: "Competências & Tecnologias (Skills)",
  },
  {
    index: 4,
    label: "Idiomas",
    heading: "Idiomas & Nível de Proficiência",
  },
  {
    index: 5,
    label: "Experiências",
    heading: "Experiências Profissionais e Projetos de Extensão",
  },
  {
    index: 6,
    label: "Certificações",
    heading: "Certificações & Atividades Complementares",
  },
];

/** Ids âncora dos blocos (`#bloco-pessoais` etc.). */
export const BLOCO_IDS = [
  "pessoais",
  "academico",
  "links",
  "competencias",
  "idiomas",
  "experiencias",
  "certificacoes",
] as const;

/** Rótulos pt-BR dos níveis de idioma (portal do aluno e página do candidato). */
export const LEVEL_LABELS: Record<LanguageEntry["level"], string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

/**
 * Dados necessários para renderizar os 7 blocos em modo leitura.
 * `year` aceita string (rascunho do formulário do aluno) ou number
 * (gravado no banco) — os dois renderizam igual.
 */
export type ResumeBlockData = {
  course: string;
  headline: string;
  summary: string;
  academicHistory: Array<{ item: string; year: string | number }>;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  lattesUrl: string;
  skills: string[];
  languages: LanguageEntry[];
  experiences: Array<{
    company: string;
    role: string;
    period: string;
    description: string;
  }>;
  projectsText: string;
  certifications: string[];
  /**
   * [R6] true quando o contato do aluno NÃO está liberado para este
   * recrutador: o Bloco 2 omite LinkedIn/Portfólio (mesma regra do
   * servidor) em vez de exibir valores reservados.
   */
  contactBlocked?: boolean;
};
