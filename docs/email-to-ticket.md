# Email-to-ticket (Gmail)

A Tenant Admin connects a Gmail account in **Settings → Channels**. Mail sent
to the workspace's support address becomes a ticket; a reply to a ticket's
email thread is added to that ticket instead.

## Architecture

```text
Gmail ──watch──▶ Pub/Sub topic ──push (OIDC)──▶ gmail-webhook        (Edge Function, verify_jwt off)
                                                   │ verify token, decode, find mailbox
                                                   ▼
                                          email_sync_jobs            (Postgres queue)
                                                   │  ▲ pg_cron every minute: retries,
                                                   │  │ reconciliation, watch renewal
                                                   ▼  │ (email_ingest_schedule)
                                          email-ingest               (Edge Function worker)
                                                   │ Gmail History API → message ids
                                                   ▼
                                          email_inbound_events       (ledger + per-email retry queue)
                                                   │ fetch, normalize, filter, thread
                                                   ▼
                                          email_ingest_commit()      (one transaction)
                                                   │ customer match/create, ticket or reply
                                                   ▼
                                tickets / ticket_messages triggers   (number, SLA, notifications,
                                                                      customer email, audit log)
```

**The worker is a Supabase Edge Function, not a separate Node process.**
That is the project's existing worker pattern (`email-jobs`,
`reconcile-subscriptions`: Edge Function + pg_cron + Vault), and the app's
host (Vercel) can't run long-lived workers. The pipeline code is portable
TypeScript in `supabase/functions/_shared/email/`, with every dependency
injected. The same files run in Deno, in the Next.js OAuth routes and in
Vitest, and they could move to a Node worker unchanged.

**The ticket service is the database.** Every ticket path (agent form,
portal, chatbot, email) inserts into `tickets` / `ticket_messages`. The
existing triggers on those tables number the ticket, attach and start the SLA,
notify staff, email the customer and write the audit log. Email-to-ticket adds
no business logic of its own on top of that.

| Concern                                | Where                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Schema, RLS, queue, ingest transaction | `supabase/migrations/20261127120000_email_to_ticket.sql` (canonical copies under `supabase/schemas/`)                     |
| Provider-neutral types and interface   | `_shared/email/types.ts` (`EmailProvider`, `IncomingEmail`, `GmailSyncJob`)                                               |
| Gmail adapter                          | `_shared/email/providers/gmail/` (API client, normalization, MIME, OAuth URL, Pub/Sub auth)                               |
| Filtering                              | `_shared/email/filtering.ts` (`isSupportEmail`, `screenEmail`)                                                            |
| Threading                              | `_shared/email/threading.ts` (`EmailThreadMatcher`)                                                                       |
| Attachments                            | `_shared/email/attachments.ts`                                                                                            |
| Pipeline                               | `_shared/email/processor.ts` (`processIncomingEmail`), `_shared/email/sync.ts` (jobs)                                     |
| Errors and retry                       | `_shared/email/errors.ts`                                                                                                 |
| Token encryption                       | `_shared/email/token-crypto.ts`, `_shared/email/credentials.ts`                                                           |
| Worker and webhook                     | `supabase/functions/email-ingest/`, `supabase/functions/gmail-webhook/`                                                   |
| OAuth endpoints                        | `startGmailConnectAction` (`src/features/email-channels/actions/`) and `src/app/api/integrations/gmail/callback/route.ts` |
| Settings page                          | `src/app/(app)/[tenantSlug]/(base-layout)/settings/channels/`, `src/features/email-channels/`                             |

Adding Outlook means writing `providers/outlook/` (an `EmailProvider`, a
webhook for Graph change notifications), widening the `provider` check
constraint, and choosing the provider in the worker. The ledger, queue,
processor, threading and SQL stay as they are.

## Behaviour

- **What is filed.** Mail to the receiving address in To, Cc or an envelope
  recipient (Delivered-To / X-Original-To, so Bcc and forwarding rules work).
  Comparison is case-insensitive. Gmail's dots and `googlemail.com` are
  folded, but the `+tag` must match, so with `admin+support@gmail.com`
  configured, the owner's mail to `admin@gmail.com` is never filed.
