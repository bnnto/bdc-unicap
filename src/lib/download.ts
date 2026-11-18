/**
 * [PERFIL_E_LGPD] Etapa 3 — portabilidade em CSV: monta a planilha com
 * tudo que o portal guarda sobre o usuário e dispara o download no
 * navegador.
 *
 * O formato reaproveita o writer RFC 4180 de src/lib/reportExport.ts:
 * UTF-8 com BOM, separador ";" e CRLF — abre direto no Excel/LibreOffice
 * pt-BR, sem dependências novas. Usa ObjectURL quando disponível e cai
 * para data URL em ambientes sem createObjectURL (ex.: jsdom).
 */
import {
  toCsv,
  type ExportReport,
  type ReportCell,
  type ReportSection,
} from "./reportExport";
import { formatDay } from "./formatters";

/** Payload de `api.users.getMyDataExport` (só dados do próprio usuário). */
export type DataExportPayload = {
  exportedAt?: number;
  usuario?: Record<string, unknown> | null;
  consentimentos?: ReadonlyArray<Record<string, unknown>> | null;
  perfilAluno?: Record<string, unknown> | null;
  candidaturas?: ReadonlyArray<Record<string, unknown>> | null;
  vagasPublicadas?: ReadonlyArray<Record<string, unknown>> | null;
};

/** Nome do arquivo/relatório (vira o slug do nome baixado). */
export const DATA_EXPORT_NAME = "portal-carreiras-meus-dados";

/** Célula textual: nulo vira vazio, booleano vira Sim/Não, lista/objeto em texto. */
function text(value: unknown): ReportCell {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("; ");
  }
  return JSON.stringify(value) ?? "";
}

/** Data legível (dd/mm/aaaa); ausente vira vazio. */
function dateCell(value: unknown): ReportCell {
  return typeof value === "number" ? formatDay(value) : text(value);
}

/** Data e hora locais (para o instante da exportação). */
function dateTimeCell(value: unknown): ReportCell {
  return typeof value === "number"
    ? new Date(value).toLocaleString("pt-BR")
    : text(value);
}

/** Seção "Campo;Valor" a partir de pares rótulo → célula já formatada. */
function fieldSection(
  title: string,
  rows: ReadonlyArray<readonly [string, ReportCell]>,
): ReportSection {
  return {
    title,
    columns: ["Campo", "Valor"],
    rows: rows.map(([label, value]) => [label, value]),
  };
}

/**
 * Converte o payload da portabilidade num relatório CSV com uma seção por
 * bloco de dados (usuário, consentimentos, perfil, candidaturas, vagas).
 */
export function myDataReport(data: DataExportPayload): ExportReport {
  const sections: ReportSection[] = [];
  const usuario = data.usuario ?? null;
  const perfil = data.perfilAluno ?? null;

  sections.push(
    fieldSection("Exportação", [
      ["Gerado em", dateTimeCell(data.exportedAt)],
      ["Consentimentos registrados", String(data.consentimentos?.length ?? 0)],
      ["Candidaturas", String(data.candidaturas?.length ?? 0)],
      ["Vagas publicadas", String(data.vagasPublicadas?.length ?? 0)],
    ]),
  );

  if (usuario !== null) {
    sections.push(
      fieldSection("Usuário", [
        ["ID", text(usuario.id)],
        ["E-mail", text(usuario.email)],
        ["Nome", text(usuario.name)],
        ["Papel", text(usuario.role)],
        ["Conta ativa", text(usuario.active)],
        ["Foto de perfil", text(usuario.image)],
        ["LinkedIn", text(usuario.linkedinUrl)],
        ["Site", text(usuario.website)],
        ["Alertas de vagas", text(usuario.notifyJobAlerts)],
        [
          "Atualizações de candidatura",
          text(usuario.notifyApplicationUpdates),
        ],
      ]),
    );
  }

  sections.push({
    title: "Consentimentos",
    columns: ["Versão do termo", "Aceito em"],
    rows: (data.consentimentos ?? []).map((consent) => [
      text(consent.termVersion),
      dateTimeCell(consent.acceptedAt),
    ]),
  });

  if (perfil !== null) {
    sections.push(
      fieldSection("Perfil do aluno", [
        ["Nome completo", text(perfil.fullName)],
        ["Matrícula", text(perfil.enrollment)],
        ["Situação", text(perfil.status)],
        ["Curso", text(perfil.course)],
        ["Ano de conclusão", text(perfil.graduationYear)],
        ["Semestre", text(perfil.semester)],
        ["Localização", text(perfil.location)],
        ["LinkedIn", text(perfil.linkedinUrl)],
        ["Portfólio", text(perfil.portfolioUrl)],
        ["Disponibilidade", text(perfil.availability)],
        ["Visibilidade", text(perfil.visibility)],
        ["Mostrar contato a recrutadores", text(perfil.showContactToRecruiters)],
        ["Competências", text(perfil.skills)],
        ["Idiomas", text(perfil.languages)],
        ["Currículo (dados)", text(perfil.resumeData)],
        ["Banner", text(perfil.bannerUrl)],
      ]),
    );
  }

  sections.push({
    title: "Candidaturas",
    columns: [
      "Vaga",
      "Tipo de contrato",
      "Etapa",
      "Compatibilidade",
      "Candidatura em",
      "Motivo da reprovação",
      "Processo aceito",
      "Entrevista",
      "Início previsto",
      "ID da candidatura",
      "ID da vaga",
    ],
    rows: (data.candidaturas ?? []).map((application) => [
      text(application.jobTitle),
      text(application.contractType),
      text(application.stage),
      text(application.matchScore),
      dateCell(application.appliedAt),
      text(application.rejectionReason),
      text(application.processAccepted),
      dateCell(application.interviewDate),
      dateCell(application.expectedStartDate),
      text(application.applicationId),
      text(application.jobId),
    ]),
  });

  sections.push({
    title: "Vagas publicadas",
    columns: [
      "Título",
      "Situação",
      "Tipo de contrato",
      "Publicada em",
      "Expira em",
      "Preenchida em",
      "ID da vaga",
    ],
    rows: (data.vagasPublicadas ?? []).map((job) => [
      text(job.title),
      text(job.status),
      text(job.contractType),
      dateCell(job.publishedAt),
      dateCell(job.expiresAt),
      dateCell(job.filledAt),
      text(job.jobId),
    ]),
  });

  return { reportName: DATA_EXPORT_NAME, sections };
}

/** Baixa o relatório como CSV no navegador (Blob + âncora + revoke). */
export function downloadCsv(filename: string, report: ExportReport): void {
  const csv = toCsv(report);
  const canUseBlob =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const url = canUseBlob
    ? URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    : `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (canUseBlob && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}