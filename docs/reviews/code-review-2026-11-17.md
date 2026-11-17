# Code Review Report

- **Date:** 2026-11-17
- **Reviewer:** Claude Code (automated review)
- **Scope:** `src/` (app, components, features, lib, hooks, config), plus `supabase/migrations`, `supabase/schemas` and `supabase/functions` where a finding depends on them · 466 files
- **Verdict:** NEEDS ATTENTION

---

## How this was checked

- **Depth:** All 466 source files went through `tsc`, ESLint and pattern scans:
  - server-only environment variables reached from client components;
  - service imports in client components;
  - `dangerouslySetInnerHTML`, raw `<img>`, `any` and `as` casts, and disabled lint rules;
  - `useEffect` data loading;
  - every server action, checked for an auth guard;
  - every route, checked for `loading.tsx`, `error.tsx` and metadata.
- **Read closely:**
  - everything added since the 2026-11-03 review: support requests, the In-Person View, dynamic roles, invoices, soft delete, trial extension, plan create/deprecate, the payment grace period and the customer-to-portal redirect;
  - the proxy, auth and public (signed-out) actions;
  - the ticket bulk actions.
- **Sampled, not read line by line:** large UI components that were already covered by earlier reviews. UI bugs may remain there.
- **Test runs:** `tsc` clean, ESLint clean, 129 unit tests pass, and 241 of 241 database authorization tests pass.
- **Not run:** the PayPal webhook and the subscription jobs. The local edge runtime has no PayPal credentials, so the grace-period flow is reviewed but not executed.
- **Earlier findings:** items still open from earlier reviews are listed only when the code still shows them (RISK-005).

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

None found.

---

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

### RISK-001 · `src/features/platform-admin/services/platform-support.service.ts:85`

- **What is wrong:** `listPlatformSupportRequests` loads only the 1,000 most recently updated support requests. Two features rely on that list being complete:
  - `activeAccessRequestId` (line 99) looks for a workspace's active access grant only inside it;
  - the Tenants page counts open requests only inside it.
- **Why it matters:** Past 1,000 requests, an older open request drops off the list without any warning. Its workspace then shows "no open requests" on the Tenants page. The super admin also gets "No workspace access" in the In-Person View, even though the tenant granted access.
- **Recommendation:** Look up the active grant with its own query, and load only open requests for the Tenants page.
- **Minimal fix:**

```ts
export async function activeAccessRequestId(tenantId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("support_requests")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("allow_workspace_access", true)
    .gt("access_expires_at", new Date(await serverNow()).toISOString())
    .in("status", ["open", "in_progress", "waiting_on_customer"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
```

### RISK-002 · `src/features/platform-admin/actions/platform-plans.actions.ts:71`

- **What is wrong:** These platform-wide changes are written only to the server console with `console.info`:
  - creating, editing, deprecating and showing plans;
  - creating, editing, archiving and deleting roles (`platform-roles.actions.ts:94`);
  - saving Platform Settings (`platform-settings.actions.ts:33`), including the payment grace period.
    Nothing is stored in the database.
- **Why it matters:** These changes affect every workspace's billing and access. Console logs expire after a few days and can't be searched by plan or role. If a plan is deprecated or the grace period is shortened by mistake, there is no record of who did it or when.
- **Recommendation:** Add an append-only `platform_audit_logs` table (same immutability trigger as `audit_logs`) and write one row per platform change.
- **Minimal fix:**

```ts
// after each successful platform write
await createSupabaseAdminClient()
  .from("platform_audit_logs")
  .insert({
    actor_id: admin.id,
    actor_email: admin.email,
    entity: "plan",
    entity_id: parsed.data.id,
    action: "update",
    meta_json: { summary: `Updated the ${name} plan` },
  });
```

### RISK-003 · `src/app/platform/tenants/[tenantId]/in-person-view/page.tsx:27`

- **What is wrong:** These five pages have no `loading.tsx`:
  - the four Help & Support pages under `src/app/(app)/[tenantSlug]/(base-layout)/support/`;
  - the In-Person View.
    Every other data page in the app has one.
