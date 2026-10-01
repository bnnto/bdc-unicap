/**
 * Geração e download do Currículo Vitae em PDF (issue [S2-2]) — sem libs
 * pesadas: o documento é montado pela regra pura `buildResumeDocument`
 * (src/lib/resumeDocument.ts), renderizado num template imprimível com
 * identidade UNICAP e o PDF sai do próprio navegador (`window.print()`).
 * A folha `.unicap-resume-doc` serve de prévia na tela e de documento A4
 * na impressão — o restante da aplicação fica oculto via `@media print`.
 */

/**
 * Folha A4 com identidade bordô/dourado; aplicação fica intocada na tela.
 *
 * [REFACTOR_ALUNO Etapa 2.3 — CORREÇÃO CRÍTICA] O PDF deve ser o
 * “espelho exato” do visualizador:
 * 1. `print-color-adjust: exact` (prefixo webkit + padrão) em tudo — sem
 *    isso o navegador descarta os fundos (banda bordô, chips) e o layout
 *    “perde o design”;
 * 2. `display: flex` e `display: grid` REAFIRMADOS dentro de
 *    `@media print` — cabeçalho e grid de duas colunas não colapsam;
 * 3. `break-inside: avoid` em itens/seções — nada de cortes no meio de
 *    experiências ou cabeçalhos órfãos;
 * 4. a aplicação inteira some, exceto #unicap-resume-print-root, que
 *    recebe o MESMO markup da prévia (.unicap-resume-doc).
 */
