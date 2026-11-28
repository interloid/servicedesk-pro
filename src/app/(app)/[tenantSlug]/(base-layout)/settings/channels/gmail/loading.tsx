import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors EmailChannelSettings: back link and header, then from xl two
 * columns filling the window -- connection and routing on the left, recent
 * emails on the right.
 */
export default function Loading() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 xl:overflow-hidden">
      <div className="flex w-full flex-col gap-6 xl:h-full">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-[10px]" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-80 max-w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-4 sm:p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full max-w-md rounded-lg" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-[10px]" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
