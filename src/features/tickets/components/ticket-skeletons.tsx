import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/*
 * Route-level loading states for the ticket queue and a single ticket. Each
 * mirrors the component it stands in for -- TicketsTable and TicketDetailView
 * -- with the same wrappers, cards, column widths and control heights, so
 * nothing jumps when the real content streams in. Every bar is sized to the
 * line box of the text it stands for (h-5 for text-sm, h-4 for text-xs).
 */

/* ───────────────────────── Ticket queue ───────────────────────── */

/** Subject widths, varied so the rows don't read as a striped pattern. */
const SUBJECT_WIDTHS = ["w-[70%]", "w-[55%]", "w-[80%]", "w-[62%]", "w-[48%]"];
const REQUESTER_WIDTHS = ["w-24", "w-28", "w-20", "w-32", "w-24"];
const COMPANY_WIDTHS = ["w-16", "w-20", "", "w-24", "w-14"];
const ASSIGNEE_WIDTHS = ["w-20", "w-24", "w-16", "w-24", "w-20"];

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

/** The real table's head: same widths, so the columns land in place. */
const HEADS = [
  { id: "id", width: "w-24", bar: "w-12" },
  { id: "subject", width: "", bar: "w-16" },
  { id: "requester", width: "w-48", bar: "w-20" },
  { id: "priority", width: "w-28", bar: "w-16" },
  { id: "assignee", width: "w-44", bar: "w-16" },
  { id: "status", width: "w-28", bar: "w-12" },
  { id: "sla", width: "w-36", bar: "w-8", right: true },
];

/** An empty 40px field: the real search box and filter selects. */
function FieldShell({ className }: { className: string }) {
  return (
    <div
      className={cn("h-10 rounded-lg border border-border bg-card", className)}
    />
  );
}

