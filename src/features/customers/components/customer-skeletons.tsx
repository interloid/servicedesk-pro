import { DASHBOARD_CARD } from "@/components/shared/dashboard-ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Skeletons for a customer's profile, split the way the route renders:
 *
 * - CustomerHeaderSkeleton stands in for the header and tab strip, which live
 *   in the route's layout and stay on screen across tab and page changes;
 * - CustomerOverviewSkeleton and CustomerTicketsSkeleton stand in for the tab
 *   body, so switching to Tickets shows a ticket table loading rather than the
 *   Overview's cards.
 *
 * They mirror CustomerDetail piece for piece, with the same container queries,
 * so the layout lands in place at every width. Every bar is sized to the line
 * box of the text it stands for (h-5 for text-sm, h-4 for text-xs, and so on),
 * so nothing moves when the data lands.
 */

const CARD = DASHBOARD_CARD;

const HEAD =
  "h-11 px-4 text-xs font-semibold text-muted-foreground last:border-r-0";
const CELL = "px-4 py-4 text-sm last:border-r-0";

const SUBJECT_WIDTHS = ["w-[85%]", "w-[70%]", "w-[78%]", "w-[62%]", "w-[74%]"];

function SectionHeading({ width }: { width: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-5">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className={cn("h-5", width)} />
        <Skeleton className="h-3.5 w-48 max-w-[80%]" />
      </div>
    </div>
  );
}

/** Mirrors the shared StatCard: label and small icon, then the figure. */
function StatCard({ value }: { value: string }) {
  return (
    <div className={cn(CARD, "flex flex-col gap-3 p-4 sm:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="mt-1 h-3.5 w-24 max-w-full" />
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>
      <Skeleton className={cn("h-6.5", value)} />
    </div>
  );
}

/** The primary contact: avatar, name, email, "Primary contact", status. */
function ContactRow() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-slate-50/40 p-3.5">
      <Skeleton className="size-12 shrink-0 rounded-full @md:size-14" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 self-center @md:flex-row @md:justify-between">
        <div className="w-full min-w-0 @md:w-auto @md:flex-1">
          <Skeleton className="h-6 w-36 max-w-full" />
          <Skeleton className="mt-0.5 h-5 w-48 max-w-full" />
          <Skeleton className="mt-1 h-5 w-28" />
        </div>
        {/* The portal status badge: under the details, then at the right. */}
        <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

/** A detail row: icon, label, value, and the square copy button when it has one. */
function DetailRow({
  value,
  description = false,
  copy = true,
}: {
  value: string;
  copy?: boolean;
  /** The portal row carries a line of explanation under the URL. */
  description?: boolean;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <Skeleton className="mt-0.5 size-5 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className={cn("mt-0.5 h-5 max-w-full", value)} />
        {description ? (
          <>
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-2/3" />
          </>
        ) : null}
      </div>
      {copy ? <Skeleton className="size-9 shrink-0 rounded-lg" /> : null}
    </div>
  );
}

function TicketTable({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Table className="min-w-190 table-fixed">
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className={cn(HEAD, "w-24")}>
              <Skeleton className="h-4 w-3" />
            </TableHead>
            <TableHead className={HEAD}>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead className={cn(HEAD, "w-28")}>
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead className={cn(HEAD, "w-36")}>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead className={cn(HEAD, "w-36")}>
              <Skeleton className="h-4 w-14" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SUBJECT_WIDTHS.map((width) => (
            <TableRow key={width} className="hover:bg-transparent">
              <TableCell className={CELL}>
                <Skeleton className="h-5 w-7" />
              </TableCell>
              <TableCell className={CELL}>
                <Skeleton className={cn("h-5", width)} />
              </TableCell>
              <TableCell className={CELL}>
                <Skeleton className="h-6 w-14 rounded-md" />
              </TableCell>
              <TableCell className={CELL}>
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell className={CELL}>
                <Skeleton className="h-5 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CustomerHeaderSkeleton() {
  return (
    <>
      <div>
        {/* The back link's row is its 22px line box, not the 20px link. */}
        <div className="flex h-5.5 items-center">
          <Skeleton className="h-5 w-24" />
        </div>

        <div className="mt-4 flex min-w-0 items-center gap-3.5 sm:gap-5">
          {/* Carries the same white edge and green hairline as the real
              avatar, so the photo does not appear to grow a ring when it
              lands. The ring is toned down here because the Skeleton's own
              fill is already flat: a full-strength emerald ring on a grey
              circle is darker than the ring on a photo it stands in for. */}
          <Skeleton className="size-14 shrink-0 rounded-full ring-1 ring-slate-200 ring-offset-[3px] ring-offset-background sm:size-20 sm:ring-offset-4 dark:ring-slate-700" />
          <div className="min-w-0 flex-1">
            {/* The eyebrow, then the name. */}
            <Skeleton className="mb-1 h-4 w-24" />
            <Skeleton className="h-8 w-48 max-w-full sm:h-10 sm:w-64" />
            {/* Email and company: stacked on a phone, one line from sm. */}
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5">
              <Skeleton className="h-5 w-52 max-w-full sm:h-6" />
              <Skeleton className="h-5 w-20 sm:h-6" />
            </div>
            <Skeleton className="mt-1 h-5 w-44" />
          </div>
        </div>
      </div>

      {/* The segmented tab control. */}
      <div
        aria-hidden
        className="flex h-10 w-fit items-center gap-1 rounded-lg border border-border bg-slate-100/70 p-1"
      >
        <div className="flex h-8 items-center rounded-md bg-white px-3 ring-1 ring-slate-200 dark:bg-card dark:ring-border">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex h-8 items-center gap-2 px-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-5 rounded-full" />
        </div>
      </div>
    </>
  );
}

export function CustomerOverviewSkeleton() {
  return (
    <>
      {/* Open tickets, Total tickets, Company, CSAT. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @4xl:grid-cols-4">
        <StatCard value="w-8" />
        <StatCard value="w-8" />
        <StatCard value="w-24 max-w-full" />
        <StatCard value="w-20" />
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]">
        <section className={cn(CARD, "@container flex min-w-0 flex-col")}>
          <SectionHeading width="w-48 max-w-[60%]" />
          <div className="flex flex-1 flex-col px-5 pb-5">
            <ContactRow />
            <div className="mt-2 divide-y">
              <DetailRow value="w-52" />
              <DetailRow value="w-16" copy={false} />
              <DetailRow value="w-64" description />
            </div>
          </div>
        </section>

        <section className={cn(CARD, "min-w-0 overflow-hidden")}>
          <SectionHeading width="w-36" />
          <TicketTable className="border-t" />
        </section>
      </div>
    </>
  );
}

/** The Tickets tab: the card is the table, as on the real tab. */
export function CustomerTicketsSkeleton() {
  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <TicketTable />
    </section>
  );
}
