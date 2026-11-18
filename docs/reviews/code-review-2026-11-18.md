# Code Review Report

- **Date:** 2026-11-18
- **Reviewer:** Claude Code (automated review)
- **Scope:** `src/` (app, components, config, context, features, hooks, lib, types), `supabase/migrations/20261118*`, `supabase/schemas/` (audit files) · 499 source files
- **Verdict:** NEEDS ATTENTION

---

## How this was checked

- **Whole codebase (499 source files):** `tsc --noEmit` (clean), ESLint (clean), and Vitest (182 of 182 pass). `npm run test:authz` builds a database from every migration: 247 of 247 pass.
- **Pattern scans across all files:** `any`, `as unknown as`, `dangerouslySetInnerHTML`, raw `<img>`, server secrets in client files, `eslint-disable` lines, `useEffect` data fetching, and routes without `loading.tsx` / `error.tsx` / metadata.
- **Read in full:** support impersonation (`platform-impersonation.service.ts`, `platform-impersonation.actions.ts`), workspace support (`support.service.ts`, `support-actions.ts`), the new audit migrations (`20261118120000`, `20261118130000`), the audit page code, and everything changed in the UI today (platform header and sidebar, support form and thread, tenants table, back links).
- **Open items from earlier reviews:** each item still open in the 2026-11-17 review was checked again in the code. Eight are still present and are carried forward below. The Next.js advisory (old RISK-004) is fixed: `package.json` now has `^16.4.6`. Every item in `code-review-2026-11-17-2.md` is marked done.
- **Not read line by line:** older feature code that earlier reviews covered and that hasn't changed since (tickets UI, SLA engine, billing pages, onboarding). The automated scans above still covered it.

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

### RISK-001 · `supabase/migrations/20261118120000_audit_log_modules.sql:741`