- **What is ignored:** spam/trash, drafts/sent, automated mail
  (`Auto-Submitted`, `Precedence: bulk|junk|auto_reply`, `X-Autoreply`, null
  return path), `no-reply@`/`mailer-daemon@` senders, the platform's
  `FROM_EMAIL`, the mailbox itself, team members, and duplicate Message-IDs.
  `Precedence: list` is _not_ ignored, because a Google Group that forwards
  customers sets it. When a group rewrites From to the support address, the
  customer is taken from Reply-To.
- **Customers.** Matched by tenant + lower-cased email. If auto-create is on,
  an unknown sender becomes a customer with no portal sign-in linked: an
  address in a From header is not proof of identity, and claiming the record
  still takes the portal's emailed link. If auto-create is off, the email is
  ignored (`unknown_sender`).
- **New tickets** use the portal's defaults: status `new`, priority `low`.
  The opening email is the description.
- **Threading:** In-Reply-To, then References, then a `[#1001]` / `[SD-1001]`
  subject token. A subject match is only accepted from the ticket's requester,
  because ticket numbers are guessable. Every candidate is re-checked in SQL to
  belong to the email's tenant.
- **Replies** become public customer messages with the email headers stored,
  and the quoted history is stripped. Reopen policy is the portal's: `pending`
  / `on_hold` go back to `open`, while `resolved` / `closed` stay as they are
  (the assignee is still notified).
- **Agent replies sent from Gmail.** The sync reads the mailbox's SENT mail
  too (the watch covers `INBOX` and `SENT`). A message sent _from the
  connected mailbox_ that continues a ticket's thread — In-Reply-To or
  References, or a `[#n]` subject when the ticket's customer is a recipient —
  is added to that ticket as a public agent reply
  (`email_ingest_commit_agent_reply`, migration `20261127150000`). It is
  credited to the staff member who connected the mailbox (or the earliest
  active Tenant Admin). The customer already has the email, so no second
  `customer_ticket_reply` email is queued for it. Other sent mail is ignored
  (`sent_not_ticket_reply`), kept without headers, hidden from the channel
  page and purged after 30 days. Mail the platform sends itself carries
  `X-ServiceDesk-Origin` and is never captured.
- **Outbound.** Customer emails about an email-originated ticket now carry
  `Reply-To: <support address>` and `In-Reply-To`/`References` to the opening
  email, so the customer's reply lands back on the ticket. Every other ticket's
  email is unchanged.
- **Attachments.** The app's allowlist (identical to the composer's, enforced
  by a test), with the stored type taken from the extension and never from the
  sender's declared type. Limits: `EMAIL_MAX_ATTACHMENT_BYTES` (capped at the
  bucket's 20 MB) and 10 files. Inline signature images are skipped. Files
  left out are named in a note on the ticket. Storage path is
  `{tenant}/{ticket}/email-{event}-{n}.{ext}` in the private
  `ticket-attachments` bucket.

## Reliability

- **Idempotency.** `uq_email_inbound_message (integration_id,
provider_message_id)` records each Gmail message once.
  `email_ingest_commit` locks the event row and writes the ticket/message
  _and_ the event's `ticket_id` in one transaction, so if it runs again it
  replays the result instead of creating a second ticket. Message-IDs are
  deduplicated per tenant. Attachment paths are deterministic and
  `uq_storage_path` skips repeats.
- **Crash safety.** Order is: record events → advance cursor → process. A
  crash before the cursor moves re-reads the same history (the ledger drops
  duplicates). A crash after commit but before attachments resumes with the
  attachments.
- **Concurrency.** `claim_*` functions use `FOR UPDATE SKIP LOCKED`. A
  per-mailbox lease (`email_acquire_integration_lease`) serialises one
  mailbox's sync and processing, so two replies in one thread can't race into
  two tickets.
- **Retries.** Per email: 5 s, 30 s, 2 min, 10 min, then `failed`.
  Permanent errors fail at once. Failed emails show on the channel page with a
  **Retry** button. Jobs use the same curve plus 30 min. Revoked credentials
  mark the channel _Connection expired_ and stop its jobs until reconnected.
- **Reconciliation.** Every minute the scheduler queues a sync for any live
  mailbox not synced in 10 minutes. That recovers any notification Pub/Sub
  dropped. If the cursor is older than Gmail's history (about a week), the
  sync falls back to the last two days of inbox mail.
- **Watch renewal.** Watches expire after 7 days. The scheduler renews any
  that expire within a day; a failure is logged, shown on the page, and
  retried hourly.

