# ServiceDesk Pro: Codebase Summary for UI Work

This is the reference map for anyone doing UI, UX, styling or layout work on this repository. Read it, and [`ui-guide.md`](ui-guide.md), before changing anything.

ServiceDesk Pro is a multi-tenant help desk SaaS with three faces:

1. **Staff app** at `/{tenantSlug}/…`, for agents, managers, admins and billing admins.
2. **Customer portal** at `/{tenantSlug}/portal/…`, branded per tenant, with an AI chatbot.
3. **Platform console** at `/platform/…`, for the operators of the whole service.

It also has a public marketing home page (`/`), central auth pages (`/login` and others) and a self-serve onboarding wizard (`/setup`).

> Paths are relative to the repository root. Deeper backend detail (database, billing, email, deployment) is in [`README.md`](README.md).

---

## 1. Tech stack and styling setup

### Framework and runtime

| Area               | Technology                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Next.js 16** App Router, with the **React Compiler** enabled (`reactCompiler: true` in `next.config.ts`)                                                    |
| UI runtime         | React 19.2, TypeScript 5                                                                                                                                      |
| Request middleware | `src/proxy.ts`. Next 16 renamed `middleware.ts` to `proxy.ts`. It handles routing, sessions, the CSP nonce, role gates, maintenance mode and workspace blocks |
| Backend            | Supabase (Postgres with RLS, Auth, Storage, Realtime, Edge Functions)                                                                                         |
| Forms              | React Hook Form 7 with `@hookform/resolvers` and **Zod 4**                                                                                                    |
| Mutations          | **Server Actions** (`"use server"`) returning `{ ok/success, message?, fieldErrors? }`                                                                        |
| Toasts             | `sonner` (`src/components/ui/sonner.tsx`, mounted in `src/app/providers.tsx` at `bottom-right` with `richColors`)                                             |
| Charts             | `recharts` 3                                                                                                                                                  |
| PDF export         | `html-to-image` and `jspdf` (Reports page)                                                                                                                    |
| Markdown           | `react-markdown` and `remark-gfm` (chatbot, with HTML skipped)                                                                                                |
| Dates              | `date-fns` 4, `react-day-picker` 10 (shadcn `Calendar`)                                                                                                       |
| Command list       | `cmdk` (shadcn `Command`)                                                                                                                                     |
| Monitoring         | Sentry (`src/instrumentation*.ts`)                                                                                                                            |
| Tests              | Vitest (logic only), Playwright e2e, **Argos visual snapshots**                                                                                               |

> ⚠️ Per `AGENTS.md`: this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before touching framework-level code, such as `layout.tsx`, `error.tsx`, `loading.tsx` or route conventions.

### CSS framework

- **Tailwind CSS v4**, using CSS-first config. **There is no `tailwind.config.*`.** Theme tokens live in `src/app/globals.css` under `@theme inline`. PostCSS uses `@tailwindcss/postcss` (`postcss.config.mjs`).
- `globals.css` imports `tailwindcss`, `tw-animate-css` (animation utilities for Radix enter/exit) and `shadcn/tailwind.css`.
- **shadcn/ui**: `components.json` sets style `radix-nova`, baseColor `neutral`, CSS variables on and RSC on. Primitives import from the `radix-ui` monopackage. Every primitive sets `data-slot="…"` on its root.
- Class merging uses `cn()` from `src/lib/utils.ts`, which is `twMerge(clsx(...))`. Variants are built with `class-variance-authority` (cva).
- Prettier runs with `prettier-plugin-tailwindcss`, which sorts classes. Run `npm run format`.

### Icon libraries

- **`lucide-react`** is the primary and default icon set (shadcn `iconLibrary: "lucide"`).
- **`react-icons`** is installed but used sparingly: only `src/features/billing/components/billing-dashboard.tsx` uses it, for payment and brand marks. Prefer lucide for anything new.
- Icons inside `Button` default to `size-4`.

### Typography

