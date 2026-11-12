import type { Metadata } from "next";
import Link from "next/link";
import {
  Ticket,
  ArrowRight,
  CheckCircle2,
  Globe,
  Lock,
  Clock,
  Users,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { APP_ROUTES } from "@/lib/routes";
import { SiteHeader } from "@/components/marketing/site-header";
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

export default async function Home() {
  const { platformName } = await getCachedPlatformSettings();

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col justify-between selection:bg-brand-accent/20 selection:text-brand-accent">
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
        <section className="relative px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 md:pt-24 pb-12 sm:pb-20 max-w-5xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-semibold border border-brand-accent/20 mb-6 max-w-full">
            <Ticket className="w-3.5 h-3.5 text-brand-accent shrink-0" />
            <span className="truncate">
              Help desk for teams that outgrew a shared inbox
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl leading-[1.12]">
            Answer every customer{" "}
            <span className="text-brand-accent inline-block">on time</span>
          </h1>

          <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Ticket queues, SLA targets with breach alerts, a branded customer
            portal and reports, in a workspace of your own.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <Link
              href={APP_ROUTES.SETUP}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-primary-foreground font-medium text-sm sm:text-base transition-all shadow-md hover:shadow-lg w-full sm:w-auto shrink-0"
            >
              <span>Create Your Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-border bg-card text-card-foreground hover:bg-muted font-medium text-sm sm:text-base transition-colors w-full sm:w-auto shrink-0"
            >
              View Plans & Pricing
            </a>
          </div>
        </section>

        <section
          id="highlights"
          className="py-12 sm:py-20 lg:py-24 bg-card border-y border-border"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-10 sm:mb-16">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-semibold border border-brand-accent/20 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Ready on day
                one
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                Keep promises to your customers
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-3">
                <PlatformName /> tracks every request against the targets you
                set, so nothing waits in a queue unnoticed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
              <div className="p-6 sm:p-8 rounded-2xl border border-border bg-muted/40 hover:border-brand-accent/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">
                    SLA targets and breach alerts
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Set first-response and resolution targets for each priority.
                    Every ticket shows the time left, and the team is alerted
                    when a target is missed.
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-border bg-muted/40 hover:border-brand-accent/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">
                    A portal for your customers
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Customers raise requests, reply and follow progress in a
                    portal with your name, logo and colors, and get an email at
                    each update.
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-border bg-muted/40 hover:border-brand-accent/50 transition-all sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">
                    Your data stays yours
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Each workspace is walled off by row-level security in the
                    database, and an automated test suite checks that one
                    workspace can never read or change another&apos;s data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="py-12 sm:py-20 lg:py-24 bg-card border-b border-border"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                Everything a support team uses every day
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-3">
                From the first request to the monthly report.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
              <div className="p-6 sm:p-8 rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                  <Ticket className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg text-foreground mb-2">
                  Ticket queues
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Requests from the portal and from your agents land in one
                  queue. Assign, prioritize, add internal notes and attach
                  files, then save the views your team uses most.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg text-foreground mb-2">
                  A workspace of your own
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Your team and your customers sign in at your workspace&apos;s
                  own web address, with your branding on the customer portal.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors sm:col-span-2 lg:col-span-1">
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-5">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg text-foreground mb-2">
                  Roles and audit log
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Admin, manager, agent and billing roles control who sees and
                  changes what. Sign in with email or Google, and keep an audit
                  log of sensitive changes on Business.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="py-12 sm:py-20 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
        >
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Transparent plans for teams of any size
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-3">
              One monthly price per workspace. Start free, and try any paid plan
              free for 15 days.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
            <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card text-card-foreground flex flex-col justify-between shadow-xs hover:border-brand-accent/30 transition-all">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Free
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  For small teams getting started.
                </p>
                <div className="mt-6 text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  $0
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                    / workspace / mo
                  </span>
                </div>
                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-muted-foreground">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Up to 2 agent seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>50 tickets and 1 GB of files</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Customer portal and one SLA policy</span>
                  </li>
                </ul>
              </div>
              <Link
                href={APP_ROUTES.SETUP}
                className="mt-8 w-full py-3 rounded-xl border border-border bg-muted/60 hover:bg-muted text-xs sm:text-sm font-semibold text-center text-foreground transition-colors block"
              >
                Start free
              </Link>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl border-2 border-brand-accent bg-card text-card-foreground flex flex-col justify-between relative shadow-lg lg:-translate-y-2">
              <div className="absolute -top-3.5 right-6 bg-brand-accent text-primary-foreground text-[10px] font-bold tracking-wider px-3 py-0.5 rounded-full uppercase shadow-xs">
                Most Popular
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Pro
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  For growing teams that need SLAs, shared views and reports.
                </p>
                <div className="mt-6 text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  $29
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                    / workspace / mo
                  </span>
                </div>
                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-muted-foreground">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Up to 15 agent seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Unlimited tickets and 10 GB of files</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Unlimited SLA policies and business hours</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Shared views and your branding on the portal</span>
                  </li>
                </ul>
              </div>
              <Link
                href={APP_ROUTES.SETUP}
                className="mt-8 w-full py-3 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-xs sm:text-sm font-semibold text-center text-primary-foreground transition-colors shadow-xs block"
              >
                Start 15-day free trial
              </Link>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card text-card-foreground flex flex-col justify-between shadow-xs hover:border-brand-accent/30 transition-all">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-accent shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Business
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  For larger teams that need an audit trail and room to grow.
                </p>
                <div className="mt-6 text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  $59
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                    / workspace / mo
                  </span>
                </div>
                <ul className="mt-6 space-y-3 text-xs sm:text-sm text-muted-foreground">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Up to 100 agent seats</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>50 GB of files</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Audit log of sensitive changes</span>
                  </li>
                </ul>
              </div>
              <Link
                href={APP_ROUTES.SETUP}
                className="mt-8 w-full py-3 rounded-xl border border-border bg-muted/60 hover:bg-muted text-xs sm:text-sm font-semibold text-center text-foreground transition-colors block"
              >
                Start 15-day free trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground text-center sm:text-left">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span className="w-5 h-5 rounded bg-brand-accent text-primary-foreground flex items-center justify-center font-bold text-[10px] shrink-0">
              <PlatformInitial />
            </span>
            <span className="tracking-tight">
              <PlatformName /> Platform
            </span>
          </div>
          <p>A reference build, made to demonstrate the product.</p>
          <p>
            © {new Date().getFullYear()} <PlatformName />. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
