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

// --- Constantes nomeadas (evitam "magic numbers") --------------------------

/** 27/set/2026 12:00 no fuso local (sem "Z" = horário local). */
const MEIO_DIA = new Date("2026-09-27T12:00:00").getTime();

// Dados do relatório de exemplo.
const VAGAS_ABERTAS = 3;
const INSCRITOS = 10;
const APROVADOS = 4;

// Formato ZIP (assinaturas e deslocamentos do PKWARE APPNOTE).
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_EOCD_SIZE = 22;
const EOCD_ENTRY_COUNT_OFFSET = 10;
const EOCD_CENTRAL_SIZE_OFFSET = 12;
const EOCD_CENTRAL_OFFSET_OFFSET = 16;
const LOCAL_HEADER_SIZE = 30;
const LOCAL_COMPRESSED_SIZE_OFFSET = 18;
const LOCAL_NAME_LENGTH_OFFSET = 26;
const LOCAL_EXTRA_LENGTH_OFFSET = 28;

/** CRC-32 do texto "123456789" (vetor de teste padrão da especificação). */
const CRC32_CHECK_VALUE = 0xcbf43926;

const ENTRADAS_NO_ZIP_DE_EXEMPLO = 2;
const LIMITE_NOME_PLANILHA = 31;
const REPETICOES_TITULO_LONGO = 3;
const TAMANHO_ASPAS_DOBRADAS = 2;
const BOM_UTF8 = [...encoder.encode("\uFEFF")];

const sampleReport: ExportReport = {
  reportName: "Relatório Operacional UNICAP",
  sections: [
    {
      title: "Resumo de Vagas",
      columns: ["Métrica", "Valor"],
      rows: [
        ["Vagas abertas", VAGAS_ABERTAS],
        ["Vagas com 'aspas' e ; ponto-e-vírgula", "quebra\r\nde linha"],
        ["Sem valor", null],
      ],
    },
    {
      title: "Funil de Conversão",
      columns: ["Etapa", "Candidaturas"],
      rows: [
        ["Inscrito", INSCRITOS],
        ["Aprovado", APROVADOS],
      ],
    },
  ],
};

// --- Helpers ---------------------------------------------------------------

/** Partes de `parts` que NÃO aparecem em `text` (vazio = todas presentes). */
function missingParts(text: string, parts: string[]) {
  return parts.filter((part) => !text.includes(part));
}

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
          index += TAMANHO_ASPAS_DOBRADAS;
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
    if (view.getUint32(offset, true) !== ZIP_LOCAL_SIGNATURE) break;
    const compressedSize = view.getUint32(
      offset + LOCAL_COMPRESSED_SIZE_OFFSET,
      true,
    );
    const nameLength = view.getUint16(offset + LOCAL_NAME_LENGTH_OFFSET, true);
    const extraLength = view.getUint16(
      offset + LOCAL_EXTRA_LENGTH_OFFSET,
      true,
    );
    const nameStart = offset + LOCAL_HEADER_SIZE;
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

/** Lê o "End Of Central Directory" (últimos 22 bytes) de um ZIP. */
function readEocd(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocdOffset = zip.length - ZIP_EOCD_SIZE;
  return {
    view,
    eocdOffset,
    signature: view.getUint32(eocdOffset, true),
    entryCount: view.getUint16(eocdOffset + EOCD_ENTRY_COUNT_OFFSET, true),
    centralSize: view.getUint32(eocdOffset + EOCD_CENTRAL_SIZE_OFFSET, true),
    centralOffset: view.getUint32(
      eocdOffset + EOCD_CENTRAL_OFFSET_OFFSET,
      true,
    ),
  };
}

// --- Testes ----------------------------------------------------------------