- Three fonts, loaded with `next/font/google` in `src/app/layout.tsx`, which self-hosts them (so the CSP's `font-src 'self'` holds):
  - **Plus Jakarta Sans** (`--font-jakarta`, exposed as `--font-heading` / `font-heading`): applied to every `h1`–`h4` by a base-layer rule in `globals.css` with `letter-spacing: -0.02em`. A heading's own `tracking-*` or `font-*` class still wins.
  - **Inter** (`--font-sans`): body, controls, forms and navigation.
  - **JetBrains Mono** (`--font-mono`): use `font-mono tabular-nums` for ticket numbers, SLA timers, addresses and figures (applied in the tickets table, ticket detail, SLA card, portal request number, auth showcase and landing page).
- **The staff shell and platform shell set `text-xs` as the base size.** Pages must opt into `text-sm` or larger explicitly.
- Typical page H1: `text-2xl font-bold tracking-tight text-foreground`, sometimes `text-xl sm:text-2xl` and `text-balance`.
- Primitive defaults: Button `text-sm`, Input `text-base md:text-sm`, Badge `text-xs`, CardTitle `text-base font-medium`.

### Colour system (`src/app/globals.css`)

All colours are CSS custom properties exposed to Tailwind as `bg-*`, `text-*`, `border-*` and so on.

| Group       | Tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Default (light)           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Brand       | One teal scale, `--brand-50` … `--brand-950` (Tailwind `bg-brand-50` … `bg-brand-950`), anchored on `#0f766e` (`brand-700`). `--brand-base`, `--brand-accent` and `--primary` = `#0f766e`; `--brand-hover` = `#115e59` (darker, so white text keeps contrast); `--brand-pressed` = `#134e4a`; `--brand-badge` = `#ccfbf1`; `--ring` = `#0d9488`; `--accent`/`--brand-soft` = `#f0fdfa`; deep panels (auth side panel, landing CTA) = `brand-950` `#0b3b36` | teal                      |
| shadcn core | `background #f8fafc`, `foreground #0f172a`, `card #fff`, `popover`, `primary` (= brand-base), `secondary`/`muted #f1f5f9`, `muted-foreground #64748b`, `accent #e7f1f1`, `accent-foreground #0f766e`, `destructive #dc2626`, `border #e2e8f0`, `input #cbd5e1`, `ring #16a34a`                                                                                                                                                                             | slate based               |
| Status      | `success`, `warning`, `info`, `destructive`, each with `-soft`, `-strong` and `-foreground`                                                                                                                                                                                                                                                                                                                                                                | green, amber, indigo, red |
| Note        | `note`, `note-border`, `note-foreground`                                                                                                                                                                                                                                                                                                                                                                                                                   | amber (internal notes)    |
| Charts      | `chart-1…5`, `chart-muted`, `chart-axis`, `chart-opened #4f46e5`, `chart-resolved #0ea5e9`                                                                                                                                                                                                                                                                                                                                                                 | colour-blind validated    |
| Sidebar     | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`                                                                                                                                                                                                                                                                                                                                                     |                           |

- **One brand colour.** Use the brand tokens for every selected state, menu highlight, icon tile, avatar and accent. Use the numbered scale (`brand-50` … `brand-950`) on central screens (landing, auth, platform console). Inside tenant UI use `brand-accent` / `brand-soft` / `brand-ink`, because `BrandTheme` re-points those (not the numbered scale) to a tenant's own colour. Do not add raw `emerald-*`/`green-*` or hex greens. Green stays reserved for status ("Active", "Operational", success).
- **The neutral palette is `slate`.** The README rule is to use `slate`, never `gray`.
- **Radius**: `--radius: 0.625rem`. `rounded-sm/md/lg/xl/3xl/4xl` derive from it, and `rounded-2xl` is fixed at 1rem.
- **Custom breakpoint**: `wide` = 1800px, alongside Tailwind's defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`).
- **Tenant branding** (`src/components/shared/layout/brand-theme.tsx`, `src/features/branding/branding.ts`): a `<style>` tag re-points `--brand-*`, `--primary`, `--ring`, `--accent` and `--sidebar-accent` (plus `--foreground`/`--background` in light mode) to the tenant's hex colours. The values come from `brandPalette()`, the same function the branding editor preview uses. **Anything that uses the brand tokens is automatically tenant-branded. Anything that hard-codes teal or green is not.**

### Themes and dark mode

- `globals.css` defines a full dark palette under `.dark, [data-theme="dark"]` and the custom variant `@custom-variant dark (&:is(.dark *, [data-theme='dark'] *))`.
- **Nothing in the app ever sets `.dark` or `data-theme`.** There is no ThemeProvider and no toggle. `next-themes` is installed but only read by `sonner.tsx` (`useTheme()`), which falls back to `"system"`. **In practice the app is light-only.** `dark:` classes exist but never apply.
- Many components hard-code light colours (`bg-white`, `text-slate-*`), notably the app footer, sidebar, onboarding, toast colours, the keyboard-shortcuts modal and the platform charts.

### Other global CSS utilities (`globals.css`)

- A thin 4px scrollbar on everything. The **portal page** gets a normal 12px scrollbar through `html:has([data-portal-root])`.
- `@utility scrollbar-none`: hides the scrollbar but keeps scrolling.
- `@utility skeleton-pulse` (keyframes `sdp-skeleton`): defined but currently unused. Skeletons use the shadcn `Skeleton` (`animate-pulse`).
- `.progress-track` and `.progress-sweep`, used by `IndeterminateProgress`, with a `prefers-reduced-motion` fallback.
- `.plan-card-current`: the border on the current pricing plan card.
- `.exporting [data-pdf-expand|data-pdf-row|data-pdf-stack]`: the Reports PDF capture layout.
- Base rules: `a { text-primary }` and `a:hover { text-brand-pressed }`. **A link on a brand-coloured surface must set its own text and hover colour**, or it disappears (see the portal header and `back-link.tsx`).
- `button:not(:disabled) { cursor: pointer }`.

### Security constraints that affect styling (`src/lib/csp.ts`, `next.config.ts`)

