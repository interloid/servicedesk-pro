import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors ChannelsOverview: header, then two channel cards side by side. */
export default function Loading() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-[32rem] max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-[10px]" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-72 max-w-full" />
                </div>
              </div>
              <div className="flex gap-8 sm:pl-14">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex justify-end gap-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
