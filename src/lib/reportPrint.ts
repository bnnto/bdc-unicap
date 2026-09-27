/**
 * Exportação PDF dos relatórios (issue [S6-2]) — PDF nativo do navegador
 * (window.print() → "Salvar como PDF"), no padrão do S2-2
 * (resumePrint.ts): sem libs pesadas, fidelidade do motor de layout do
 * próprio navegador e escolha do destino pelo usuário.
 *
 * CA 1 — PDF fiel aos dados filtrados: o template é gerado a partir do
 * MESMO ExportReport montado pela S6-1 (estado vigente do painel).
 * CA 2 — identidade visual UNICAP: bordô/dourado, Merriweather, A4 com
 * cabeçalho institucional, tabelas com zebra suave e rodapé da universidade.
 *
 * O container dedicado fica oculto na tela e é exibido apenas na
 * impressão via `@media print` — sem afetar o restante da aplicação.
 */
import type { ExportReport, ReportCell } from "./reportExport";
import { formatDay } from "./formatters";

/**
 * Folha A4 com identidade UNICAP. Oculta a aplicação na impressão e
 * devolve o fluxo de impressão do currículo (S2-2) quando o container
 * do relatório não está na página.
 */
export const REPORT_PRINT_CSS = `
@media print {
  @page {
    size: A4;
    margin: 14mm 12mm;
  }
  body > *:not(#unicap-report-print-root) {
    display: none !important;
  }
  #unicap-report-print-root {
    display: block !important;
  }
  .unicap-report-doc {
    border: none !important;
    box-shadow: none !important;
    max-width: none !important;
    padding: 0 !important;
  }
}
body:not(:has(#unicap-report-print-root)) #unicap-resume-print-root {
  display: block !important;
}
#unicap-report-print-root {
  display: none;
}
.unicap-report-doc {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 210mm;
  padding: 8mm;
}
.unicap-report-doc .unicap-report-header {
  align-items: flex-end;
  border-bottom: 2.5px solid #6b1426;
  display: flex;
  justify-content: space-between;
  padding-bottom: 10px;
}
.unicap-report-doc .unicap-report-brand {
  color: #6b1426;
  font-family: Merriweather, Georgia, serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
}
.unicap-report-doc .unicap-report-doc-title {
  color: #c89d3c;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 2px 0 0;
  text-transform: uppercase;
}
.unicap-report-doc .unicap-report-title {
  color: #6b1426;
  font-family: Merriweather, Georgia, serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  margin: 12px 0 2px;
}
.unicap-report-doc .unicap-report-generated {
  color: #64748b;
  font-size: 10.5px;
  margin: 0;
}
.unicap-report-doc .unicap-report-section {
  margin-top: 14px;
}
.unicap-report-doc .unicap-report-section-title {
  border-bottom: 1px solid #c89d3c;
  color: #6b1426;
  font-family: Merriweather, Georgia, serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0 0 7px;
  padding-bottom: 3px;
  text-transform: uppercase;
}
.unicap-report-doc table {
  border-collapse: collapse;
  width: 100%;
}
.unicap-report-doc th {
  background: #6b1426;
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: left;
}
.unicap-report-doc th,
.unicap-report-doc td {
  border: 1px solid #e2e8f0;
  padding: 5px 8px;
}
.unicap-report-doc td.unicap-report-num {
  text-align: right;
  white-space: nowrap;
}
.unicap-report-doc tbody tr:nth-child(even) td {
  background: #fdf2f4;
}
.unicap-report-doc .unicap-report-footer {
  border-top: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 9.5px;
  margin-top: 18px;
  padding-top: 6px;
}
`;

const STYLE_ID = "unicap-report-print-style";
const CONTAINER_ID = "unicap-report-print-root";

export type ReportPrintWindow = Pick<Window, "document" | "print">;

/** Escapa texto para conteúdo/atributos HTML. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Célula da tabela: número alinhado à direita, texto escapado, vazia. */
function cellMarkup(cell: ReportCell): string {
  if (cell === null || cell === undefined) return "<td></td>";
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return `<td class="unicap-report-num">${cell}</td>`;
  }
  return `<td>${escapeHtml(String(cell))}</td>`;
}

/**
 * Monta o template institucional do relatório (CA 1 — fiel ao
 * ExportReport vigente; CA 2 — identidade UNICAP).
 */
export function buildReportPrintMarkup(
  report: ExportReport,
  now: number = Date.now(),
): string {
  const sections = report.sections
    .map(
      (section) => `
  <section class="unicap-report-section">
    <h2 class="unicap-report-section-title">${escapeHtml(section.title)}</h2>
    <table>
      <thead><tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>${section.rows.map((row) => `<tr>${row.map(cellMarkup).join("")}</tr>`).join("")}</tbody>
    </table>
  </section>`,
    )
    .join("");
  return `
<div class="unicap-report-doc">
  <header class="unicap-report-header">
    <p class="unicap-report-brand">UNICAP</p>
    <p class="unicap-report-doc-title">Portal de Carreiras</p>
  </header>
  <h1 class="unicap-report-title">${escapeHtml(report.reportName)}</h1>
  <p class="unicap-report-generated">Gerado em ${formatDay(now)}</p>${sections}
  <footer class="unicap-report-footer">
    Universidade Católica de Pernambuco — Portal de Carreiras · Relatório
    gerado com os filtros vigentes do Painel Operacional.
  </footer>
</div>`;
}

/** Injeta o CSS de impressão uma única vez (idempotente). */
export function injectReportPrintStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = REPORT_PRINT_CSS;
  doc.head.appendChild(style);
}

/**
 * Renderiza `markup` no container dedicado à impressão (oculto na tela,
 * exibido via `@media print`). Chamado antes de window.print().
 */
export function renderReportIntoPrintContainer(
  doc: Document,
  markup: string,
): HTMLElement {
  injectReportPrintStyle(doc);
  let container = doc.getElementById(CONTAINER_ID);
  if (container === null) {
    container = doc.createElement("div");
    container.id = CONTAINER_ID;
    doc.body.appendChild(container);
  }
  container.innerHTML = markup;
  return container;
}

/** Limpa o container de impressão (usado ao desmontar a prévia). */
export function clearReportPrintContainer(doc: Document): void {
  doc.getElementById(CONTAINER_ID)?.remove();
}

/**
 * Dispara a impressão/PDF do relatório: renderiza o template e chama
 * window.print(), onde o usuário escolhe "Salvar como PDF".
 */
export function printOperationalReport(
  report: ExportReport,
  now: number = Date.now(),
  win: ReportPrintWindow = window,
): void {
  renderReportIntoPrintContainer(
    win.document,
    buildReportPrintMarkup(report, now),
  );
  win.print();
}
