"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart2,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  Clock,
  Crown,
  Download,
  FilePlus2,
  ListChecks,
  Loader2,
  Star,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
  DashboardPageHeader,
  StatCard,
} from "@/components/shared/dashboard-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_RANGE,
  REPORT_RANGES,
  ReportRange,
  ReportsData,
} from "../types/types";
import { exportReportsPdf } from "../lib/export-pdf";
import { AgentPerformanceTable } from "./agent-performance-table";
import { PrioritySlaCard } from "./priority-sla-card";
import { ReportsSkeletonBody } from "./reports-skeleton";
import { REPORT_STAT_GRID } from "./styles";
import { TicketPerformanceCard } from "./ticket-performance-card";

interface ReportsDashboardProps {
  data: ReportsData;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function RangePicker({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (range: ReportRange) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(DASHBOARD_BUTTON, "gap-2 bg-card px-3.5")}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {REPORT_RANGES[range].label}
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1">
        <DropdownMenuRadioGroup
          value={range}
          onValueChange={(value) => onChange(value as ReportRange)}
        >
          {(Object.keys(REPORT_RANGES) as ReportRange[]).map((key) => (
            <DropdownMenuRadioItem
              key={key}
              value={key}
              className="cursor-pointer capitalize"
            >
              {REPORT_RANGES[key].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ReportsDashboard({ data }: ReportsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  // The report body, captured by the PDF export.
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  const exportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportReportsPdf(reportRef.current, data);
    } catch (error) {
      console.error("[reports] PDF export failed:", error);
      toast.error("Couldn't export the report", {
        description: "The PDF couldn't be generated. Try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  const { summary } = data;
  const rangeLabel = REPORT_RANGES[data.range].label;
  const hasData =
    summary.ticketsCreated + summary.ticketsSolved + summary.openBacklog > 0;

  const changeRange = (next: ReportRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_REPORT_RANGE) params.delete("range");
    else params.set("range", next);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <DashboardPageHeader
          eyebrow="Workspace"
          icon={BarChart2}
          title="Reports"
          description="Analyze your support performance and team productivity."
          action={
            // The picker stays even when the period is empty: hiding it left a
            // quiet "Last 7 days" with no way back short of editing the URL.
            <div className="flex flex-wrap items-center gap-2">
              {hasData && (
                <Button
                  variant="outline"
                  onClick={() => void exportPdf()}
                  disabled={exporting || isPending}
                  className={cn(DASHBOARD_BUTTON, "gap-2 bg-card px-3.5")}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {exporting ? "Exporting…" : "Export PDF"}
                </Button>
              )}
              <RangePicker range={data.range} onChange={changeRange} />
            </div>
          }
        />

        <div
          ref={reportRef}
          aria-busy={isPending}
          className="flex flex-col gap-6"
        >
          {/* A new period swaps the body for its skeleton, so the old numbers
              never sit under the new period's label. The heading and picker
              stay put. */}
          {isPending ? (
            <ReportsSkeletonBody />
          ) : !hasData ? (
            <div
              className={cn(
                DASHBOARD_CARD,
                "flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center",
              )}
            >
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
              >
                <ChartColumn className="size-6" strokeWidth={1.75} />
              </span>
              <h2 className="mt-5 font-heading text-lg font-bold tracking-tight text-foreground">
                No ticket activity yet
              </h2>
              <p className="mt-1.5 max-w-lg text-sm text-slate-500">
                We couldn&rsquo;t find any ticket data yet.{" "}
                <span className="sm:block">
                  Check back once tickets come in.
                </span>
              </p>
            </div>
          ) : (
            <>
              {data.truncated && (
                <p
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-amber-200! bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60! dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <TriangleAlert
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                  />
                  <span>
                    This period has too much activity to report on fully, so the
                    figures below are partial. Pick a shorter range.
                  </span>
                </p>
              )}
              <div data-pdf-block data-pdf-row className={REPORT_STAT_GRID}>
                <StatCard
                  icon={Crown}
                  iconClassName="bg-brand-50 text-brand-700"
                  label="SLA Attainment"
                  value={
                    summary.slaAttainment === null || data.truncated
                      ? "—"
                      : `${summary.slaAttainment}%`
                  }
                  hint={
                    data.truncated
                      ? "Partial data — pick a shorter range"
                      : summary.slaEligible === 0
                        ? "No tickets to judge yet"
                        : `${summary.slaMetCount} of ${plural(summary.slaEligible, "ticket")} met SLA`
                  }
                />
                <StatCard
                  icon={Clock}
                  iconClassName="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300"
                  label="Median First Response"
                  value={summary.medianFirstResponse ?? "—"}
                  hint={
                    summary.firstResponseCount === 0
                      ? "No replies yet"
                      : `Across ${plural(summary.firstResponseCount, "ticket")}`
                  }
                />
                <StatCard
                  icon={ListChecks}
                  iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300"
                  label="Tickets Solved"
                  value={String(summary.ticketsSolved)}
                  hint={rangeLabel}
                />
                <StatCard
                  icon={FilePlus2}
                  iconClassName="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  label="Tickets Created"
                  value={String(summary.ticketsCreated)}
                  hint={rangeLabel}
                />
                <StatCard
                  icon={Star}
                  iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
                  label="CSAT"
                  value={
                    summary.csatAverage === null
                      ? "—"
                      : `${summary.csatAverage} / 5`
                  }
                  hint={
                    summary.csatResponses === 0
                      ? "No ratings yet"
                      : `${plural(summary.csatResponses, "rating")} · ${summary.csatPositiveRate}% positive`
                  }
                />
              </div>

              {/* Charts stacked on the left; on xl the agent table sits
                  beside them and is pinned to their height, so its rows
                  scroll inside instead of stretching the row. */}
              <div
                data-pdf-stack
                className="grid grid-cols-1 gap-6 xl:grid-cols-2"
              >
                <div className="flex min-w-0 flex-col gap-6">
                  <div data-pdf-block>
                    <TicketPerformanceCard data={data} />
                  </div>
                  <div data-pdf-block>
                    <PrioritySlaCard items={data.prioritySla} />
                  </div>
                </div>

                <div data-pdf-block className="min-w-0 xl:relative">
                  <AgentPerformanceTable
                    agents={data.agents}
                    className="xl:absolute xl:inset-0"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
