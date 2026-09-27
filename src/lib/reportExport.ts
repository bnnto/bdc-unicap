/**
 * Exportação CSV/XLSX dos relatórios do dashboard (issue [S6-1]).
 *
 * CA 1 — download com os dados filtrados vigentes: as métricas já chegam
 * filtradas ao painel pelas queries Convex (S5-5), então o relatório é
 * montado a partir do MESMO estado exibido — sem nova ida ao servidor.
 * CA 2 — encoding correto: CSV em UTF-8 com BOM + separador ";" (pt-BR)
 * e CRLF; XLSX em UTF-8 com declaração XML. O Excel abre ambos sem
 * mojibake e com as colunas certas.
 * CA 3 — arquivos válidos: CSV conforme RFC 4180; XLSX é um pacote OOXML
 * (SpreadsheetML empacotado por src/lib/zip.ts) escrito aqui byte a byte.
 *
 * Zero dependências: o CSV usa Blob/URL nativos e o XLSX sai de um
 * writer OOXML próprio — mais leve e seguro que qualquer lib de planilha.
 *
 * I/O de navegador injetável para testes (padrão do S2-2 resumePrint.ts).
 */
import { buildZip } from "./zip";

/** Seção de dados do relatório: título, colunas e linhas de células. */
export type ReportSection = {
  title: string;
  columns: string[];
  rows: ReportRow[];
};

/** Célula de uma linha: texto, número ou vazio (null/undefined). */
export type ReportCell = string | number | null | undefined;

export type ReportRow = readonly ReportCell[];

/** Relatório completo a exportar (CSV ou XLSX). */
export type ExportReport = {
  reportName: string;
  sections: ReportSection[];
};

/** Separador pt-BR: o Excel pt-BR espera ";" para abrir colunas direto. */
export const CSV_SEPARATOR = ";";

/**
 * Escapa um campo conforme RFC 4180: se contém separador, aspas, CR/LF
 * ou BOM interno, vira campo entre aspas com aspas internas dobradas.
 */
