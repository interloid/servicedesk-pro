import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  deliveryForRecipient,
  PermanentEmailError,
  refusedRecipientError,
  sendEmail,
} from "../_shared/gmail.ts";
import {
  captureEmail,
  deliverEmail,
  signInLinkFacts,
  withheldLinkEmail,
} from "../_shared/demo-outbox.ts";
import { mayCaptureSignInLink } from "../_shared/email-policy.ts";
import { isServiceRole } from "../_shared/service-role.ts";

import { getPlatformBrand } from "../_shared/platform-brand.ts";
import { invitationEmailHtml, roleWithArticle } from "./invitation-template.ts";
import { customerTicketEmailHtml } from "./customer-ticket-template.ts";
import { notificationEmailHtml } from "./notification-template.ts";
import {
  portalSignInEmailCopy,
  portalSignInEmailHtml,
} from "./portal-sign-in-template.ts";

// Sends the mail queued in public.email_jobs: team invitations and password
// resets (through Supabase Auth), and our own invitation and customer-portal
// sign-in emails, notification-center alerts and customers' ticket updates
// (through the Gmail API, as the Google account that granted
// GOOGLE_REFRESH_TOKEN).
//
// One caller:
//   1. pg_cron every minute while a job is due -- the sender and retry path
//      for a failed or newly queued job
//
// Both authenticate with the service role key. The gateway checks the
// signature (verify_jwt = true in config.toml); the role check below turns
// away the anon key and signed-in users' tokens, which are valid JWTs too.
//
// claim_email_jobs hands each job to one caller (SKIP LOCKED), so the two can
// run at the same time without sending anything twice.
//
// Demo outbox (EMAIL_DEMO_OUTBOX): mail for anyone outside
// EMAIL_ALLOWED_RECIPIENTS is stored in public.demo_outbox instead of sent,
// and the job counts as sent. See _shared/demo-outbox.ts.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
// The app's origin, for the ticket / portal request links in notification and
// customer emails. Shared with update-payment-method; without it those emails
// go out with no button.
const FRONTEND_URL = Deno.env.get("FRONTEND_URL")?.trim().replace(/\/+$/, "");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 10;
const MAX_BATCHES = 5;

type EmailJob = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  tenant_id: string | null;
};

type TeamInvitationPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  redirectTo?: string;
  metadata?: Record<string, string>;
};

type PasswordResetPayload = {
  email: string;
  redirectTo: string;
};

type PortalSignInPayload = {
  email: string;
  redirectTo: string;
  tenantName: string;
  /** A Tenant Admin's "Invite customer": same link, worded as an invitation. */
  invited?: boolean;
  /** A first ticket filed signed out: same link, worded as account setup. */
  ticketNumber?: number | null;
};

type NotificationPayload = {
  notificationId: string;
};

type CustomerTicketPayload = {
  ticketId: string;
  /** customer_ticket_reply only. */
  messageId?: string;
};

/** Mirrors FALLBACK_TITLES in src/features/notifications/lib/feed.ts. */
const NOTIFICATION_FALLBACK_TITLES: Record<string, string> = {
  ticket_assigned: "Ticket assigned to you",
  ticket_updated: "New reply",
  mention: "You were mentioned",
  sla_breach: "SLA breached",
  sla_warning: "SLA deadline approaching",
  ticket_created: "New ticket",
  ticket_reopened: "Ticket reopened",
};

// Same pattern and unescaping as mentionsToNames in src/lib/mentions.ts: the
// customer sees who was named, not the markup or the user id.
const MENTION_REGEX =
  /@\[((?:\\.|(?!@\[)[^\\\n])+?)\]\(user:([a-f0-9-]{36})\)/g;

function mentionsToNames(body: string): string {
  return body.replace(MENTION_REGEX, (_, name: string) =>
    name.replace(/\\([\\[\]])/g, "$1"),
  );
}

/** 30s, 2m, 8m, 32m… capped at an hour. */
function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 4 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

/**
 * True once the person has signed in and set a password. An invited account
 * stays unconfirmed until then, and Supabase will still re-send an invite to
 * one of those.
 */
async function isRegistered(userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return false;
  }

  return Boolean(data.user.email_confirmed_at ?? data.user.confirmed_at);
}

