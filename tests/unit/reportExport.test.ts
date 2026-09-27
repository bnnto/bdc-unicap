/**
 * [S6-1] Exportação CSV/XLSX dos relatórios do dashboard — regras puras.
 *
 * CA 1 — download com os dados filtrados vigentes (mapeamento das métricas);
 * CA 2 — encoding correto (UTF-8 com BOM para Excel, separador pt-BR);
 * CA 3 — arquivos CSV e XLSX válidos (ZIP/OOXML estruturalmente correto).
 */
import { describe, expect, it } from "vitest";
import {
  CSV_SEPARATOR,
  buildWorkbookXml,
  csvBytes,
  downloadReport,
  formatDateStamp,
  reportFilename,
  sheetNameFor,
  toCsv,
  xlsxBytes,
  type ExportReport,
  type ReportDownloadDeps,
} from "../../src/lib/reportExport";
import { buildZip, crc32 } from "../../src/lib/zip";
import { buildOperationalReport } from "../../src/lib/operationalPanel";

const encoder = new TextEncoder();

const sampleReport: ExportReport = {
  reportName: "Relatório Operacional UNICAP",
  sections: [
    {
      title: "Resumo de Vagas",
      columns: ["Métrica", "Valor"],
      rows: [
        ["Vagas abertas", 3],
        ["Vagas com 'aspas' e ; ponto-e-vírgula", "quebra\r\nde linha"],
        ["Sem valor", null],
      ],
    },
    {
      title: "Funil de Conversão",
      columns: ["Etapa", "Candidaturas"],
      rows: [
        ["Inscrito", 10],
        ["Aprovado", 4],
      ],
    },
  ],
};

