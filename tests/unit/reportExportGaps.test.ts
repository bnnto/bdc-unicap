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

const NOON = new Date("2026-09-27T12:00:00").getTime();
const encoder = new TextEncoder();

/** Assinaturas dos registros do formato ZIP (little-endian). */
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

/** Tamanhos fixos dos registros ZIP (sem nome/dados/comentário). */
const LOCAL_HEADER_SIZE = 30;
const EOCD_SIZE = 22;

/** Deslocamentos dos campos em cada registro, a partir do início dele. */
const LOCAL = { crc32: 14, compressedSize: 18, nameLength: 26 } as const;
const CENTRAL = { compressedSize: 20, localOffset: 42 } as const;
const EOCD = {
  entriesOnDisk: 8,
  totalEntries: 10,
  centralSize: 12,
  centralOffset: 16,
} as const;

/** Limite do Excel para o nome de uma aba. */
const SHEET_NAME_LIMIT = 31;

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Extrai entradas de um ZIP "stored" para inspeção estrutural. */
function extractZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = viewOf(bytes);
  const nameDecoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset < bytes.length - EOCD_SIZE) {
    if (view.getUint32(offset, true) !== LOCAL_HEADER_SIGNATURE) break;
    const compressedSize = view.getUint32(offset + LOCAL.compressedSize, true);
    const nameLength = view.getUint16(offset + LOCAL.nameLength, true);
    const nameStart = offset + LOCAL_HEADER_SIZE;
    const name = nameDecoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    const dataStart = nameStart + nameLength;
    entries.set(name, bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}

/** Texto de uma entrada do ZIP ("" se a entrada não existir). */
function zipText(bytes: Uint8Array, name: string): string {
  return new TextDecoder().decode(extractZipEntries(bytes).get(name));
}

describe("[S6-3] ZIP — estrutura e metadados (CA 1)", () => {
  describe("entrada única", () => {
    const name = "a.txt";
    const data = encoder.encode("dados");
    const zip = buildZip([{ name, data }]);
    const view = viewOf(zip);
    // Central directory logo após a única entrada (cabeçalho + nome + dados).
    const centralOffset = LOCAL_HEADER_SIZE + name.length + data.length;

    it("central directory começa logo após a entrada", () => {
      expect(view.getUint32(centralOffset, true)).toBe(
        CENTRAL_HEADER_SIGNATURE,
      );
    });

    it("offset local gravado no central directory é 0", () => {
      expect(view.getUint32(centralOffset + CENTRAL.localOffset, true)).toBe(0);
    });

    it("tamanho compactado = original (stored) no header local", () => {
      expect(view.getUint32(LOCAL.compressedSize, true)).toBe(data.length);
    });

    it("tamanho compactado = original (stored) no central directory", () => {
      expect(
        view.getUint32(centralOffset + CENTRAL.compressedSize, true),
      ).toBe(data.length);
    });
  });

  it("nomes multibyte (UTF-8) são contados em BYTES e restaurados intactos", () => {
    const name = "relatório-açúcar.xlsx";
    const zip = buildZip([{ name, data: encoder.encode("x") }]);

    expect([...extractZipEntries(zip).keys()]).toEqual([name]);
    // ç/á ocupam 2 bytes cada: o campo guarda bytes, não caracteres.
    expect(viewOf(zip).getUint16(LOCAL.nameLength, true)).toBe(
      encoder.encode(name).length,
    );
  });

  describe("sem entradas: apenas o EOCD, com contagem zero", () => {
    const zip = buildZip([]);
    const view = viewOf(zip);

    it("tem exatamente o tamanho do EOCD", () => {
      expect(zip.length).toBe(EOCD_SIZE);
    });

    it("começa pela assinatura do EOCD", () => {
      expect(view.getUint32(0, true)).toBe(EOCD_SIGNATURE);
    });

    it.each(["entriesOnDisk", "totalEntries"] as const)(
      "EOCD: %s é zero",
      (campo) => {
        expect(view.getUint16(EOCD[campo], true)).toBe(0);
      },
    );

    it.each(["centralSize", "centralOffset"] as const)(
      "EOCD: %s é zero",
      (campo) => {
        expect(view.getUint32(EOCD[campo], true)).toBe(0);
      },
    );
  });

  describe("múltiplas entradas", () => {
    const first = encoder.encode("primeiro");
    const second = encoder.encode("segundo com acentuação");
    const zip = buildZip([
      { name: "xl/one.bin", data: first },
      { name: "xl/two.bin", data: second },
    ]);

    it("dados íntegros, na ordem de inserção", () => {
      const decoder = new TextDecoder();
      const entries = [...extractZipEntries(zip)].map(([name, data]) => [
        name,
        decoder.decode(data),
      ]);
      expect(entries).toEqual([
        ["xl/one.bin", "primeiro"],
        ["xl/two.bin", "segundo com acentuação"],
      ]);
    });

    it("CRC consistente na primeira entrada", () => {
      expect(viewOf(zip).getUint32(LOCAL.crc32, true)).toBe(crc32(first));
    });
  });
});

describe("[S6-3] nomes de planilha — sanitização (CA 1/CA 2)", () => {
  it.each([":\\/?*[]", "   "])(
    "título %j cai no fallback 'Planilha'",
    (titulo) => {
      expect(sheetNameFor(titulo)).toBe("Planilha");
    },
  );

  it("sufixo avança até achar nome livre (Resumo, Resumo 2 → Resumo 3)", () => {
    expect(sheetNameFor("Resumo", new Set(["Resumo", "Resumo 2"]))).toBe(
      "Resumo 3",
    );
  });

  it("sufixo de desambiguação respeita o limite de 31 caracteres", () => {
    const base = "A".repeat(SHEET_NAME_LIMIT);
    const result = sheetNameFor(base, new Set([base]));

    expect(result.length).toBeLessThanOrEqual(SHEET_NAME_LIMIT);
    // O sufixo " 2" ocupa 2 caracteres: o nome-base é truncado para caber.
    expect(result).toBe(`${"A".repeat(SHEET_NAME_LIMIT - 2)} 2`);
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

    const workbook = zipText(xlsxBytes(report), "xl/workbook.xml");

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
    expect(csvBytes(report).length).toBe(encoder.encode(toCsv(report)).length);
  });
});