/**
 * Always the "You've been invited" email, never a sign-in email. Supabase's
 * invite only works for an address that has never confirmed an account;
 * anyone who has gets a magic link generated WITHOUT sending, carried in our
 * own invitation email through Gmail.
 */
async function sendTeamInvitation(
  invite: TeamInvitationPayload,
): Promise<void> {
  const { userId, email, name, role, tenantId, redirectTo, metadata } = invite;

  // Up front: Supabase's own invite email never passes through sendEmail.
  const delivery = deliveryForRecipient(email);

  if (delivery === "refuse") {
    throw refusedRecipientError();
  }

  if (delivery === "capture") {
    return captureTeamInvitation(invite);
  }

  if (!(await isRegistered(userId))) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { ...(name ? { full_name: name } : {}), ...metadata },
      redirectTo,
    });

    if (error) {
      throw new Error(`inviteUserByEmail failed: ${error.message}`);
    }

    return;
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  const actionLink = link?.properties?.action_link;

  if (linkError || !actionLink) {
    throw new Error(
      `generateLink failed: ${linkError?.message ?? "no action_link"}`,
    );
  }

  await sendEmail(
    await invitationEmail({ email, role, tenantId, link: actionLink }),
  );
}

async function workspaceName(tenantId: string): Promise<string> {
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  return (tenant?.name as string | undefined) ?? "your team";
}

async function invitationEmail({
  email,
  role,
  tenantId,
  link,
}: {
  email: string;
  role: string;
  tenantId: string;
  link: string;
}) {
  const workspace = await workspaceName(tenantId);

  return {
    to: email,
    subject: `You've been invited to ${workspace}`,
    html: invitationEmailHtml({
      workspace,
      role,
      link,
      platformName: (await getPlatformBrand(admin)).platformName,
    }),
    text: `You've been invited to join ${workspace} as ${roleWithArticle(
      role,
    )}.\n\nAccept the invitation: ${link}\n\nThis link works once and expires in 1 hour. If it has expired, ask your admin to resend the invite.`,
  };
}

/**
 * Demo outbox: the same invitation, stored instead of sent. The accept link
 * comes from generateLink, which returns it without sending anything -- and
 * only for an account the invite itself created (see mayCaptureSignInLink).
 */
async function captureTeamInvitation({
  userId,
  email,
  name,
  role,
  tenantId,
  redirectTo,
  metadata,
}: TeamInvitationPayload): Promise<void> {
  const { data: found, error } = await admin.auth.admin.getUserById(userId);

  if (error || !found.user) {
    throw new Error(`getUserById failed: ${error?.message ?? "no such user"}`);
  }

  const facts = await signInLinkFacts(admin, {
    kind: "team_invitation",
    tenantId,
    email,
    user: found.user,
    createdNow: false,
  });

  if (!mayCaptureSignInLink(facts)) {
    const workspace = await workspaceName(tenantId);

    await captureEmail(
      admin,
      { tenantId, kind: "team_invitation", linkWithheld: true },
      withheldLinkEmail({
        to: email,
        subject: `You've been invited to ${workspace}`,
        intro: `You've been invited to join ${workspace} as ${roleWithArticle(role)}.`,
      }),
    );
    return;
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { ...(name ? { full_name: name } : {}), ...metadata },
      redirectTo,
    },
  });

  const actionLink = link?.properties?.action_link;

  if (linkError || !actionLink) {
    throw new Error(
      `generateLink failed: ${linkError?.message ?? "no action_link"}`,
    );
  }

  await captureEmail(
    admin,
    { tenantId, kind: "team_invitation" },
    await invitationEmail({ email, role, tenantId, link: actionLink }),
  );
}

/**
 * Supabase's "Reset password" template. A 429 is thrown and retried.
 *
 * Never captured: a reset link signs in as an account that already exists.
 * The app tells the person asking instead, and doesn't queue it.
 */