- `style-src 'self' 'unsafe-inline'`: inline `style={{}}` is allowed.
- `font-src 'self' data:`: **no external font CDNs**. Use `next/font` only.
- `img-src 'self' data: blob: <supabase>`: **no third-party images or CSS `url()`**. `next/image` remote patterns allow only Supabase public storage.
- `script-src` uses a nonce with `strict-dynamic`: **no inline `<script>` and no third-party script tags.** `e2e/*/csp.e2e.ts` and `security.e2e.ts` fail on any CSP violation.
- The root layout calls `await connection()` so every page renders per request with a nonce. **Never remove it.**

---

## 2. Folder structure and page/component hierarchy

```text
src/
  app/                              Routes (keep thin: fetch data, pass props to a feature component)
    layout.tsx                      Root: fonts, PlatformBrandProvider, Providers (Toaster), connection()
    providers.tsx                   Toaster + EmailVerificationHandler
    globals.css                     The whole design system (tokens, utilities)
    page.tsx                        Marketing home (sections #features, #pricing...; JSON-LD)
    error.tsx / global-error.tsx    Root error boundaries (prop: retry)
    not-found.tsx                   Root 404
    blocked/ maintenance/ unauthorized/   Status pages (AuthShell/AuthCard + PlatformStatusCard)
    (auth)/                         login, forgot-password, reset-password, setup (onboarding wizard)
    auth/                           callback, confirm, impersonation/end (route handlers, minimal UI)
    api/                            workspace-status, sentry-test
    (app)/[tenantSlug]/
      login/ forgot-password/ reset-password/   Tenant-branded auth
      payment/success|cancel/       PayPal return pages (countdown redirects)
      account/billing/cancel/
      (base-layout)/                ← STAFF APP (sidebar + header + footer shell)
        layout.tsx                  getShellIdentity → SidebarProvider > TooltipProvider > NotificationsProvider
        tickets/(overview)          TicketsTable
        tickets/[ticketId]          TicketDetailView
        views/                      SavedViewsList
        customers/(overview)        CustomersTable
        customers/[customerId]/     layout (CustomerHeader + CustomerTabs) + page (?tab=overview|tickets)
        sla/(overview) | new | [policyId]   SlaPoliciesPage / SlaEditor
        reports/                    ReportsDashboard | ReportsLocked
        settings/team|branding|notifications|audit
        account/billing|plans       BillingDashboard / PricingCards
        support/ (+ new, requests, requests/[requestId])   Help & Support (platform support requests)
        error.tsx / not-found.tsx   Shell-level boundaries ("We couldn't find that page")
      portal/                       ← CUSTOMER PORTAL (PortalShell, tenant BrandTheme)
        layout.tsx                  getPortalTenant/Identity → PortalShell (+ chat widget)
        page.tsx                    redirect only
        login/ check-email/ password/ welcome/ help/
        requests/(overview)         PortalRequestsList
        requests/new                PortalNewRequestForm (guest + signed-in)
        requests/[requestId]        PortalRequestDetailView (chat-style thread, data-portal-fill)
        auth/callback/              route handler
        error.tsx / not-found.tsx
    platform/                       ← PLATFORM CONSOLE (requirePlatformAdmin on layout AND every page)
      layout.tsx                    SidebarProvider (--sidebar-width 17rem) > PlatformSidebar + PlatformHeader
      (overview)/ analytics/ health/ logs/ audit-logs/ tenants/(list) tenants/[id]/in-person-view
      users/ billing/ plans/ roles/ settings/
      billing/invoices/[invoiceId]/route.ts   PDF route
  components/
    ui/                             shadcn primitives (customised, see §3)
    shared/                         Cross-feature components
      layout/                       App shell: app-sidebar, app-header, app-footer, header-search,
                                    notification-menu, profile-menu, impersonation-banner, brand-theme,
                                    global-shortcuts, role-route-guard, token-role-sync
    marketing/site-header.tsx       Public header (mobile menu)
  features/<area>/                  One folder per product area
    components/                     React UI for that area
    actions/ or *-actions.ts        Server Actions
    services/                       Server-only data access (Supabase)
    schemas/ or lib/                Zod schemas, pure helpers
    types/                          TS types
  hooks/                            Shared client hooks (realtime, shortcuts, guards, mobile)
  lib/                              tenancy.ts, routes.ts, identity.ts, csp.ts, format.ts, pagination.ts,
                                    supabase/ clients, impersonation, rate-limit, utils (cn)
  config/                           Validated env + site config
  types/                            Shared TS types (shell-identity, notification, team-members)
  proxy.ts                          Request middleware (Next 16 name)
e2e/                                Playwright specs (public/, signed-in/, support/)
supabase/                           Migrations, schemas, edge functions, authz SQL tests
docs/                               Reviews, security docs
```

**Feature modules:** `audit`, `auth`, `billing`, `branding`, `chatbot`, `customers`, `notifications`, `onboarding`, `platform-admin`, `portal`, `reports`, `roles` (constants only), `saved-view`, `sla-policies`, `support`, `team`, `tenancy`, `tickets`, `users` (actions only).

