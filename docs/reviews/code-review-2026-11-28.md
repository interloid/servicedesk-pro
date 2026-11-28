# Code Review Report

- **Date:** 2026-11-28
- **Reviewer:** Claude Code (automated review)
- **Scope:** Untracked files on `feat/omnichannel-support` (email-to-ticket): `src/app/.../settings/channels/`, `src/app/api/integrations/`, `src/features/email-channels/`, `supabase/functions/{email-ingest,gmail-webhook,_shared/email}/`, `supabase/schemas/` (new tables, policies, functions, triggers), `supabase/migrations/202611271*`, `supabase/tests/authz/cases/80_email_ingest.sql`, `docs/email-to-ticket.md` · 45 files. The doc, the authz test, and the long migrations were skimmed, not read line by line. The migrations were checked against their canonical schema copies for the key functions only.
- **Verdict:** NEEDS ATTENTION

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

### RISK-001 · `supabase/schemas/functions/37_email_ingest.sql:915`

(The same function ships in `supabase/migrations/20261127150000_email_agent_replies.sql`.)

- **What is wrong:** The worker treats mail sent from an alias such as `admin+support@gmail.com` as an agent reply, because `isAgentReplyCandidate` compares mailboxes with the `+tag` removed (`processor.ts:638`). The SQL function then compares the sender to `connected_email` exactly. `admin+support@gmail.com` is not `admin@gmail.com`, so the SQL ignores the reply as `sent_not_ticket_reply`.
- **Why it matters:** The settings page tells admins to use a `+support` alias as the support address. Teams that set up Gmail's "Send mail as" with that alias will reply from it. Every one of those replies is dropped. `sent_not_ticket_reply` is also hidden from the "Recent emails" list, so nobody sees that it happened. Customers get the agent's answer by email, but the ticket never records it.
- **Recommendation:** Accept the receiving address as a sender too, in a new migration and in the canonical schema copy.
- **Minimal fix:**

```sql
-- email_ingest_commit_agent_reply
ELSIF v_sender IS DISTINCT FROM v_integration.connected_email
  AND v_sender IS DISTINCT FROM v_integration.receiving_email THEN
    v_reason := 'sent_not_ticket_reply';
```

### RISK-002 · `supabase/functions/_shared/email/threading.ts:107`

(Related: `filtering.ts:195` and `37_email_ingest.sql:449`.)

- **What is wrong:** Nothing checks that an email really came from the address in its `From` header. A subject token such as `[#1042]` adds the email to that ticket when the sender is the ticket's requester. But the "sender" is just the `From` (or `Reply-To`) header, and anyone can type any address there.
- **Why it matters:** Ticket numbers are short and easy to guess. An attacker can send mail as `victim@customer.com` with `[#1042]` in the subject. The message is then posted on the victim's ticket as a public message from the victim. Agents will trust it, for example "please send the invoice to this new address." Gmail only marks spoofed mail as spam when the sender's domain enforces DMARC (`p=reject`). Many domains don't.
- **Recommendation:** Only allow subject-token matches when Gmail's own `Authentication-Results` header says `dmarc=pass`. Otherwise, open a new ticket.
- **Minimal fix:**

```ts
// gmail-normalize.ts — Gmail adds its own result as the topmost header.
const auth = first(headers, "authentication-results") ?? "";
// add to the IncomingEmail returned (and to the type in types.ts):
senderAuthenticated:
  /^\s*mx\.google\.com\s*;/i.test(auth) && /\bdmarc=pass\b/i.test(auth),

// processor.ts, customer path, right after findTicketForEmail:
if (match?.source === "subject" && !email.senderAuthenticated) match = null;
```

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

### RISK-003 · `supabase/schemas/functions/37_email_ingest.sql:122`

(Related: lines 721 and 738.)