async function sendPasswordReset({
  email,
  redirectTo,
}: PasswordResetPayload): Promise<void> {
  const delivery = deliveryForRecipient(email);

  if (delivery === "refuse") {
    throw refusedRecipientError();
  }

  if (delivery === "capture") {
    console.info(
      "[email-jobs] password_reset not sent: demo outbox recipient, and reset links are never stored.",
    );
    return;
  }

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(
      `resetPasswordForEmail failed (${error.status ?? "?"}): ${error.message}`,
    );
  }
}

/**
 * A customer's sign-in link for the support portal.
 *
 * Not signInWithOtp: the link it sends is PKCE, and exchanging the code needs
 * the verifier cookie of the browser that asked -- this function has none. So
 * the link is generated here without sending, and carries the hashed token
 * straight to the portal callback, which verifies it server-side (verifyOtp).
 * That also makes it work on a different device from the one that asked.
 *
 * generateLink needs an existing user, and a first-time customer has none.
 * The account is created confirmed: it is inert (no membership, no session)
 * until the link in THIS email is clicked, and clicking it is the proof of
 * address. The Next.js side has already turned team emails away.
 */
async function sendPortalSignIn(
  {
    email,
    redirectTo,
    tenantName,
    invited = false,
    ticketNumber = null,
  }: PortalSignInPayload,
  job: EmailJob,
): Promise<void> {
  // Before the account is created, not only before the send.
  const delivery = deliveryForRecipient(email);

  if (delivery === "refuse") {
    throw refusedRecipientError();
  }

  const copy = portalSignInEmailCopy({
    workspace: tenantName,
    invited,
    ticketNumber,
  });
  const capture = {
    tenantId: job.tenant_id,
    kind: invited
      ? ("customer_invitation" as const)
      : ("portal_sign_in" as const),
  };

  if (delivery === "capture" && !job.tenant_id) {
    throw new PermanentEmailError(
      "Demo outbox: portal sign-in job has no workspace; not sent.",
    );
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  // An existing account is the normal case for a returning customer.
  if (createError && createError.code !== "email_exists") {
    throw new Error(`createUser failed: ${createError.message}`);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const hashedToken = link?.properties?.hashed_token;

  if (linkError || !hashedToken) {
    throw new Error(
      `generateLink failed: ${linkError?.message ?? "no hashed_token"}`,
    );
  }

  const url = new URL(redirectTo);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "magiclink");

  const signInLink = url.toString();

  const message = {
    to: email,
    subject: copy.subject,
    html: portalSignInEmailHtml({
      workspace: tenantName,
      link: signInLink,
      invited,
      ticketNumber,
    }),
    text: `${copy.bodyText}: ${signInLink}\n\n${copy.note}`,
  };

  if (delivery === "send") {
    await sendEmail(message);
    return;
  }

  // Demo outbox. The link was only generated, never sent; it is stored only
  // for a customer account confined to this workspace.
  const facts = await signInLinkFacts(admin, {
    kind: "portal_sign_in",
    tenantId: job.tenant_id!,
    email,
    user: link.user ?? null,
    createdNow: !createError,
  });

  // No user in the response: nothing to judge by, so no link.
  if (link.user && mayCaptureSignInLink(facts)) {
    await captureEmail(admin, capture, message);
    return;
  }

  await captureEmail(
    admin,
    { ...capture, linkWithheld: true },
    withheldLinkEmail({
      to: email,
      subject: copy.subject,
      intro: copy.bodyText,
    }),
  );
}

/**
 * One notification, queued by the queue_notification_email trigger because
 * the recipient has email on for its event. Everything is read at send time;
 * a notification already read in the app, or deleted, is not emailed.
 */
async function sendNotification(
  { notificationId }: NotificationPayload,
  job: EmailJob,
): Promise<void> {
  const { data: notification, error } = await admin
    .from("notifications")
    .select(
      "type, payload_json, read_at, user:users(email), tenant:tenants(name, slug)",
    )
    .eq("id", notificationId)
    .maybeSingle();

  if (error) {
    throw new Error(`notification lookup failed: ${error.message}`);
  }

  if (!notification || notification.read_at) {
    return;
  }

  const user = notification.user as { email?: string } | null;
  const tenant = notification.tenant as { name?: string; slug?: string } | null;

  if (!user?.email) {
    throw new PermanentEmailError("Recipient has no email address");
  }

  const payload = (notification.payload_json ?? {}) as Record<string, unknown>;
  const type = notification.type as string;
  const number =
    typeof payload.ticket_number === "number" ? payload.ticket_number : null;
  const fallback = NOTIFICATION_FALLBACK_TITLES[type] ?? "New notification";
  const title =
    (typeof payload.title === "string" && payload.title) ||
    (number !== null ? `${fallback} · #${number}` : fallback);
  const body =
    (typeof payload.body === "string" && payload.body) ||
    (typeof payload.subject === "string" ? payload.subject : "");

  const ticketId =
    typeof payload.ticket_id === "string" ? payload.ticket_id : null;
  const link =
    FRONTEND_URL && tenant?.slug && ticketId
      ? `${FRONTEND_URL}/${encodeURIComponent(tenant.slug)}/tickets/${ticketId}`
      : null;

  const workspace = tenant?.name ?? "ServiceDesk";

  await deliverEmail(
    admin,
    { tenantId: job.tenant_id, kind: "notification" },
    {
      to: user.email,
      subject: `[${workspace}] ${title}`,
      html: notificationEmailHtml({ workspace, title, body, link }),
      text: [title, body, link ? `View ticket: ${link}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    },
  );
}

type CustomerTicket = {
  tenantId: string;
  number: number;
  subject: string;
  status: string;
  email: string;
  workspace: string;
  link: string | null;
};

/**
 * The ticket, its requester's address and the workspace, read at send time.
 * Null when the ticket has been deleted since the job was queued.
 */
async function loadCustomerTicket(
  ticketId: string,
): Promise<CustomerTicket | null> {
  const { data: ticket, error } = await admin
    .from("tickets")
    .select(
      "tenant_id, number, subject, status, customer:customers(email), tenant:tenants(name, slug)",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw new Error(`ticket lookup failed: ${error.message}`);
  }

  if (!ticket) {
    return null;
  }

  const customer = ticket.customer as { email?: string } | null;
  const tenant = ticket.tenant as { name?: string; slug?: string } | null;

  if (!customer?.email) {
    throw new PermanentEmailError("Requester has no email address");
  }

  return {
    tenantId: ticket.tenant_id as string,
    number: ticket.number as number,
    subject: ticket.subject as string,
    status: ticket.status as string,
    email: customer.email,
    workspace: tenant?.name ?? "Support",
    link:
      FRONTEND_URL && tenant?.slug
        ? `${FRONTEND_URL}/${encodeURIComponent(
            tenant.slug,
          )}/portal/requests/${ticketId}`
        : null,
  };
}

async function sendCustomerTicketEmail(
  ticket: CustomerTicket,
  content: {
    subject: string;
    heading: string;
    intro: string;
    quote?: string;
    buttonLabel: string;
    note: string;
  },
): Promise<void> {
  await deliverEmail(
    admin,
    { tenantId: ticket.tenantId, kind: "customer_ticket" },
    {
      to: ticket.email,
      subject: content.subject,
      html: customerTicketEmailHtml({
        workspace: ticket.workspace,
        link: ticket.link,
        ...content,
      }),
      text: [
        content.intro,
        content.quote ?? "",
        ticket.link ? `${content.buttonLabel}: ${ticket.link}` : "",
        content.note,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  );
}

/** The confirmation for a new request, portal or raised by an agent. */
async function sendCustomerTicketCreated({
  ticketId,
}: CustomerTicketPayload): Promise<void> {
  const ticket = await loadCustomerTicket(ticketId);
  if (!ticket) return;

  await sendCustomerTicketEmail(ticket, {
    subject: `[#${ticket.number}] We've received your request: ${ticket.subject}`,
    heading: "We've received your request",
    intro: `Your request "${ticket.subject}" is logged as #${ticket.number}. Our team will get back to you as soon as possible.`,
    buttonLabel: "View request",
    note: "You can follow its progress and add details from the support portal. We'll email you when the team replies.",
  });
}

/**
 * A public reply from the team. Internal notes never queue this (the trigger
 * checks visibility); a reply deleted or turned internal since is skipped.
 */
async function sendCustomerTicketReply({
  ticketId,
  messageId,
}: CustomerTicketPayload): Promise<void> {
  if (!messageId) {
    throw new PermanentEmailError("customer_ticket_reply without messageId");
  }

  const { data: message, error } = await admin
    .from("ticket_messages")
    .select("body, visibility, author_type")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    throw new Error(`message lookup failed: ${error.message}`);
  }

  if (
    !message ||
    message.visibility !== "public" ||
    message.author_type !== "agent"
  ) {
    return;
  }

  const ticket = await loadCustomerTicket(ticketId);
  if (!ticket) return;

  const body = mentionsToNames(message.body as string).trim();

  await sendCustomerTicketEmail(ticket, {
    subject: `Re: [#${ticket.number}] ${ticket.subject}`,
    heading: "New reply on your request",
    intro: `The team replied to "${ticket.subject}" (#${ticket.number}):`,
    quote: body.length > 4000 ? `${body.slice(0, 4000)}…` : body,
    buttonLabel: "View and reply",
    note: "Replies to this email aren't read. Answer from the support portal so the team sees it.",
  });
}

/** Skipped when the ticket was reopened before the email went out. */
async function sendCustomerTicketResolved({
  ticketId,
}: CustomerTicketPayload): Promise<void> {
  const ticket = await loadCustomerTicket(ticketId);
  if (!ticket || (ticket.status !== "resolved" && ticket.status !== "closed")) {
    return;
  }

  await sendCustomerTicketEmail(ticket, {
    subject: `[#${ticket.number}] Your request has been resolved: ${ticket.subject}`,
    heading: "Your request has been resolved",
    intro: `We've marked "${ticket.subject}" (#${ticket.number}) as resolved.`,
    buttonLabel: "View request",
    note: "If something still isn't right, reopen the request from the support portal and the team will pick it up again.",
  });
}

const HANDLERS: Record<
  string,
  (payload: never, job: EmailJob) => Promise<void>
> = {
  team_invitation: sendTeamInvitation,
  password_reset: sendPasswordReset,
  portal_sign_in: sendPortalSignIn,
  notification: sendNotification,
  customer_ticket_created: sendCustomerTicketCreated,
  customer_ticket_reply: sendCustomerTicketReply,
  customer_ticket_resolved: sendCustomerTicketResolved,
};

async function runJob(job: EmailJob): Promise<boolean> {
  const now = new Date();

  try {
    const handler = HANDLERS[job.kind];

    if (!handler) {
      throw new PermanentEmailError(`No handler for email kind "${job.kind}"`);
    }

    await handler(job.payload as never, job);

    await admin
      .from("email_jobs")
      .update({
        status: "sent",
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
        locked_at: null,
        last_error: null,
      })
      .eq("id", job.id);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const giveUp =
      error instanceof PermanentEmailError || job.attempts >= job.max_attempts;

    console.error(
      `[email-jobs] ${job.kind} ${job.id} attempt ${job.attempts} failed${
        giveUp ? " (giving up)" : ""
      }:`,
      message,
    );

    await admin
      .from("email_jobs")
      .update({
        status: giveUp ? "failed" : "pending",
        run_after: new Date(
          now.getTime() + retryDelayMs(job.attempts),
        ).toISOString(),
        updated_at: now.toISOString(),
        locked_at: null,
        last_error: message.slice(0, 2000),
      })
      .eq("id", job.id);

    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false }, { status: 405 });
  }

  if (!isServiceRole(req, SERVICE_ROLE_KEY)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let sent = 0;
  let failed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await admin.rpc("claim_email_jobs", {
      p_limit: BATCH_SIZE,
    });

    if (error) {
      console.error("[email-jobs] claim failed:", error.message);
      return Response.json({ ok: false, sent, failed }, { status: 500 });
    }

    const jobs = (data ?? []) as EmailJob[];

    if (jobs.length === 0) {
      break;
    }

    const results = await Promise.all(jobs.map(runJob));
    sent += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;

    if (jobs.length < BATCH_SIZE) {
      break;
    }
  }

  return Response.json({ ok: true, sent, failed });
});