**Page pattern.** `page.tsx` is a thin async server component. It awaits `params` and `searchParams` (they are Promises in this Next version), runs any role or plan gate (`notFound()` or `redirect()`), fetches data with `Promise.all`, and renders **one** feature component with plain props. A `now` from `serverNow()` is often passed in to avoid hydration drift. Nearly every route has a `loading.tsx` that renders the feature's skeleton file.

---

## 3. UI components and layout patterns

### 3.1 `src/components/ui/`: shadcn primitives with local customisations

| Component        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**       | cva. Variants: `default` (`bg-(--brand-accent) hover:bg-brand-hover`, brandable), `outline`, `secondary` (both `text-brand-accent`), `ghost`, `destructive` (**soft**: `bg-destructive/10 text-destructive`), `link`. Sizes: `default` h-8, `xs` h-6, `sm` h-7, `lg` **h-11**, `icon` size-8, `icon-xs`, `icon-sm`, `icon-lg` size-9. Base: `rounded-lg text-sm focus-visible:ring-3 active:translate-y-px`. Emits `data-variant`/`data-size` |
| **Badge**        | `h-5 rounded-4xl text-xs`. Variants: `default` (`bg-primary`), `secondary`, `destructive` (soft), `outline`, `ghost`, `link`                                                                                                                                                                                                                                                                                                                  |
| **Input**        | h-8 `rounded-lg`. Feature code usually overrides to h-10 (app) or h-11 (portal/auth)                                                                                                                                                                                                                                                                                                                                                          |
| **Textarea**     | `field-sizing-content min-h-16`                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Select**       | trigger `size` `sm` or `default`                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Card**         | `size` `default` or `sm` (drives `--card-spacing`). `rounded-xl ring-1 ring-foreground/10`. Footer `border-t bg-muted/50`. _Hand-rolled cards are more common than this primitive_                                                                                                                                                                                                                                                            |
| **Dialog**       | `sm:max-w-sm rounded-xl p-4`. Overlay `bg-black/10 backdrop-blur-xs`. `showCloseButton` prop                                                                                                                                                                                                                                                                                                                                                  |
| **AlertDialog**  | `size` prop, full-bleed bordered footer, `AlertDialogMedia` slot                                                                                                                                                                                                                                                                                                                                                                              |
| **Sheet**        | `side`, `showCloseButton`. `w-3/4 sm:max-w-sm`. Used for the new-ticket form and the mobile sidebar                                                                                                                                                                                                                                                                                                                                           |
| **Sidebar**      | stock shadcn, plus SidebarTrigger accepts `icon`. Mobile breakpoint is **< 1024px** (`src/hooks/use-mobile.ts`), where it renders as a left Sheet. Cookie `sidebar_state`, Ctrl/Cmd+B                                                                                                                                                                                                                                                         |
| **Popover**      | `w-72 rounded-lg p-2.5`, `collisionPadding` prop                                                                                                                                                                                                                                                                                                                                                                                              |
| **DropdownMenu** | item `variant` `default` or `destructive`, `data-inset`                                                                                                                                                                                                                                                                                                                                                                                       |
| **Table**        | wrapped in `data-slot="table-container"` (`overflow-x-auto`). Head h-10 px-2, cell p-2, `whitespace-nowrap`                                                                                                                                                                                                                                                                                                                                   |
| **Calendar**     | react-day-picker, `buttonVariant` prop                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Avatar**       | `size` `sm`, `default` or `lg`. AvatarBadge, AvatarGroup                                                                                                                                                                                                                                                                                                                                                                                      |
| **Custom**       | `indeterminate-progress.tsx` (relies on `.progress-*` CSS and `onTransitionEnd` to unmount), `password-input.tsx` (eye toggle), `input-group.tsx` (addons, focus via `has-[[data-slot=input-group-control]]`)                                                                                                                                                                                                                                 |
| Others           | alert, checkbox, command, form (RHF bindings that set `aria-invalid`), label, progress, radio-group (brand-accent), separator, skeleton, sonner (hard-coded light toast colours), switch, tooltip                                                                                                                                                                                                                                             |

### 3.2 `src/components/shared/`: cross-feature UI

- **modal-notice.tsx**: the in-dialog notice box. Tones: **`accent` | `amber` | `neutral` | `danger`**. With a title it renders a size-9 icon tile. **Reuse it; don't invent new notice styles.**
- **unsaved-changes-dialog.tsx**: "Leave without saving?" dialog (`open`, `onStay`, `onLeave`).
- **pagination.tsx**: `page`, `pageCount`, `label`, plus **either** `hrefFor` (links) **or** `onChange` (buttons). The window comes from `pageWindow()` in `src/lib/pagination.ts`.
- **locked-backdrop.tsx**: plan-locked blur (`inert`, `aria-hidden`, `pointer-events-none`, blur, about 14 capture-phase event blockers).
- **page-loader.tsx** and **loading-spinner.tsx** (lucide `Loader2`), **person-avatar.tsx**, **back-link.tsx** (`text-brand-ink`), **character-count.tsx** (shows at ≥90%, `aria-live`), **mention-text.tsx** and **linkified-text.tsx** (safe links), **profile-modal.tsx** (RHF + avatar upload), **keyboard-shortcuts-modal.tsx**, **platform-brand.tsx** (context: `platformName`, `supportEmail`), **email-verification-handler.tsx**.

