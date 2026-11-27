"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Inbox } from "lucide-react";

import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";
import { cn } from "@/lib/utils";

/**
 * The header's page links, with the current one marked. Hidden on a phone,
 * where the account menu carries the same links. "Your requests" is only for
 * a signed-in customer; a visitor has none to see.
 */
export function PortalHeaderNav({
  tenantSlug,
  signedIn,
}: {
  tenantSlug: string;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const requests = portalPath(tenantSlug, PORTAL_ROUTES.REQUESTS);
  const help = portalPath(tenantSlug, PORTAL_ROUTES.HELP);

  const links = [
    ...(signedIn
      ? [{ href: requests, label: "Your requests", icon: Inbox }]
      : []),
    { href: help, label: "Help centre", icon: BookOpen },
  ];

  return (
    <nav
      aria-label="Portal"
      className="hidden items-stretch self-stretch sm:flex"
    >
      <ul className="flex items-stretch gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="relative flex items-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // Colours named: globals.css paints every `a` in the brand
                // colour, which is the colour of this bar.
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-accent-foreground/80 transition-colors outline-none",
                  "hover:bg-current/10 hover:text-brand-accent-foreground focus-visible:ring-2 focus-visible:ring-current/60",
                  active && "bg-current/12 text-brand-accent-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-current"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