> **Status (2026-11-18): fixed before deploy.** The new triggers name the person from the row (`created_by`, `access_granted_by`, `uploaded_by`, message author, or the customer's portal sign-in) via `audit_use_actor()`. Workspace and platform support writes and staff attachment inserts now use `createAuditedAdminClient`. Verified locally; still "System": ticket status changes made from the portal (reopen/close RPCs).

- **What is wrong:** The new audit triggers find the person through `auth.uid()`. Several writes come from the server's admin client, which has no signed-in user. Those rows are saved with no person, so the audit log shows "System".
- **Where it happens:**
  - Support requests: `src/features/support/services/support.service.ts:124` (create), `:206` (grant or withdraw access), `:232` (close). All use `createSupabaseAdminClient()`.
  - Staff attachments: `src/features/tickets/services/tickets.service.ts:1555` (`recordStagedAttachments`).
  - Portal attachments, tickets and replies made by customers: `src/features/portal/services/portal.service.ts`.
  - Platform support changing a request's status: `src/features/platform-admin/services/platform-support.service.ts:167`, `:187`.
- **Why it matters:** "Allowed support to access the workspace for #1001" is the most sensitive row in the log. It will say "System", not the Tenant Admin who allowed it. An admin checking who let platform support in can't find out. Uploads by staff also lose their author. These triggers aren't deployed yet, so this can be fixed before any wrong rows exist.
- **Recommendation:** In each trigger, set the existing `app.audit_fallback_actor` from the row's own "who" column before calling `audit_record`. That is the same mechanism the billing triggers already use.
- **Minimal fix:**

```sql
-- audit_support_requests(), before each audit_record call
perform set_config(
    'app.audit_fallback_actor',
    coalesce(
        case when tg_op = 'INSERT' then new.created_by else new.access_granted_by end::text,
        ''
    ),
    true
);
-- ... audit_record(...) ...
perform set_config('app.audit_fallback_actor', '', true);

-- audit_attachments(): v_row.uploaded_by
-- audit_tickets() on INSERT: new.created_by
-- audit_ticket_messages(): v_row.author_id when v_row.author_type = 'agent'
```

`audit_fallback_actor()` already ignores an id with no `users` row, so passing a customer's id is safe.

---

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

### RISK-002 · `src/app/page.tsx:62`

- **What is wrong:** The homepage puts `platformName` inside a `<script type="application/ld+json">` tag using `JSON.stringify`. `JSON.stringify` does not escape `</script>`. The settings form only limits the name to 80 characters. (Carried from 2026-11-17 RISK-006.)
- **Why it matters:** A platform name like `</script><script>…` runs as code for every visitor to the homepage. It takes a platform admin account to set it. A stolen admin account could therefore attack every visitor.
- **Recommendation:** Escape `<` in the JSON before writing it into the tag.
- **Minimal fix:**

```tsx
__html: JSON.stringify(data).replace(/</g, "\\u003c"),
```

### RISK-003 · `src/features/platform-admin/services/platform-support.service.ts:85`

- **What is wrong:** `listPlatformSupportRequests` loads only the 1,000 most recently updated support requests. The Tenants page uses this list for its "N Open" badges and its "Support access" state. (Carried from 2026-11-17 RISK-001.)
- **Why it matters:** Once there are more than 1,000 requests, older open requests drop off the list. A workspace with an old open request shows no badge, and support may never answer it.
- **Recommendation:** Load open requests with their own query, filtered by `status`, and keep the capped query only for history.
- **Minimal fix:**

```ts
.in("status", OPEN_SUPPORT_STATUSES as unknown as string[])
```

### RISK-004 · `src/features/platform-admin/actions/platform-plans.actions.ts:72`

- **What is wrong:** These platform changes are written only to the server console with `console.info`:
  - Plan create and edit (`platform-plans.actions.ts:72`, `:142`, `:169`).
  - Role changes (`platform-roles.actions.ts:95`).
  - Support status changes and replies (`platform-support.actions.ts:73`, `:102`).

  Platform settings, including maintenance mode, are not recorded anywhere (`platform-settings.actions.ts`). (Carried from 2026-11-17 RISK-002.)

- **Why it matters:** Today's audit change promises a "Platform admin" module. Turning on maintenance mode locks every workspace out, yet nothing records who did it. Server logs rotate, so the trail is lost within days.
- **Recommendation:** Write these to a platform-level audit table. `audit_logs.tenant_id` is required, so they can't go in the workspace log.

### RISK-005 · `src/app/platform/tenants/[tenantId]/in-person-view/page.tsx:27`

- **What is wrong:** The Support access page has no `loading.tsx`. It reads the workspace's data and writes an audit row before it renders. (Carried from 2026-11-17 RISK-003.)
- **Why it matters:** After clicking the eye button, the old page stays on screen with no sign anything is happening. The operator clicks again, and each click writes another "viewed the workspace" row into the tenant's audit log.
- **Recommendation:** Add a `loading.tsx` next to the page that renders the existing platform skeleton.
- **Minimal fix:**

```tsx
// src/app/platform/tenants/[tenantId]/in-person-view/loading.tsx
export { default } from "../../(list)/loading";
```

### RISK-006 · `src/features/platform-admin/services/platform-data.service.ts:157`

- **What is wrong:** The Tenants page (`loadTenants`) and the Users page (`getPlatformUsers`) load every row so the browser can search and page them. (Carried from 2026-11-17 RISK-005.)
- **Why it matters:** Both pages slow down as the platform grows. At a few thousand workspaces, every visit sends megabytes to the browser and the page takes seconds to open.
- **Recommendation:** Move search, filters and paging to the server, as the audit log page already does.

### RISK-007 · `src/features/platform-admin/services/platform-impersonation.service.ts:252`

- **What is wrong:** `startImpersonation` creates a live sign-in for the Tenant Admin and an `impersonation_sessions` row first. Then it calls `recordAudit` and `saveReturnSession`. If either of those throws, nothing calls `end_impersonation_session`. The other failure paths in the same function all do.
- **Why it matters:** The operator sees an error, but the sign-in and its session row stay live until the grant expires, up to 72 hours. Anything that lists active impersonations will show support as signed in when it isn't. Nobody holds those tokens, so it can't be used to get in.
- **Recommendation:** Wrap the steps after the insert in one `try` block that ends the session on any failure.
- **Minimal fix:**

```ts
try {
  await recordAudit(/* … */);
  await saveReturnSession(own.refresh_token);
} catch (error) {
  await db.rpc("end_impersonation_session", {
    p_auth_session_id: sessionId,
    p_reason: "start failed",
  });
  throw error;
}
```

---

## 🏗️ 3. Architectural & Cross-File Findings

### RISK-008 · Affected files: `src/features/platform-admin/actions/platform-roles.actions.ts`

- **What is wrong:** The shared `run()` helper takes any Zod schema and a `write(data: never)` callback. It then calls `write(parsed.data as never)` at line 83. Nothing ties the schema to what the callback expects. (Carried from 2026-11-17 RISK-007.)
- **Why it matters:** If someone pairs the wrong schema with a write function, TypeScript accepts it. The mistake only shows up when the database rejects the write.
- **Recommendation:** Make `run` generic: `run<S extends z.ZodType>(schema: S, write: (data: z.infer<S>) => …)`.

### RISK-009 · Affected files: `src/features/platform-admin/services/platform-data.service.ts`, `src/features/platform-admin/components/tenants-table.tsx`

- **What is wrong:** The Tenants page hides soft-deleted workspaces. The Overview dashboard still counts them (`totalTenants: tenants.length`, line 527). (Carried from 2026-11-17 RISK-008.)
- **Why it matters:** The two pages show different totals for the same platform. Someone comparing them will think data is missing.
- **Recommendation:** Filter `deleted_at` out of the Overview count, the same way the Tenants page does.

### RISK-010 · Affected files: `src/features/platform-admin/workspace-status.ts`, `src/proxy.ts`, `src/features/platform-admin/components/blocked-actions.tsx`, `supabase/schemas/tables/27_platform_settings.sql`

- **What is wrong:** Since migration `20261117150000`, nothing sets `block_source = 'payment'` or reads `block_on_payment_failure`. The proxy (`proxy.ts:220`, `:241`) and `workspace-status.ts:26` still handle a payment block. (Carried from 2026-11-17 RISK-009.)
- **Why it matters:** A future developer will assume payment blocks still happen and test for them. This code has to be read and kept working without serving any purpose.
- **Recommendation:** Remove the payment branch and the unused setting in one migration plus a code change.

### RISK-011 · Affected files: `src/features/audit/components/audit-locked.tsx`, `src/features/audit/types/audit.ts`, `supabase/schemas/functions/19_audit_log.sql`

- **What is wrong:** Today's change stopped recording sign-ins and removed the Security module. Two old names remain:
  - The upgrade prompt still says "Upgrade to Business to track sign-ins…" (`audit-locked.tsx:187`).
  - The stat figure is still called `security` in `AuditSummary` and in `audit_log_summary()`, but it now counts platform access and failed actions.
- **Why it matters:** The prompt promises a feature the plan no longer has. The `security` name will mislead the next person who changes the card.
- **Recommendation:** Change the prompt to "track tickets, users, SLA and billing changes", and rename the field to `platformAccess` in the next migration that touches the function.

### RISK-012 · Affected files: `src/features/audit/services/audit.service.ts`, `src/features/platform-admin/services/platform-audit.service.ts`, `platform-data.service.ts`, `platform-billing.service.ts`, `platform-observability.service.ts`, `src/features/notifications/services/notifications.service.ts`

- **What is wrong:** Eight query results are forced to a hand-written type with `as unknown as` (for example `audit.service.ts:648`, `platform-audit.service.ts:140`). TypeScript no longer checks those rows against the database columns.
- **Why it matters:** If a column is renamed or dropped, these files still compile. The page then shows `undefined` or crashes at runtime, and only for users who reach that page.
- **Recommendation:** Regenerate `database.types.ts`, then use `.returns<T>()` or typed selects so a column change fails the build.

---

## 🧪 4. Required Test Cases

| Risk ID  | What the test does                                                                                                                                                                                       | What it should prove                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RISK-001 | In the authz suite, as `service_role` with no JWT user, inserts a `support_requests` row with `allow_workspace_access = true` and `created_by` set to a Tenant Admin. Reads the newest `audit_logs` row. | `actor_id` is the Tenant Admin, not null.                                 |
| RISK-001 | Same setup. Updates `allow_workspace_access` to false with `access_granted_by` set.                                                                                                                      | The "Withdrew support access" row names that admin.                       |
| RISK-001 | As `service_role`, inserts an `attachments` row with `uploaded_by` set to an agent.                                                                                                                      | The "Uploaded …" row names the agent.                                     |
| RISK-001 | Inserts a `ticket_messages` row with `author_type = 'customer'` and a customer id as `author_id`.                                                                                                        | The row is still written, with no person (no error from the users check). |

---

## 🏁 5. Verdict

**NEEDS ATTENTION.** The codebase is in good shape: typecheck, lint, 182 unit tests and 247 authorization tests all pass. No server secret reaches the browser. The one new High issue comes from today's audit change, and it isn't deployed yet: the most sensitive support-access rows would name nobody. Fix RISK-001 before the audit migrations go out, then deal with the six Medium items, five of which are carried over from 2026-11-17.

---

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                        | File                                                                     | Completed | Reason if Not Completed |
| -------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------ | --------- | ----------------------- |
| RISK-001 | High     | Admin-client audit rows show "System"           | `supabase/migrations/20261118120000_audit_log_modules.sql`               | No        | _Pending_               |
| RISK-002 | Medium   | Platform name unescaped in homepage script      | `src/app/page.tsx`                                                       | No        | _Pending_               |
| RISK-003 | Medium   | Support list capped, drops old requests         | `src/features/platform-admin/services/platform-support.service.ts`       | No        | _Pending_               |
| RISK-004 | Medium   | Platform plan/role/settings changes not audited | `src/features/platform-admin/actions/platform-plans.actions.ts`          | No        | _Pending_               |
| RISK-005 | Medium   | Support access page lacks loading UI            | `src/app/platform/tenants/[tenantId]/in-person-view/page.tsx`            | No        | _Pending_               |
| RISK-006 | Medium   | Tenants and Users pages load every row          | `src/features/platform-admin/services/platform-data.service.ts`          | No        | _Pending_               |
| RISK-007 | Medium   | Failed impersonation start leaves session live  | `src/features/platform-admin/services/platform-impersonation.service.ts` | No        | _Pending_               |
| RISK-008 | Low      | Roles action helper hides type errors           | `src/features/platform-admin/actions/platform-roles.actions.ts`          | No        | _Pending_               |
| RISK-009 | Low      | Overview counts soft-deleted workspaces         | `src/features/platform-admin/services/platform-data.service.ts`          | No        | _Pending_               |
| RISK-010 | Low      | Dead payment-block code and settings column     | `src/features/platform-admin/workspace-status.ts`                        | No        | _Pending_               |
| RISK-011 | Low      | Stale sign-in and security audit wording        | `src/features/audit/components/audit-locked.tsx`                         | No        | _Pending_               |
| RISK-012 | Low      | Unchecked casts on database query results       | `src/features/audit/services/audit.service.ts`                           | No        | _Pending_               |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