**Shared dialog styling constants:** `src/features/team/components/modal-buttons.ts` exports `TEAM_DIALOG_CONTENT`, `TEAM_DIALOG_TITLE`, `TEAM_DIALOG_FOOTER` and `TEAM_MODAL_BUTTON*` (content p-5, title text-lg semibold, full-bleed footer, h-10 buttons). They are reused by the unsaved-changes dialog and the platform dialogs. Billing has a similar `modal-buttons.ts`.

### 3.3 Staff app shell (`(base-layout)/layout.tsx`)

```
SidebarProvider > TooltipProvider(delay 0) > NotificationsProvider(userId)
  RoleRouteGuard · WorkspaceStatusWatcher · TokenRoleSync · GlobalShortcuts   (render null)
  div.flex.h-screen.overflow-hidden.bg-background.text-xs.text-slate-800
    AppSidebar (collapsible="icon")
    div.flex-1.flex-col.min-w-0
      ImpersonationBanner?  (amber role=status strip, plain <form method=post>)
      AppHeader             (sticky h-15, bg-background/95 backdrop-blur, search + bell + profile)
      main.flex-1.overflow-y-auto.p-0   ← pages add their own padding
      AppFooter             (static strip, hard-coded bg-white)
```

- **AppSidebar** has groups Main, SETTINGS and ACCOUNT. Items are `h-10 rounded-md text-sm text-slate-600`; the active item is `bg-slate-100/80 font-semibold text-slate-900`. A Lock icon marks items not on the plan. An item is visible only when `item.roles.includes(role) && SHIPPED_TENANT_ROUTES.has(href)` (`src/lib/tenancy.ts`), so Knowledge base, Macros, Channels and the like are hidden today. On mobile, clicking a link calls `setOpenMobile(false)`.
- **HeaderSearch** is a Popover plus an InputGroup with ARIA combobox. It debounces 200ms into `searchTicketsAction`, discards stale responses with `requestRef`, supports ↑/↓/Enter/Esc and the `/` shortcut, and navigates through `confirmNavigation`. On mobile it lives in a Popover.
- **NotificationMenu**: the bell's `aria-label` is `"Notifications, {n} unread"` with a badge `> span` (visual tests target this). It has a two-step clear-all, and opening an item marks it read and navigates.
- **ProfileMenu**: Profile settings, Keyboard shortcuts, Sign out (`useLogout`).

**Common page scaffold (staff):**

```
div.h-full.overflow-y-auto.p-4.sm:p-6.lg:p-8.text-slate-900
  div.mx-auto.flex.w-full.flex-col.gap-6   (or max-w-7xl)
    header: h1.text-2xl.font-bold.tracking-tight + p.text-sm.text-muted-foreground + actions
    card(s): rounded-xl border border-slate-200 bg-white shadow-sm  |  rounded-2xl border bg-card p-5 shadow-xs
```

- **Tables**: TableHead overridden to `px-4 text-left font-bold text-slate-500`. Sticky header: `sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_var(--color-slate-200)]`. Tables must stay real `<table>` elements inside `<main>`, because visual tests mask `main table tbody`.
- **Empty states** are defined locally per feature: `flex flex-col items-center px-5 py-16 text-center`, an icon circle `size-14 rounded-full bg-brand-accent/10 text-brand-accent ring-8 ring-brand-accent/5`, a `text-base font-bold` title, and a `text-sm text-muted-foreground max-w-sm` body.
- **Plan-locked screens** (`reports-locked`, `branding-locked`, `audit-locked`): sample UI inside `LockedBackdrop` with an upgrade card on top.
- **Control sizes (README rule):** `h-10` in the app, `h-11` on auth, onboarding and portal, `p-2` on menu rows.

### 3.4 Customer portal shell (`src/features/portal/components/portal-shell.tsx`)

```
div[data-portal-root].group/portal.flex.min-h-dvh.flex-col  (has-data-portal-fill:h-dvh)
  header  sticky z-40 bg-brand-accent text-brand-accent-foreground   (logo, "Help centre", user menu)
  main    flex flex-col overflow-auto  pb-2.5!  (phones with chat: pb-20!)
  footer  bg-slate-900 (deliberately unbranded), a DIRECT child of the root
  PortalChatWidget (signed-in customers, when the chatbot is enabled)
```