## Configuration

| Variable                                   | Where                       | Notes                                                                                              |
| ------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | app + functions             | The existing OAuth client (also used for sending) works. Add the redirect URI to it.               |
| `GOOGLE_REDIRECT_URI`                      | app                         | `https://<app>/api/integrations/gmail/callback`, on the same host admins use                       |
| `GOOGLE_PUBSUB_TOPIC`                      | app + functions             | `projects/<project>/topics/<topic>`                                                                |
| `EMAIL_ENCRYPTION_KEY`                     | app + functions, **secret** | `openssl rand -base64 32`. Same value on both sides; changing it forces every mailbox to reconnect |
| `GOOGLE_PUBSUB_AUDIENCE`                   | functions                   | The push subscription's audience                                                                   |
| `GOOGLE_PUBSUB_SERVICE_ACCOUNT`            | functions                   | The push subscription's service account email                                                      |
| `GOOGLE_PUBSUB_VERIFICATION_TOKEN`         | functions, secret, optional | Extra `?token=` on the push URL                                                                    |
| `EMAIL_MAX_ATTACHMENT_BYTES`               | functions, optional         | Default and maximum 20 MB                                                                          |

Set them in the GitHub environment; `scripts/ci/sync-env.mjs` pushes them to
Vercel and the Edge Functions. The channel page shows "not set up" until the
app has the first five. The webhook refuses every request until the audience
and service account are set.

Vault secret for the cron (created by **Bootstrap development database**;
create it by hand in production):

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/email-ingest', 'email_ingest_url');
```

## Google Cloud setup

1. **APIs.** In the project that owns the OAuth client, enable the **Gmail
   API** and **Cloud Pub/Sub API**.
2. **OAuth consent screen.** Add the scope
   `https://www.googleapis.com/auth/gmail.readonly`. That is the only scope
   requested: it can't send, delete or modify mail. It is a _restricted_
   scope, so a public (External, In production) app needs Google's
   verification and a security assessment. Until then, use Internal (one
   Workspace) or Testing with listed test users. **Testing-mode refresh tokens
   expire after 7 days**, which shows as _Connection expired_.
3. **OAuth client** (Web): add the redirect URI
   `https://<app>/api/integrations/gmail/callback` (and
   `http://localhost:3000/api/integrations/gmail/callback` for local dev).
4. **Topic:** `gcloud pubsub topics create gmail-inbound`.
5. **Let Gmail publish to it:**
   ```sh
   gcloud pubsub topics add-iam-policy-binding gmail-inbound \
     --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
     --role=roles/pubsub.publisher
   ```
6. **Push service account:** `gcloud iam service-accounts create gmail-push`.
   Allow Pub/Sub to mint tokens for it:
   ```sh
   gcloud iam service-accounts add-iam-policy-binding \
     gmail-push@<project>.iam.gserviceaccount.com \
     --member=serviceAccount:service-<project-number>@gcp-sa-pubsub.iam.gserviceaccount.com \
     --role=roles/iam.serviceAccountTokenCreator
   ```
7. **Push subscription with authentication:**
   ```sh
   gcloud pubsub subscriptions create gmail-inbound-push \
     --topic=gmail-inbound \
     --push-endpoint="https://<ref>.supabase.co/functions/v1/gmail-webhook" \
     --push-auth-service-account=gmail-push@<project>.iam.gserviceaccount.com \
     --push-auth-token-audience="https://<ref>.supabase.co/functions/v1/gmail-webhook" \
     --ack-deadline=30 --min-retry-delay=10s --max-retry-delay=600s
   ```
   Then set `GOOGLE_PUBSUB_AUDIENCE` to the audience and
   `GOOGLE_PUBSUB_SERVICE_ACCOUNT` to the service account. If you use
   `GOOGLE_PUBSUB_VERIFICATION_TOKEN`, append `?token=<value>` to the push
   endpoint.

## Deployment

The normal Deploy workflow covers it: migrations, then Edge Function secrets
and `supabase functions deploy` (which deploys `email-ingest` and
`gmail-webhook` with the `verify_jwt` settings in `supabase/config.toml`),
then the app. One-time per environment: the Google Cloud steps above, the
variables, and the `email_ingest_url` Vault secret.

