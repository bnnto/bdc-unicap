/**
 * [S6-2] Exportação PDF dos relatórios com template institucional
 * UNICAP — regras puras do template + helpers de impressão.
 *
 * CA 1 — PDF fiel aos dados filtrados: o template é gerado a partir do
 * MESMO ExportReport montado pela S6-1 (estado vigente do painel).
 * CA 2 — identidade visual UNICAP: bordô (#6b1426) e dourado (#c89d3c),
 * Merriweather no título, A4 com cabeçalho e rodapé institucionais.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  REPORT_PRINT_CSS,
  buildReportPrintMarkup,
  clearReportPrintContainer,
  printOperationalReport,
  renderReportIntoPrintContainer,
  type ReportPrintWindow,
} from "../../src/lib/reportPrint";
import { buildOperationalReport } from "../../src/lib/operationalPanel";

const NOON = new Date(2026, 8, 27, 12).getTime();

const REPORT = buildOperationalReport({
  summary: {
    jobs: { open: 3, closed: 1, filled: 2, total: 6 },
    applications: {
      total: 20,
      inProgress: 12,
      finalized: 8,
      approved: 5,
      rejected: 3,
    },
    employability: { rate: 63 },
  },
  timeToHire: { averageDays: 12, samplesCount: 4 },
  funnel: {
    steps: [
      {
        stage: "inscrito",
        label: "Inscrito",
        count: 20,
        conversionFromPrevious: null,
      },
    ],
    totalApplications: 20,
  },
  rankings: {
    topCompanies: [
      {
        recruiterId: "r1",
        companyName: "Alpha",
        publishedJobs: 3,
        applicationsCount: 12,
      },
    ],
    topJobs: [],
  },
});

function makeWindow(): ReportPrintWindow & { printed: boolean } {
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

describe("CSS de impressão do relatório (S6-2) — identidade UNICAP", () => {
  it("usa folha A4 e oculta a aplicação durante a impressão", () => {
    expect(REPORT_PRINT_CSS).toContain("@media print");
    expect(REPORT_PRINT_CSS).toContain("@page");
    expect(REPORT_PRINT_CSS).toContain("size: A4");
    expect(REPORT_PRINT_CSS).toContain(
      "body > *:not(#unicap-report-print-root)",
    );
    expect(REPORT_PRINT_CSS).toContain("display: none !important");
  });

  it("convive com a impressão do currículo (S2-2) sem vazar estilos", () => {
    // A folha do relatório oculta o root do currículo e vice-versa.
    expect(REPORT_PRINT_CSS).toContain("#unicap-resume-print-root");
  });

  it("aplica as cores institucionais bordô e dourado", () => {
    expect(REPORT_PRINT_CSS).toContain("#6b1426");
    expect(REPORT_PRINT_CSS).toContain("#c89d3c");
    expect(REPORT_PRINT_CSS).toContain("Merriweather");
  });
});

describe("helpers de impressão do relatório (S6-2)", () => {
  beforeEach(() => {
    clearReportPrintContainer(document);
    document.getElementById("unicap-report-print-style")?.remove();
  });

  it("injeta o CSS uma única vez (idempotente)", () => {
    renderReportIntoPrintContainer(
      document,
      buildReportPrintMarkup(REPORT, NOON),
    );
    renderReportIntoPrintContainer(
      document,
      buildReportPrintMarkup(REPORT, NOON),
    );
    expect(
      document.querySelectorAll("#unicap-report-print-style"),
    ).toHaveLength(1);
  });

  it("renderiza o template no container dedicado (e substitui em renders sucessivos)", () => {
    renderReportIntoPrintContainer(
      document,
      buildReportPrintMarkup(REPORT, NOON),
    );
    renderReportIntoPrintContainer(
      document,
      buildReportPrintMarkup(REPORT, NOON),
    );
    expect(
      document.querySelectorAll("#unicap-report-print-root .unicap-report-doc"),
    ).toHaveLength(1);
  });

  it("limpa o container ao desmontar", () => {
    renderReportIntoPrintContainer(
      document,
      buildReportPrintMarkup(REPORT, NOON),
    );
    clearReportPrintContainer(document);
    expect(document.getElementById("unicap-report-print-root")).toBeNull();
  });

  it("printOperationalReport renderiza o template e chama window.print()", () => {
    const win = makeWindow();
    printOperationalReport(REPORT, NOON, win);
    expect(win.printed).toBe(true);
    expect(
      document.querySelector("#unicap-report-print-root .unicap-report-doc"),
    ).not.toBeNull();
  });
});

describe("template do relatório (CA 1 — fiel aos dados; CA 2 — UNICAP)", () => {
  it("cabeçalho institucional: marca UNICAP, título do relatório e data de geração", () => {
    const markup = buildReportPrintMarkup(REPORT, NOON);
    expect(markup).toContain("unicap-report-doc");
    expect(markup).toContain("UNICAP");
    expect(markup).toContain("Relatório Operacional UNICAP");
    expect(markup).toContain("Gerado em 27/09/2026");
  });

  it("renderiza TODAS as seções com colunas e valores do relatório vigente", () => {
    const markup = buildReportPrintMarkup(REPORT, NOON);
    for (const title of REPORT.sections.map((section) => section.title)) {
      expect(markup).toContain(title);
    }
    // Dados fiéis: linha do resumo e do funil presentes com os valores.
    expect(markup).toContain("Vagas abertas");
    expect(markup).toContain(">3</td>");
    expect(markup).toContain("Inscrito");
    expect(markup).toContain(">20</td>");
    // Nulo vira célula vazia (nunca "null"/"undefined").
    expect(markup).not.toContain("null");
    expect(markup).not.toContain("undefined");
  });

  it("célula numérica é marcada (alinhamento à direita) e vazia fica vazia", () => {
    const markup = buildReportPrintMarkup(
      {
        reportName: "x",
        sections: [
          {
            title: "s",
            columns: ["Métrica", "Valor"],
            rows: [
              ["Item", 7],
              ["Vazio", null],
            ],
          },
        ],
      },
      NOON,
    );
    expect(markup).toContain('<td class="unicap-report-num">7</td>');
    expect(markup).toContain("<td></td>");
  });

  it("escapa textos para HTML (títulos e células com caracteres especiais)", () => {
    const markup = buildReportPrintMarkup(
      {
        reportName: 'Relatório <b>& "cotações"',
        sections: [
          {
            title: "Vagas <script>",
            columns: ["A&B"],
            rows: [["<td>?", 1]],
          },
        ],
      },
      NOON,
    );
    expect(markup).toContain("&lt;b&gt;");
    expect(markup).toContain("&amp;");
    expect(markup).toContain("&quot;");
    expect(markup).toContain("Vagas &lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("rodapé institucional com a universidade e a página de geração", () => {
    const markup = buildReportPrintMarkup(REPORT, NOON);
    expect(markup).toContain("Universidade Católica de Pernambuco");
    expect(markup).toContain("unicap-report-footer");
  });
});