- **Why it matters:** The In-Person View runs about eight queries before it renders. After a click, the old page stays on screen with no feedback until they finish. Users click again and start a second load, which also writes a second audit entry.
- **Recommendation:** Add a `loading.tsx` to each route, reusing the existing skeleton components.
- **Minimal fix:**

```tsx
// src/app/platform/tenants/[tenantId]/in-person-view/loading.tsx
import { PlatformTenantsSkeleton } from "@/features/platform-admin/components/platform-skeletons";

export default function Loading() {
  return <PlatformTenantsSkeleton />;
}
```

### RISK-004 · `package.json:40`

- **What is wrong:** The installed Next.js is 16.4.2. `npm audit` reports advisory GHSA-mfr8-8qww-v76h (moderate) for 16.3.0 through 16.4.4.
- **Why it matters:** The leak happens when a `"use cache"` function is called through `unstable_cache()`. The app uses `unstable_cache` (`platform-settings.service.ts:73`, `platform-observability.service.ts:655`) but no `"use cache"` today, so it is not triggered yet. Adding `"use cache"` later would make it exploitable. The dev server also prints this warning on every start.
- **Recommendation:** Upgrade `next` to 16.4.5 or later, and run the test suites.
- **Minimal fix:**

```json
"next": "^16.4.5"
```

### RISK-005 · `src/features/platform-admin/services/platform-data.service.ts:157`

- **What is wrong:** The Tenants page (`loadTenants`) and the Users page (`getPlatformUsers`, line 365) still load every row so the browser can search them. The Tenants page now also loads up to 1,000 support requests. This was RISK-008 in the 2026-11-03 review, marked "Partial".
- **Why it matters:** Each visit reads every tenant, subscription, membership and user. Pages get slower as the platform grows, and the whole list is sent to the browser on every visit.
- **Recommendation:** Move search, filters and pagination to the server, using URL search params and `.range()`.
- **Minimal fix:**

```ts
// page.tsx: read ?q=&page= and pass them down
const { data, count } = await admin
  .from("tenants")
  .select(TENANT_COLUMNS, { count: "exact" })
  .ilike("name", `%${q}%`)
  .range(page * 50, page * 50 + 49);
```

### RISK-006 · `src/app/page.tsx:62`

- **What is wrong:** The homepage JSON-LD block puts `platformName` into `JSON.stringify` inside a `<script>` tag. `JSON.stringify` does not escape `</script>`.
- **Why it matters:** A platform name containing `</script><script>…` would end the block early and add a script tag to the public homepage. The enforced nonce Content-Security-Policy blocks it today, and only a platform admin can set the name. One CSP change would turn this into stored XSS (a script that runs for every visitor).
- **Recommendation:** Escape `<` in the JSON before writing it.
- **Minimal fix:**

```tsx
__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
```

---

## 🏗️ 3. Architectural & Cross-File Findings

### RISK-007 · Affected files: `src/features/platform-admin/actions/platform-roles.actions.ts`

- **What is wrong:** The shared `run()` helper takes `schema: z.ZodType` and a `write(data: never)` callback. It then calls `write(parsed.data as never)`. Nothing ties the schema to the callback's input type.
- **Why it matters:** Pairing the wrong schema with the wrong write function (for example `idSchema` with `updatePlatformRole`) still compiles. The bug would only show up at runtime as a database error.
- **Recommendation:** Make `run` generic over the schema, so TypeScript checks the pairing:

```ts
async function run<S extends z.ZodType>(
  label: string,
  schema: S,
  input: unknown,
  write: (data: z.infer<S>, actorId: string) => Promise<void>,
);
```

### RISK-008 · Affected files: `src/features/platform-admin/services/platform-data.service.ts`, `src/features/platform-admin/components/tenants-table.tsx`

