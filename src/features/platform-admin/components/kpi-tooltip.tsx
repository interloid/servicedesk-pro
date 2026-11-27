"use client";

import { useRef, useState, type ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Wraps a KPI card. Its label and hint stay on one line each (marked with
 * data-kpi-text) so every card's figure sits at the same height; when either
 * is cut off with "…", hovering or focusing the card shows the full text.
 * Cards whose text fits show no tooltip.
 */
export function KpiTooltip({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactElement;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function onOpenChange(next: boolean) {
    if (!next) {
      setOpen(false);
      return;
    }
    const clipped = Array.from(
      ref.current?.querySelectorAll<HTMLElement>("[data-kpi-text]") ?? [],
    ).some((node) => node.scrollWidth > node.clientWidth + 1);
    setOpen(clipped);
  }

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild ref={ref}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-60">
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{label}</span>
          {hint && <span className="opacity-75">{hint}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