Check it: connect Gmail on a test workspace, send a mail from another account
to the support address, and watch it appear under **Recent emails** and in
the ticket queue within seconds. Reply to the confirmation email and the
reply lands on the ticket.

## Monitoring

Structured JSON logs in the function logs (`service`, `event`, `tenant_id`,
`integration_id`, `job_id`, `event_id`, `provider_message_id`,
`error_category`, `retry_count`, `duration_ms`). Tokens and bodies are always
redacted. Metrics are log lines with `"event":"metric"`: `emails_received`,
`emails_processed`, `tickets_created_from_email`,
`replies_appended_from_email`, `emails_ignored`, `email_processing_failures`,
`email_processing_latency_ms`, `email_queue_depth`, `oauth_refresh_failures`,
`watch_renewal_failures`.

Per workspace, the channel page shows status, last sync, watch expiry, last
error, seven-day counts (`email_channel_stats`) and the recent emails with
retry. Platform-side queries:

```sql
select status, count(*) from email_inbound_events group by 1;
select * from email_sync_jobs where status in ('pending','processing','failed') order by run_after;
select id, tenant_id, status, last_error, watch_expiration from tenant_email_integrations where status in ('error','expired');
select * from cron.job_run_details where command like '%email_ingest%' order by start_time desc limit 20;
```

## Testing

```sh
npm test                  # unit + pipeline tests (src/features/email-channels/tests/)
npm run test:authz        # RLS, token isolation and the ingest SQL against real PostgreSQL
```

`tests/pipeline.test.ts` drives the real sync runner, processor, threading
and retry code against an in-memory model of the SQL contract. It covers the
integration scenarios: new and unknown senders, replies, duplicate
notifications, the wrong recipient, multi-email history, retry and failure, a
crash after ticket creation, revoked credentials, watch renewal, attachments,
tenant isolation and reopen policy. `supabase/tests/authz/cases/80_email_ingest.sql`
runs the same scenarios through the real SQL functions.

## Security

- Tokens are AES-256-GCM encrypted with a key that is never in the database,
  and bound to tenant + provider as additional authenticated data (AAD). The
  token columns are not granted to API roles, so `select *` by a browser fails
  and only the service role reads them.
- RLS: Tenant Admins read their own workspace's channel and events (the
  membership is re-checked in the database, not taken from the JWT). There are
  no client write policies; every change goes through a server action that
  checks a live Tenant Admin membership. The sync queue is service-role only.
- OAuth: an HMAC-signed state that expires after 10 minutes, a nonce bound to
  an httpOnly cookie, PKCE S256, the same admin re-checked on the callback, the
  flow started by a server action (same-origin only; the page then navigates
  to Google, since the CSP's `form-action 'self'` blocks a form redirect to
  another origin), the minimum scope, and
  fixed result codes in redirects (never provider text).
- Webhook: Google-signed OIDC token (signature, issuer, audience, service
  account, expiry), failing closed when not configured; a body size cap; no
  work beyond queueing.
- A browser can't mark its own message or ticket as `source = email` (a
  trigger resets it), and a mailbox can't be connected to two workspaces.
- Email content: stored as text only (HTML converted with linear-time
  parsing), control characters stripped, length capped. Logs never contain
  bodies or tokens. Mail that wasn't for the support address keeps no headers
  and is purged after 30 days.

## Known limitations

- **Gmail only**, and one mailbox per workspace.
- **No historical import:** only mail arriving after the connection, plus the
  two-day fallback when a cursor ages out.
- **Replies are sent from the platform's `FROM_EMAIL`**, not the tenant's
  Gmail (that would need `gmail.send`). `Reply-To` routes the customer's
  answer back.
- A customer's reply to a **resolved/closed** ticket is added but doesn't
  reopen it (current portal policy). There is no "closed → new ticket" option
  yet.
- No per-ticket reply addresses (threading priority 4).
- Gmail replies are credited to the person who connected the mailbox, not
  to whichever teammate typed them (they all send as the one mailbox).
- `gmail.readonly` is a restricted scope (see Google Cloud setup); Testing-mode
  tokens expire weekly.
- Disabling the channel skips the mail that arrives meanwhile, by design.
- Edge Function limits (wall clock, memory) bound each run. Large backlogs are
  worked through over several runs. A single email near 20 MB of attachments
  may be slow.
- Spam filtering relies on Gmail's own spam label and the automated-mail
  headers; there is no separate content filter.
