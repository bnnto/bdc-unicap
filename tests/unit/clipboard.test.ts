/**
 * [QUICK_WIN_RECRUITER] Cópia rápida para a área de transferência —
 * helper puro de I/O testável: o recrutador copia E-mail/Telefone do
 * candidato com 1 clique e recebe Toast de confirmação na UI.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "../../src/lib/clipboard";

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setClipboard(undefined);
});

describe("copyTextToClipboard — ações rápidas do recrutador", () => {
  it("copiou com sucesso → true, com o texto exato", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyTextToClipboard("aluno@unicap.br")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("aluno@unicap.br");
  });

  it("API de clipboard indisponível → false, sem lançar erro", async () => {
    setClipboard(undefined);
    await expect(copyTextToClipboard("81988887777")).resolves.toBe(false);
  });

  it("writeText rejeitando (permissão negada) → false, sem lançar erro", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("writeText not allowed")));
    await expect(copyTextToClipboard("x")).resolves.toBe(false);
  });
});
