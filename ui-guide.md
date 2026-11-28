# UI Improvement Guide: Rules of Engagement

These rules apply to anyone, human or AI agent, doing UI or UX work on this repository. They are not optional.

---

## Rule 0: Read `summary.md` first

**Always read [`summary.md`](summary.md) in full before making any change.** It documents the design tokens, layout shells, reusable components, and the hooks, attributes and strings that look like styling but carry logic. If something you are about to change is not covered there, read the source before touching it.

Also respect `AGENTS.md`: this Next.js version differs from older releases. Check `node_modules/next/dist/docs/` before touching framework files such as `layout.tsx`, `loading.tsx` or `error.tsx`.

---

## Rule 1: UI and UX only (strict)

You may **only** make visual-design, styling, layout, responsiveness, accessibility-presentation and UX-polish improvements.

You must **not** alter:

- **Business logic**: calculations, conditions, role or plan checks, SLA, billing or tenancy rules, `src/lib/tenancy.ts` and `src/proxy.ts`.
- **API and data calls**: Server Actions (`actions/`, `*-actions.ts`), services (`services/`), Supabase clients, route handlers (`route.ts`), Edge Functions, migrations or SQL.
- **State management**: `useState`/`useReducer` shape and transitions, contexts (`NotificationsProvider`, `PlatformBrandProvider`, `SidebarProvider`), `useTransition` usage, optimistic updates and rollbacks, sessionStorage and localStorage keys.
- **Event handlers**: what `onClick`, `onSubmit`, `onChange`, `onKeyDown` and the rest _do_. You may move an element that carries a handler. You may not change, remove or re-wire the handler.
- **Routing and URL state**: `router.push`/`replace`/`refresh` calls, `searchParams` names, `redirect()`/`notFound()` gates, `href` targets, route files and route groups.
- **Validation**: Zod schemas, RHF configuration (`resolver`, `defaultValues`, field names), `maxLength` and limit constants.
- **Realtime, keyboard shortcuts and guards**: `src/hooks/*`, `useUnsavedChangesGuard` wiring, shortcut keys.
- **Security**: CSP (`src/lib/csp.ts`), `next.config.ts` headers, `connection()` in the root layout, `requirePlatformAdmin()` calls.

**Keep all existing functionality 100% intact.** Every button, form, filter, shortcut, dialog, toast, redirect and live update must behave exactly as before.

If an improvement seems to _require_ a logic change, **stop and ask** rather than doing it.

---

## Rule 2: What you _may_ change

- Tailwind classes, spacing, sizing, typography, colour (through tokens), borders, radius, shadows, transitions and motion (with `prefers-reduced-motion` respected).
- JSX **structure for layout purposes**: wrappers, grid/flex arrangement and element order, as long as every element, prop, handler, `ref`, `key`, `id`, `name`, `aria-*`, `role` and `data-*` attribute is preserved.
- Responsive behaviour: breakpoints, stacking, overflow handling, touch-target sizes.
- Empty, loading and skeleton states (visual only). Keep each `loading.tsx` file where it is.
- Presentational copy _only_ where no test or behaviour depends on it (see Rule 5). When in doubt, leave text alone.
- Adding purely presentational components, such as a shared `EmptyState` or `PageHeader`, provided adopting them changes no behaviour.
- `src/app/globals.css` tokens and utilities, provided the existing token names, the `.exporting [data-pdf-*]` rules, `.progress-*`, `.plan-card-current`, the `[data-portal-root]` scrollbar rules and `scrollbar-none` keep working.

---

## Rule 3: Design-system conventions

1. **Use tokens, not raw colours.** Prefer `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-brand-accent`, `text-brand-ink`, `bg-brand-soft`, and `success|warning|info|destructive` with `-soft`/`-strong`. Where a neutral is unavoidable, use **`slate`, never `gray`**.
2. **Portal and chatbot surfaces must use brand tokens only.** They are re-themed per tenant by `BrandTheme`. Hard-coded teal, green or hex breaks tenant branding.
3. **Links on brand-coloured surfaces** must set `text-brand-accent-foreground hover:text-brand-accent-foreground` (or the matching colour). The global `a` and `a:hover` rules otherwise make them invisible.
4. **Control heights**: `h-10` in the staff app and platform console, `h-11` on auth, onboarding and portal forms, `p-2` on menu rows.
5. **Reuse primitives** from `src/components/ui/` and the existing patterns: `modal-notice.tsx` tones (`accent`, `amber`, `neutral`, `danger`), the `TEAM_DIALOG_*`/`TEAM_MODAL_BUTTON*` dialog constants, `platform-ui.tsx` (`PLATFORM_CARD`, `DataTable`…), `Pagination`, `LockedBackdrop`. **Don't invent new popup or notice styles.**
6. **Dates and times**: use the shadcn `Calendar` and `TimePickerPopover`, never native date or time inputs.
7. **Icons**: `lucide-react`. Don't add new icon libraries.
8. **Fonts and assets**: `next/font` only. No external font CDNs, image hosts, CSS `url()` to third parties, or `<script>` tags (CSP will block them and the CSP e2e tests fail).
9. **Dark mode is not active** (nothing sets `.dark`). Don't build features that depend on it. If you add `dark:` variants, keep the light theme pixel-correct first.
10. **Base text size is `text-xs`** in the staff and platform shells. Set explicit sizes on page content.
11. **Charts** (recharts): keep `ResponsiveContainer` parents with a defined height. Prefer `--chart-*` tokens when restyling.
12. **Accessibility**: keep or improve focus-visible rings, contrast (the tokens are contrast-validated, see the comments in `globals.css`), keyboard reachability and labels. Never remove an `aria-*`, `role`, `sr-only` text or `<label htmlFor>`.

