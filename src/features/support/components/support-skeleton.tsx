import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a Help & Support page loads its requests: a heading, an action
 * button and a few rows, laid out like the pages it stands in for.
 */
export function SupportSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading support requests"
    >
      <div className="mx-auto flex w-full flex-col gap-6 sm:gap-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg sm:w-52" />
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