function csvField(value: ReportCell): string {
  if (value === null || value === undefined) return "";
  const text = String(value)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n|\r|\n/g, "\r\n");
  if (/[";\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

/** Serializa o relatório inteiro em uma string CSV (com BOM no início). */
export function toCsv(report: ExportReport): string {
  const lines: string[] = [report.reportName];
  report.sections.forEach((section) => {
    lines.push("");
    lines.push(`# ${section.title}`);
    lines.push(section.columns.map(csvField).join(CSV_SEPARATOR));
    for (const row of section.rows) {
      lines.push(row.map(csvField).join(CSV_SEPARATOR));
    }
  });
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Codifica o CSV em UTF-8 COM BOM (bytes 0xEF 0xBB 0xBF) para o Excel. */
export function csvBytes(report: ExportReport): Uint8Array {
  return new TextEncoder().encode(toCsv(report));
}

/** Timestamp (epoch ms) → "aaaa-mm-dd" LOCAL (para nome de arquivo). */
export function formatDateStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Nome de arquivo do relatório: slug (minúsculas, sem acentos/espacos)
 * + data local + extensão — ex.: "relatorio-operacional-2026-09-27.csv".
 */
export function reportFilename(
  reportName: string,
  format: "csv" | "xlsx",
  now: number = Date.now(),
): string {
  const slug = reportName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug === "" ? "relatorio" : slug;
  return `${base}-${formatDateStamp(now)}.${format}`;
}

/**
 * Nome de planilha (aba do XLSX): Excel proíbe : \ / ? * [ ] e limita a
 * 31 caracteres; nomes repetidos são desambiguados ("Resumo 2").
 */
export function sheetNameFor(
  title: string,
  used: ReadonlySet<string> = new Set(),
): string {
  let name = title
    .replace(/[:\\/?*[\]]/g, "")
    .trim()
    .slice(0, 31);
  if (name === "") name = "Planilha";
  if (!used.has(name)) return name;
  let suffix = 2;
  while (used.has(`${name} ${suffix}`)) suffix += 1;
  const withSuffix = `${name} ${suffix}`;
  if (withSuffix.length <= 31) return withSuffix;
  // Sufixo não pode estourar o limite do Excel: trunca a base.
  return `${name.slice(0, 31 - String(suffix).length - 1)} ${suffix}`;
}

/** Escapa texto para XML (attribute/element content). */
function xmlEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Referência de célula estilo Excel ("A1", "B3"). */
function cellRef(column: number, row: number): string {
  let ref = "";
  let c = column;
  while (c >= 0) {
    ref = String.fromCharCode(65 + (c % 26)) + ref;
    c = Math.floor(c / 26) - 1;
  }
  return `${ref}${row}`;
}

/**
 * Converte uma linha em XML de células: número → `<v>` (numérico),
 * texto → inlineStr (preserva acentos sem sharedStrings), vazio →
 * célula vazia `<c r=".."/>`.
 */
function rowToXml(row: ReportRow, rowIndex: number): string {
  const cells = row
    .map((cell, columnIndex) => {
      const ref = cellRef(columnIndex, rowIndex + 1);
      if (cell === null || cell === undefined) {
        return `<c r="${ref}"/>`;
      }
      if (typeof cell === "number" && Number.isFinite(cell)) {
        return `<c r="${ref}"><v>${cell}</v></c>`;
      }
      const text = String(cell).replace(/^\uFEFF/, "");
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
    })
    .join("");
  return `<row>${cells}</row>`;
}

/** Planilha completa (uma seção do relatório) em SpreadsheetML. */
function sheetXml(section: ReportSection): string {
  const headerRow = rowToXml(section.columns, 0);
  const dataRows = section.rows.map((row, index) => rowToXml(row, index + 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${dataRows.join("")}</sheetData></worksheet>`;
}

/** workbook.xml com as planilhas nomeadas (CA 3 — estrutura válida). */
export function buildWorkbookXml(sheetNames: readonly string[]): string {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

const ENCODER = new TextEncoder();

function xmlPart(text: string): Uint8Array {
  return ENCODER.encode(text);
}

/**
 * Monta o pacote XLSX (OOXML mínimo válido): [Content_Types].xml,
 * _rels/.rels, workbook.xml, workbook rels e uma planilha por seção.
 * ZIP stored do src/lib/zip.ts — determinístico.
 */
export function xlsxBytes(report: ExportReport): Uint8Array {
  const sheetNames: string[] = [];
  const used = new Set<string>();
  for (const section of report.sections) {
    const name = sheetNameFor(section.title, used);
    used.add(name);
    sheetNames.push(name);
  }

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetNames
    .map(
      (_name, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("")}</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetNames
    .map(
      (_name, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("")}</Relationships>`;

  const workbook = buildWorkbookXml(sheetNames);

  return buildZip([
    { name: "[Content_Types].xml", data: xmlPart(contentTypes) },
    { name: "_rels/.rels", data: xmlPart(rootRels) },
    { name: "xl/workbook.xml", data: xmlPart(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: xmlPart(workbookRels) },
    ...report.sections.map((section, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: xmlPart(sheetXml(section)),
    })),
  ]);
}

/** APIs de navegador usadas pelo download (injetáveis nos testes). */
export type ReportDownloadDeps = {
  document: Pick<Document, "createElement" | "body">;
  url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
};

/** Dispara o download nativo (Blob + âncora + revoke). */
export function downloadReport(
  report: ExportReport,
  format: "csv" | "xlsx",
  deps: ReportDownloadDeps = { document, url: URL },
): void {
  const blob =
    format === "csv"
      ? new Blob([csvBytes(report)], {
          type: "text/csv;charset=utf-8",
        })
      : new Blob([xlsxBytes(report)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
  const url = deps.url.createObjectURL(blob);
  const anchor = deps.document.createElement("a");
  anchor.href = url;
  anchor.download = reportFilename(report.reportName, format);
  deps.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  deps.url.revokeObjectURL(url);
}
