/**
 * [S6-1] Exportação CSV/XLSX dos relatórios — integração no Painel
 * Operacional: botões de download (CSV e Excel) exportam os dados
 * FILTRADOS vigentes exibidos no painel (CA 1), com CSV em UTF-8+BOM
 * (CA 2) e XLSX válido (CA 3).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    operational: {
      operationalSummary: "query:operational.operationalSummary",
      timeToHireStats: "query:operational.timeToHireStats",
      pipelineFunnel: "query:operational.pipelineFunnel",
      activeRankings: "query:operational.activeRankings",
    },
  },
}));

import { useQuery } from "convex/react";
import { OperationalPanel } from "../../src/components/operational/OperationalPanel";

const mockedUseQuery = vi.mocked(useQuery);

const SUMMARY = {
  jobs: { open: 3, closed: 1, filled: 2, total: 6 },
  applications: {
    total: 20,
    inProgress: 12,
    finalized: 8,
    approved: 5,
    rejected: 3,
    byStage: {
      inscrito: 8,
      triagem: 4,
      entrevista: 0,
      aprovado: 5,
      reprovado: 3,
    },
  },
  employability: { rate: 63, label: "63%", approved: 5, rejected: 3 },
};

const TTH = {
  averageDays: 12,
  label: "12 dias",
  samplesCount: 4,
  facets: { courses: ["CC"], companies: ["Alpha"] },
};

const FUNNEL = {
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
    {
      stage: "entrevista" as const,
      label: "Entrevista",
      count: 0,
      conversionFromPrevious: 0,
    },
    {
      stage: "aprovado" as const,
      label: "Aprovado",
      count: 5,
      conversionFromPrevious: 100,
    },
  ],
  totalApplications: 20,
};

const RANKINGS = {
  limit: 5,
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
};

/** Lê os bytes do Blob via FileReader (o Blob do jsdom não tem .text()). */
function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(new Error("Falha ao ler o Blob do export no teste"));
    reader.readAsArrayBuffer(blob);
  });
}

/** Captura o Blob e o nome de arquivo do download nativo (jsdom-safe). */
function spyDownload(): { blobs: Blob[]; downloads: string[] } {
  const blobs: Blob[] = [];
  const downloads: string[] = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (blob: Blob) => {
      blobs.push(blob);
      return "blob:fake";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  return { blobs, downloads };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:operational.operationalSummary") return SUMMARY;
    if (query === "query:operational.timeToHireStats") return TTH;
    if (query === "query:operational.pipelineFunnel") return FUNNEL;
    if (query === "query:operational.activeRankings") return RANKINGS;
    return undefined;
  }) as never);
});

describe("OperationalPanel — exportação dos relatórios (S6-1)", () => {
  it("oferece download CSV e Excel do relatório atual", () => {
    render(<OperationalPanel />);
    expect(
      screen.getByRole("button", { name: /baixar csv/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /baixar excel/i }),
    ).toBeInTheDocument();
  });

  it("CSV exportado contém os dados filtrados vigentes com BOM UTF-8", async () => {
    const { blobs } = spyDownload();
    render(<OperationalPanel />);

    await userEvent.click(screen.getByRole("button", { name: /baixar csv/i }));

    await waitFor(() => expect(blobs).toHaveLength(1));
    const blob = blobs[0];
    expect(blob?.type).toBe("text/csv;charset=utf-8");
    const bytes = await blobBytes(blob as Blob);
    // BOM UTF-8 nos 3 primeiros bytes (CA 2).
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    // Métricas do estado vigente (CA 1).
    expect(text).toContain("Relatório Operacional UNICAP");
    expect(text).toContain("Vagas abertas;3");
    expect(text).toContain("Taxa de empregabilidade (%);63");
    expect(text).toContain("TTH médio (dias);12");
    expect(text).toContain("Inscrito;20;");
  });

  it("XLSX exportado é um pacote OOXML com as métricas vigentes", async () => {
    const { blobs } = spyDownload();
    render(<OperationalPanel />);

    await userEvent.click(
      screen.getByRole("button", { name: /baixar excel/i }),
    );

    await waitFor(() => expect(blobs).toHaveLength(1));
    const blob = blobs[0];
    expect(blob?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const bytes = await blobBytes(blob as Blob);
    // Assinatura PKZip local (XLSX = ZIP/OOXML válido).
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it("nome do arquivo usa slug + data de hoje", async () => {
    const { downloads } = spyDownload();
    render(<OperationalPanel />);
    await userEvent.click(screen.getByRole("button", { name: /baixar csv/i }));
    expect(downloads[0]).toMatch(
      /^relatorio-operacional-unicap-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
