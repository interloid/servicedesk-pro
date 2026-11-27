import {
  DASHBOARD_CARD,
  DASHBOARD_STAT_GRID,
} from "@/components/shared/dashboard-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

/*
 * Route-level loading states for the SLA screens. Each mirrors the page it
 * stands in for — same wrappers, cards and row heights — so nothing jumps
 * when the real content streams in.
 */

/** Same as the editor's CARD. */
const CARD =
  "gap-4 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-0 [--card-spacing:--spacing(5)]";
const INSET = "overflow-hidden rounded-xl border border-border";
const HEAD_ROW = "border-border bg-slate-50/80 hover:bg-slate-50/80";

/** Mirrors the shared StatCard: round icon, figure on top, one-line label. */
function StatCardSkeleton() {
  return (
    <div className={cn(DASHBOARD_CARD, "flex items-start gap-4 p-5")}>
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <Skeleton className="h-7 w-10" />
        <Skeleton className="h-4 w-24 max-w-full" />
      </div>
    </div>
  );
}

/* ───────────────────────── Policy list ───────────────────────── */

const LIST_COLUMNS = [
  "w-24", // Policy name
  "w-24", // Business hours
  "w-20", // SLA targets
  "w-16", // Applied to
  "w-20", // Updated at
  "w-12", // Status
];

export function SlaPoliciesSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8"
      aria-busy
      aria-label="Loading SLA policies"
    >
      <div className="mx-auto flex w-full flex-col gap-6">
        {/* The page header: eyebrow, title, description, New policy. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-48 sm:h-10" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        <div className={DASHBOARD_STAT_GRID}>
          {[0, 1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                {LIST_COLUMNS.map((w, i) => (
                  <TableHead key={i} className="h-10 px-4">
                    <Skeleton className={cn("h-2.5", w)} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }, (_, row) => (
                <TableRow
                  key={row}
                  className="border-border hover:bg-transparent"
                >
                  <TableCell className="px-4 py-4 align-top">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-44" />
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-9 shrink-0 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </TableCell>
                  {/* Urgent and Low targets: two 20px lines, 6px apart. */}
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex h-5 items-center">
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <div className="flex h-5 items-center">
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-3 w-16" />
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Editor (new / edit) ───────────────────────── */

/**
 * A card header: numbered badge or icon tile, title and hint, optional action.
 * The title and hint sit in boxes of their real line heights (text-base 24px,
 * text-xs 16px), so a header with a hint is 42px and one without is the tile's
 * height, exactly as in the editor.
 */
function HeaderSkeleton({
  tile = "size-9 rounded-full",
  hint = true,
  action,
}: {
  tile?: string;
  hint?: boolean;
  action?: string;
}) {
  return (
    <CardHeader className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Skeleton className={cn("shrink-0", tile)} />
        <div className="space-y-0.5">
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-36" />
          </div>
          {hint && (
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          )}
        </div>
      </div>
      {action && <Skeleton className={cn("h-10 rounded-lg", action)} />}
    </CardHeader>
  );
}

/** The editor's Field: a 20px label, 6px gap, then the control. */
function FieldSkeleton({ control = "h-10" }: { control?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-5 items-center">
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className={cn("w-full rounded-lg", control)} />
    </div>
  );
}

/** A bordered option with a 20px title over a 16px line (Applies to, Default SLA). */
function OptionSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border p-3.5",
        className,
      )}
    >
      <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
      <div className="space-y-0.5">
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
    </div>
  );
}

export function SlaEditorSkeleton() {
  return (
    <div
      className="min-h-full bg-slate-50/50 p-4 pb-10 sm:p-6 lg:p-8"
      aria-busy
      aria-label="Loading SLA policy"
    >
      <div className="mx-auto flex max-w-8xl flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-56 sm:h-10" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Card className={CARD}>
              <HeaderSkeleton hint={false} />
              <CardContent className="flex flex-col gap-3">
                <FieldSkeleton />
                <FieldSkeleton />
                <FieldSkeleton control="h-21" />
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-5 items-center">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <OptionSkeleton />
                    <OptionSkeleton />
                  </div>
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                </div>
                <OptionSkeleton />
              </CardContent>
            </Card>

            <Card className={CARD}>
              <HeaderSkeleton />
              <CardContent>
                <div className={INSET}>
                  <Table className="min-w-160 md:min-w-0">
                    <TableHeader>
                      <TableRow className={HEAD_ROW}>
                        {["w-14", "w-28", "w-24"].map((w, i) => (
                          <TableHead key={i} className="px-3">
                            <Skeleton className={cn("h-3", w)} />
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 4 }, (_, i) => (
                        <TableRow
                          key={i}
                          className="border-slate-100 hover:bg-transparent"
                        >
                          <TableCell className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Skeleton className="size-2 rounded-full" />
                              <Skeleton className="h-4 w-14" />
                            </div>
                          </TableCell>
                          {[0, 1].map((c) => (
                            <TableCell key={c} className="px-3 py-1.5">
                              <div className="flex gap-2">
                                <Skeleton className="h-9 w-24 rounded-lg" />
                                <Skeleton className="h-9 w-32 rounded-lg" />
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card className={CARD}>
              <HeaderSkeleton />
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border p-4"
                  >
                    <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
                    <Skeleton className="mt-0.5 size-6 shrink-0 rounded" />
                    <div className="space-y-1">
                      <div className="flex h-5 items-center">
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex h-5 items-center">
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={CARD}>
              <HeaderSkeleton tile="size-9 rounded-full" action="w-36" />
              <CardContent>
                <div className={INSET}>
                  <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div>
                          <div className="flex h-5 items-center">
                            <Skeleton className="h-3.5 w-24" />
                          </div>
                          <div className="flex h-4 items-center">
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex h-10 items-center justify-between border-t border-slate-100 px-4">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={CARD}>
              <HeaderSkeleton tile="size-9 rounded-full" action="w-28" />
              <CardContent>
                <div className={cn(INSET, "h-50.25")}>
                  <div className="flex h-10 items-center gap-6 border-b border-border bg-slate-50/80 px-4">
                    {["w-24", "w-12", "w-12", "w-14"].map((w, i) => (
                      <Skeleton key={i} className={cn("h-3", w)} />
                    ))}
                  </div>
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="flex h-13 items-center gap-6 border-b border-slate-100 px-4 last:border-b-0"
                    >
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3.5 w-14" />
                      <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={CARD}>
              <HeaderSkeleton tile="size-9 rounded-full" hint={false} />
              <CardContent className="space-y-3">
                <div className="flex h-9 items-center gap-3">
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="ml-3 h-9 w-16 rounded-lg" />
                  <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
                <div className="flex h-9 items-center gap-3">
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="ml-3 h-9 w-44 rounded-lg" />
                  <Skeleton className="hidden h-3 w-72 sm:block" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
