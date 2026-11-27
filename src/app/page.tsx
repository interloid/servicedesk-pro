import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Database,
  Flag,
  Globe,
  KeyRound,
  ScrollText,
  Users,
} from "lucide-react";
import { APP_ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { FeatureTabs } from "@/components/marketing/feature-tabs";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import {
  PlatformInitial,
  PlatformName,
} from "@/components/shared/platform-brand";
import { siteConfig } from "@/config/site";
import { getCachedPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";

// Longer than the site-wide description, and limited to what the product does
// today: search results quote this text.
const HOME_DESCRIPTION =
  "Run customer support from one help desk: ticket queues, SLA policies with breach alerts, a branded customer portal and reports. Start free.";

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getCachedPlatformSettings();
  const socialTitle = `${platformName} — help desk for growing support teams`;

  return {
    // A layout's title template only reaches child segments, not its own page.
    title: `Help desk built for teams that outgrew a shared inbox | ${platformName}`,
    description: HOME_DESCRIPTION,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: "/",
      siteName: platformName,
      title: socialTitle,
      description: HOME_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: HOME_DESCRIPTION,
      ...(siteConfig.twitterHandle ? { site: siteConfig.twitterHandle } : {}),
    },
  };
}

/*
 * Every claim on this page is something the product does today (see
 * summary.md and README "Core systems"). Keep it that way when editing copy.
 */

// Product facts, not marketing stats.
const FACTS = [
  { icon: Users, value: "5", label: "roles, from workspace admin to customer" },
  {
    icon: Flag,
    value: "4",
    label: "priority levels, each with its own SLA targets",
  },
  {
    icon: Globe,
    value: "1",
    label: "customer portal and address per workspace",
  },
];

// Small emerald icon tile, shared by the hero facts and the security grid.
const ICON_TILE =
  "flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100";

// The real setup wizard at /setup.
const STEPS = [
  {
    title: "Create your account",
    body: "You become the workspace's first admin.",
  },
  {
    title: "Name your organization",
    body: "Pick the portal address customers will use.",
  },
  {
    title: "Set business hours",
    body: "Working days, opening hours and time zone.",
  },
  {
    title: "Add your first SLA policy",
    body: "First-response and resolution targets per priority.",
  },
  {
    title: "Invite your team",
    body: "Add agents, managers and billing admins.",
  },
];

const SECURITY = [
  {
    icon: Database,
    title: "Row-level security on every table",
    body: "Tenant isolation lives in Postgres, not just in the app. A query can only return rows that belong to the signed-in user's workspace.",
  },
  {
    icon: KeyRound,
    title: "Sessions scoped to one workspace",
    body: "Each sign-in token carries one workspace and one role, and the database policies read those claims on every request.",
  },
  {
    icon: Globe,
    title: "A separate address for each workspace",
    body: "Each workspace and its portal sit on their own subdomain, so customers always know whose help desk they are in.",
  },
  {
    icon: ScrollText,
    title: "An audit trail of changes",
    body: "On the Business plan, the audit log records changes to tickets, team, policies and billing, with who made them and when.",
  },
];

const FAQS = [
  {
    q: "What is a workspace?",
    a: "A workspace is one support organization: its own team, tickets, customers, SLA policies and customer portal, on its own address.",
  },
  {
    q: "How is one workspace's data kept apart from another's?",
    a: "Isolation is enforced in the database. Every workspace table has row-level security policies, so a query can only return rows from the signed-in user's own workspace.",
  },
  {
    q: "How do SLA clocks handle nights, weekends and holidays?",
    a: "Targets count business time only. Set working days, opening hours, holidays and a time zone, and the clock pauses outside them. Agents see a warning before a target is missed.",
  },
  {
    q: "Can we change plans later?",
    a: "Yes. Upgrades apply straight away. Downgrades and cancellations take effect at the end of the current billing period, and paid features stay on until then.",
  },
];

const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const EYEBROW =
  "font-mono text-xs font-medium tracking-wider text-brand-accent uppercase";
const H2 =
  "mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl";
const LEAD = "mt-4 text-base leading-relaxed text-slate-600 sm:text-lg";
const FOOTER_LINK =
  "text-sm text-slate-600 transition-colors hover:text-foreground";

