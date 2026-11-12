import { toast } from "sonner";

/**
 * What to tell someone whose email was captured in the Demo outbox or held
 * back on a demo, in place of the usual "sent" message. `href` opens the Demo
 * outbox (given only to those who can read it).
 */
export type EmailNotice = { message: string; href?: string };

/** The toast for a notice, replacing `toastId` when given. */
export function showEmailNotice(
  notice: EmailNotice,
  toastId?: string | number,
): void {
  toast.info(notice.message, {
    id: toastId,
    duration: 10_000,
    action: notice.href
      ? {
          label: "Open outbox",
          onClick: () => window.location.assign(notice.href!),
        }
      : undefined,
  });
}