- Helpers: `PortalCentered` (uses `my-auto`, not `justify-center`, on purpose), `PortalCard` (`max-w-120`), `PortalSplit` (centred `max-w-md` card for sign-in and check-email).
- **Every portal input and button is `h-11`.** Fields: `h-11 rounded-lg bg-background/60 text-sm`. Outline hover: `hover:bg-brand-accent/10 hover:text-brand-accent`.
- **Brand tokens only** in the portal and chatbot (`bg-brand-accent`, `text-brand-ink`, `bg-brand-soft`, `bg-card`, `bg-background`). Never hard-code teal or hex.
- **The request thread page** sets `data-portal-fill`, which gives a full-height chat-window layout. The footer hides on mobile and `useLayoutEffect` pins the thread to the bottom.
- **Chatbot widget** (`src/features/chatbot/components/`): the launcher is `fixed right-4 bottom-[calc(1rem+var(--footer-clearance))] z-50`. `useFooterClearance()` measures `[data-portal-root] > footer` and writes `--footer-clearance`. The panel is full screen on phones and a floating `role="dialog"` from `sm` up (with an `expanded` width of 56rem). The launcher is hidden on the request thread page.

### 3.5 Platform console shell (`src/app/platform/layout.tsx`)

- `SidebarProvider` with `--sidebar-width: 17rem`. The root div **must keep `relative`**. `<main>` has `has-data-no-page-scrollbar:scrollbar-none`.
- `PlatformSidebar` (nav from `PLATFORM_NAV`) and `PlatformHeader` (breadcrumbs derived from `PLATFORM_NAV`, profile menu).
- **Primitives** in `src/features/platform-admin/components/platform-ui.tsx`:
  - class constants: `PLATFORM_BUTTON` (`h-10 rounded-lg px-4 font-semibold`), `PLATFORM_CARD` (`rounded-[14px] border bg-card shadow-xs`), `PLATFORM_TOOLBAR`, `PLATFORM_SEARCH`, `PLATFORM_STAT_GRID`;
  - components: `PlatformPageHeader`, `SearchField`, `PlatformFilterBar`, `FilterSelect`, `FilterTabs`, `TablePaginationFooter`, `DataTable<T>` (column config).
- Other shared pieces: `StatCard`, `ToneBadge` with `BADGE_TONES` (green/blue/teal/violet/amber/red/muted), `SimpleTable` plus `useTablePagination` (page sizes 10/25/50, in memory), `RefreshButton`, `ManagementNotice`, `PlatformStatusCard` (also used on `/blocked`, `/maintenance` and `/setup`).
- **Charts** (`api-traffic-chart`, `monthly-bar-chart`, `overview-dashboard`) hard-code hex colours. `ResponsiveContainer` needs a parent with a set height.
- `platform-skeletons.tsx` holds one skeleton per page. Keep them in step with layout changes.

### 3.6 Auth, onboarding, marketing

- **AuthShell / AuthCard** (`src/features/auth/components/auth-card.tsx`): a centred `<main>` with the logo. `AuthCard` is `<form method="post" noValidate>`. **Keep `method="post"`**, so a submit before hydration never puts the password in the URL.
- **Onboarding** (`src/features/onboarding/`): a 5-step wizard with `StepperHeader`, each step its own RHF+Zod form, a `TimePickerPopover` (scrolls to `[data-selected="true"]` and blocks wheel/touch in the capture phase), and an `OnboardingLoader` overlay. The card is sized `max-h-[calc(100dvh-9rem)]` with an inner scroll. It hard-codes `bg-white`, `slate` and `teal-700` (styling debt).
- **Marketing** (`src/app/page.tsx` plus `src/components/marketing/`: `site-header.tsx`, `hero-preview.tsx`, `feature-tabs.tsx`, `pricing-plans.tsx`): sticky header with a mobile toggle (`aria-label="Toggle Navigation Menu"`, `aria-expanded`). Sections: hero, product preview, `#features`, `#how-it-works`, `#security`, `#pricing`, `#faq`. Every menu and footer link points to one of these anchors or to `/setup`, `/login` or the support mailto; smooth scrolling comes from `html:has([data-landing])` in `globals.css`. The page must keep exactly **one `h1`**, and a banner link matching "Log in" or "Sign in" that goes to `/login`. Copy must stay limited to what the product does today. A new top-level route such as `/docs` is **not** a UI change: the proxy would read it as a workspace slug (it needs `RESERVED_LABELS` / `CENTRAL_PATHS` in `src/lib/tenancy.ts` plus a migration).

### 3.7 Modal, sheet and popup inventory

