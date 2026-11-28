# Code Review Report

- **Date:** 2026-11-28
- **Reviewer:** Claude Code (automated review)
- **Scope:** `src/` (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `config/`, `types/`, `proxy.ts`) · 520 files
- **Verdict:** NEEDS ATTENTION

---

## How this review was done

- I ran `tsc --noEmit` and `eslint src` on all 520 files. Both pass for tracked code.
- I ran pattern scans over every file for `any`, `as unknown as`, `dangerouslySetInnerHTML`, `<img>`, `eslint-disable`, server env vars in client files, `useEffect` data loading, and duplicate type names.
- I read these in full: the proxy, every route handler, the auth and ticket actions and services, the upload path, the realtime hooks, the chatbot action and schema, billing actions and capture, both reset-password pages, the payment success page, and the brand CSS and JSON-LD injection sites.
- Before reporting anything about data access, I checked the Supabase RLS policies it depends on.
- I did not read all ~104k lines line by line. Large UI files (`branding-editor.tsx`, `sla-editor.tsx`, platform-admin screens) got the automated checks and pattern scans only.

Things I checked that are **not** problems:

- `sendTicketMessageAction` does not check the caller's role. RLS on `ticket_messages` still blocks a customer from posting as an agent or posting an internal note.
- `BrandTheme` writes tenant colours into a `<style>` tag. Only validated hex values get through.
- No server-only env var is read in any `"use client"` file.
- The upload helpers use the admin client. Each one calls `requireStaffUploader` first.

Local-only note: `tsc` reports errors in `src/features/email-channels/tests/*`. That folder is gitignored and imports modules that no longer exist. It only breaks `tsc` on this machine. Delete it locally.

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

- **RISK-001** · `src/features/auth/services/auth.service.ts:431`
- **What is wrong:** The central reset-password flow (`/reset-password`) saves the new password but never signs out the session the email link created. The tenant flow does sign out (`updatePasswordForTenant`, line ~657).
- **Why it matters:** The page says "Taking you to sign in" and sends the user to `/login`. The proxy sees a live session on `/login` and redirects staff to their dashboard (`proxy.ts:386`). So the user is signed in by the email link, not by their new password. On a shared computer, anyone who opens the browser later is still signed in. The tenant code says the fresh sign-in "runs the invite-to-active step". Someone who sets their first password from this page skips that step and keeps the old token.
- **Extra problem on the same page:** `onSubmit` in `src/app/(auth)/reset-password/page.tsx:159` has no `try/catch`. If the action throws (for example, the network drops), the error reaches the error boundary and the form is replaced by the error screen. The tenant page catches this and shows a retry message.
- **Recommendation:** Sign out after a successful update in `updatePassword`, as the tenant version does. Clear the local copy in the page, and wrap the action call in `try/catch`.
- **Minimal fix:**

```ts
// auth.service.ts — updatePassword()
if (error) {
  return { success: false, error: passwordUpdateMessage(error) };
}
await supabase.auth.signOut();
return { success: true };
```

```tsx
// (auth)/reset-password/page.tsx — onSubmit
try {
  const result = await updatePasswordAction(values);
  if (!result.success) { /* existing error handling */ return; }
  await createSupabaseClient().auth.signOut({ scope: "local" });
  // existing success path
} catch {
  form.setError("root", { message: "We couldn't update your password. Check your connection and try again." });
}
```

---

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

- **RISK-002** · `src/hooks/use-realtime-tickets-refresh.ts:85`
- **What is wrong:** The ticket queue listens to every `DELETE` on `sla_events`, with no filter. Supabase cannot filter DELETE events, and with RLS on, the old row holds only the primary key. So `old.tenant_id` is always missing and the guard on line 88 never skips anything.
- **Why it matters:** When any tenant changes a ticket's priority or SLA policy, the SLA engine deletes pending `sla_events` rows. Then every open ticket queue in every tenant runs `router.refresh()`. Each refresh re-renders the queue on the server and queries the database. Server load grows with the number of tenants times the number of open queues.
- **Recommendation:** Remove the DELETE listener. The same change also fires a `tickets` UPDATE, which is filtered by tenant and already triggers a refresh.
- **Minimal fix:**

