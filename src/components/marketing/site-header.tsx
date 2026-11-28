"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { usePlatformBrand } from "@/components/shared/platform-brand";
import { DEMO_LOGIN_ENABLED } from "@/features/auth/demo-accounts";
import { APP_ROUTES } from "@/lib/routes";

// Every item scrolls to a section on the landing page (src/app/page.tsx).
const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { platformName } = usePlatformBrand();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-base font-bold text-foreground transition-opacity hover:text-foreground hover:opacity-90 sm:text-lg"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent text-sm font-bold text-primary-foreground">
            {platformName.charAt(0).toUpperCase()}
          </span>
          <span className="font-heading tracking-tight">{platformName}</span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-1 text-sm font-medium lg:flex"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {DEMO_LOGIN_ENABLED && (
            <Link
              href={APP_ROUTES.DEMO_LOGIN}
              className="rounded-md px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-brand-accent transition-colors hover:bg-slate-100 hover:text-brand-accent"
            >
              Try demo login
            </Link>
          )}
          <Link
            href={APP_ROUTES.LOGIN}
            className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href={APP_ROUTES.SETUP}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-brand-hover hover:text-primary-foreground"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="-mr-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:ring-2 focus:ring-brand-accent/50 focus:outline-hidden lg:hidden"
          aria-label="Toggle Navigation Menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="space-y-4 border-b border-border bg-white px-4 pt-3 pb-6 animate-in duration-200 slide-in-from-top-2 sm:px-6 lg:hidden">
          <nav
            aria-label="Main"
            className="flex flex-col space-y-1 text-sm font-medium"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2.5 text-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-2.5 border-t border-border pt-3">
            {DEMO_LOGIN_ENABLED && (
              <Link
                href={APP_ROUTES.DEMO_LOGIN}
                onClick={closeMobileMenu}
                className="w-full rounded-lg border border-brand-accent/40 bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand-accent transition-colors hover:bg-muted hover:text-brand-accent"
              >
                Try demo login
              </Link>
            )}
            <Link
              href={APP_ROUTES.LOGIN}
              onClick={closeMobileMenu}
              className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href={APP_ROUTES.SETUP}
              onClick={closeMobileMenu}
              className="w-full rounded-lg bg-brand-accent px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-hover hover:text-primary-foreground"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
