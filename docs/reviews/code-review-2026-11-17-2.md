# Code Review Report

- **Date:** 2026-11-17
- **Reviewer:** Claude Code (automated review)
- **Scope:** `src/` (app, components, config, features, hooks, lib, types), `scripts/ci`, `.env.example` · 497 files
- **Verdict:** NEEDS ATTENTION

---

## How this was checked

- **Whole codebase (497 source files):** `tsc --noEmit`, ESLint and the Vitest suite. Pattern scans for `any`, `as unknown as`, `dangerouslySetInnerHTML`, raw `<img>`, server secrets in client files, `useEffect` data fetching, and routes without `loading.tsx` / `error.tsx`.
- **Read line by line:** everything not yet committed on `feat/support-requests-dynamic-roles`. That is the new `src/features/chatbot/` (34 files) plus the changes to the portal, `rate-limit.ts`, `server-env.ts`, `globals.css`, `.env.example` and `scripts/ci/sync-env*`.
- **Already reviewed today:** the committed code was reviewed in `code-review-2026-11-17.md`. Its findings are not repeated here. Their status is listed under "Earlier findings" below.
- **Results:** `tsc` passes, ESLint passes, and Vitest fails 1 of 166 tests (RISK-003).
- **Claude API usage** in `providers/anthropic.ts` was checked against the current API for `claude-sonnet-5-5` and `claude-haiku-5-5`. That covers `effort: "low"`, the server-side fallback beta used only on models that accept it, strict tools, the system-prompt cache breakpoint, and thinking blocks sent back unchanged within a turn. It is correct, and there are no findings there.

---

## ⚡ 1. High-Risk Issues (Bugs, Security Leaks, Broken Logic)

### RISK-001 · `src/features/chatbot/schemas/chatbot.schema.ts:20`

- **What is wrong:** The 2,000-character cap applies to every turn in the transcript, including the assistant's own replies. The widget only checks the customer's message before sending.
- **Why it matters:** One assistant reply over 2,000 characters breaks the chat. A table of five requests or a long how-to answer is enough. After that, every new message is refused with "That message is too long." The customer has typed nothing long, so they have no way to fix it. The chat stays broken until that reply drops out of the last 20 turns, or until they close the tab.
- **Recommendation:** Cap only the customer's turns at `CHAT_MESSAGE_MAX`. Give assistant turns a separate, larger cap.
- **Minimal fix:**

```ts
export const CHAT_REPLY_MAX = 20_000; // assistant turns, in chatbot.ts

z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    text: z
      .string()
      .trim()
      .min(1)
      .max(CHAT_MESSAGE_MAX, "That message is too long."),
  }),
  z.object({
    role: z.literal("assistant"),
    text: z.string().trim().min(1).max(CHAT_REPLY_MAX),
  }),
]);
```

Confirmed with a scratch test: `[user "hi", assistant "x" × 2500, user "thanks"]` fails validation.

### RISK-002 · `src/features/chatbot/components/portal-chat-widget.tsx:92`

- **What is wrong:** The saved chat is keyed by workspace (`portal-chat:v2:${slug}`), not by customer. Nothing clears it on sign-out.
- **Why it matters:** On a shared computer, customer A signs out and customer B signs in, in the same tab. When B opens the chat, they see A's conversation. That includes A's request subjects and statuses, the profile card with A's email address, and download links for A's files. The links stay valid for up to 55 minutes.
- **Recommendation:** Put the customer id in the storage key, and remove the key when the customer signs out.
- **Minimal fix:**

```tsx
// portal-shell.tsx
<PortalChatWidget
  slug={tenant.slug}
  customerId={customer.id}
  customerName={customer.fullName}
/>;

// portal-chat-widget.tsx
const storageKey = `portal-chat:v3:${slug}:${customerId}`;

// portal-user-menu.tsx, before signOutAction
try {
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith("portal-chat:"))
    .forEach((k) => sessionStorage.removeItem(k));
} catch {}
```

### RISK-003 · `.env.example:65` · `scripts/ci/sync-env.test.mjs:243`

- **What is wrong:** `ANTHROPIC_API_KEY` and `CHATBOT_MODEL` were removed from `.env.example`. The deploy manifest in `sync-env.mjs` still lists them, and the app still reads them. The comment above still says Anthropic is the default provider.
- **Why it matters:** `npm test` fails ("covers every deployed setting in .env.example"), so CI goes red on this branch. Anyone who sets up from `.env.example` also never sees the key that the default provider needs. Their chat is silently switched off and the widget never shows.
- **Recommendation:** Pick one supported setup and make all three places agree: `.env.example`, `MANIFEST`, and `providers/config.ts`.
- **Minimal fix:** If Anthropic stays the default, put the two lines back:

