// MIME helpers for the Gmail adapter: base64url bodies, charsets, RFC 2047
// encoded-word headers and RFC 2231 parameters.

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

const CHARSET_ALIASES: Record<string, string> = {
  utf8: "utf-8",
  latin1: "iso-8859-1",
  "latin-1": "iso-8859-1",
  ascii: "us-ascii",
  "ks_c_5601-1987": "euc-kr",
  "x-sjis": "shift_jis",
};

/** Bytes in a named charset; unknown or broken charsets fall back to UTF-8. */
export function decodeBytes(
  bytes: Uint8Array,
  charset?: string | null,
): string {
  const name = (charset ?? "utf-8").trim().replace(/^"|"$/g, "").toLowerCase();
  const label = CHARSET_ALIASES[name] ?? name;

  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeQ(text: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === "_") {
      bytes.push(0x20);
    } else if (
      char === "=" &&
      /^[0-9a-fA-F]{2}$/.test(text.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(char.charCodeAt(0) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

const ENCODED_WORD = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;

/**
 * RFC 2047 encoded-words in a header ("=?UTF-8?B?...?="), decoded. Whitespace
 * between two adjacent encoded words is dropped, as the RFC requires; text
 * that is already decoded passes through unchanged.
 */
export function decodeEncodedWords(value: string | null | undefined): string {
  if (!value) return "";

  const joined = value.replace(/(\?=)\s+(=\?)/g, "$1$2");

  return joined.replace(
    ENCODED_WORD,
    (match, charset: string, encoding: string, text: string) => {
      try {
        const bytes =
          encoding.toUpperCase() === "B"
            ? base64UrlToBytes(text)
            : decodeQ(text);
        // RFC 2231 language suffix: "UTF-8*en".
        return decodeBytes(bytes, charset.split("*")[0]);
      } catch {
        return match;
      }
    },
  );
}

export interface HeaderValue {
  value: string;
  params: Record<string, string>;
}

/**
 * A structured header: `text/plain; charset="utf-8"`,
 * `attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`. Parameter names are
 * lower-case; RFC 2231 continuations and charsets are folded in.
 */
export function parseHeaderParams(
  header: string | null | undefined,
): HeaderValue {
  if (!header) return { value: "", params: {} };

  const parts: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < header.length; i += 1) {
    const char = header[i];
    if (char === "\\" && quoted) {
      current += header[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ";" && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  const [value, ...rest] = parts.map((p) => p.trim());
  const raw: Record<string, string> = {};
  const extended: Record<string, { charset: string; chunks: string[] }> = {};

  for (const part of rest) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim();

    const continuation = /^([^*]+)\*(\d+)?(\*)?$/.exec(key);

    if (continuation) {
      const name = continuation[1];
      const index = continuation[2] ? Number(continuation[2]) : 0;
      const encoded =
        Boolean(continuation[3]) || (!continuation[2] && key.endsWith("*"));
      const entry = (extended[name] ??= { charset: "utf-8", chunks: [] });
      let chunk = val;

      if (encoded) {
        const m = /^([^']*)'[^']*'(.*)$/.exec(val);
        if (m && index === 0) {
          entry.charset = m[1] || "utf-8";
          chunk = m[2];
        }
        chunk = decodeBytes(percentBytes(chunk), entry.charset);
      }

      entry.chunks[index] = chunk;
    } else {
      raw[key] = val;
    }
  }

  const params: Record<string, string> = { ...raw };
  for (const [name, entry] of Object.entries(extended)) {
    params[name] = entry.chunks.filter((c) => c !== undefined).join("");
  }

  return { value: value.toLowerCase(), params };
}

function percentBytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "%" && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(text.charCodeAt(i) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}