export const RESUME_PRINT_CSS = `
@media print {
  @page {
    size: A4;
    margin: 14mm 12mm;
  }
  /* 1. Força as cores de fundo no PDF (Etapa 2.3). */
  *,
  *::before,
  *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html,
  body {
    background: #ffffff !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  /* Só o documento impresso fica visível. */
  body > *:not(#unicap-resume-print-root) {
    display: none !important;
  }
  #unicap-resume-print-root {
    display: block !important;
  }
  /* 2. Espelho exato da prévia: folha sem moldura, sem sombra. */
  .unicap-resume-doc {
    border: none !important;
    box-shadow: none !important;
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 12px !important;
  }
  .unicap-resume-header {
    display: flex !important;
    align-items: flex-end !important;
    justify-content: space-between !important;
    background: #6b1426 !important;
    border-radius: 0 !important;
  }
  .unicap-resume-identity {
    display: block !important;
  }
  .unicap-resume-grid {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) !important;
    gap: 16px !important;
    align-items: start !important;
  }
  .unicap-resume-grid--single {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .unicap-resume-chips {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
  }
  /* 3. Sem cortes no meio de blocos nem títulos órfãos. */
  .unicap-resume-header,
  .unicap-resume-identity,
  .unicap-resume-section,
  .unicap-resume-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .unicap-resume-section-title {
    break-after: avoid;
    page-break-after: avoid;
  }
  .unicap-resume-col {
    break-inside: auto;
    page-break-inside: auto;
  }
  a {
    color: #6b1426 !important;
    text-decoration: none !important;
  }
}
.unicap-resume-doc {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  color: #1e293b;
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 12.5px;
  line-height: 1.55;
  margin: 0 auto;
  max-width: 210mm;
  padding: 10mm;
}
.unicap-resume-doc .unicap-resume-header {
  align-items: flex-end;
  background: #6b1426;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
}
.unicap-resume-doc .unicap-resume-brand {
  color: #ffffff;
  font-family: Merriweather, Georgia, serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
}
.unicap-resume-doc .unicap-resume-doc-title {
  color: #c89d3c;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 2px 0 0;
  text-transform: uppercase;
}
.unicap-resume-doc .unicap-resume-acronym {
  color: #c89d3c;
  font-family: Merriweather, Georgia, serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0;
}
.unicap-resume-doc .unicap-resume-identity {
  border-bottom: 2.5px solid #6b1426;
  padding: 12px 0 8px;
}
.unicap-resume-doc .unicap-resume-name {
  color: #6b1426;
  font-family: Merriweather, Georgia, serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  margin: 0 0 4px;
}
.unicap-resume-doc .unicap-resume-headline {
  color: #475569;
  font-size: 13px;
  margin: 0 0 6px;
}
.unicap-resume-doc .unicap-resume-contacts {
  color: #64748b;
  font-size: 11px;
  margin: 2px 0 0;
}
.unicap-resume-doc .unicap-resume-contacts a {
  color: #6b1426;
  text-decoration: underline;
}
.unicap-resume-doc .unicap-resume-meta {
  color: #64748b;
  font-size: 11px;
  margin: 0;
}
.unicap-resume-doc .unicap-resume-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  margin-top: 12px;
}
.unicap-resume-doc .unicap-resume-grid--single {
  grid-template-columns: minmax(0, 1fr);
}
.unicap-resume-doc .unicap-resume-col-side {
  background: #fdf2f4;
  border-radius: 4px;
  padding: 10px;
}
.unicap-resume-doc .unicap-resume-section {
  margin-top: 14px;
}
.unicap-resume-doc .unicap-resume-col-side .unicap-resume-section:first-child,
.unicap-resume-doc .unicap-resume-col-main > .unicap-resume-section:first-child {
  margin-top: 0;
}
.unicap-resume-doc .unicap-resume-section-title {
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
.unicap-resume-doc .unicap-resume-summary {
  margin: 0;
  white-space: pre-line;
}
.unicap-resume-doc .unicap-resume-item {
  margin-bottom: 8px;
}
.unicap-resume-doc .unicap-resume-item:last-child {
  margin-bottom: 0;
}
.unicap-resume-doc .unicap-resume-item-title {
  font-weight: 700;
  margin: 0;
}
.unicap-resume-doc .unicap-resume-item-sub {
  color: #64748b;
  font-size: 11px;
  margin: 1px 0 3px;
}
.unicap-resume-doc .unicap-resume-item-desc {
  margin: 0;
}
.unicap-resume-doc .unicap-resume-list {
  list-style: disc;
  margin: 0;
  padding-left: 16px;
}
.unicap-resume-doc .unicap-resume-list li {
  margin-bottom: 3px;
}
.unicap-resume-doc .unicap-resume-list li:last-child {
  margin-bottom: 0;
}
.unicap-resume-doc .unicap-resume-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.unicap-resume-doc .unicap-resume-chips li {
  background: #6b1426;
  border-radius: 3px;
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
}
.unicap-resume-doc .unicap-resume-footer {
  border-top: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 9.5px;
  margin-top: 18px;
  padding-top: 6px;
}
`;

const STYLE_ID = "unicap-resume-print-style";
const CONTAINER_ID = "unicap-resume-print-root";

export type ResumePrintWindow = Pick<Window, "document" | "print">;

/** Injeta o CSS de impressão uma única vez (idempotente). */
export function injectResumePrintStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = RESUME_PRINT_CSS;
  doc.head.appendChild(style);
}

/**
 * Renderiza `markup` dentro do container dedicado à impressão (oculto na
 * tela, exibido via `@media print`). Chamado antes de window.print().
 */
export function renderResumeIntoPrintContainer(
  doc: Document,
  markup: string,
): HTMLElement {
  injectResumePrintStyle(doc);
  let container = doc.getElementById(CONTAINER_ID);
  if (container === null) {
    container = doc.createElement("div");
    container.id = CONTAINER_ID;
    doc.body.appendChild(container);
  }
  container.innerHTML = markup;
  return container;
}

/** Limpa o container de impressão (usado ao desmontar o preview). */
export function clearResumePrintContainer(doc: Document): void {
  doc.getElementById(CONTAINER_ID)?.remove();
}

/**
 * Dispara a impressão/PDF: renderiza o template e chama window.print(),
 * onde o usuário escolhe "Salvar como PDF" com o nome de arquivo correto.
 */
export function printResumeDocument(
  markup: string,
  win: ResumePrintWindow = window,
): void {
  renderResumeIntoPrintContainer(win.document, markup);
  win.print();
}