| Area        | Component                                                                                                                                           | Kind                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Tickets     | `create-ticket-sheet.tsx` (SheetTitle "New ticket"), `priority-confirm-dialog.tsx`                                                                  | Sheet, AlertDialog   |
| Saved views | `create-saved-view-dialog.tsx`, `delete-saved-view-dialog.tsx`                                                                                      | Dialog               |
| Customers   | `invite-customer-modal.tsx`, `customer-access.tsx`                                                                                                  | Dialog, DropdownMenu |
| Team        | `invite-member-modal.tsx`, `change-role-modal.tsx`, `remove-member-modal.tsx`, `permission-matrix-modal.tsx`                                        | Dialog               |
| SLA         | `business-hours-dialogs.tsx`, leave-guard AlertDialog in `sla-editor.tsx`                                                                           | Dialog, AlertDialog  |
| Billing     | `invoice-model.tsx`, `downgrade-dialog.tsx`, `cancel-subscription.tsx`, plan-details dialog                                                         | Dialog, AlertDialog  |
| Audit       | `audit-event-details.tsx`, `audit-date-range-picker.tsx`                                                                                            | Dialog, Popover      |
| Support     | close-request dialog in `support-request-view.tsx`                                                                                                  | Dialog               |
| Portal      | `portal-profile-dialog.tsx`, `portal-password-dialog.tsx`                                                                                           | Dialog               |
| Platform    | `workspace-block-dialog.tsx`, `workspace-lifecycle-dialogs.tsx` (delete/restore/extend trial), `tenant-support-dialog.tsx`, `sign-in-as-button.tsx` | Dialog               |
| Shared      | `profile-modal.tsx`, `keyboard-shortcuts-modal.tsx`, `unsaved-changes-dialog.tsx`                                                                   | Dialog               |

---

## 4. Core functionality and state flow (do not break)

### 4.1 Data and mutation flow

1. A server `page.tsx` fetches through services (`src/features/*/services`, user-scoped Supabase client, RLS) and passes props down.
2. A client component validates with **RHF + Zod** (portal, auth, onboarding, team and customer invites, profile) or plain `useState` and FormData (tickets sheet, SLA editor, branding editor, support form).
3. It calls a **Server Action** inside `useTransition`. The action re-validates and returns `{ ok/success, message, fieldErrors }`.
4. The UI shows the result: sonner toast, inline `<Alert variant="destructive">` banner, or `applyFieldErrors(form, fieldErrors)` (portal). Then it calls `router.refresh()`, `router.push`/`replace`, or relies on `revalidatePath` in the action.
5. **Realtime hooks** in `src/hooks/` call `router.refresh()` (debounced) or patch local state, so other open screens update.

### 4.2 URL is state

Filters, sort, pagination, search, ranges and tabs live in `searchParams`, and are changed with `router.push`/`replace(…, { scroll: false })` inside `startTransition`:

- Tickets: `status`, `priority`, `search`, `view`, `sort`, `sortOrder`, `page`, `limit`, `new=1`
- Customers: `q`, `sort`, `dir`, `page`, `tab`
- Audit, platform logs and platform audit: filters, page, page size
- Reports and platform analytics: `range`
- Portal requests: search (300ms debounce), state, sort, page

Any filter change drops `page`. **Keep these param names and the push/replace logic exactly.**

### 4.3 Hooks (`src/hooks/`)

| Hook                                                     | Role                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `use-realtime-ticket`, `-messages`, `-sla-events`        | ticket detail live updates                                                                                                            |
| `use-realtime-tickets-refresh` + `use-debounced-refresh` | tickets list refresh                                                                                                                  |
| `use-realtime-portal-request`                            | portal thread refresh                                                                                                                 |
| `use-keyboard-shortcut` (`isShortcutBlocked`)            | single-key shortcuts, ignored inside inputs, dialogs and comboboxes                                                                   |
| `use-list-navigation` (`SUGGESTION_ACTIVE_CLASS`)        | ↑/↓ in suggestion lists (@mentions)                                                                                                   |
| `use-unsaved-changes-guard` (`confirmNavigation`)        | blocks navigation with unsaved edits (SLA editor, branding editor, platform settings, header search, notifications, global shortcuts) |
| `use-mobile`                                             | `< 1024px` breakpoint for the Sidebar                                                                                                 |
| `use-mounted`, `use-now`                                 | hydration-safe relative times and clocks                                                                                              |

### 4.4 Contexts and providers

- `PlatformBrandProvider` (root): platform name and support email.
- `NotificationsProvider` (staff shell): `useNotifications()` returns `prefs`, `notifications`, `setRead`, `markAllRead`, `remove`, `clear` and `savePrefs`. It subscribes to the realtime channel and fires a toast for each new notification.
- `SidebarProvider` and `TooltipProvider` (staff and platform shells).
- There is **no global client store** (no Redux or Zustand). State is server props, URL params, local `useState` and these contexts.

### 4.5 Access control (logic, not styling)

- **Roles**: `tenant_admin`, `manager`, `agent`, `billing_admin` (billing and plans only), `customer` (portal only). Platform admins come from an env allow-list.
- **Enforced in layers**: `src/proxy.ts` → `(base-layout)/layout.tsx` (`getShellIdentity`, `isStaffRole`) → page-level gates (`notFound()`) → `RoleRouteGuard` (client backstop) → RLS.
- **Platform**: `requirePlatformAdmin()` runs on the layout **and on every page**.
- **UI gating flags passed as props**: `canManage` (SLA), `canInvite` (customers, team), `canEdit` (branding), `canUpgrade` (locked screens), `canPerformTeamAction` (team rows), `canAssignToSelf` (tickets), plus plan flags (`planIncludesReports`, `planIncludesBranding`, `org.auditLogs`). **Hiding a control is not the same as gating it. Never change these conditions.**

### 4.6 Fragile hooks that look like styling but are logic

