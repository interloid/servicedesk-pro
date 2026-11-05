import type { CSSProperties, ReactNode } from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatNumber } from "../format";
import { PLAN_FEATURES, type PlatformPlan } from "../types";
import { PLATFORM_CARD } from "./platform-ui";
import { ToneBadge } from "./status-badge";

type Row = {
  key: string;
  label: string;
  enforced: boolean;
  value: (plan: PlatformPlan) => ReactNode;
};

const GROUP_ORDER = ["essentials", "service", "advanced"] as const;

const SLA_ROW: Row = {
  key: "sla_policies",
  label: "SLA policies",
  enforced: true,
  value: (plan) =>
    plan.slaPolicies === -1 ? "Unlimited" : formatNumber(plan.slaPolicies),
};

function rowsOf(group: (typeof GROUP_ORDER)[number]): Row[] {
  const rows = PLAN_FEATURES.filter((feature) => feature.group === group).map(
    (feature): Row => ({
      key: feature.key,
      label: feature.label,
      enforced: feature.enforced,
      value: (plan) => <Included value={plan.features[feature.key]} />,
    }),
  );

  // The first thing plans limit, so it leads the group.
  return group === "service" ? [SLA_ROW, ...rows] : rows;
}

function Included({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
      <Check className="size-4" aria-hidden />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center text-muted-foreground/70">
      <Minus className="size-4" aria-hidden />
      <span className="sr-only">Not included</span>
    </span>
  );
}

/**
 * One line per feature at every width, so plans stay comparable on a phone. Sized
 * by the card, not the screen: the sidebar takes a lot of a tablet's width.
 */
export function PlanComparison({ plans }: { plans: PlatformPlan[] }) {
  const columnStyle = {
    "--plan-column": `${66 / Math.max(plans.length, 1)}%`,
    // Past this a phone scrolls sideways rather than crushing the feature names.
    minWidth: `${5.5 + plans.length * 4}rem`,
  } as CSSProperties;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold text-foreground">
          Feature comparison
        </h2>
        <p className="text-sm text-muted-foreground">
          The app only checks features tagged Enforced; the rest just appear on
          the pricing page. Branding and reports are locked by plan name, and
          ticket and storage limits aren&apos;t enforced.
        </p>
      </div>

      <div className={cn(PLATFORM_CARD, "@container overflow-hidden")}>
        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse text-sm"
            style={columnStyle}
          >
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="p-3 text-left align-bottom text-xs font-bold text-foreground @3xl:px-4 @3xl:text-base"
                >
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className="w-16 border-l border-border px-1 py-2 text-center align-top @lg:w-(--plan-column) @3xl:p-4"
                  >
                    <span className="block truncate text-xs font-bold text-foreground @3xl:text-base">
                      {plan.name}
                    </span>
                    {plan.description && (
                      <span className="mt-1 hidden text-xs leading-snug font-normal text-balance text-muted-foreground @3xl:block">
                        {plan.description}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {GROUP_ORDER.flatMap(rowsOf).map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40"
                >
                  <th
                    scope="row"
                    className="p-3 text-left font-medium text-foreground @3xl:px-4"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {row.label}
                      {row.enforced && (
                        <ToneBadge tone="muted">Enforced</ToneBadge>
                      )}
                    </span>
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.id}
                      className="border-l border-border px-1 py-2 text-center align-middle text-xs font-medium text-foreground @3xl:text-sm"
                    >
                      {row.value(plan)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