/** Parser CSV mínimo (RFC 4180 com separador ;) para validar a saída. */
function parseCsv(text: string): string[][] {
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  while (index < clean.length) {
    const ch = clean[index] ?? "";
    if (quoted) {
      if (ch === '"') {
        if ((clean[index + 1] ?? "") === '"') {
          field += '"';
          index += 2;
        } else {
          quoted = false;
          index += 1;
        }
      } else {
        field += ch;
        index += 1;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      index += 1;
      continue;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
    index += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Extrai entradas de um ZIP "stored" (sem compressão) para inspeção. */
function extractZipEntries(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset < bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    const dataStart = nameStart + nameLength;
    entries.set(
      name,
      decoder.decode(bytes.subarray(dataStart, dataStart + compressedSize)),
    );
    offset = dataStart + extraLength + compressedSize;
  }
  return entries;
}

describe("[S6-1] nome do arquivo exportado", () => {
  it("data local no formato aaaa-mm-dd (ordenável, sem barras)", () => {
    const noon = new Date(2026, 8, 27, 12).getTime();
    expect(formatDateStamp(noon)).toBe("2026-09-27");
  });

  it("slug sem acentos/espacos + extensao por formato", () => {
    const noon = new Date(2026, 8, 27, 12).getTime();
    expect(reportFilename("Relatório Operacional UNICAP", "csv", noon)).toBe(
      "relatorio-operacional-unicap-2026-09-27.csv",
    );
    expect(reportFilename("Relatório Operacional UNICAP", "xlsx", noon)).toBe(
      "relatorio-operacional-unicap-2026-09-27.xlsx",
    );
  });

  it("remove caracteres invalidos de nome de arquivo", () => {
    const noon = new Date(2026, 8, 27, 12).getTime();
    expect(reportFilename("A/B: C?D*E", "csv", noon)).toBe(
      "a-b-c-d-e-2026-09-27.csv",
    );
  });
});

describe("[S6-1] CSV (CA 2 — encoding para Excel)", () => {
  it("comeca com BOM UTF-8 e usa separador pt-BR (;)", () => {
    const csv = toCsv(sampleReport);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(CSV_SEPARATOR).toBe(";");
    expect(csv).toContain(`Métrica${CSV_SEPARATOR}Valor`);
  });

  it("escapa campos com separador, aspas e quebras de linha (RFC 4180)", () => {
    const csv = toCsv(sampleReport);
    expect(csv).toContain("'aspas'");
    expect(csv).toContain('; ponto-e-vírgula"');
    // LF é normalizado para CRLF (Excel); campo citado mantém a quebra.
    expect(csv).toContain('"quebra\r\nde linha"');
    // Aspas internas são dobradas.
    const quoted = toCsv({
      reportName: "x",
      sections: [{ title: "s", columns: ["c"], rows: [['diz "oi"']] }],
    });
    expect(quoted).toContain('"diz ""oi"""');
  });

  it("usa CRLF como fim de linha (Excel) e valor nulo vira célula vazia", () => {
    const csv = toCsv(sampleReport);
    expect(csv).toContain("\r\n");
    expect(csv.match(/(?<!\r)\n/)).toBeNull();
    expect(csv).toContain("Sem valor;");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("empilha as seções com título e linha em branco entre elas", () => {
    const rows = parseCsv(toCsv(sampleReport)).filter(
      (row) => !(row.length === 1 && (row[0] ?? "") === ""),
    );
    expect(rows).toEqual([
      [sampleReport.reportName],
      ["# Resumo de Vagas"],
      ["Métrica", "Valor"],
      ["Vagas abertas", "3"],
      ["Vagas com 'aspas' e ; ponto-e-vírgula", "quebra\r\nde linha"],
      ["Sem valor", ""],
      ["# Funil de Conversão"],
      ["Etapa", "Candidaturas"],
      ["Inscrito", "10"],
      ["Aprovado", "4"],
    ]);
  });

  it("csvBytes codifica UTF-8 com BOM (EF BB BF) — Excel abre sem mojibake", () => {
    const bytes = csvBytes(sampleReport);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const bomDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
    expect(bomDecoder.decode(bytes)).toBe(toCsv(sampleReport));
  });
});

describe("[S6-1] ZIP (base do XLSX)", () => {
  it("crc32 bate com o vetor de teste conhecido", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("empacota entradas stored, com central directory e EOCD consistentes", () => {
    const zip = buildZip([
      { name: "xl/a.txt", data: encoder.encode("hello") },
      { name: "xl/b.txt", data: encoder.encode("world!") },
    ]);
    const entries = extractZipEntries(zip);
    expect([...entries.keys()]).toEqual(["xl/a.txt", "xl/b.txt"]);
    expect(entries.get("xl/a.txt")).toBe("hello");
    expect(entries.get("xl/b.txt")).toBe("world!");

    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);
    const centralSize = view.getUint32(eocdOffset + 12, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    expect(centralOffset + centralSize).toBe(eocdOffset);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
  });
});

describe("[S6-1] nomes de planilha", () => {
  it("mantém o título quando já é válido", () => {
    expect(sheetNameFor("Resumo de Vagas")).toBe("Resumo de Vagas");
  });

  it("remove caracteres proibidos e limita a 31 caracteres", () => {
    expect(sheetNameFor("A[B]:C*D?E/F\\G")).toBe("ABCDEFG");
    expect(
      sheetNameFor("Título Extenso ".repeat(3)).length,
    ).toBeLessThanOrEqual(31);
  });

  it("desambigua nomes repetidos", () => {
    expect(sheetNameFor("Resumo", new Set(["Resumo"]))).toBe("Resumo 2");
  });
});

describe("[S6-1] XLSX (CA 3 — arquivo válido)", () => {
  it("workbook lista as planilhas com r:id e namespaces OOXML", () => {
    const xml = buildWorkbookXml(["Resumo de Vagas", "Funil de Conversão"]);
    expect(xml).toContain(
      'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
    );
    expect(xml).toContain(
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
    expect(xml).toContain(
      '<sheet name="Resumo de Vagas" sheetId="1" r:id="rId1"/>',
    );
    expect(xml).toContain(
      '<sheet name="Funil de Conversão" sheetId="2" r:id="rId2"/>',
    );
  });

  it("gera um pacote OOXML com partes obrigatórias e planilhas por seção", () => {
    const bytes = xlsxBytes(sampleReport);
    // Assinatura PKZip local.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    const entries = extractZipEntries(bytes);
    expect([...entries.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);

    const contentTypes = entries.get("[Content_Types].xml") ?? "";
    expect(contentTypes).toContain(
      'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"',
    );
    expect(contentTypes).toContain("/xl/worksheets/sheet1.xml");
    expect(contentTypes).toContain("/xl/worksheets/sheet2.xml");

    const rels = entries.get("xl/_rels/workbook.xml.rels") ?? "";
    expect(rels).toContain('Target="worksheets/sheet1.xml"');
    expect(rels).toContain('Target="worksheets/sheet2.xml"');

    const workbook = entries.get("xl/workbook.xml") ?? "";
    expect(workbook).toContain(
      '<sheet name="Resumo de Vagas" sheetId="1" r:id="rId1"/>',
    );
    expect(workbook).toContain(
      '<sheet name="Funil de Conversão" sheetId="2" r:id="rId2"/>',
    );

    // EOCD com contagem de entradas correta.
    const eocdOffset = bytes.length - 22;
    expect(view.getUint16(eocdOffset + 10, true)).toBe(entries.size);
  });

  it("células: texto vira inlineStr, número vira <v> e nulo vira célula vazia", () => {
    const entries = extractZipEntries(xlsxBytes(sampleReport));
    const sheet1 = entries.get("xl/worksheets/sheet1.xml") ?? "";
    expect(sheet1).toContain('<t xml:space="preserve">Métrica</t>');
    expect(sheet1).toContain("<v>3</v>");
    expect(sheet1).toContain(
      `<c r="A3" t="inlineStr"><is><t xml:space="preserve">Vagas com 'aspas' e ; ponto-e-vírgula</t></is></c>`,
    );
    expect(sheet1).toContain('<c r="B4"/>');

    const sheet2 = entries.get("xl/worksheets/sheet2.xml") ?? "";
    expect(sheet2).toContain('<t xml:space="preserve">Etapa</t>');
    expect(sheet2).toContain("<v>10</v>");
  });

  it("é determinístico (mesma entrada → mesmos bytes)", () => {
    expect(xlsxBytes(sampleReport)).toEqual(xlsxBytes(sampleReport));
  });
});

describe("[S6-1] download nativo do navegador", () => {
  function makeDeps(): {
    deps: ReportDownloadDeps;
    created: Blob[];
    revoked: string[];
    clicks: string[];
    anchor: {
      href: string;
      download: string;
      click: () => void;
      remove: () => void;
    };
  } {
    const created: Blob[] = [];
    const revoked: string[] = [];
    const clicks: string[] = [];
    const anchor = {
      href: "",
      download: "",
      click: () => {
        clicks.push(anchor.download);
      },
      remove: () => {},
    };
    const deps: ReportDownloadDeps = {
      document: {
        createElement: () => anchor as unknown as HTMLAnchorElement,
        body: { appendChild: () => {} } as unknown as HTMLElement,
      },
      url: {
        createObjectURL: (blob: Blob) => {
          created.push(blob);
          return "blob:fake-1";
        },
        revokeObjectURL: (url: string) => {
          revoked.push(url);
        },
      },
    };
    return { deps, created, revoked, clicks, anchor };
  }

  it("CSV: Blob text/csv com bytes corretos, âncora com download e revoke", () => {
    const { deps, created, revoked, clicks, anchor } = makeDeps();
    downloadReport(sampleReport, "csv", deps);

    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe("text/csv;charset=utf-8");
    expect(created[0]?.size).toBe(csvBytes(sampleReport).length);
    expect(anchor.download).toBe(
      reportFilename(sampleReport.reportName, "csv"),
    );
    expect(clicks).toEqual([anchor.download]);
    expect(revoked).toEqual(["blob:fake-1"]);
  });

  it("XLSX: Blob com MIME de planilha e tamanho do pacote gerado", () => {
    const { deps, created, anchor } = makeDeps();
    downloadReport(sampleReport, "xlsx", deps);

    expect(created[0]?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(created[0]?.size).toBe(xlsxBytes(sampleReport).length);
    expect(anchor.download).toBe(
      reportFilename(sampleReport.reportName, "xlsx"),
    );
  });
});

describe("[S6-1] relatório do painel operacional (dados filtrados vigentes)", () => {
  const input = {
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
          stage: "inscrito" as const,
          label: "Inscrito",
          count: 20,
          conversionFromPrevious: null,
        },
        {
          stage: "triagem" as const,
          label: "Em Triagem",
          count: 10,
          conversionFromPrevious: 50,
        },
      ],
      totalApplications: 23,
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
      topJobs: [
        {
          jobId: "j1",
          title: "Estágio Web",
          companyName: "Alpha",
          applicationsCount: 12,
        },
      ],
    },
  };

  it("monta as seis seções do painel na ordem de exibição", () => {
    const report = buildOperationalReport(input);
    expect(report.reportName).toBe("Relatório Operacional UNICAP");
    expect(report.sections.map((section) => section.title)).toEqual([
      "Resumo de Vagas",
      "Candidaturas",
      "Funil de Conversão",
      "Empresas Mais Ativas",
      "Vagas Mais Procuradas",
      "Time to Hire",
    ]);
  });

  it("resume vagas, candidaturas (com taxa), funil, rankings e TTH", () => {
    const report = buildOperationalReport(input);
    expect(report.sections[0]?.rows).toEqual([
      ["Vagas abertas", 3],
      ["Vagas fechadas", 1],
      ["Vagas preenchidas", 2],
      ["Total de vagas", 6],
    ]);
    expect(report.sections[1]?.rows).toContainEqual([
      "Taxa de empregabilidade (%)",
      63,
    ]);
    expect(report.sections[1]?.rows).toContainEqual(["Aprovados", 5]);
    expect(report.sections[2]?.rows).toEqual([
      ["Inscrito", 20, ""],
      ["Em Triagem", 10, 50],
    ]);
    expect(report.sections[3]?.rows).toEqual([[1, "Alpha", 3, 12]]);
    expect(report.sections[4]?.rows).toEqual([[1, "Estágio Web", "Alpha", 12]]);
    expect(report.sections[5]?.rows).toEqual([
      ["TTH médio (dias)", 12],
      ["Contratações na amostra", 4],
    ]);
  });

  it("métricas sem valor (null) viram células vazias, nunca 'null'/'undefined'", () => {
    const report = buildOperationalReport({
      ...input,
      summary: {
        ...input.summary,
        employability: { rate: null },
      },
      timeToHire: { averageDays: null, samplesCount: 0 },
    });
    const csv = toCsv(report);
    expect(csv).toContain("Taxa de empregabilidade (%);");
    expect(csv).toContain("TTH médio (dias);");
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });
});