```ts
// delete this block
.on(
  "postgres_changes",
  { event: "DELETE", schema: "public", table: "sla_events" },
  (payload) => { /* ... */ schedule(); },
)
```

- **RISK-003** · `src/proxy.ts:566`
- **What is wrong:** The subdomain branch's check `if (isCentralPath(pathname))`, which redirects to the apex domain, can never run. Line 364 already returns for every central path, on any host.
- **Why it matters:** On `acme.example.com`, a signed-out visitor is redirected to `/login` (line 668). That request matches the central-path check at line 364, which serves the generic platform sign-in. The user never sees the workspace's own `/acme/login` page or its branding. The intended redirect to the apex domain never happens either.
- **Recommendation:** Decide which login a subdomain should show. Then either handle subdomain hosts before line 364, or delete the dead branch and redirect to the tenant login path.
- **Minimal fix:**

```ts
// before the central-path block (line 364)
const subdomainSlug = SUBDOMAIN_ROUTING_AVAILABLE ? tenantLabelFromHost(hostHeader) : null;
if (subdomainSlug && isCentralPath(pathname)) {
  return withSessionCookies(
    NextResponse.redirect(new URL(`${pathname}${url.search}`, `${url.protocol}//${process.env.NEXT_PUBLIC_APP_DOMAIN}`)),
    response,
  );
}
```

- **RISK-004** · `src/app/(auth)/reset-password/page.tsx:157`
- **What is wrong:** The link-handling effect depends on `searchParams`. The effect calls `history.replaceState` to strip `?code=`. In this Next.js version, `replaceState` updates `useSearchParams`, so the effect runs a second time. The effect also has no "unmounted" guard, unlike the tenant page.
- **Why it matters:** Every valid link calls `getSession` and `checkPasswordAccessAction` twice, and the access check signs revoked users out. In development, Strict Mode exchanges the same code twice. The second exchange fails and shows "link expired" even though the first one worked.
- **Recommendation:** Read the URL once on mount from `window.location`, run the effect with `[]`, and add a `cancelled` flag.
- **Minimal fix:**

```tsx
useEffect(() => {
  let cancelled = false;
  const search = new URLSearchParams(window.location.search);
  // ...use `search` instead of `searchParams`; check `cancelled` before each setState
  return () => { cancelled = true; };
}, []);
```

- **RISK-005** · `src/features/tickets/components/ticket-detail-view.tsx:489`
- **What is wrong:** `lastFromOther` is true for every new message from someone else that has no attachments row yet. That covers every plain-text message. Each one triggers a full `router.refresh()` 1.5 seconds later.
- **Why it matters:** The refresh is meant to fetch files that arrive just after a message. Most messages have no files, so most of these refreshes re-render the whole ticket page on the server for nothing. A busy ticket refreshes once per incoming reply.
- **Recommendation:** Refresh only when an attachments row shows up. Listen for `attachments` INSERT for this ticket, or have the realtime message carry a "has files" flag.
- **Minimal fix:**

```ts
// only when the message is known to carry files
const lastFromOther = !!lastMessage && lastMessage.has_attachments && /* existing checks */;
```

- **RISK-006** · `src/app/(app)/[tenantSlug]/payment/success/page.tsx:1`, `payment/cancel/page.tsx:1`, `src/app/(auth)/reset-password/page.tsx:1`, `src/app/(app)/[tenantSlug]/reset-password/page.tsx:1`
- **What is wrong:** These route files are `"use client"` at the page level. A client page cannot export `metadata`.
- **Why it matters:** The browser tab and history show only the platform name, so "Payment Successful" and "Set your password" tabs look the same as every other page. The whole page, including static text, ships as JavaScript and renders only after hydration.
- **Recommendation:** Make each `page.tsx` a Server Component that exports `metadata`, and move the interactive part into a client child component.
- **Minimal fix:**

```tsx
// payment/success/page.tsx
import type { Metadata } from "next";
import { PaymentSuccess } from "@/features/billing/components/payment-success"; // the current body, "use client"
export const metadata: Metadata = { title: "Payment confirmation" };
export default function Page() { return <PaymentSuccess />; }
```

- **RISK-007** · `src/app/(app)/[tenantSlug]/payment/success/page.tsx:133`
- **What is wrong:** The 5-second auto-redirect to the billing page also runs when the payment could not be verified.
- **Why it matters:** A buyer whose payment was charged but not confirmed sees "Payment Not Confirmed" for 5 seconds, then the page moves away. The order ID they need for a support request goes with it. The button also reads "Go to Account & Billing Immediately", which makes no sense when the page leaves on its own anyway.
- **Recommendation:** Auto-redirect only on success. Keep the unverified state on screen until the user acts.
- **Minimal fix:**

```ts
useEffect(() => {
  if (checking || rateApprovalUrl || unverified) return;
  // ...existing countdown
}, [checking, countdown, rateApprovalUrl, unverified, router, targetRedirectUrl]);
```

- **RISK-008** · `src/features/billing/billing-actions.ts:37,57,111,159`, `src/features/billing/services/billing.service.ts:204,320,409`, `src/features/auth/services/auth.service.ts:438`, `src/features/tickets/actions/tickets.actions.ts:454` (and 7 more action files)
- **What is wrong:** Many `catch` blocks send `error.message` straight to the browser. The ticket services sanitize their own errors with `fail()`, but these catch blocks also catch errors from libraries, `fetch`, and Supabase.
- **Why it matters:** Users see raw text like "Edge Function returned a non-2xx status code" or "fetch failed" on a payment screen. Internal messages can also reveal function names, column names, or provider details.
- **Recommendation:** Return a fixed message from `catch`, and log the real error on the server.
- **Minimal fix:**

```ts
} catch (error) {
  console.error("[confirmOrderPaymentAction]", error);
  return { success: false, error: "We couldn't confirm the payment. Check your billing page." };
}
```

---

## 🏗️ 3. Architectural & Cross-File Findings

- **RISK-009** (Medium: this duplication caused RISK-001 and RISK-004) · Affected files: `src/app/(auth)/reset-password/page.tsx`, `src/app/(app)/[tenantSlug]/reset-password/page.tsx`, `src/features/auth/services/auth.service.ts` (`updatePassword`, `updatePasswordForTenant`)
- **What is wrong:** The two reset-password pages each carry their own copy of about 150 lines of link handling: error params, code exchange, hash tokens, session check, and access check. The two server functions behind them also copy each other. The copies have drifted. Only the tenant version checks the link `type`, guards against unmount, signs out after saving, catches thrown errors, and maps Supabase errors to friendly text.
- **Why it matters:** Each fix went into only one copy. RISK-001 and RISK-004 are fixes that the tenant page has and the central page lacks.
- **Recommendation:** Move the link handling into one hook (for example `useEmailLinkSession`) and the update into one service function with an optional `tenantSlug`. Both pages then render only their own UI.

- **RISK-010** · Affected files: `src/features/tickets/types/tickets.types.ts:5`, `src/features/customers/types/customers.ts:11`, `src/features/onboarding/services/onboarding.service.ts:30`, `src/features/onboarding/components/organization.tsx:48`, `src/features/onboarding/components/business-hours.tsx:19`
- **What is wrong:** `TicketStatus` is defined twice. One copy is a hand-written union and the other comes from the database enum. `Timezone` is defined three times with three different shapes.
- **Why it matters:** If a ticket status is added in the database, the customers types pick it up but the ticket types do not. TypeScript then won't catch tickets code that doesn't handle it. The three `Timezone` shapes force casts wherever data moves between them.
- **Recommendation:** Derive `TicketStatus` from `Database["public"]["Enums"]["ticket_status"]` in one place. Keep one `Timezone` type in the onboarding service and import it.

- **RISK-011** · Affected files: `src/features/billing/billing-actions.ts` (7 `await import(...)` calls)
- **What is wrong:** The billing actions load their own services with dynamic `await import()`. Every other actions file uses normal static imports.
- **Why it matters:** A dynamic import on the server saves nothing here, and a broken import path fails only when a customer clicks "Pay" instead of at build time. The odd pattern also makes the file harder to follow.
- **Recommendation:** Switch to static imports at the top of the file.

---

## 🧪 4. Required Test Cases

| Risk ID  | What the test does | What it should prove |
| -------- | ------------------ | -------------------- |
| RISK-001 | Open `/reset-password` with a valid recovery link, set a new password, then open `/login`. | The sign-in form shows. The user is not redirected to the dashboard, and `supabase.auth.getSession()` returns `null`. |
| RISK-001 | Use an invite link on the central page, set the first password, then sign in with it. | The membership moves from "invited" to "active", the same as the tenant page. |
| RISK-001 | Make `updatePasswordAction` reject (simulate the network going offline) and submit the form. | The form stays on screen with a retry message. The error boundary does not appear. |
| RISK-001 | Call `updatePassword` when Supabase returns an error. | The returned message is the friendly mapped text, not Supabase's raw `error.message`. |

---

## 🏁 5. Verdict

**NEEDS ATTENTION.** The codebase is in good shape. RLS, upload checks, CSP, redirect safety, and the tenant isolation in the proxy are all careful and well commented. The real problems sit in a few places where code was copied and then drifted, and in some realtime listeners that do more work than they need. Fix RISK-001 first: the central password reset leaves the email-link session signed in.

---

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                    | File                                                       | Completed | Reason if Not Completed |
| -------- | -------- | ------------------------------------------- | ---------------------------------------------------------- | --------- | ----------------------- |
| RISK-001 | High     | Password reset leaves link session signed in | `src/features/auth/services/auth.service.ts`               | Yes       | —                       |
| RISK-002 | Medium   | Any tenant's SLA delete refreshes all queues | `src/hooks/use-realtime-tickets-refresh.ts`                | Yes       | —                       |
| RISK-003 | Medium   | Dead subdomain redirect; generic login shown | `src/proxy.ts`                                             | Yes       | —                       |
| RISK-004 | Medium   | Reset link effect runs twice                 | `src/app/(auth)/reset-password/page.tsx`                   | Yes       | —                       |
| RISK-005 | Medium   | Full page refresh on every incoming message  | `src/features/tickets/components/ticket-detail-view.tsx`   | Yes       | —                       |
| RISK-006 | Medium   | Client-only pages cannot set metadata        | `src/app/(app)/[tenantSlug]/payment/success/page.tsx`      | Yes       | —                       |
| RISK-007 | Medium   | Payment failure screen auto-redirects away   | `src/app/(app)/[tenantSlug]/payment/success/page.tsx`      | Yes       | —                       |
| RISK-008 | Medium   | Raw error messages returned to browser       | `src/features/billing/billing-actions.ts`                  | Yes       | —                       |
| RISK-009 | Medium   | Duplicated, drifted reset-password logic     | `src/app/(auth)/reset-password/page.tsx`                   | Yes       | —                       |
| RISK-010 | Low      | TicketStatus and Timezone types duplicated   | `src/features/tickets/types/tickets.types.ts`              | Yes       | —                       |
| RISK-011 | Low      | Needless dynamic imports in billing actions  | `src/features/billing/billing-actions.ts`                  | Yes       | —                       |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
