// Which email attachments are stored, and as what.
//
// The allowlist is the app's own (TICKET_ATTACHMENT_TYPES in
// src/features/tickets/lib/attachments.ts): an email can attach exactly what
// a person could through the composer. The Edge runtime cannot import from
// src/, so the table is repeated here and attachments.test.ts fails if the
// two ever differ.
//
// As in the app, the stored content type comes from the extension via the
// allowlist, never from the sender's declared type, so nothing can be stored
// as text/html or image/svg+xml and later render as active content.

import type { IncomingAttachment } from "./types.ts";

export const EMAIL_ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  log: "text/plain",
  md: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "text/plain",
  yaml: "text/plain",
  yml: "text/plain",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

/** The ticket-attachments bucket's own per-file limit (buckets.sql). */
export const BUCKET_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Same per-message cap as the composer (TICKET_ATTACHMENTS_MAX_FILES). */
export const DEFAULT_MAX_ATTACHMENTS = 10;

/**
 * EMAIL_MAX_ATTACHMENT_BYTES, clamped to the bucket's limit (a larger value
 * could never be stored). Falls back to the bucket limit when unset or junk.
 */
export function maxAttachmentBytes(
  configured: string | undefined | null,
): number {
  const value = Number(configured);
  if (!Number.isFinite(value) || value <= 0) return BUCKET_MAX_FILE_BYTES;
  return Math.min(Math.floor(value), BUCKET_MAX_FILE_BYTES);
}

/** As attachmentExtension in the app: lower-case [a-z0-9], at most 10. */
export function attachmentExtension(name: string): string {
  const raw = (name.match(/\.([^./\\]+)$/) || [])[1] ?? "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
}

/**
 * A file name safe to show and to store: no path, no control or reserved
 * characters, no leading dots, at most 120 characters with the extension
 * kept. Never empty.
 */
export function sanitizeFilename(name: string | null | undefined): string {
  const base = (name ?? "")
    .split(/[\\/]/)
    .pop()!
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/[‪-‮⁦-⁩]/g, "") // bidi overrides: "gpj.exe"
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");

  if (!base) return "attachment";
  if (base.length <= 120) return base;

  const ext = attachmentExtension(base);
  const keep = ext ? 120 - ext.length - 1 : 120;
  return ext ? `${base.slice(0, keep).trimEnd()}.${ext}` : base.slice(0, 120);
}

export type AttachmentRejection =
  "type_not_allowed" | "too_large" | "too_many" | "empty";

export interface PlannedAttachment {
  attachment: IncomingAttachment;
  /** Shown to people: sanitized original name. */
  originalFilename: string;
  extension: string;
  contentType: string;
  /** Stable per event and position, so a retry overwrites, never duplicates. */
  storedName: string;
}

export interface AttachmentPlan {
  accepted: PlannedAttachment[];
  rejected: { filename: string; reason: AttachmentRejection }[];
  /** Inline parts left out (signature logos and the like). */
  skippedInline: number;
}

export interface PlanOptions {
  eventId: string;
  maxBytes: number;
  maxFiles?: number;
}

export function planAttachments(
  attachments: IncomingAttachment[],
  options: PlanOptions,
): AttachmentPlan {
  const plan: AttachmentPlan = { accepted: [], rejected: [], skippedInline: 0 };
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_ATTACHMENTS;
  const eventKey = options.eventId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);

  attachments.forEach((attachment, index) => {
    const originalFilename = sanitizeFilename(attachment.filename);

    // An inline image is part of the HTML (a logo in a signature), not a file
    // the customer chose to send. A named inline file that is not an image
    // (some clients inline PDFs) is still an attachment.
    if (attachment.inline && /^image\//i.test(attachment.mimeType)) {
      plan.skippedInline += 1;
      return;
    }

    const extension = attachmentExtension(originalFilename);
    const contentType = Object.prototype.hasOwnProperty.call(
      EMAIL_ATTACHMENT_TYPES,
      extension,
    )
      ? EMAIL_ATTACHMENT_TYPES[extension]
      : null;

    if (!contentType) {
      plan.rejected.push({
        filename: originalFilename,
        reason: "type_not_allowed",
      });
      return;
    }

    if (attachment.size <= 0 && !attachment.data?.length) {
      plan.rejected.push({ filename: originalFilename, reason: "empty" });
      return;
    }

    if (attachment.size > options.maxBytes) {
      plan.rejected.push({ filename: originalFilename, reason: "too_large" });
      return;
    }

    if (plan.accepted.length >= maxFiles) {
      plan.rejected.push({ filename: originalFilename, reason: "too_many" });
      return;
    }

    plan.accepted.push({
      attachment,
      originalFilename,
      extension,
      contentType,
      storedName: `email-${eventKey}-${index + 1}.${extension}`,
    });
  });

  return plan;
}

const REJECTION_TEXT: Record<AttachmentRejection, string> = {
  type_not_allowed: "file type not allowed",
  too_large: "too large",
  too_many: "too many attachments",
  empty: "empty file",
};

/** The note appended to the ticket body when files were left out. */
export function rejectionNote(
  rejected: AttachmentPlan["rejected"],
): string | null {
  if (rejected.length === 0) return null;

  const items = rejected
    .slice(0, 20)
    .map((r) => `${r.filename} (${REJECTION_TEXT[r.reason]})`)
    .join(", ");
  const more = rejected.length > 20 ? `, and ${rejected.length - 20} more` : "";

  return `[Not imported from the email: ${items}${more}.]`;
}
