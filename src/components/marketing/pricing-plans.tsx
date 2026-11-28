"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2 } from "lucide-react";

import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { PricingComparison } from "./pricing-comparison";

/**
 * Landing page plans with a Monthly / Annual switch. Prices and limits follow
 * the default plans (supabase/schemas/seeds/01_plans_seed.sql); seat limits
 * can be changed in the platform console, so keep this in step if they are.
 *
 * The annual figures are a display calculation (20% off the monthly price).
 * Checkout itself is monthly; see the note in the hand-off before relying on
 * annual pricing in production.
 */

const ANNUAL_DISCOUNT = 0.2;

const PLANS = [
  {
    key: "free",
    name: "Starter Workspace",
    blurb: "For small teams getting started.",
    monthly: 0,
    features: [
      "2 agent seats",
      "Up to 50 tickets",
      "1 SLA policy",
      "Customer portal and email notifications",
      "1 GB file storage",
    ],
    cta: { label: "Start free", href: APP_ROUTES.SETUP },
  },
  {
    key: "pro",
    name: "Pro Operations",
    blurb: "For growing teams that run on SLAs.",
    monthly: 29,
    featured: true,
    features: [
      "15 agent seats",
      "Unlimited tickets",
      "Unlimited SLA policies with business hours",
      "Shared saved views and reports",
      "Portal branding",
      "10 GB file storage",
    ],
    cta: { label: "Get started with Pro", href: APP_ROUTES.SETUP },
  },
  {
    key: "business",
    name: "Business Plan",
    blurb: "For larger teams that need governance.",
    monthly: 59,
    icon: Building2,
    features: [
      "100 agent seats",
      "Everything in Pro",
      "Audit log",
      "Advanced roles",
      "Priority support",
      "50 GB file storage",
    ],
    cta: { label: "Contact sales", href: APP_ROUTES.LOGIN },
  },
];

function money(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function PricingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="flex flex-col items-center gap-10">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1"
      >
        {[
          { value: false, label: "Monthly" },
          { value: true, label: "Annual" },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={annual === option.value}
            onClick={() => setAnnual(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-accent/30",
              annual === option.value
                ? "bg-brand-accent text-brand-accent-foreground shadow-sm"
                : "text-slate-600 hover:text-foreground",
            )}
          >
            {option.label}
            {option.value && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-bold",
                  annual
                    ? "bg-white/20 text-brand-accent-foreground"
                    : "bg-success-soft text-success-strong",
                )}
              >
                Save 20%
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 items-stretch gap-6 lg:max-w-6xl lg:grid-cols-3">
        {PLANS.map((plan) => {
          const perMonth = annual
            ? plan.monthly * (1 - ANNUAL_DISCOUNT)
            : plan.monthly;
          const yearly = perMonth * 12;
          const saving = plan.monthly * 12 - yearly;
          const Icon = plan.icon;

          return (
            <div
              key={plan.key}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 sm:p-8",
                plan.featured
                  ? "border-brand-accent bg-brand-50/30 shadow-[0_16px_40px_-16px_rgba(6,78,59,0.22)] ring-1 ring-brand-accent"
                  : "border-slate-200 bg-card",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-accent px-3 py-0.5 text-[10px] font-bold tracking-wider text-brand-accent-foreground uppercase shadow-xs">
                  Most popular
                </span>
              )}

              <div className="flex items-center gap-2">
                {Icon && (
                  <Icon
                    className="size-4 shrink-0 text-brand-accent"
                    aria-hidden
                  />
                )}
                <h3 className="text-lg font-bold text-foreground">
                  {plan.name}
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                  {money(perMonth)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / month{annual && plan.monthly > 0 ? ", billed yearly" : ""}
                </span>
              </div>
              <p className="mt-1 h-5 text-xs text-muted-foreground">
                {annual && plan.monthly > 0 ? (
                  <>
                    {money(yearly)} per year
                    <span className="ml-1.5 font-semibold text-success-strong">
                      You save {money(saving)}
                    </span>
                  </>
                ) : plan.monthly > 0 ? (
                  "Per workspace, cancel any time"
                ) : (
                  "Free for as long as you like"
                )}
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-brand-accent"
                      aria-hidden
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta.href}
                className={cn(
                  "mt-8 flex h-11 items-center justify-center rounded-[10px] text-sm font-semibold transition-all",
                  plan.featured
                    ? "bg-brand-accent text-brand-accent-foreground hover:bg-brand-hover hover:text-brand-accent-foreground"
                    : "border border-slate-300 bg-card text-foreground hover:bg-slate-50 hover:text-foreground",
                )}
              >
                {plan.cta.label}
              </Link>
            </div>
          );
        })}
      </div>

      <PricingComparison
        plans={PLANS.map((plan) => {
          const perMonth = annual
            ? plan.monthly * (1 - ANNUAL_DISCOUNT)
            : plan.monthly;
          return {
            key: plan.key,
            name: plan.name,
            price: money(perMonth),
            priceNote:
              plan.monthly === 0
                ? "free forever"
                : annual
                  ? "/ mo, billed yearly"
                  : "/ month",
            featured: plan.featured,
            cta: plan.cta,
          };
        })}
      />
    </div>
  );
}
