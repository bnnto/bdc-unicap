/**
 * Writer de ZIP "stored" (sem compressão) — base do pacote XLSX da
 * issue [S6-1]. Implementa local file headers, central directory e EOCD
 * byte a byte, com CRC32 IEEE — zero dependências, determinístico.
 */

/** Entrada de camada base do ZIP (store = sem compressão). */
export type ZipEntry = { name: string; data: Uint8Array };

/** Passo do CRC32 IEEE (polinômio 0xEDB88320 refletido). */
function crcStep(crc: number): number {
  return crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
}

/** CRC32 IEEE 802.3 — campo obrigatório de cada entrada ZIP. */
export function crc32(data: Uint8Array): number {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let step = 0; step < 8; step += 1) {
      crc = crcStep(crc);
    }
  }
  return (crc ^ -1) >>> 0;
}

/** Escreve uint16/uint32 little-endian no buffer. */
function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

const ENCODER = new TextEncoder();

/** Empacota as entradas (stored) em um ZIP válido e determinístico. */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  // Metadados por entrada (nome UTF-8, CRC, tamanho e offset local) em
  // uma única passagem — sem indexação cruzada entre arrays paralelos.
  const metas = entries.map((entry) => ({
    name: ENCODER.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
    size: entry.data.length,
    localOffset: 0,
  }));

  const localHeaderSize = 30;
  const centralHeaderSize = 46;
  const namesLength = metas.reduce((sum, meta) => sum + meta.name.length, 0);
  const dataLength = metas.reduce((sum, meta) => sum + meta.size, 0);
  const total =
    metas.length * (localHeaderSize + centralHeaderSize) +
    namesLength * 2 +
    dataLength +
    22;
  const zip = new Uint8Array(total);

  // Local file headers + dados (sem compressão: método 0, "stored").
  let offset = 0;
  metas.forEach((meta) => {
    meta.localOffset = offset;
    writeUint32(zip, offset, 0x04034b50);
    writeUint16(zip, offset + 4, 20); // versão necessária
    writeUint16(zip, offset + 6, 0x0800); // UTF-8 (flag bit 11)
    writeUint16(zip, offset + 8, 0); // método stored
    writeUint32(zip, offset + 14, meta.crc);
    writeUint32(zip, offset + 18, meta.size);
    writeUint32(zip, offset + 22, meta.size);
    writeUint16(zip, offset + 26, meta.name.length);
    writeUint16(zip, offset + 28, 0); // sem extra field
    zip.set(meta.name, offset + 30);
    offset += 30 + meta.name.length;
    zip.set(meta.data, offset);
    offset += meta.size;
  });

  // Central directory.
  const centralStart = offset;
  metas.forEach((meta) => {
    writeUint32(zip, offset, 0x02014b50);
    writeUint16(zip, offset + 4, 20);
    writeUint16(zip, offset + 6, 20);
    writeUint16(zip, offset + 8, 0x0800);
    writeUint16(zip, offset + 10, 0); // método stored
    writeUint32(zip, offset + 16, meta.crc);
    writeUint32(zip, offset + 20, meta.size);
    writeUint32(zip, offset + 24, meta.size);
    writeUint16(zip, offset + 28, meta.name.length);
    writeUint32(zip, offset + 42, meta.localOffset);
    zip.set(meta.name, offset + 46);
    offset += 46 + meta.name.length;
  });
  const centralSize = offset - centralStart;

  // End of central directory.
  writeUint32(zip, offset, 0x06054b50);
  writeUint16(zip, offset + 8, metas.length);
  writeUint16(zip, offset + 10, metas.length);
  writeUint32(zip, offset + 12, centralSize);
  writeUint32(zip, offset + 16, centralStart);
  return zip;
}