```bash
# Claude API key, from https://platform.claude.com.
ANTHROPIC_API_KEY=
# Model for the provider. Claude default: claude-sonnet-5-5. Groq default: openai/gpt-oss-120b.
CHATBOT_MODEL=
```

If Anthropic is being dropped instead, remove both entries from `MANIFEST`, and remove the Anthropic branch and comments from `providers/config.ts`.

---

## ⚠️ 2. Medium-Risk Issues (Performance, Anti-patterns, Next.js Violations)

### RISK-004 · `src/features/chatbot/components/chat-markdown.tsx:17`

- **What is wrong:** `isInternal` accepts any link that starts with `/` but not with `//`. A link like `/\evil.example` passes the check. Browsers read a backslash as a slash, so it opens `https://evil.example`.
- **Why it matters:** The model writes links after reading ticket text. A link planted in a ticket can come back in a reply that looks like a portal link. The customer clicks it and leaves the site. That is a phishing route. Today only staff or the customer can write that ticket text, which is why this is Medium and not High.
- **Recommendation:** Reject backslashes and resolve the link against the current origin before calling it internal.
- **Minimal fix:**

```ts
function isInternal(href: string | undefined): href is string {
  if (!href || !href.startsWith("/") || href.includes("\\")) return false;
  try {
    return new URL(href, "https://x.invalid").origin === "https://x.invalid";
  } catch {
    return false;
  }
}
```

### RISK-005 · `src/features/chatbot/actions/chatbot.actions.ts:116`

- **What is wrong:** The burst and daily counters go up before the model is called. Nothing gives the message back when the provider fails.
- **Why it matters:** When the provider is busy or times out, the customer gets an error and still loses one of their 100 daily messages. That happens often on the Groq free tier. Retrying makes it worse. A customer can run out for the day without ever getting an answer.
- **Recommendation:** Count a message only once a reply comes back. Or give one back on `busy`, `timeout` and `unavailable` errors.
- **Minimal fix:** Check the limits with `peekRateLimit` before the call, and call `rateLimit` (which counts the message) only after `runChat` succeeds:

```ts
const day = await peekRateLimit(dayKey(identity.userId));
if (day.count >= CHAT_DAILY_LIMIT) return rateLimitedResult(day.resetAt);
const reply = await runChat({ ... });
await rateLimit(dayKey(identity.userId), { limit: CHAT_DAILY_LIMIT, windowMs: DAY_MS });
```

The burst limit stays where it is, before the call. It is there to stop floods.

### RISK-006 · `src/app/(app)/[tenantSlug]/(base-layout)/support/page.tsx:41`

- **What is wrong:** The workspace Support pages (`support`, `support/requests` and `support/requests/[requestId]`) await their data with no `loading.tsx` and no `<Suspense>`. Earlier RISK-003 covered the platform side of this feature, not these pages.
- **Why it matters:** Nothing appears after a click until the server answers. On a slow connection, the old page stays on screen and the click looks ignored.
- **Recommendation:** Add a `loading.tsx` to `support/`, following the existing `views/loading.tsx` and `reports/loading.tsx`.
- **Minimal fix:** Copy `(base-layout)/views/loading.tsx` to `(base-layout)/support/loading.tsx` and adjust the skeleton to a list layout.

---

## 🏗️ 3. Architectural & Cross-File Findings

### RISK-007 · Affected files: `src/features/chatbot/tools/list-my-tickets.ts`, `get-ticket.ts`, `draft-ticket.ts`

- **What is wrong:** Each tool describes its input twice. There is a hand-written JSON Schema for the model and a separate Zod schema for checking. `draft_ticket` already disagrees with itself: the JSON Schema tells the model "under 80 characters", while the Zod schema allows 200.
- **Why it matters:** A change to one schema and not the other passes review and type checks. Then either the model sends input the tool rejects, or the tool accepts input the model was told it can't send.
- **Recommendation:** Write each tool's input once in Zod and generate the JSON Schema from it with `z.toJSONSchema()`. That is built into Zod 4, which the project already uses.

### RISK-008 · Affected files: `src/features/chatbot/providers/groq.ts:1`, `src/features/chatbot/providers/ollama.ts`

- **What is wrong:** The Groq provider imports `stripThinking` from the Ollama provider.
- **Why it matters:** If Ollama support is removed (a cleanup that has already started in `.env.example`), deleting `ollama.ts` breaks Groq.
- **Recommendation:** Move `stripThinking` into `providers/types.ts` next to the other shared helpers.

### RISK-009 · Affected files: `src/lib/rate-limit.ts:154`

