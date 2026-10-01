/**
 * [PERFIL_E_LGPD] Etapa 3 — download de JSON no navegador: monta o
 * arquivo e clica num <a> temporário. Usa ObjectURL quando disponível e
 * cai para data URL ambientes sem createObjectURL (ex.: jsdom).
 */
export function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const canUseBlob =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const url = canUseBlob
    ? URL.createObjectURL(new Blob([json], { type: "application/json" }))
    : `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (canUseBlob && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