---

## Rule 4: Do not touch these logic-carrying hooks

These look like markup or styling but drive behaviour (full table in `summary.md` §4.6):

- `data-portal-root`, `data-portal-fill`, the portal `<footer>` as a **direct child** of the portal root, `main`'s `flex-col` and `pb-20!`.
- `--footer-clearance` and the chat launcher and panel `calc()` offsets.
- `data-pdf-block`, `data-pdf-expand`, `data-pdf-row`, `data-pdf-stack`, `data-pdf-hide` and the grid nesting they target.
- `data-row-select`, `data-view-id`, `ROW_GRID`, `data-no-page-scrollbar`, `data-busy`, `data-selected`, and `data-slot` on primitives.
- `<fieldset disabled>` wrappers (SLA editor). `disabled={!canEdit}`-style props.
- `<Suspense>` boundaries, `key` props used for remounting, `use(promise)` patterns.
- `inert`, `aria-hidden` and the capture-phase blockers in `LockedBackdrop`.
- `<form method="post" noValidate>` in `AuthCard`. The plain `<form method=post>` in `ImpersonationBanner`.
- `relative` on the platform layout root. `onTransitionEnd` and `.progress-*` in `IndeterminateProgress`.
- Components that render `null`: `RoleRouteGuard`, `TokenRoleSync`, `GlobalShortcuts`, `WorkspaceStatusWatcher`, `EmailVerificationHandler`.
- Toast-versus-banner behaviour (`portal-toast.ts`). Never add a toast right before `window.location.assign`.

---

## Rule 5: Preserve test contracts

Playwright e2e tests select by **accessible name, label, placeholder, role and visible text**. Changing them breaks tests even when the UI "looks the same". The full list is in `summary.md` §4.7. Key ones:

- Button and label text such as "New ticket", "Create ticket", "Send to customer", "Internal note", "Add internal note", "Invite member", "Sign in", "Reopen"; placeholders such as "Search this view", "Search your requests…", "Write a reply or attach a file…".
- Headings: the request or ticket subject as the page `h1`; "We couldn't find that page"; "Sign in to your workspace"; exactly one `h1` on the home page.
- `aria-label="Notifications, {n} unread"` with the count in a direct child `span`.
- `/upgrade/i` text only on plan-locked screens.
- Never introduce "Page not found" or "Something went wrong" text on healthy pages.

**Argos visual snapshots will change** when you restyle. That is expected. List the affected screens in your PR so reviewers can approve the diffs.

---

## Rule 6: Workflow checklist

Before you start:

- [ ] Read `summary.md` (and this guide).
- [ ] Open the component **and** its skeleton (`*-skeleton(s).tsx`) and `loading.tsx`. Layout changes must be mirrored in the skeleton.

While you work:

- [ ] Diff only `className`, layout wrappers, presentational markup and CSS.
- [ ] Do not edit files under `actions/`, `services/`, `schemas/`, `lib/` (except purely presentational class-string files such as `styles.ts`, `modal-buttons.ts`, `platform-ui.tsx`), `hooks/`, `proxy.ts`, `config/`, `supabase/`, `route.ts` files, or `CLAUDE.md`/`AGENTS.md`.
- [ ] Check every breakpoint: phone (< 640), tablet (640–1023, where the sidebar is a Sheet below 1024), desktop, and `wide` (≥ 1800).
- [ ] Check the portal with a custom tenant brand colour, not just the default green.

Before you finish:

- [ ] `npm run lint` and `npm run format:check` pass.
- [ ] `npm test` passes (Vitest).
- [ ] If possible, run `npm run test:e2e`. At minimum, re-read the selectors in §4.7 of `summary.md` against your diff.
- [ ] Manually exercise every touched flow: open and close dialogs, submit forms, change filters and pagination, use the shortcuts, confirm toasts and redirects still happen.
- [ ] In the PR description, state "UI-only, no logic changes" and list the screens with expected visual-snapshot diffs.

**When in doubt, don't change it. Ask.**
