/**
 * Termo de consentimento LGPD versionado (issue [S1-2], R7).
 * Fonte única do texto vigente, compartilhada entre frontend (exibição) e
 * backend (`convex/consentTerms.ts` espelha a versão aceitável).
 * Alterar o termo exige nova versão (vX.Y) — nunca editar o texto in-place.
 */

export const CONSENT_TERM_VERSION = "v1.1";

export const CONSENT_TERM = `TERMO DE CONSENTIMENTO LGPD — BANCO DE CURRÍCULOS E SETOR DE EXTENSÃO DA UNICAP (${CONSENT_TERM_VERSION})

A Universidade Católica de Pernambuco (UNICAP), na condição de controladora, trata dados pessoais de estudantes, egressos, recrutadores e empresas parceiras por meio do Banco de Currículos e do Setor de Extensão, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).

1. Dados tratados e finalidades
(a) Dados de identificação (nome, e-mail, matrícula, curso, semestre/ano de formação) — para validar vínculo com a UNICAP, permitir cadastro e candidaturas a vagas.
(b) Dados acadêmicos e profissionais declarados (competências, idiomas, histórico acadêmico, links de LinkedIn/GitHub/Portfólio, currículo) — para compor o banco de talentos, calcular compatibilidade com vagas e divulgar oportunidades.
(c) Dados de recrutadores/empresas (nome, e-mail, empresa) — para publicação de vagas e gestão de candidaturas.

2. Base legal
O tratamento ocorre com base no seu consentimento (art. 7º, I) e, quando aplicável, no cumprimento de obrigações legais e no legítimo interesse da administração acadêmica (art. 7º, II e IX).

3. Compartilhamento e visibilidade
Seus dados de contato só ficam visíveis a recrutadores quando você autoriza expressamente ("Visível para recrutadores") ou quando você participa de um processo seletivo e aceita liberar o contato — regra prevista no art. 7º, I, e respeitada por todo o sistema. Estudantes/egressos com matrícula inativa não aparecem nas buscas públicas.

4. Conservação e segurança
Os dados são conservados durante o vínculo com a UNICAP e pelo prazo necessário às finalidades descritas, com exclusão ou anonimização após solicitação. Adotamos medidas técnicas (criptografia em trânsito — HTTPS — e em repouso, controle de acesso por papéis e trilha de auditoria de consentimentos) conforme art. 46 da LGPD.

5. Direitos do titular
A qualquer momento, sem custo, você pode solicitar: confirmação de tratamento; acesso aos dados; correção de dados incompletos, inexatos ou desatualizados; portabilidade; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; informação sobre compartilhamentos; e revogação do consentimento. Canais: Coordenação do Banco de Currículos e Encarregado (DPO) da UNICAP — dpo@unicap.br.

6. Revogação
Este consentimento pode ser revogado a qualquer tempo, mediante solicitação ao Encarregado. A revogação implica o desaparecimento do seu perfil das buscas de recrutadores e a impossibilidade de novas candidaturas, sem prejuízo dos tratamentos já realizados.

7. Aceite
Ao assinalar "Li e aceito o Termo de Consentimento LGPD", você declara ter lido e compreendido este termo (${CONSENT_TERM_VERSION}) e consente, de forma livre, informada e inequívoca, com o tratamento dos seus dados para as finalidades aqui descritas. O aceite é registrado com versão do termo, data e hora (trilha de auditoria).`;

/** Changelog do termo — nova entrada a cada versão publicada. */
export const CONSENT_TERM_CHANGELOG: ReadonlyArray<{
  version: string;
  publishedAt: string;
  summary: string;
}> = [
  {
    version: "v1.1",
    publishedAt: "2026-10-17",
    summary:
      "Renomeação institucional: o sistema passa a chamar-se Banco de Currículos (mesmas finalidades e bases legais).",
  },
  {
    version: "v1.0",
    publishedAt: "2026-09-25",
    summary: "Criação do termo de consentimento LGPD do Portal (R7).",
  },
];

/** Versão curta para exibição próxima ao checkbox de aceite. */
export function consentSummary(): string {
  return (
    `Termo de Consentimento LGPD (${CONSENT_TERM_VERSION}) — tratamento de dados ` +
    "pessoais para cadastro, banco de talentos, vagas e extensão, com contato " +
    "a recrutadores apenas mediante sua autorização."
  );
}

/** Verifica se uma versão registrada corresponde à vigente. */
export function isCurrentTerm(version: string): boolean {
  return version === CONSENT_TERM_VERSION;
}
