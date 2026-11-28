"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** The type's icon in a soft tinted circle, so each toast reads at a glance. */
function ToastIcon({
  tint,
  children,
}: {
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full [&>svg]:size-4",
        tint,
      )}
    >
      {children}
    </span>
  );
}

/**
 * One look for every toast in the app: a white card with a soft shadow, a
 * coloured edge and icon circle for its type (brand teal for success), a bold
 * title over a muted description, and a close button. The `!` modifiers win
 * over Sonner's own styles.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: (
          <ToastIcon tint="bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
            <CircleCheckIcon />
          </ToastIcon>
        ),
        info: (
          <ToastIcon tint="bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
            <InfoIcon />
          </ToastIcon>
        ),
        warning: (
          <ToastIcon tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
            <TriangleAlertIcon />
          </ToastIcon>
        ),
        error: (
          <ToastIcon tint="bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
            <OctagonXIcon />
          </ToastIcon>
        ),
        loading: (
          <ToastIcon tint="bg-slate-100 text-slate-500 dark:bg-muted">
            <Loader2Icon className="animate-spin" />
          </ToastIcon>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.875rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: cn(
            "cn-toast !items-start !gap-3 !rounded-[0.875rem] !border !border-l-4 !border-border !bg-card !py-3.5 !pr-10 !pl-3.5 !font-sans",
            "!shadow-[0_16px_40px_-16px_rgba(15,23,42,0.28),0_2px_6px_rgba(15,23,42,0.05)]",
          ),
          content: "!gap-0.5 !pt-1",
          title: "!text-sm !leading-snug !font-semibold !text-foreground",
          description: "!text-xs !leading-relaxed !text-slate-500",
          icon: "!m-0 !size-8 !shrink-0",
          closeButton: cn(
            // Sonner pins the button to the top-left corner and nudges it out
            // with `transform`, so reset that (not `translate`) and sit it
            // inside the top-right, centred on the title's first line.
            "!top-4 !right-3 !left-auto !size-6 ![transform:none] !rounded-md !border-0 !bg-transparent !text-slate-400",
            "hover:!bg-slate-100 hover:!text-foreground dark:hover:!bg-muted",
          ),
          actionButton:
            "!h-7 !rounded-md !bg-brand-700 !px-2.5 !text-xs !font-semibold !text-white hover:!bg-brand-800",
          cancelButton:
            "!h-7 !rounded-md !bg-slate-100 !px-2.5 !text-xs !font-semibold !text-slate-700",
          success: "!border-l-brand-700",
          info: "!border-l-sky-500",
          warning: "!border-l-amber-500",
          error: "!border-l-red-500",
          loading: "!border-l-slate-300",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
