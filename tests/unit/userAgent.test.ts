/**
 * [UX_REFINEMENT] Etapa 4.2 — humanização do User-Agent das sessões
 * recentes: "Chrome no Windows", "Safari no Mobile"… sem expor IDs
 * criptográficos na página de configurações.
 */
import { describe, expect, it } from "vitest";
import { describeUserAgent } from "../../src/lib/userAgent";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
const EDGE_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("[UX_REFINEMENT] describeUserAgent — sessões humanizadas", () => {
  it("traduz navegador + sistema em rótulo amigável", () => {
    expect(describeUserAgent(CHROME_WINDOWS)).toBe("Chrome no Windows");
    expect(describeUserAgent(FIREFOX_LINUX)).toBe("Firefox no Linux");
    expect(describeUserAgent(EDGE_MAC)).toBe("Edge no macOS");
    expect(describeUserAgent(ANDROID_CHROME)).toBe("Chrome no Android");
    expect(describeUserAgent(SAFARI_IPHONE)).toBe("Safari no Mobile");
  });

  it("sem navegador conhecido devolve null (UI usa o fallback)", () => {
    expect(describeUserAgent("curl/8.4.0")).toBeNull();
    expect(describeUserAgent("")).toBeNull();
    expect(describeUserAgent(undefined)).toBeNull();
    expect(describeUserAgent(null)).toBeNull();
  });
});