export function TicketsTableSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto p-4 font-sans sm:p-6 lg:p-8"
      aria-busy
      aria-label="Loading tickets"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            {/* Eyebrow, "Tickets" (2rem) and the count line. */}
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-36 sm:h-10" />
            <Skeleton className="h-5 w-56" />
          </div>

          {/* Columns, New ticket. */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        {/* The filter card: view tabs, then the selects and search. */}
        <div className={cn(DASHBOARD_CARD, "@container p-3")}>
          <div className="flex flex-col gap-3 @[72rem]:flex-row @[72rem]:items-center @[72rem]:justify-between">
            <div className="flex h-10 w-fit max-w-full items-center gap-1 overflow-hidden rounded-lg border border-border bg-slate-100/70 p-1 dark:bg-muted/50">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-3 @[40rem]:flex @[40rem]:items-center @[40rem]:justify-end @[72rem]:flex-1">
              <FieldShell className="col-span-2 @[40rem]:order-last @[40rem]:w-64 @[48rem]:w-72" />
              <FieldShell className="w-full @[40rem]:w-40" />
              <FieldShell className="w-full @[40rem]:w-40" />
            </div>
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-muted/40 [&_tr]:border-b-0">
                <TableRow className="shadow-[inset_0_-1px_0_var(--border)] hover:bg-transparent">
                  <TableHead className="h-10 w-12 px-4">
                    <Skeleton className="mx-auto size-4 rounded-[5px]" />
                  </TableHead>
                  {HEADS.map((head) => (
                    <TableHead
                      key={head.id}
                      className={cn("h-10 px-4", head.width)}
                    >
                      <Skeleton
                        className={cn("h-3", head.bar, head.right && "ml-auto")}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {ROWS.map((row) => {
                  const company = COMPANY_WIDTHS[row % COMPANY_WIDTHS.length];
                  return (
                    <TableRow key={row} className="hover:bg-transparent">
                      <TableCell className="px-4 py-3">
                        <Skeleton className="mx-auto size-4 rounded-[5px]" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="my-1 h-5 w-10" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton
                          className={cn(
                            "my-1 h-5",
                            SUBJECT_WIDTHS[row % SUBJECT_WIDTHS.length],
                          )}
                        />
                      </TableCell>
                      {/* Name over company; the real cell drops the
                          company line when there is none. */}
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1 py-1">
                          <Skeleton
                            className={cn(
                              "h-4.5",
                              REQUESTER_WIDTHS[row % REQUESTER_WIDTHS.length],
                            )}
                          />
                          {company && (
                            <Skeleton
                              className={cn("h-3.5 bg-slate-200/70", company)}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="my-1 h-6 w-18 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2 py-1">
                          <Skeleton className="size-5 shrink-0 rounded-full" />
                          <Skeleton
                            className={cn(
                              "h-5",
                              ASSIGNEE_WIDTHS[row % ASSIGNEE_WIDTHS.length],
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="my-1 h-6 w-16 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="my-1 ml-auto h-6 w-24 rounded-md" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* "Showing x of y", rows per page, and the pager. */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row dark:bg-muted/30">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="ml-3 hidden h-5 w-24 sm:block" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Ticket view ───────────────────────── */

const CARD = DASHBOARD_CARD;

/** A panel's round icon and title, as on the real cards. */
function PanelHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className={cn("h-5", title)} />
    </div>
  );
}

/**
 * The thread as it usually opens: the customer's message on the left, a
 * reply on the right, and a follow-up. Lines are the bubble's text lines.
 */
const THREAD: { customer: boolean; name: string; lines: string[] }[] = [
  { customer: true, name: "w-28", lines: ["w-72", "w-64", "w-40"] },
  { customer: false, name: "w-24", lines: ["w-64", "w-48"] },
  { customer: true, name: "w-28", lines: ["w-56"] },
];

function ThreadMessage({
  customer,
  name,
  lines,
}: {
  customer: boolean;
  name: string;
  lines: string[];
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        customer ? "items-start" : "items-end",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          !customer && "flex-row-reverse",
        )}
      >
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div
          className={cn(
            "flex flex-col gap-1",
            customer ? "items-start" : "items-end",
          )}
        >
          <Skeleton className={cn("h-4", name)} />
          <Skeleton className="h-3 w-20 bg-slate-200/70" />
        </div>
      </div>
      {/* The bubble, with the real one's corner cut on the speaker's side. */}
      <div
        className={cn(
          "flex w-full max-w-[85%] flex-col gap-2 rounded-2xl px-3.5 py-3 sm:max-w-[75%]",
          customer
            ? "items-start rounded-tl-sm bg-slate-100"
            : "items-end rounded-tr-sm bg-brand-accent/10",
        )}
      >
        {lines.map((width, i) => (
          <Skeleton
            key={i}
            className={cn("h-3.5 max-w-full bg-slate-200/80", width)}
          />
        ))}
      </div>
    </div>
  );
}

/** A sidebar field: label over a 40px select. */
function SidebarField({ label }: { label: string }) {
  return (
    <div className="grid gap-2">
      <Skeleton className={cn("h-4", label)} />
      <div className="h-10 w-full rounded-lg border border-border bg-card" />
    </div>
  );
}

/** One SLA clock: label and badge, the progress bar, the footnote. */
function SlaClock() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200/70! bg-slate-50/60 px-3 py-2.5 dark:border-border! dark:bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3.5 w-36 bg-slate-200/70" />
    </div>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-y-auto p-4 font-sans sm:p-6 lg:p-8"
      aria-busy
      aria-label="Loading ticket"
    >
      <div className="mx-auto flex w-full flex-1 flex-col gap-6 lg:min-h-0">
        {/* Back to queue: the link's row is its 22px line box. */}
        <div className="flex h-5.5 items-center">
          <Skeleton className="h-5 w-28" />
        </div>

        <div className="space-y-2">
          {/* Number and SLA headline badge. */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-12 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          {/* Subject: the 2rem heading. */}
          <Skeleton className="h-9 w-96 max-w-full sm:h-10" />
          {/* Created by … · last activity. */}
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:min-h-136 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section
            className={cn(
              DASHBOARD_CARD,
              "flex h-[75dvh] min-h-112 flex-col overflow-hidden lg:h-auto lg:min-h-0",
            )}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-3 py-4 sm:px-5 sm:py-5">
              {THREAD.map((message, i) => (
                <ThreadMessage key={i} {...message} />
              ))}
            </div>

            {/* The composer: reply type, the text box, Attach and Send. */}
            <div className="shrink-0 border-t border-border bg-slate-50/60 dark:bg-muted/30">
              <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
              <div className="px-3 pt-2 sm:px-4">
                <div className="h-16 w-full rounded-lg border border-border bg-card" />
              </div>
              <div className="flex flex-col items-stretch justify-between gap-2 px-3 pt-2 pb-3 sm:flex-row sm:items-center sm:px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-22 rounded-md" />
                  <Skeleton className="hidden h-4 w-52 sm:block" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
              </div>
            </div>
          </section>

          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto">
            {/* Requester, status, priority, assignee, tags. */}
            <div className={CARD}>
              <div className="space-y-3 p-4">
                <PanelHeading title="w-20" />
                <div className="flex items-center gap-3 rounded-lg border border-border bg-slate-50/60 p-2.5 dark:bg-muted/30">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3.5 w-20 bg-slate-200/70" />
                  </div>
                </div>
                <SidebarField label="w-12" />
                <SidebarField label="w-14" />
                <SidebarField label="w-16" />
                <SidebarField label="w-10" />
              </div>
            </div>

            {/* SLA: policy, how it counts, and the two clocks. */}
            <div className={CARD}>
              <div className="space-y-3 p-4">
                <PanelHeading title="w-10" />
                <div className="grid gap-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-48 bg-slate-200/70" />
                </div>
                <SlaClock />
                <SlaClock />
              </div>
            </div>

            {/* Attachments. */}
            <div className={CARD}>
              <div className="space-y-3 p-4">
                <PanelHeading title="w-24" />
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-12 bg-slate-200/70" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
