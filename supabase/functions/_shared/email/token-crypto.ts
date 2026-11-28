// OAuth token encryption at rest: AES-256-GCM with EMAIL_ENCRYPTION_KEY.
//
// The key never reaches the database, so a database dump, a backup or a
// misconfigured policy yields ciphertext only. Each ciphertext is bound to its
// tenant and provider as additional authenticated data: a token copied from
// one integration row onto another (another tenant's) fails to decrypt
// instead of authenticating as the first tenant's mailbox.
//
// Format: "v1.<iv base64url>.<ciphertext+tag base64url>". The version prefix
// leaves room to rotate the scheme or the key later.
//
// Generate a key:  openssl rand -base64 32

const VERSION = "v1";
const IV_BYTES = 12;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 32 bytes as base64 (standard or URL-safe) or 64 hex characters. */
export function parseEncryptionKey(
  raw: string | undefined | null,
): Uint8Array<ArrayBuffer> {
  const value = raw?.trim();

  if (!value) {
    throw new TokenCryptoError("EMAIL_ENCRYPTION_KEY is not set.");
  }

  let bytes: Uint8Array<ArrayBuffer>;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }
  } else {
    try {
      bytes = base64ToBytes(value);
    } catch {
      throw new TokenCryptoError("EMAIL_ENCRYPTION_KEY is not valid base64.");
    }
  }

  if (bytes.length !== 32) {
    throw new TokenCryptoError(
      "EMAIL_ENCRYPTION_KEY must be 32 bytes (openssl rand -base64 32).",
    );
  }

  return bytes;
}

export async function importEncryptionKey(
  raw: string | undefined | null,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    parseEncryptionKey(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** What a ciphertext is bound to: its tenant and provider. */
export function tokenAad(tenantId: string, provider: string): string {
  return `servicedesk:email-token:${provider}:${tenantId}`;
}

export async function encryptToken(
  plaintext: string,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(
  blob: string,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  const [version, ivPart, dataPart, extra] = blob.split(".");

  if (version !== VERSION || !ivPart || !dataPart || extra !== undefined) {
    throw new TokenCryptoError("Unrecognised token ciphertext.");
  }

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(ivPart),
        additionalData: new TextEncoder().encode(aad),
      },
      key,
      base64ToBytes(dataPart),
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    // Wrong key, wrong tenant (AAD), or tampered: never say which.
    throw new TokenCryptoError("Token could not be decrypted.");
  }
}
