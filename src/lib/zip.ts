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
  const nameBytes = entries.map((entry) => ENCODER.encode(entry.name));
  const crcs = entries.map((entry) => crc32(entry.data));
  const sizes = entries.map((entry) => entry.data.length);

  const localHeaderSize = 30;
  const centralHeaderSize = 46;
  const namesLength = nameBytes.reduce((sum, bytes) => sum + bytes.length, 0);
  const dataLength = sizes.reduce((sum, size) => sum + size, 0);
  const total =
    entries.length * (localHeaderSize + centralHeaderSize) +
    namesLength * 2 +
    dataLength +
    22;
  const zip = new Uint8Array(total);

  // Local file headers + dados (sem compressão: método 0, "stored").
  let offset = 0;
  const localOffsets: number[] = [];
  entries.forEach((entry, index) => {
    localOffsets.push(offset);
    writeUint32(zip, offset, 0x04034b50);
    writeUint16(zip, offset + 4, 20); // versão necessária
    writeUint16(zip, offset + 6, 0x0800); // UTF-8 (flag bit 11)
    writeUint16(zip, offset + 8, 0); // método stored
    writeUint32(zip, offset + 14, crcs[index] ?? 0);
    writeUint32(zip, offset + 18, sizes[index] ?? 0);
    writeUint32(zip, offset + 22, sizes[index] ?? 0);
    const name = nameBytes[index] ?? new Uint8Array(0);
    writeUint16(zip, offset + 26, name.length);
    writeUint16(zip, offset + 28, 0); // sem extra field
    zip.set(name, offset + 30);
    offset += 30 + name.length;
    zip.set(entry.data, offset);
    offset += entry.data.length;
  });

  // Central directory.
  const centralStart = offset;
  entries.forEach((_entry, index) => {
    const name = nameBytes[index] ?? new Uint8Array(0);
    writeUint32(zip, offset, 0x02014b50);
    writeUint16(zip, offset + 4, 20);
    writeUint16(zip, offset + 6, 20);
    writeUint16(zip, offset + 8, 0x0800);
    writeUint16(zip, offset + 10, 0); // método stored
    writeUint32(zip, offset + 16, crcs[index] ?? 0);
    writeUint32(zip, offset + 20, sizes[index] ?? 0);
    writeUint32(zip, offset + 24, sizes[index] ?? 0);
    writeUint16(zip, offset + 28, name.length);
    writeUint32(zip, offset + 42, localOffsets[index] ?? 0);
    zip.set(name, offset + 46);
    offset += 46 + name.length;
  });
  const centralSize = offset - centralStart;

  // End of central directory.
  writeUint32(zip, offset, 0x06054b50);
  writeUint16(zip, offset + 8, entries.length);
  writeUint16(zip, offset + 10, entries.length);
  writeUint32(zip, offset + 12, centralSize);
  writeUint32(zip, offset + 16, centralStart);
  return zip;
}