| Thing                                                                        | Where                                                         | Why                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `data-portal-root`, `data-portal-fill`, footer as a direct child of the root | portal shell, thread page, skeletons, globals.css             | scrollbar CSS, thread layout, chatbot footer measurement                           |
| `--footer-clearance` calc offsets                                            | chat launcher and panel                                       | keeps the launcher clear of footer and pagination                                  |
| `data-pdf-block`, `-expand`, `-row`, `-stack`, `-hide`                       | reports dashboard                                             | PDF export capture layout (`lib/export-pdf.ts`, `.exporting` CSS)                  |
| `data-row-select`                                                            | tickets table checkbox cell                                   | row-click handler ignores clicks there                                             |
| `data-view-id`, `ROW_GRID`                                                   | saved views list                                              | drag and keyboard reorder use `querySelectorAll`; grid is shared with the skeleton |
| `data-no-page-scrollbar`                                                     | platform logs                                                 | main scrollbar hiding                                                              |
| `data-busy`, `data-checked`, `data-state`, `data-slot`                       | team rows, pickers, primitives                                | Tailwind variants and test selectors                                               |
| `<fieldset disabled>` wrappers                                               | SLA editor                                                    | read-only and in-use locking                                                       |
| `<Suspense>` + `use(promise)`                                                | ticket view tabs, customer layout/page keys, audit view `key` | streaming and remount behaviour                                                    |
| `inert` + capture blockers                                                   | `LockedBackdrop`                                              | stops interaction with locked sample UI                                            |
| `form method="post"`                                                         | AuthCard, impersonation banner                                | works without JS; no password in URL                                               |
| `onTransitionEnd` + `.progress-*`                                            | IndeterminateProgress                                         | otherwise the bar never unmounts                                                   |
| `relative` on platform root                                                  | platform layout                                               | stops the sr-only label making the document scroll                                 |
| `loading.tsx` placement inside route groups                                  | e.g. `portal/requests/(overview)/loading.tsx`                 | moving it up flashes the wrong skeleton                                            |
| `redirecting` flag                                                           | `billing/hooks/use-payment-redirect.ts`                       | keeps buttons disabled during the PayPal redirect                                  |
| Toast-versus-banner policy                                                   | `portal/portal-toast.ts`                                      | no toast for errors already in a banner; no toast before `window.location.assign`  |

### 4.7 Strings and selectors tests depend on (do not reword)

- **Tickets**: button "New ticket"; dialog named "New ticket"; label `/^Subject/`; combobox `/Requester/`; "Search customers"; button "Create ticket"; placeholder "Search this view"; text `/\d+ total tickets/`; ticket subjects as links; detail `h1` = subject; placeholder `/^Write a reply to/`; "Send to customer"; "Internal note"; placeholder `/^Visible to your team only/`; "Add internal note"; combobox "Status" (`Label htmlFor="status"` + `SelectTrigger id="status"`); option "Resolved"; toasts "Ticket resolved." and "Ticket reopened."; button "Reopen".
- **Team**: "Invite member". **Billing**: text `/Invoice|INV-/`.
- **Portal**: "Search your requests…"; label "Subject"; placeholder `/Describe what happened/`; "Create ticket" / "Creating…"; `h1` = subject; "Write a reply or attach a file…"; sr-only "Send reply"; composer clears after send; `aria-label`s "Sort requests", "Requests pages", "Support assistant", "Open/Close support assistant", "Message", "Send", "Dismiss".
- **Auth**: label "Email" (with `aria-invalid` on an empty submit); label "Password" (exact match, only once); button "Sign in"; `/invalid email or password/i`; a `/forgot/i` link; "Sign in to {tenant}"; "Sign in to your workspace".
- **Error screens**: the 404 heading "We couldn't find that page" must appear where expected. "Page not found" and `/something went wrong/i` must **not** appear on healthy pages.
- **Plan locks**: visible `/upgrade/i` text on locked pages only. Don't add "upgrade" wording to unlocked pages.
- **Notifications bell**: `aria-label="Notifications, {n} unread"` with the count in a direct child `span`.
- **Visual snapshots (Argos)**: public pages (`/`, `/login`, `/forgot-password`, `/setup`, `/unauthorized`, `/maintenance`, `/blocked`, tenant login/forgot, portal login) and signed-in pages per role, including the new-ticket sheet (`[role="dialog"][data-slot="sheet-content"]`) and the invite-member dialog. Visual changes **will** produce diffs that need approving. That is expected, not a failure.

### 4.8 Known quirks noticed during the survey (not fixed)

- `src/app/platform/error.tsx` takes `reset`, while the other boundaries use this Next version's `retry` prop.
- `TenantLoginForm`'s "Forgot password?" link goes to the global, not the tenant, forgot-password route.
- The landing page's Annual pricing toggle is display-only: checkout and PayPal plans are monthly.
- Dark-mode tokens exist but are never activated. `skeleton-pulse` is unused.
- Root `error.tsx`, `global-error.tsx` and `not-found.tsx` use raw `<button>`/`<Link>` styling rather than `Button`.