- **What is wrong:** The Tenants page hides soft-deleted workspaces unless "Status: Deleted" is picked. The Overview dashboard (`totalTenants: tenants.length`, line 527) still counts them.
- **Why it matters:** The two pages show different tenant totals for the same platform. A super admin comparing them can't tell which number is right.
- **Recommendation:** Exclude rows with `deletedAt` from the Overview totals, or show "deleted" as its own number.

### RISK-009 · Affected files: `src/features/platform-admin/workspace-status.ts`, `src/proxy.ts`, `src/features/platform-admin/components/blocked-actions.tsx`, `supabase/schemas/tables/27_platform_settings.sql`

- **What is wrong:** Since migration `20261117150000`, nothing sets `block_source = 'payment'`, and nothing reads `platform_settings.block_on_payment_failure`. These still handle a payment block:
  - the proxy's billing-path exception (`proxy.ts:215`, `proxy.ts:236`);
  - the `"payment"` branch in `workspace-status.ts`;
  - the "payment" variant of the blocked page.
- **Why it matters:** Readers will assume payment blocks still happen and may "fix" the grace period around them. The unused column also invites someone to wire the old toggle back up.
- **Recommendation:** Remove the payment-block branches and drop the column in a follow-up migration, once production has no `block_source = 'payment'` rows (the grace migration already clears them).

---

## 🧪 4. Required Test Cases

There are no high-risk findings, so no tests are required. These tests are recommended for the medium findings:

- **RISK-001:** Seed 1,001 support requests where the oldest one has an active grant. Open that workspace's In-Person View. It should open, which proves the grant lookup doesn't depend on list order.
- **RISK-001:** Seed 1,001 requests with the oldest one still open. Load the Tenants page. Its workspace should show "1 Open", which proves open requests aren't dropped.
- **RISK-002:** Deprecate a plan, then read `platform_audit_logs`. There should be one row naming the admin and the plan.
- **RISK-002:** As the service role, try to update and delete a `platform_audit_logs` row. Both should fail, which proves the log can't be edited.
- **RISK-006:** Unit test: render the homepage JSON-LD with the platform name `</script><script>x()</script>`. The output should contain no `</script>` before the real closing tag.

---

## 🏁 5. Verdict

**NEEDS ATTENTION.** No security leaks or broken logic were found. Every server action checks its caller, public actions are rate-limited, and all 241 database authorization tests pass. Fix RISK-001 first: once the platform passes 1,000 support requests, the Tenants page and the In-Person View silently stop matching what tenants actually granted.

---

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                        | File                                                               | Completed | Reason if Not Completed |
| -------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------ | --------- | ----------------------- |
| RISK-001 | Medium   | Support list capped, drops access and counts    | `src/features/platform-admin/services/platform-support.service.ts` | No        | _Pending_               |
| RISK-002 | Medium   | Platform plan/role/settings changes not audited | `src/features/platform-admin/actions/platform-plans.actions.ts`    | No        | _Pending_               |
| RISK-003 | Medium   | Support and In-Person View lack loading UI      | `src/app/platform/tenants/[tenantId]/in-person-view/page.tsx`      | No        | _Pending_               |
| RISK-004 | Medium   | Next.js 16.4.2 has moderate advisory            | `package.json`                                                     | No        | _Pending_               |
| RISK-005 | Medium   | Tenants and Users pages load every row          | `src/features/platform-admin/services/platform-data.service.ts`    | No        | _Pending_               |
| RISK-006 | Medium   | Platform name unescaped in homepage script      | `src/app/page.tsx`                                                 | No        | _Pending_               |
| RISK-007 | Low      | Roles action helper hides type errors           | `src/features/platform-admin/actions/platform-roles.actions.ts`    | No        | _Pending_               |
| RISK-008 | Low      | Overview counts soft-deleted workspaces         | `src/features/platform-admin/services/platform-data.service.ts`    | No        | _Pending_               |
| RISK-009 | Low      | Dead payment-block code and settings column     | `src/features/platform-admin/workspace-status.ts`                  | No        | _Pending_               |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
