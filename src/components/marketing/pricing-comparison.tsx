import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "Compare plans" table under the landing page plan cards. Values follow the
 * default plans in supabase/schemas/seeds/01_plans_seed.sql (limits and
 * features_json), the same source as the cards in pricing-plans.tsx; keep
 * them in step if the seed changes.
 */

export type ComparisonPlan = {
  key: string;
  name: string;
  /** Price shown in the header, already formatted ("$29"). */
  price: string;
  priceNote: string;
  featured?: boolean;
  cta: { label: string; href: string };
};

/** A value per plan, in the plans' order: true / false, or text. */
type Cell = boolean | string;
type Row = { label: string; hint?: string; values: [Cell, Cell, Cell] };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Team & usage",
    rows: [
      { label: "Agent seats", values: ["2", "15", "100"] },
      { label: "Tickets", values: ["Up to 50", "Unlimited", "Unlimited"] },
      { label: "File storage", values: ["1 GB", "10 GB", "50 GB"] },
      {
        label: "SLA policies",
        hint: "Response and resolution targets",
        values: ["1", "Unlimited", "Unlimited"],
      },
    ],
  },
  {
    title: "Ticketing & support",
    rows: [
      { label: "Core ticketing", values: [true, true, true] },
      { label: "Customer portal", values: [true, true, true] },
      { label: "Email notifications", values: [true, true, true] },
      {
        label: "Business hours",
        hint: "SLA clocks pause outside working hours",
        values: [false, true, true],
      },
      { label: "Shared saved views", values: [false, true, true] },
      { label: "Reports", values: [false, true, true] },
      { label: "Priority support", values: [false, true, true] },
    ],
  },
  {
    title: "Branding & governance",
    rows: [
      { label: "Portal branding", values: [false, true, true] },
      { label: "Audit log", values: [false, false, true] },
      { label: "Advanced roles", values: [false, false, true] },
      { label: "AI automation", values: [false, false, true] },
    ],
  },
];

function Value({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex size-6 items-center justify-center text-slate-300">
        <Minus className="size-4" aria-hidden />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return (
    <span className="text-sm font-semibold text-foreground tabular-nums">
      {value}
    </span>
  );
}

export function PricingComparison({ plans }: { plans: ComparisonPlan[] }) {
  return (
    <section
      aria-labelledby="compare-plans"
      className="flex w-full max-w-6xl flex-col items-center gap-6 pt-6"
    >
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h3
          id="compare-plans"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Compare plans
        </h3>
        <p className="text-sm text-muted-foreground sm:text-base">
          Every plan includes the help desk essentials. Here&apos;s what changes
          as your team grows.
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] sm:min-w-[42rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-32 bg-card p-3 align-bottom sm:w-[34%] sm:p-5 text-xs font-semibold tracking-wider text-slate-500 uppercase"
                >
                  Features
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.key}
                    scope="col"
                    className={cn(
                      "w-[22%] px-2 py-4 text-center align-top font-normal sm:p-5",
                      plan.featured && "bg-brand-50/60",
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {/* Same height in every column, so the plan names line up. */}
                      <span
                        aria-hidden={!plan.featured}
                        className={cn(
                          "mb-1 rounded-full bg-brand-accent px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-accent-foreground uppercase",
                          !plan.featured && "invisible",
                        )}
                      >
                        Most popular
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {plan.name}
                      </span>
                      <span className="text-sm text-slate-500">
                        <span className="text-lg font-semibold text-foreground tabular-nums">
                          {plan.price}
                        </span>{" "}
                        {plan.priceNote}
                      </span>
                      <Link
                        href={plan.cta.href}
                        className={cn(
                          "mt-3 flex h-9 w-full max-w-44 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                          plan.featured
                            ? "bg-brand-accent text-brand-accent-foreground hover:bg-brand-hover hover:text-brand-accent-foreground"
                            : "border border-slate-300 bg-card text-foreground hover:bg-slate-50 hover:text-foreground",
                        )}
                      >
                        {plan.cta.label}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {GROUPS.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={plans.length + 1}
                    className="sticky left-0 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card px-3 py-3.5 font-medium text-slate-700 sm:px-5"
                    >
                      {row.label}
                      {row.hint && (
                        <span className="mt-0.5 block text-xs font-normal text-slate-400">
                          {row.hint}
                        </span>
                      )}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        key={plans[index]?.key ?? index}
                        className={cn(
                          "px-2 py-3.5 text-center sm:px-5",
                          plans[index]?.featured && "bg-brand-50/40",
                        )}
                      >
                        <Value value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