describe("[S6-1] nome do arquivo exportado", () => {
  it("data local no formato aaaa-mm-dd (ordenável, sem barras)", () => {
    expect(formatDateStamp(MEIO_DIA)).toBe("2026-09-27");
  });

  it.each(["csv", "xlsx"] as const)(
    "slug sem acentos/espaços + extensão .%s",
    (format) => {
      expect(
        reportFilename("Relatório Operacional UNICAP", format, MEIO_DIA),
      ).toBe(`relatorio-operacional-unicap-2026-09-27.${format}`);
    },
  );

  it("remove caracteres inválidos de nome de arquivo", () => {
    expect(reportFilename("A/B: C?D*E", "csv", MEIO_DIA)).toBe(
      "a-b-c-d-e-2026-09-27.csv",
    );
  });
});

describe("[S6-1] CSV (CA 2 — encoding para Excel)", () => {
  it("começa com BOM UTF-8 e usa separador pt-BR (;)", () => {
    const csv = toCsv(sampleReport);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(CSV_SEPARATOR).toBe(";");
    expect(csv).toContain(`Métrica${CSV_SEPARATOR}Valor`);
  });

  it("campo com separador é citado (RFC 4180)", () => {
    const csv = toCsv(sampleReport);
    expect(csv).toContain("'aspas'");
    expect(csv).toContain('; ponto-e-vírgula"');
  });

  it("campo com quebra de linha é citado e mantém CRLF", () => {
    // LF é normalizado para CRLF (Excel); campo citado mantém a quebra.
    expect(toCsv(sampleReport)).toContain('"quebra\r\nde linha"');
  });

  it("aspas internas são dobradas", () => {
    const quoted = toCsv({
      reportName: "x",
      sections: [{ title: "s", columns: ["c"], rows: [['diz "oi"']] }],
    });
    expect(quoted).toContain('"diz ""oi"""');
  });

  it("usa CRLF como fim de linha (Excel)", () => {
    const csv = toCsv(sampleReport);
    expect(csv).toContain("\r\n");
    expect(csv.match(/(?<!\r)\n/)).toBeNull();
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("valor nulo vira célula vazia", () => {
    expect(toCsv(sampleReport)).toContain("Sem valor;");
  });

  it("empilha as seções com título e linha em branco entre elas", () => {
    const rows = parseCsv(toCsv(sampleReport)).filter(
      (row) => !(row.length === 1 && (row[0] ?? "") === ""),
    );
    expect(rows).toEqual([
      [sampleReport.reportName],
      ["# Resumo de Vagas"],
      ["Métrica", "Valor"],
      ["Vagas abertas", String(VAGAS_ABERTAS)],
      ["Vagas com 'aspas' e ; ponto-e-vírgula", "quebra\r\nde linha"],
      ["Sem valor", ""],
      ["# Funil de Conversão"],
      ["Etapa", "Candidaturas"],
      ["Inscrito", String(INSCRITOS)],
      ["Aprovado", String(APROVADOS)],
    ]);
  });

  it("csvBytes codifica UTF-8 com BOM (EF BB BF) — Excel abre sem mojibake", () => {
    const bytes = csvBytes(sampleReport);
    expect([...bytes.slice(0, BOM_UTF8.length)]).toEqual(BOM_UTF8);
    const bomDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
    expect(bomDecoder.decode(bytes)).toBe(toCsv(sampleReport));
  });
});

describe("[S6-1] ZIP (base do XLSX)", () => {
  const buildSampleZip = () =>
    buildZip([
      { name: "xl/a.txt", data: encoder.encode("hello") },
      { name: "xl/b.txt", data: encoder.encode("world!") },
    ]);

  it("crc32 bate com o vetor de teste conhecido", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(CRC32_CHECK_VALUE);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("empacota as entradas na ordem informada", () => {
    const entries = extractZipEntries(buildSampleZip());
    expect([...entries.keys()]).toEqual(["xl/a.txt", "xl/b.txt"]);
  });

  it("guarda o conteúdo de cada entrada sem compressão (stored)", () => {
    const entries = extractZipEntries(buildSampleZip());
    expect(Object.fromEntries(entries)).toEqual({
      "xl/a.txt": "hello",
      "xl/b.txt": "world!",
    });
  });

  it("EOCD tem a assinatura e a contagem de entradas corretas", () => {
    const eocd = readEocd(buildSampleZip());
    expect(eocd.signature).toBe(ZIP_EOCD_SIGNATURE);
    expect(eocd.entryCount).toBe(ENTRADAS_NO_ZIP_DE_EXEMPLO);
  });

  it("central directory termina onde começa o EOCD e tem assinatura própria", () => {
    const zip = buildSampleZip();
    const eocd = readEocd(zip);
    expect(eocd.centralOffset + eocd.centralSize).toBe(eocd.eocdOffset);
    expect(eocd.view.getUint32(eocd.centralOffset, true)).toBe(
      ZIP_CENTRAL_SIGNATURE,
    );
  });
});

describe("[S6-1] nomes de planilha", () => {
  it("mantém o título quando já é válido", () => {
    expect(sheetNameFor("Resumo de Vagas")).toBe("Resumo de Vagas");
  });

  it("remove caracteres proibidos", () => {
    expect(sheetNameFor("A[B]:C*D?E/F\\G")).toBe("ABCDEFG");
  });

  it("limita a 31 caracteres", () => {
    const longo = "Título Extenso ".repeat(REPETICOES_TITULO_LONGO);
    expect(sheetNameFor(longo).length).toBeLessThanOrEqual(
      LIMITE_NOME_PLANILHA,
    );
  });

  it("desambigua nomes repetidos", () => {
    expect(sheetNameFor("Resumo", new Set(["Resumo"]))).toBe("Resumo 2");
  });
});

describe("[S6-1] XLSX (CA 3 — arquivo válido)", () => {
  const SHEET_RESUMO =
    '<sheet name="Resumo de Vagas" sheetId="1" r:id="rId1"/>';
  const SHEET_FUNIL =
    '<sheet name="Funil de Conversão" sheetId="2" r:id="rId2"/>';

  function buildSampleXlsx() {
    const bytes = xlsxBytes(sampleReport);
    return { bytes, entries: extractZipEntries(bytes) };
  }

  it("workbook lista as planilhas com r:id e namespaces OOXML", () => {
    const xml = buildWorkbookXml(["Resumo de Vagas", "Funil de Conversão"]);
    expect(
      missingParts(xml, [
        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
        SHEET_RESUMO,
        SHEET_FUNIL,
      ]),
    ).toEqual([]);
  });

  it("pacote começa com a assinatura PKZip local", () => {
    const { bytes } = buildSampleXlsx();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(ZIP_LOCAL_SIGNATURE);
  });

  it("pacote tem as partes obrigatórias e uma planilha por seção", () => {
    const { entries } = buildSampleXlsx();
    expect([...entries.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
  });

  it("[Content_Types].xml declara o workbook e as planilhas", () => {
    const contentTypes =
      buildSampleXlsx().entries.get("[Content_Types].xml") ?? "";
    expect(
      missingParts(contentTypes, [
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"',
        "/xl/worksheets/sheet1.xml",
        "/xl/worksheets/sheet2.xml",
      ]),
    ).toEqual([]);
  });

  it("relacionamentos apontam para as duas planilhas", () => {
    const rels =
      buildSampleXlsx().entries.get("xl/_rels/workbook.xml.rels") ?? "";
    expect(
      missingParts(rels, [
        'Target="worksheets/sheet1.xml"',
        'Target="worksheets/sheet2.xml"',
      ]),
    ).toEqual([]);
  });

  it("workbook.xml lista as planilhas pelo título da seção", () => {
    const workbook = buildSampleXlsx().entries.get("xl/workbook.xml") ?? "";
    expect(missingParts(workbook, [SHEET_RESUMO, SHEET_FUNIL])).toEqual([]);
  });

  it("EOCD com contagem de entradas correta", () => {
    const { bytes, entries } = buildSampleXlsx();
    expect(readEocd(bytes).entryCount).toBe(entries.size);
  });

  it("células da 1ª planilha: texto vira inlineStr, número vira <v>, nulo vira célula vazia", () => {
    const sheet1 =
      buildSampleXlsx().entries.get("xl/worksheets/sheet1.xml") ?? "";
    expect(
      missingParts(sheet1, [
        '<t xml:space="preserve">Métrica</t>',
        `<v>${VAGAS_ABERTAS}</v>`,
        `<c r="A3" t="inlineStr"><is><t xml:space="preserve">Vagas com 'aspas' e ; ponto-e-vírgula</t></is></c>`,
        '<c r="B4"/>',
      ]),
    ).toEqual([]);
  });

  it("células da 2ª planilha: título de coluna e número", () => {
    const sheet2 =
      buildSampleXlsx().entries.get("xl/worksheets/sheet2.xml") ?? "";
    expect(
      missingParts(sheet2, [
        '<t xml:space="preserve">Etapa</t>',
        `<v>${INSCRITOS}</v>`,
      ]),
    ).toEqual([]);
  });

  it("é determinístico (mesma entrada → mesmos bytes)", () => {
    expect(xlsxBytes(sampleReport)).toEqual(xlsxBytes(sampleReport));
  });
});

describe("[S6-1] download nativo do navegador", () => {
  function makeDeps() {
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

  function runDownload(format: "csv" | "xlsx") {
    const fake = makeDeps();
    downloadReport(sampleReport, format, fake.deps);
    return fake;
  }

  it("CSV: gera um Blob text/csv com os bytes corretos", () => {
    const { created } = runDownload("csv");
    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe("text/csv;charset=utf-8");
    expect(created[0]?.size).toBe(csvBytes(sampleReport).length);
  });

  it("CSV: a âncora recebe o nome do arquivo", () => {
    const { anchor } = runDownload("csv");
    expect(anchor.download).toBe(
      reportFilename(sampleReport.reportName, "csv"),
    );
  });

  it("CSV: clica na âncora e revoga a URL do Blob", () => {
    const { anchor, clicks, revoked } = runDownload("csv");
    expect(clicks).toEqual([anchor.download]);
    expect(revoked).toEqual(["blob:fake-1"]);
  });

  it("XLSX: Blob com MIME de planilha e tamanho do pacote gerado", () => {
    const { created, anchor } = runDownload("xlsx");
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
  // Fixture: aqui o literal numérico É o caso de teste (entrada e saída
  // esperada); por isso estes números não viram constantes nomeadas.
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
  const report = buildOperationalReport(input);

  it("monta as seis seções do painel na ordem de exibição", () => {
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

  it("resume as vagas", () => {
    expect(report.sections[0]?.rows).toEqual([
      ["Vagas abertas", 3],
      ["Vagas fechadas", 1],
      ["Vagas preenchidas", 2],
      ["Total de vagas", 6],
    ]);
  });

  it("resume as candidaturas (com taxa de empregabilidade)", () => {
    expect(report.sections[1]?.rows).toContainEqual([
      "Taxa de empregabilidade (%)",
      63,
    ]);
    expect(report.sections[1]?.rows).toContainEqual(["Aprovados", 5]);
  });

  it("resume o funil", () => {
    expect(report.sections[2]?.rows).toEqual([
      ["Inscrito", 20, ""],
      ["Em Triagem", 10, 50],
    ]);
  });

  it("resume os rankings de empresas e vagas", () => {
    expect(report.sections[3]?.rows).toEqual([[1, "Alpha", 3, 12]]);
    expect(report.sections[4]?.rows).toEqual([[1, "Estágio Web", "Alpha", 12]]);
  });

  it("resume o time to hire", () => {
    expect(report.sections[5]?.rows).toEqual([
      ["TTH médio (dias)", 12],
      ["Contratações na amostra", 4],
    ]);
  });

  it("métricas sem valor (null) viram células vazias, nunca 'null'/'undefined'", () => {
    const semValores = buildOperationalReport({
      ...input,
      summary: {
        ...input.summary,
        employability: { rate: null },
      },
      timeToHire: { averageDays: null, samplesCount: 0 },
    });
    const csv = toCsv(semValores);
    expect(
      missingParts(csv, ["Taxa de empregabilidade (%);", "TTH médio (dias);"]),
    ).toEqual([]);
    expect(csv).not.toMatch(/null|undefined/);
  });
});
