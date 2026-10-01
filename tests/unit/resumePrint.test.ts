import { describe, expect, it } from "vitest";
import {
  RESUME_PRINT_CSS,
  clearResumePrintContainer,
  injectResumePrintStyle,
  printResumeDocument,
  renderResumeIntoPrintContainer,
  type ResumePrintWindow,
} from "../../src/lib/resumePrint";

const CSS = ` #unicap-resume-print-root `;
const MARKUP = `<div class="unicap-resume-doc" data-testid="doc"></div>`;

function makeWindow(): ResumePrintWindow & { printed: boolean } {
  let printed = false;
  return {
    document,
    print: () => {
      printed = true;
    },
    get printed() {
      return printed;
    },
  };
}

describe("CSS de impressão do currículo (S2-2)", () => {
  it("esconde a aplicação e mostra apenas o template A4 UNICAP", () => {
    expect(RESUME_PRINT_CSS).toContain("@media print");
    expect(RESUME_PRINT_CSS).toContain("@page");
    expect(RESUME_PRINT_CSS).toContain("size: A4");
    expect(RESUME_PRINT_CSS).toContain(CSS.trim());
    expect(RESUME_PRINT_CSS).toContain("display: none !important");
  });

  it("usa as cores institucionais bordô e dourado", () => {
    expect(RESUME_PRINT_CSS).toContain("#6b1426");
    expect(RESUME_PRINT_CSS).toContain("#c89d3c");
  });
});

describe("helpers de impressão do currículo (S2-2)", () => {
  it("injeta o CSS uma única vez (idempotente)", () => {
    injectResumePrintStyle(document);
    injectResumePrintStyle(document);
    expect(
      document.querySelectorAll("#unicap-resume-print-style"),
    ).toHaveLength(1);
  });

  it("renderiza o markup no container dedicado", () => {
    const container = renderResumeIntoPrintContainer(document, MARKUP);
    expect(container.id).toBe("unicap-resume-print-root");
    expect(container.querySelector('[data-testid="doc"]')).not.toBeNull();
  });

  it("substitui o conteúdo em renders sucessivos (sem duplicar)", () => {
    renderResumeIntoPrintContainer(document, MARKUP);
    renderResumeIntoPrintContainer(document, MARKUP);
    expect(
      document.querySelectorAll("#unicap-resume-print-root [data-testid=doc]"),
    ).toHaveLength(1);
  });

  it("limpa o container ao desmontar", () => {
    renderResumeIntoPrintContainer(document, MARKUP);
    clearResumePrintContainer(document);
    expect(document.getElementById("unicap-resume-print-root")).toBeNull();
  });

  it("printResumeDocument renderiza e chama window.print()", () => {
    const win = makeWindow();
    printResumeDocument(MARKUP, win);
    expect(win.printed).toBe(true);
    expect(
      document.querySelector("#unicap-resume-print-root .unicap-resume-doc"),
    ).not.toBeNull();
  });
});

/**
 * Extrai o conteúdo do bloco `@media print { … }` (chaves aninhadas)
 * para asserções ESPECÍFICAS das regras de impressão — Etapa 2.3 do
 * REFACTOR_ALUNO: o PDF deve ser o espelho exato do visualizador.
 */
function printMediaBlock(css: string): string {
  const start = css.indexOf("@media print");
  if (start < 0) throw new Error("@media print ausente no CSS");
  const open = css.indexOf("{", start);
  if (open < 0) throw new Error("bloco @media print sem corpo");
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("bloco @media print não fechado");
}

describe("REFACTOR_ALUNO Etapa 2.3 — @media print espelho do visualizador", () => {
  const PRINT = printMediaBlock(RESUME_PRINT_CSS);

  it("força cores de fundo com print-color-adjust: exact (prefixos webkit e padrão)", () => {
    expect(PRINT).toContain("-webkit-print-color-adjust: exact");
    expect(PRINT).toContain("print-color-adjust: exact");
  });

  it("preserva display: flex e display: grid DENTRO do @media print", () => {
    // Header em flex + grid de duas colunas do documento — sem isso o
    // PDF desconfigura em relação à prévia na tela.
    expect(PRINT).toMatch(/display:\s*flex/);
    expect(PRINT).toMatch(/display:\s*grid/);
    expect(PRINT).toContain("grid-template-columns");
  });

  it("esconde a aplicação e exibe somente o container de impressão", () => {
    expect(PRINT).toContain("#unicap-resume-print-root");
    expect(PRINT).toContain("display: none !important");
    expect(PRINT).toContain("display: block !important");
  });

  it("evita quebra de página dentro de itens e seções", () => {
    expect(PRINT).toMatch(/break-inside:\s*avoid/);
    expect(PRINT).toMatch(/page-break-inside:\s*avoid/);
  });

  it("mantém A4 com margens e remove sombra/borda da folha na impressão", () => {
    expect(PRINT).toContain("size: A4");
    expect(PRINT).toContain("box-shadow: none !important");
    expect(PRINT).toContain("border: none !important");
  });

  it("o fundo bordô do cabeçalho existe fora da impressão (precisa do color-adjust)", () => {
    // A prévia na tela usa as mesmas regras do documento — se o cabeçalho
    // não tem cor de fundo, o print-color-adjust seria inócuo.
    const doc = RESUME_PRINT_CSS.slice(
      RESUME_PRINT_CSS.indexOf("@media print"),
    );
    expect(RESUME_PRINT_CSS).toContain("#6b1426");
    expect(doc).toContain("background");
  });
});