- **What is wrong:** `peekRateLimit` casts the admin client to `SupabaseClient` with `as unknown as`. It does this because `rate_limit_buckets` is missing from the generated table types. The row shape is then typed by hand.
- **Why it matters:** If the table's columns change, this query still compiles and only fails when it runs. And when the read fails, the function falls back to a count of 0, so the usage meter shows a full allowance.
- **Recommendation:** Read the bucket through a small `security definer` SQL function, the way `rate_limit_hit` writes it, so the call is typed. Or add the table to the generated types.

---

## Earlier findings (`code-review-2026-11-17.md`)

These are not renumbered here. Track them in that report's table.

- **RISK-004** (Next.js advisory) is **fixed**. `package.json` now has `next ^16.4.6`.
- RISK-001, RISK-002, RISK-003, RISK-005, RISK-006, RISK-007, RISK-008 and RISK-009 are still open. None of the uncommitted changes touch them.

---

## 🧪 4. Required Test Cases

| Risk ID  | What the test does                                                                                                     | What it should prove                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RISK-001 | Parses `[user, assistant (5,000 chars), user]` with `chatTranscriptSchema`.                                            | A long assistant reply no longer blocks the next message.         |
| RISK-001 | Parses a transcript whose last user turn is 2,001 characters.                                                          | The customer's own cap still holds, with the "too long" message.  |
| RISK-001 | Unit test of `sendChatMessageAction` with a stub provider that returns 3,000 characters, then sends a second message.  | The second message succeeds end to end.                           |
| RISK-002 | Renders the widget as customer A, sends a message, then re-renders as customer B in the same storage. Opens the panel. | B sees only the greeting, nothing from A.                         |
| RISK-002 | E2E: customer A chats, signs out, customer B signs in in the same tab and opens the chat.                              | No `portal-chat:` key from A is left in `sessionStorage`.         |
| RISK-003 | Runs `npx vitest run scripts/ci/sync-env.test.mjs`.                                                                    | The manifest and `.env.example` list the same deployed variables. |
| RISK-003 | `resolveChatbotConfig` with only the variables `.env.example` documents, filled in.                                    | The documented setup gives a working provider, not `null`.        |

---

## 🏁 5. Verdict

**NEEDS ATTENTION.** The codebase type-checks and lints clean. The new chatbot is carefully built: the session supplies the identity for every tool call, the model can't create a request on its own, and the Claude API usage is correct. The risks are in the uncommitted chat work: one long reply breaks the chat, a saved conversation can be shown to the next customer in the same tab, and the env change turned the test suite red. **Fix RISK-001 first.** Any real customer will hit it within a few messages.

---

## 📋 6. Risk Tracking Table

| Risk ID  | Priority | Risk (Short Description)                     | File                                                        | Completed | Reason if Not Completed                                                                  |
| -------- | -------- | -------------------------------------------- | ----------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| RISK-001 | High     | Long assistant reply blocks further messages | `src/features/chatbot/schemas/chatbot.schema.ts`            | Yes       | —                                                                                        |
| RISK-002 | High     | Chat history shown to next customer          | `src/features/chatbot/components/portal-chat-widget.tsx`    | Yes       | —                                                                                        |
| RISK-003 | High     | Env example out of sync; test fails          | `.env.example`                                              | Yes       | —                                                                                        |
| RISK-004 | Medium   | Backslash link escapes internal-link check   | `src/features/chatbot/components/chat-markdown.tsx`         | Yes       | —                                                                                        |
| RISK-005 | Medium   | Failed replies still spend daily allowance   | `src/features/chatbot/actions/chatbot.actions.ts`           | Yes       | —                                                                                        |
| RISK-006 | Medium   | Workspace Support pages lack loading UI      | `src/app/(app)/[tenantSlug]/(base-layout)/support/page.tsx` | Yes       | —                                                                                        |
| RISK-007 | Low      | Tool input schemas written twice, drifting   | `src/features/chatbot/tools/draft-ticket.ts`                | Yes       | Fixed with a schema sync test; z.toJSONSchema adds limits strict tools may reject        |
| RISK-008 | Low      | Groq provider depends on Ollama file         | `src/features/chatbot/providers/groq.ts`                    | Yes       | —                                                                                        |
| RISK-009 | Low      | Untyped cast hides rate-limit read errors    | `src/lib/rate-limit.ts`                                     | Partly    | Row checked at runtime, failures logged; full typing needs database.types.ts regenerated |

> Update the **Completed** column as you fix each item. If a risk will not be fixed, replace `_Pending_` with the reason (for example: "Deferred to Q3 — requires auth refactor" or "Accepted risk — internal admin page only").
