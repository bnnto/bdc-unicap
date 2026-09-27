/**
 * [S6-3] Testes de borda dos utilitários de exportação (CSV/XLSX/PDF).
 *
 * CA 1 — formato e estrutura validados: ZIP com metadados coerentes
 * (offsets do central directory, nomes UTF-8 multibyte) e pacote OOXML
 * com planilhas nomeadas/escapadas/desambiguadas.
 * CA 2 — dados e encoding corretos: BOM, separador, números (0/negativos),
 * células vazias e sanitização de nomes (planilha ≤ 31 chars, filename).
 */
import { describe, expect, it } from "vitest";
import {
  csvBytes,
  reportFilename,
  sheetNameFor,
  toCsv,
  xlsxBytes,
  type ExportReport,
} from "../../src/lib/reportExport";
import { buildZip, crc32 } from "../../src/lib/zip";

const NOON = new Date(2026, 8, 27, 12).getTime();
const encoder = new TextEncoder();

/** Extrai entradas de um ZIP "stored" para inspeção estrutural. */
function extractZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameDecoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset < bytes.length - 22) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const nameStart = offset + 30;
    const name = nameDecoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    const dataStart = nameStart + nameLength;
    entries.set(name, bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}

describe("[S6-3] ZIP — estrutura e metadados (CA 1)", () => {
  it("entrada única: offset local 0 no central directory e campos coerentes", () => {
    const data = encoder.encode("dados");
    const zip = buildZip([{ name: "a.txt", data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // Central directory logo após a única entrada (30 + 5 + nome).
    const centralOffset = 30 + "a.txt".length + data.length;
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    // Offset local da entrada, gravado no central directory (+42).
    expect(view.getUint32(centralOffset + 42, true)).toBe(0);
    // Tamanho compactado = tamanho original (stored) nos dois headers.
    expect(view.getUint32(18, true)).toBe(data.length);
    expect(view.getUint32(centralOffset + 20, true)).toBe(data.length);
  });

  it("nomes multibyte (UTF-8) são contados em BYTES e restaurados intactos", () => {
    const name = "relatório-açúcar.xlsx";
    const zip = buildZip([{ name, data: encoder.encode("x") }]);
    const entries = extractZipEntries(zip);
    expect([...entries.keys()]).toEqual([name]);
    // Nome em bytes UTF-8 (ç/á = 2 bytes cada), não em caracteres.
    const nameBytes = encoder.encode(name).length;
    expect(zip[26]).toBe(nameBytes & 0xff);
    expect(zip[27]).toBe(nameBytes >>> 8);
  });

  it("sem entradas: ZIP contendo apenas o EOCD com contagem zero", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(10, true)).toBe(0);
    expect(view.getUint32(12, true)).toBe(0);
    expect(view.getUint32(16, true)).toBe(0);
  });

  it("múltiplas entradas: dados íntegros e CRC consistente por entrada", () => {
    const first = encoder.encode("primeiro");
    const second = encoder.encode("segundo com acentuação");
    const zip = buildZip([
      { name: "xl/one.bin", data: first },
      { name: "xl/two.bin", data: second },
    ]);
    const entries = extractZipEntries(zip);
    expect([...entries.keys()]).toEqual(["xl/one.bin", "xl/two.bin"]);
    expect(new TextDecoder().decode(entries.get("xl/one.bin"))).toBe(
      "primeiro",
    );
    expect(new TextDecoder().decode(entries.get("xl/two.bin"))).toBe(
      "segundo com acentuação",
    );
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(14, true)).toBe(crc32(first));
  });
});

describe("[S6-3] nomes de planilha — sanitização (CA 1/CA 2)", () => {
  it("título só com caracteres proibidos cai no fallback 'Planilha'", () => {
    expect(sheetNameFor(":\\/?*[]")).toBe("Planilha");
    expect(sheetNameFor("   ")).toBe("Planilha");
  });

  it("sufixo avança até achar nome livre (Resumo, Resumo 2 → Resumo 3)", () => {
    expect(sheetNameFor("Resumo", new Set(["Resumo", "Resumo 2"]))).toBe(
      "Resumo 3",
    );
  });

  it("sufixo de desambiguação respeita o limite de 31 caracteres", () => {
    const base31 = "A".repeat(31);
    const result = sheetNameFor(base31, new Set([base31]));
    expect(result.length).toBeLessThanOrEqual(31);
    expect(result).toBe(`${"A".repeat(29)} 2`);
  });

  it("remove proibidos e mantém espaços internos no nome da aba do XLSX", () => {
    const report: ExportReport = {
      reportName: "Relatório Operacional UNICAP",
      sections: [
        {
          title: " Relatório: Final ",
          columns: ["Métrica"],
          rows: [["Vagas abertas", 3]],
        },
      ],
    };
    const entries = extractZipEntries(xlsxBytes(report));
    const workbook = new TextDecoder().decode(
      entries.get("xl/workbook.xml") ?? new Uint8Array(0),
    );
    expect(workbook).toContain('<sheet name="Relatório Final"');
  });
});

describe("[S6-3] nome de arquivo — sanitização (CA 2)", () => {
  it("reportName sem caracteres de slug usa fallback 'relatorio'", () => {
    expect(reportFilename("***", "csv", NOON)).toMatch(
      /^relatorio-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it("hífens de borda são removidos e pontuação interna vira separador", () => {
    expect(reportFilename("Relatório!! Operacional.", "xlsx", NOON)).toBe(
      "relatorio-operacional-2026-09-27.xlsx",
    );
  });
});

describe("[S6-3] CSV — dados e encoding (CA 2)", () => {
  it("número 0 permanece '0' (não é tratado como vazio)", () => {
    const csv = toCsv({
      reportName: "r",
      sections: [
        { title: "s", columns: ["Métrica", "Valor"], rows: [["Zero", 0]] },
      ],
    });
    expect(csv).toContain("Zero;0");
  });

  it("números negativos e texto vazio viram '-5' e célula vazia", () => {
    const csv = toCsv({
      reportName: "r",
      sections: [
        {
          title: "s",
          columns: ["M", "V"],
          rows: [
            ["Negativo", -5],
            ["Texto vazio", ""],
          ],
        },
      ],
    });
    expect(csv).toContain("Negativo;-5");
    expect(csv).toContain("Texto vazio;");
  });

  it("CR isolado dentro do campo é normalizado para CRLF (Excel)", () => {
    const csv = toCsv({
      reportName: "r",
      sections: [{ title: "s", columns: ["c"], rows: [["a\rb"]] }],
    });
    expect(csv).toContain('"a\r\nb"');
  });

  it("csvBytes reflete o comprimento exato (BOM + conteúdo UTF-8)", () => {
    const report: ExportReport = {
      reportName: "Relatório Operacional UNICAP",
      sections: [
        { title: "Resumo", columns: ["M", "V"], rows: [["Acentuação", 1]] },
      ],
    };
    const bytes = csvBytes(report);
    expect(bytes.length).toBe(encoder.encode(toCsv(report)).length);
    expect(bytes.length).toBeGreaterThan(toCsv(report).length - 4);
  });
});
