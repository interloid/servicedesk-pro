// HTML email -> plain text for the ticket thread.
//
// Ticket bodies are text (rendered as Markdown, which escapes HTML), so the
// safest sanitiser is not to keep HTML at all: scripts, styles, comments and
// every tag go, block elements become line breaks, links keep their URL, and
// entities are decoded. Only linear regexes are used, and input is capped, so
// a hostile email cannot make this slow.

const MAX_HTML_LENGTH = 1_000_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  deg: "°",
  times: "×",
  divide: "÷",
  laquo: "«",
  raquo: "»",
  zwnj: "",
  zwj: "",
  shy: "",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi,
    (match, entity: string) => {
      if (entity[0] === "#") {
        const code =
          entity[1] === "x" || entity[1] === "X"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        if (
          !Number.isFinite(code) ||
          code <= 0 ||
          code > 0x10ffff ||
          (code >= 0xd800 && code <= 0xdfff)
        ) {
          return "";
        }
        return String.fromCodePoint(code);
      }

      const named = NAMED_ENTITIES[entity.toLowerCase()];
      return named === undefined ? match : named;
    },
  );
}

const HIDDEN_ELEMENTS = [
  "script",
  "style",
  "head",
  "title",
  "noscript",
  "template",
  "svg",
  "object",
  "iframe",
];

const HIDDEN_OPEN = new RegExp(`<(${HIDDEN_ELEMENTS.join("|")})\\b`, "gi");

/**
 * Drop comments and elements whose content is never shown, in one forward
 * pass over a single lower-cased copy (indexOf from a moving position, no
 * backtracking regex). An element that is never closed swallows the rest of
 * the document, as it would in a browser.
 */
function removeHiddenContent(html: string): string {
  const lower = html.toLowerCase();
  let out = "";
  let pos = 0;

  while (pos < html.length) {
    const comment = lower.indexOf("<!--", pos);
    HIDDEN_OPEN.lastIndex = pos;
    const open = HIDDEN_OPEN.exec(lower);
    const openAt = open ? open.index : -1;

    if (comment === -1 && openAt === -1) {
      out += html.slice(pos);
      break;
    }

    if (comment !== -1 && (openAt === -1 || comment < openAt)) {
      out += html.slice(pos, comment);
      const end = lower.indexOf("-->", comment + 4);
      pos = end === -1 ? html.length : end + 3;
      continue;
    }

    out += html.slice(pos, openAt);
    const tagEnd = lower.indexOf(">", openAt);

    if (tagEnd === -1) break;

    // <svg ... /> closes itself.
    if (lower[tagEnd - 1] === "/") {
      pos = tagEnd + 1;
      continue;
    }

    const close = lower.indexOf(`</${open![1]}`, tagEnd);
    if (close === -1) break;

    const closeEnd = lower.indexOf(">", close);
    pos = closeEnd === -1 ? html.length : closeEnd + 1;
  }

  return out;
}

export function htmlToText(html: string): string {
  // Things whose content is never shown.
  let text = removeHiddenContent(html.slice(0, MAX_HTML_LENGTH));

  // Links: keep the text, and the address when it differs. The inner text
  // is bounded so an unclosed <a> costs a fixed amount, not the document.
  text = text.replace(
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,2000}?)<\/a\s*>/gi,
    (
      _,
      dq: string | undefined,
      sq: string | undefined,
      bare: string | undefined,
      inner: string,
    ) => {
      const href = decodeHtmlEntities(dq ?? sq ?? bare ?? "").trim();
      const label = inner.replace(/<[^>]*>/g, "").trim();
      const labelText = decodeHtmlEntities(label);
      if (!/^(https?:|mailto:)/i.test(href) || !labelText) return label;
      const shown = href.replace(/^mailto:/i, "");
      return labelText === shown || labelText === href
        ? labelText
        : `${label} (${href})`;
    },
  );

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(
      /<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|pre|section|article|header|footer)\s*>/gi,
      "\n",
    )
    .replace(
      /<(p|div|h[1-6]|tr|table|ul|ol|blockquote|pre|section|article|header|footer|hr)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<[^>]*>/g, "");

  text = decodeHtmlEntities(text);

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
