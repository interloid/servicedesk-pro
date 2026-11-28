import Link from "next/link";
import { ArrowRight, Droplet, Lock } from "lucide-react";

import { LockedBackdrop } from "@/components/shared/locked-backdrop";
import { Button } from "@/components/ui/button";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

import {
  PORTAL_DOMAIN,
  type TenantBranding,
} from "@/features/branding/branding";
import { BrandingEditor } from "./branding-editor";

/**
 * Made-up branding for the blurred backdrop. A locked workspace's real
 * branding is never passed down: the blur is decoration, and anything under
 * it can still be read (or un-blurred) from dev tools.
 */
const SAMPLE_BRANDING: TenantBranding = {
  name: "Acme Support",
  slug: "acme",
  portalUrl: `acme.${PORTAL_DOMAIN}`,
  logoUrl: null,
  primaryColor: null,
  textColor: null,
  backgroundColor: null,
  showLogoOnPortal: true,
};

interface BrandingLockedProps {
  tenantSlug: string;
  portalOrigin: string;
  /** Only a Tenant Admin can open Plans & pricing; a Manager is told who can. */
  canUpgrade: boolean;
}

/** What a Free tenant sees at /settings/branding: the editor, blurred, under a lock. */
export function BrandingLocked({
  tenantSlug,
  portalOrigin,
  canUpgrade,
}: BrandingLockedProps) {
  return (
    <div className="relative h-full overflow-hidden">
      <LockedBackdrop className="h-full">
        <BrandingEditor
          branding={SAMPLE_BRANDING}
          canEdit={false}
          portalOrigin={portalOrigin}
        />
      </LockedBackdrop>

      <div className="absolute inset-0 flex items-center justify-center bg-background/30 px-4">
        <div className="flex w-full max-w-lg flex-col items-center rounded-xl border border-border bg-card/90 px-6 py-10 text-center shadow-[0_24px_48px_-20px_rgba(15,23,42,0.25)] backdrop-blur-md sm:px-10">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-8 ring-brand-50/50 dark:bg-brand-700/20 dark:text-brand-100 dark:ring-brand-700/10"
          >
            <Lock className="size-7" strokeWidth={1.75} />
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
            <Droplet className="size-3.5" strokeWidth={2} aria-hidden />
            Settings
          </span>
          <h1 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Branding is locked on the Free plan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            {canUpgrade
              ? "Upgrade to Pro to add your logo, colors, and portal address."
              : "Ask a Tenant Admin to upgrade to Pro to customize branding."}
          </p>
          {canUpgrade && (
            <Button
              asChild
              className="mt-6 h-10 gap-2 rounded-lg px-6 font-semibold shadow-none"
            >
              <Link href={tenantPath(tenantSlug, TENANT_ROUTES.ACCOUNT.PLANS)}>
                View plans
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
