/**
 * The captured email as an iframe `srcdoc`, with every link opening in a new
 * tab: the frame is sandboxed without scripts or same-origin, so a link that
 * navigated the frame itself would just show a blank box.
 */
export function emailSrcDoc(html: string): string {
  const base = '<base target="_blank">';
  const head = /<head(\s[^>]*)?>/i.exec(html);

  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}${base}${html.slice(at)}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${base}</head><body>${html}</body></html>`;
}

/**
 * No scripts, no same-origin (so no access to the app's cookies or storage),
 * no forms. Links may open a new tab, outside the sandbox, so an accept or
 * sign-in link works as it would from a mail client.
 */
export const EMAIL_FRAME_SANDBOX =
  "allow-popups allow-popups-to-escape-sandbox";

const KIND_LABELS: Record<string, string> = {
  team_invitation: "Team invite",
  customer_invitation: "Customer invite",
  portal_sign_in: "Portal sign-in",
  notification: "Notification",
  customer_ticket: "Ticket update",
  invoice: "Invoice",
};

export function demoOutboxKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