- **What is wrong:** `claim_email_sync_jobs` only takes back a stale `processing` job when `attempts < max_attempts`. If the worker dies during a job's last attempt, that job stays `processing` forever. `email_ingest_schedule` then skips any mailbox that has a `processing` job. That check has no time limit for watch renewal.
- **Why it matters:** One killed worker can stop watch renewal for that mailbox for good. The Gmail watch runs out within 7 days, and push notifications stop. Mail then arrives only through the 10-minute reconcile, which is also blocked if the stuck job is a sync job. The channel still shows "Connected."
- **Recommendation:** Mark jobs that ran out of attempts and lost their worker as `failed` at the start of `email_ingest_schedule`.
- **Minimal fix:**

```sql
UPDATE public.email_sync_jobs
SET status = 'failed', completed_at = now(), locked_at = NULL,
    last_error = 'Worker stopped during the last attempt'
WHERE status = 'processing'
  AND attempts >= max_attempts
  AND locked_at < now() - interval '5 minutes';
```

### RISK-004 · `supabase/functions/_shared/email/sync.ts:534`

- **What is wrong:** When another worker holds the mailbox lease, the job returns `ok: false` and retries in 15 seconds. The claim already added 1 to `attempts`, so waiting for the lease counts as a failure. A sync can hold the lease for about 100 seconds. Four or five 15-second retries use up all 5 attempts, and the job ends as `failed`.
- **Why it matters:** A push that arrives while the cron worker is syncing can be thrown away. Its mail then waits up to 10 minutes for reconcile. A "Sync now" during a cron run can end in "The sync failed," even though nothing is wrong.
- **Recommendation:** Don't count a lease deferral as an attempt.
- **Minimal fix:**

```sql
-- email_finish_sync_job: add p_count_attempt boolean DEFAULT true
attempts = CASE WHEN p_count_attempt THEN j.attempts ELSE j.attempts - 1 END,
```

```ts
// sync.ts lease-held branch returns { ok: false, ..., deferred: true };
// email-ingest/index.ts passes p_count_attempt: !result.deferred
```

### RISK-005 · `src/features/email-channels/services/email-channels.service.ts:831`

(Related: `email-channel-settings.tsx:203` and `channels-overview.tsx:114`.)

- **What is wrong:** "Sync now" runs a server action that polls the database for up to 20 seconds. Both pages share one `useTransition` for every action. So during a sync, the Save, Discard, Disconnect and Retry buttons are all disabled, and every refresh icon spins.
- **Why it matters:** An admin who clicks "Sync now" and then tries to save a setting waits up to 20 seconds with no explanation. Each click also keeps a server function busy for that long.
- **Recommendation:** Give sync its own transition, so the other buttons stay usable. Better still, return `"queued"` right after the kick and refresh the page a few times on the client.
- **Minimal fix:**

```tsx
const [pending, startTransition] = useTransition();
const [syncing, startSync] = useTransition();
const sync = () =>
  startSync(async () => {
    /* same body */
  });
// Sync button: disabled={syncing}; spinner: syncing && "animate-spin"
```

### RISK-006 · `src/app/(app)/[tenantSlug]/(base-layout)/settings/channels/page.tsx:21`

- **What is wrong:** The overview page calls `getEmailChannelPage()`. That function also loads the 25 most recent email events, which the overview never shows. The page only uses the channel row and `stats.syncInProgress`.
- **Why it matters:** Each visit runs an extra query, and the 25 rows (subjects and sender addresses) are sent to the browser for nothing. The page also loads more slowly.
- **Recommendation:** Add an option, or a separate function, that skips the events query for the overview.
- **Minimal fix:**

```ts
export async function getEmailChannelPage(
  { withEvents = true }: { withEvents?: boolean } = {},
) {
  // ...
  withEvents ? supabase.from("email_inbound_events")/* ... */ : { data: [], error: null },
}
// overview page:
const gmail = await getEmailChannelPage({ withEvents: false });
```

### RISK-007 · `supabase/schemas/functions/37_email_ingest.sql:793`

(Related: `email-channel-settings.tsx:526`.)