export default async function Home() {
  const { platformName, supportEmail } = await getCachedPlatformSettings();
  // The sample address in the previews, e.g. "ServiceDeskPro" -> servicedeskpro.com.
  const host = `${platformName.toLowerCase().replace(/[^a-z0-9]/g, "") || "servicedesk"}.com`;

  return (
    <div
      data-landing
      className="flex min-h-dvh flex-col justify-between bg-white font-sans text-foreground selection:bg-brand-accent/20 selection:text-brand-accent"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: platformName,
                description: HOME_DESCRIPTION,
                url: siteConfig.url,
              },
              {
                "@type": "SoftwareApplication",
                name: platformName,
                description: HOME_DESCRIPTION,
                url: siteConfig.url,
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
              },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />

      <SiteHeader />

      <main className="flex-1">
        {/* Hero and product preview, on white over a faint dot grid. */}
        <section className="relative isolate overflow-hidden bg-white">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-[46rem]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(15,23,42,0.12) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage:
                "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.6) 45%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.6) 45%, transparent 100%)",
            }}
          />
          <div className={`${CONTAINER} pt-16 pb-14 sm:pt-24 sm:pb-16`}>
            <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className={EYEBROW}>Multi-tenant help desk</p>
                <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
                  Support for every client, each in a workspace of its own.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                  Give each client or business unit its own ticket queue,
                  customer portal and SLA policy. Your agents see what is due
                  next, and every workspace stays isolated from the others.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={APP_ROUTES.SETUP}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-accent px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-hover hover:text-primary-foreground"
                  >
                    Create your workspace
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-foreground transition-colors hover:bg-slate-50 hover:text-foreground"
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  Free plan for small teams. No card needed to set up.
                </p>
              </div>

              <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-4">
                {FACTS.map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 bg-white px-5 py-4"
                  >
                    <span className={`${ICON_TILE} size-9`}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <dt className="w-6 shrink-0 text-2xl font-semibold text-foreground tabular-nums">
                      {value}
                    </dt>
                    <dd className="text-sm leading-snug text-slate-600">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div
            aria-label="Product preview"
            role="region"
            className={`${CONTAINER} pb-20 sm:pb-24`}
          >
            <HeroPreview host={host} />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-border bg-white py-20 sm:py-28"
        >
          <div className={CONTAINER}>
            <div className="mb-10 max-w-2xl sm:mb-12">
              <p className={EYEBROW}>Features</p>
              <h2 className={H2}>
                Queues, portals and access control in one place
              </h2>
              <p className={LEAD}>
                <PlatformName /> covers the work a support team does every day,
                for as many workspaces as you run.
              </p>
            </div>
            <FeatureTabs host={host} />
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-y border-border bg-[#F8FAFC] py-20 sm:py-28"
        >
          <div className={CONTAINER}>
            <div className="mb-12 max-w-2xl">
              <p className={EYEBROW}>How it works</p>
              <h2 className={H2}>From sign-up to a live queue in five steps</h2>
              <p className={LEAD}>
                The setup wizard walks you through everything a workspace needs
                before the first ticket arrives.
              </p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative bg-white p-6">
                  {/* Desktop timeline: a line runs through every step's
                      number badge, from the first to the last. */}
                  {index > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-[2.625rem] left-0 hidden h-px w-6 bg-brand-200 lg:block"
                    />
                  )}
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-[2.625rem] right-0 left-[3.75rem] hidden h-px bg-brand-200 lg:block"
                    />
                  )}
                  <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 tabular-nums ring-1 ring-brand-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 py-20 sm:py-28">
          <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <p className={EYEBROW}>Security</p>
              <h2 className={H2}>Isolation enforced where the data lives</h2>
              <p className={LEAD}>
                Workspaces share the platform, never each other&apos;s data.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:col-span-8">
              {SECURITY.map(({ icon: Icon, title, body }) => (
                <li key={title} className="bg-white p-6">
                  <span className={`${ICON_TILE} size-10`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 border-y border-border bg-[#F8FAFC] py-20 sm:py-28"
        >
          <div className={CONTAINER}>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className={EYEBROW}>Pricing</p>
              <h2 className={H2}>Priced per workspace, not per agent</h2>
              <p className={LEAD}>
                Start free. Move to Pro for business hours and branding, or
                Business for the audit log and advanced roles.
              </p>
            </div>
            <PricingPlans />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
          <div className={`${CONTAINER} grid gap-10 lg:grid-cols-12`}>
            <div className="lg:col-span-4">
              <p className={EYEBROW}>FAQ</p>
              <h2 className={H2}>Common questions</h2>
              {supportEmail && (
                <p className="mt-4 text-base text-slate-600">
                  Something else? Email{" "}
                  <a
                    href={`mailto:${supportEmail}`}
                    className="font-medium text-brand-accent underline-offset-4 hover:underline"
                  >
                    {supportEmail}
                  </a>
                  .
                </p>
              )}
            </div>
            <div className="divide-y divide-border border-y border-border lg:col-span-8">
              {FAQS.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown
                      className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="-mt-1 max-w-2xl pb-5 text-sm leading-relaxed text-slate-600">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className={`${CONTAINER} pb-20 sm:pb-28`}>
          {/* Dark emerald, matching the sign-up page's side panel. The ring
              stands in for a border: the global `* { border-border }` rule
              would override a border-colour class. */}
          <div className="relative isolate flex flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl bg-brand-950 p-8 text-white ring-1 ring-brand-800 sm:p-10 lg:flex-row lg:items-center">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 opacity-60"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
                maskImage: "linear-gradient(to left, black, transparent 70%)",
                WebkitMaskImage:
                  "linear-gradient(to left, black, transparent 70%)",
              }}
            />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Set up your first workspace
              </h2>
              <p className="mt-2 text-base text-brand-100/80">
                It takes a few minutes, and the Free plan has no time limit.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href={APP_ROUTES.SETUP}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50 hover:text-brand-900"
              >
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={APP_ROUTES.LOGIN}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-white/5 px-5 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className={`${CONTAINER} py-12`}>
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-xs font-bold text-primary-foreground">
                  <PlatformInitial />
                </span>
                <span className="font-heading tracking-tight">
                  <PlatformName />
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                A multi-tenant help desk for teams that work to SLAs.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <nav aria-label="Product">
                <p className="text-sm font-semibold text-foreground">Product</p>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a href="#features" className={FOOTER_LINK}>
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className={FOOTER_LINK}>
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#security" className={FOOTER_LINK}>
                      Security
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className={FOOTER_LINK}>
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className={FOOTER_LINK}>
                      FAQ
                    </a>
                  </li>
                </ul>
              </nav>

              <nav aria-label="Account">
                <p className="text-sm font-semibold text-foreground">Account</p>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href={APP_ROUTES.SETUP} className={FOOTER_LINK}>
                      Create a workspace
                    </Link>
                  </li>
                  <li>
                    <Link href={APP_ROUTES.LOGIN} className={FOOTER_LINK}>
                      Sign in
                    </Link>
                  </li>
                  {supportEmail && (
                    <li>
                      <a
                        href={`mailto:${supportEmail}`}
                        className={FOOTER_LINK}
                      >
                        Contact support
                      </a>
                    </li>
                  )}
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-12 border-t border-border pt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} <PlatformName />. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
