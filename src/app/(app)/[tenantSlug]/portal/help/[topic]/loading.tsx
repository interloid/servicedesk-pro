import { Skeleton } from "@/components/ui/skeleton";

/**
 * A topic page's own fallback, so moving between topics doesn't flash the
 * help centre's skeleton (../loading.tsx) on the way. Mirrors the page: the
 * breadcrumb, the header with its icon, the question list and the side panel.
 */
export default function PortalHelpTopicLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl md:px-6">
      <Skeleton className="h-4 w-48" />

      <div className="mt-5 flex items-start gap-4 border-b pb-6">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="divide-y rounded-xl border bg-card">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="px-5 py-4">
              <Skeleton className="h-4 w-2/3" />
              {row === 0 ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