- **What is wrong:** The list hides mail that wasn't for the support address (`not_support_address`, `draft_or_sent`, `sent_not_ticket_reply`). But `email_channel_stats` counts that mail in "Received" and "Ignored." "Replies added" leaves out agent replies. The panel also says "The last seven days," but the list is simply the latest 25 emails, whatever their age.
- **Why it matters:** On a personal inbox, "Received" can say 400 while the list shows 3. Admins can't tell whether email is being lost. The count also shows how much private mail the mailbox owner gets.
- **Recommendation:** Use the same filter for the stats as for the list, count agent replies, and fix the wording.
- **Minimal fix:**

```sql
WHERE tenant_id = v_tenant
  AND created_at >= p_since
  AND (ignore_reason IS NULL OR ignore_reason NOT IN
       ('not_support_address', 'sent_not_ticket_reply', 'draft_or_sent'))
-- and:
'replies_appended', count(*) FILTER (WHERE outcome IN ('reply_appended', 'agent_reply_appended')),
```

```tsx
<p className="text-sm text-slate-500">
  The latest emails, and what happened to each.
</p>
```

## 🏗️ 3. Architectural & Cross-File Findings

### RISK-008 · Affected files: `supabase/functions/_shared/email/processor.ts`, `supabase/functions/_shared/email/filtering.ts`, `supabase/schemas/functions/37_email_ingest.sql`

- **Priority:** Medium. This duplication causes the real bug in RISK-001.
- **What is wrong:** The rule for "this sender is the connected mailbox" is written twice. The TypeScript version ignores Gmail dots and `+tags`. The SQL version compares the address exactly, ignoring only case. The two disagree on addresses like `admin+support@gmail.com` and `a.dmin@gmail.com`.
- **Why it matters:** The worker and the database disagree on which emails are agent replies, and the email is dropped without a trace. Any future change to the rule has to be made in both places, and one will be missed.
- **Recommendation:** Make SQL the only judge. Have the worker pass the raw sender and let the SQL functions decide, or store a canonical mailbox column that both sides compare against.

### RISK-009 · Affected files: `src/features/email-channels/components/channels-overview.tsx`, `src/features/email-channels/components/email-channel-settings.tsx`

- **What is wrong:** The `sync` and `disconnect` handlers, their toast messages, and the whole "Disconnect Gmail?" dialog are copied in both components. The overview also imports `ConnectForm`, `StatusBadge` and `relative` from the settings page's component file.
- **Why it matters:** A wording or behaviour fix, such as RISK-005, has to be made twice. Shared pieces stuck inside one page's file make that file harder to change safely.
- **Recommendation:** Move the shared pieces into their own files, for example `components/disconnect-dialog.tsx` and `components/channel-status.tsx`. Put the action handlers in a `useEmailChannelActions()` hook.

### RISK-010 · Affected files: `.gitignore:59`, `src/features/email-channels/tests/*.test.ts`, `supabase/functions/_shared/email/attachments.ts:3`

- **What is wrong:** The `tests` rule in `.gitignore` ignores `src/features/email-channels/tests/`, which holds 1,824 lines across six test files. `attachments.ts` says its copy of the allowed file types is protected by a test that "fails if the two ever differ." That test lives in the ignored folder.
- **Why it matters:** The tests never reach the repo or CI. If someone adds a file type to the app's allowlist and not the email copy, nothing fails. Email attachments of that type are then silently rejected.
- **Recommendation:** Add a `!src/features/email-channels/tests/` exception, as was done for `supabase/tests/`. If the policy is deliberate, change the comment so it doesn't claim CI protection.

### RISK-011 · Affected files: `src/app/api/integrations/gmail/callback/route.ts:14`, `supabase/functions/_shared/email/providers/gmail/oauth.ts:1`

- **What is wrong:** Both comments say the cookie and consent URL come from a "connect route." That route no longer exists. The flow starts in the `startGmailConnectAction` server action.
- **Why it matters:** A developer looking into an OAuth bug will search for a route that isn't there. The security reasoning about who can start the flow lives in the server action, not where the comment points.
- **Recommendation:** Update both comments to name `startGmailConnectAction`.

## 🧪 4. Required Test Cases

