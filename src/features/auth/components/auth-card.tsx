import type { ReactNode } from "react";
import {
  PlatformInitial,
  PlatformName,
} from "@/components/shared/platform-brand";
import { cn } from "@/lib/utils";
import Link from "next/link";

function AuthBrand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-8.5 shrink-0 items-center justify-center rounded-md bg-brand-accent text-base font-extrabold text-brand-accent-foreground"
      >
        <PlatformInitial />
      </span>

      <span className="text-lg font-bold tracking-tight text-foreground">
        <PlatformName />
      </span>
    </Link>
  );
}

const AUTH_MAIN_CLASS =
  "flex min-h-dvh flex-col items-center justify-center gap-5.5 px-5 py-7 md:px-6 md:py-14";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={AUTH_MAIN_CLASS}>
      <AuthBrand />
      {children}
    </main>
  );
}

/**
 * AuthShell with a branded panel beside the form from `lg` up. Below `lg` it
 * looks exactly like AuthShell: the single centred card.
 *
 * The logo and form share one column (`contentClassName` sets its width), so
 * from `lg` the logo lines up with the form's left edge, and the pair is
 * centred vertically in the panel as one block.
 */
export function AuthSplitShell({
  children,
  showcase,
  contentClassName,
}: {
  children: ReactNode;
  showcase: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      data-auth-split
      className="min-h-dvh lg:grid lg:grid-cols-2 lg:bg-card"
    >
      <main className={cn(AUTH_MAIN_CLASS, "lg:px-12 xl:px-16")}>
        <div
          className={cn(
            "flex w-full flex-col items-center gap-5.5 lg:items-start",
            contentClassName,
          )}
        >
          <AuthBrand />
          {children}
        </div>
      </main>
      {showcase}
    </div>
  );
}

export function AuthCard({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    // method="post": before hydration there is no submit handler, and the browser's
    // default GET would put the password in the URL, history and request logs.
    <form
      method="post"
      noValidate
      className={cn(
        "flex w-full max-w-110 flex-col gap-4.5 rounded-2xl border bg-card px-5 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8",
        className,
      )}
      {...props}
    />
  );
}
