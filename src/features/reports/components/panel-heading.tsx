import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A Reports panel's header, as on the dashboards' panels: a round teal icon,
 * the title in the heading face and one line of context. `after` sits right
 * beside the title (an info button).
 */
export function ReportPanelHeading({
  icon: Icon,
  title,
  description,
  after,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
      >
        <Icon className="size-4.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {after}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
