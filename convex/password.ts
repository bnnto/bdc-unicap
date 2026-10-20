/**
 * Hash de senha com PBKDF2 via Web Crypto API (issue [S1-1], R7 — LGPD).
 * Disponível no runtime padrão do Convex e em Node 20+ (testes Vitest).
 * Formato: `pbkdf2$<iterações>$<salt-hex>$<hash-hex>`; salt aleatório por senha.
 */
const ITERATIONS = 600_000;
const KEYLEN_BYTES = 32;

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    KEYLEN_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, iterationsRaw, saltHex, hashHex] = stored.split("$");
  const iterations = Number.parseInt(iterationsRaw ?? "", 10);
  if (
    scheme !== "pbkdf2" ||
    !Number.isFinite(iterations) ||
    saltHex === undefined ||
    hashHex === undefined
  ) {
    return false;
  }
  const derived = await deriveBits(password, fromHex(saltHex), iterations);
  const expected = fromHex(hashHex);
  if (derived.length !== expected.length) return false;
  // Comparação em tempo constante (evita timing attacks).
  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) {
    diff |= derived[i]! ^ expected[i]!;
  }
  return diff === 0;
}
