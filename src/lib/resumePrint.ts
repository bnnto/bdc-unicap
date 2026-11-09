/**
 * Geração e download do Currículo Vitae em PDF (issue [S2-2]) — sem libs
 * pesadas: o documento é montado pela regra pura `buildResumeDocument`
 * (src/lib/resumeDocument.ts), renderizado num template imprimível com
 * identidade UNICAP e o PDF sai do próprio navegador (`window.print()`).
 * A folha `.unicap-resume-doc` serve de prévia na tela e de documento A4
 * na impressão — o restante da aplicação fica oculto via `@media print`.
 */

/**
 * Folha A4 de coluna única, paleta bordô/dourado, fonte Aptos.
 *
 * [CV_LAYOUT_V2] Sem banda de cabeçalho e sem coluna lateral. Aptos não
 * existe no Google Fonts: a pilha cai para Calibri/Arial em máquinas sem
 * Office moderno ou Windows 11.
 *
 * O PDF deve ser o “espelho exato” do visualizador:
 * 1. `print-color-adjust: exact` — sem isso o navegador descarta os fundos
 *    (chips de competências) e o layout “perde o design”;
 * 2. `display: flex` REAFIRMADO dentro de `@media print` (chips);
 * 3. `break-inside: avoid` em itens e `break-after: avoid` em títulos — nada
 *    de cortes no meio de experiências nem de títulos órfãos;
 * 4. a aplicação inteira some, exceto #unicap-resume-print-root, que recebe
 *    o MESMO markup da prévia (.unicap-resume-doc).
 *
 * Responsividade: a folha já é fluida (largura 100% até 210mm). O bloco
 * `@media screen and (max-width: 40rem)` no FINAL reduz paddings e fontes
 * só na TELA de celulares — como é `screen`, nunca afeta a impressão/PDF.
 */
export const RESUME_PRINT_CSS = `
#unicap-resume-print-root {
    display: none;
  }
@media print {
  @page {
    size: A4;
    margin: 0;
  }
  /* 1. Força as cores de fundo no PDF. */
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
    padding: 18mm 16mm !important;
  }
  .unicap-resume-chips {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0 !important;
  }
  .unicap-resume-section-title {
    display: flex !important;
    align-items: center !important;
  }
  /* 3. Sem cortes no meio de itens nem títulos órfãos. */
  .unicap-resume-identity,
  .unicap-resume-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .unicap-resume-section-title {
    break-after: avoid;
    page-break-after: avoid;
  }
  a {
    color: #6b1426 !important;
    text-decoration: none !important;
  }
}
.unicap-resume-doc {
  background: #ffffff !important;
  border: 1px solid #e2e8f0;
  box-sizing: border-box;
  color: #1e293b !important;
  font-family: Aptos, Calibri, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 210mm;
  overflow-wrap: anywhere;
  padding: 12mm;
  word-break: break-word;
}
.unicap-resume-doc * {
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.unicap-resume-doc .unicap-resume-name {
  hyphens: auto;
}
.unicap-resume-doc .unicap-resume-identity {
  border: none;
  padding: 0 0 4px;
}
.unicap-resume-doc .unicap-resume-name {
  color: #0f172a;
  font-family: inherit;
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
  margin: 0 0 8px;
}
.unicap-resume-doc .unicap-resume-headline {
  color: #6b1426;
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 10px;
}
.unicap-resume-doc .unicap-resume-contacts {
  color: #64748b;
  font-size: 14px;
  margin: 3px 0 0;
}
.unicap-resume-doc .unicap-resume-contacts a {
  color: #6b1426;
  text-decoration: underline;
}
.unicap-resume-doc .unicap-resume-section {
  margin-top: 24px;
}
.unicap-resume-doc .unicap-resume-section-title {
  align-items: center;
  color: #6b1426;
  display: flex;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  gap: 12px;
  letter-spacing: 0.18em;
  margin: 0 0 10px;
  text-transform: uppercase;
}
.unicap-resume-doc .unicap-resume-section-title::after {
  background: #d9dde3;
  content: "";
  flex: 1;
  height: 1px;
}
.unicap-resume-doc .unicap-resume-summary {
  margin: 0;
  white-space: pre-line;
}
.unicap-resume-doc .unicap-resume-projects {
  margin-bottom: 6px;
}
.unicap-resume-doc .unicap-resume-item {
  margin-bottom: 9px;
}
.unicap-resume-doc .unicap-resume-item:last-child {
  margin-bottom: 0;
}
.unicap-resume-doc .unicap-resume-item-title {
  font-family: inherit;
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 3px;
}
.unicap-resume-doc .unicap-resume-item-sub {
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
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
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}
.unicap-resume-doc .unicap-resume-chips li {
  background: none;
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
  padding: 0;
}
.unicap-resume-doc .unicap-resume-chips li + li::before {
  color: #94a3b8;
  content: "·";
  font-weight: 400;
  padding: 0 12px;
}
/* Celulares (SÓ na tela — nunca afeta a impressão/PDF): menos padding e
   fontes proporcionais, para o nome de 46px não ocupar três linhas. */
@media screen and (max-width: 40rem) {
  .unicap-resume-doc {
    font-size: 14px;
    padding: 20px 16px;
  }
  .unicap-resume-doc .unicap-resume-name {
    font-size: clamp(1.75rem, 8.5vw, 2.5rem);
  }
  .unicap-resume-doc .unicap-resume-headline {
    font-size: 17px;
  }
  .unicap-resume-doc .unicap-resume-contacts {
    font-size: 13px;
  }
  .unicap-resume-doc .unicap-resume-section {
    margin-top: 20px;
  }
  .unicap-resume-doc .unicap-resume-section-title {
    gap: 10px;
    letter-spacing: 0.12em;
  }
  .unicap-resume-doc .unicap-resume-item-title {
    font-size: 16px;
  }
  .unicap-resume-doc .unicap-resume-item-sub {
    display: block;
    font-size: 13px;
  }
  .unicap-resume-doc .unicap-resume-chips li {
    font-size: 15px;
  }
  .unicap-resume-doc .unicap-resume-chips li + li::before {
    padding: 0 8px;
  }
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
  fileName: string, // Novo parâmetro adicionado aqui
  win: ResumePrintWindow = window,
): void {
  // 1. Guarda o título original do site
  const originalTitle = win.document.title;
  
  // 2. Muda o título temporariamente (tira o .pdf porque o navegador já adiciona)
  win.document.title = fileName.replace('.pdf', '');

  renderResumeIntoPrintContainer(win.document, markup);
  win.print();

  // 3. Devolve o título original ao site imediatamente a seguir
  win.document.title = originalTitle;
  setTimeout(() => clearResumePrintContainer(win.document), 500);
}