| Risk ID  | What the test does                                                                                                                                                                                  | What it should prove                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| RISK-001 | Pipeline test. Connected mailbox `admin@gmail.com`, receiving address `admin+support@gmail.com`. A `SENT` message from `admin+support@gmail.com` has an `In-Reply-To` that matches a filed message. | The outcome is `agent_reply_appended` and a `ticket_messages` row with `author_type = 'agent'` exists. |
| RISK-001 | Authz SQL test. Call `email_ingest_commit_agent_reply` with `sender_email` set to the receiving alias, then to an unrelated address.                                                                | The alias commits. The unrelated address is ignored as `sent_not_ticket_reply`.                        |
| RISK-001 | Pipeline test. A `SENT` message from the alias with no thread match and no subject token.                                                                                                           | It is still ignored as `sent_not_ticket_reply`. The fix must not turn ordinary sent mail into replies. |
| RISK-002 | Pipeline test. From `victim@customer.com` (the requester of ticket #1042), subject `Re: [#1042]`, Gmail's `Authentication-Results` says `dmarc=fail`.                                               | No message is added to #1042. A new ticket is created instead.                                         |
| RISK-002 | Same email, but with `dmarc=pass` in Gmail's topmost `Authentication-Results`.                                                                                                                      | The message is added to #1042 as a customer reply.                                                     |
| RISK-002 | Topmost `Authentication-Results` from `mx.google.com` says `dmarc=fail`. A forged second header lower down says `dmarc=pass`.                                                                       | The email is treated as unauthenticated. Only Gmail's own header counts.                               |
| RISK-002 | An unauthenticated email whose `In-Reply-To` matches a filed Message-ID.                                                                                                                            | It still threads onto the ticket. The check only applies to subject-token matches.                     |

## 🏁 5. Verdict

**NEEDS ATTENTION.** The feature is carefully built. OAuth state and PKCE, token encryption, Pub/Sub token checks, RLS with column grants, and idempotent commits are all done well. The two high risks are both in reply threading. One silently drops agent replies sent from the support alias. The other lets a spoofed sender post on a customer's ticket. Fix RISK-001 first: it loses data quietly in the setup the settings page itself recommends.

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                       | File                                                                  | Completed | Reason if Not Completed |
| -------- | -------- | ---------------------------------------------- | --------------------------------------------------------------------- | --------- | ----------------------- |
| RISK-001 | High     | Agent replies from +alias silently dropped     | `supabase/schemas/functions/37_email_ingest.sql`                      | No        | _Pending_               |
| RISK-002 | High     | Spoofed sender posts on customer's ticket      | `supabase/functions/_shared/email/threading.ts`                       | No        | _Pending_               |
| RISK-003 | Medium   | Stuck job blocks watch renewal forever         | `supabase/schemas/functions/37_email_ingest.sql`                      | No        | _Pending_               |
| RISK-004 | Medium   | Lease wait burns sync job attempts             | `supabase/functions/_shared/email/sync.ts`                            | No        | _Pending_               |
| RISK-005 | Medium   | Sync now locks all buttons 20s                 | `src/features/email-channels/services/email-channels.service.ts`      | No        | _Pending_               |
| RISK-006 | Medium   | Overview loads unused email list               | `src/app/(app)/[tenantSlug]/(base-layout)/settings/channels/page.tsx` | No        | _Pending_               |
| RISK-007 | Medium   | Stats count hidden private mail                | `supabase/schemas/functions/37_email_ingest.sql`                      | No        | _Pending_               |
| RISK-008 | Medium   | Mailbox match rule differs TS vs SQL           | `supabase/functions/_shared/email/processor.ts`                       | No        | _Pending_               |
| RISK-009 | Low      | Duplicated sync/disconnect handlers and dialog | `src/features/email-channels/components/channels-overview.tsx`        | No        | _Pending_               |
| RISK-010 | Low      | Email-channel tests are gitignored             | `.gitignore`                                                          | No        | _Pending_               |
| RISK-011 | Low      | Comments name a nonexistent connect route      | `src/app/api/integrations/gmail/callback/route.ts`                    | No        | _Pending_               |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
