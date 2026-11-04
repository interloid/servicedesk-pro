"use client";

import type { ReactNode, SyntheticEvent } from "react";

import { cn } from "@/lib/utils";

function block(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function blockKey(event: SyntheticEvent & { key: string }) {
  // Tab stays, so focus can't get trapped in here once `inert` is gone.
  if (event.key !== "Tab") block(event);
}

/**
 * The blurred screen behind a plan lock. `inert` and the pointer-events class
 * are only attributes, which dev tools can delete, so every interaction is also
 * stopped here in the capture phase. These handlers aren't in the DOM, so
 * editing the markup leaves them running, and they also cover anything portalled
 * from inside (a select's menu, a dialog).
 *
 * This keeps the backdrop dead; it isn't what protects the feature. Backdrops
 * hold sample data only, and the server actions check the plan themselves.
 */
export function LockedBackdrop({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden
      inert
      className={cn(
        "pointer-events-none select-none opacity-60 blur-[6px]",
        className,
      )}
      onClickCapture={block}
      onDoubleClickCapture={block}
      onAuxClickCapture={block}
      onContextMenuCapture={block}
      onPointerDownCapture={block}
      onMouseDownCapture={block}
      onSubmitCapture={block}
      onKeyDownCapture={blockKey}
      onBeforeInputCapture={block}
      onChangeCapture={block}
      onPasteCapture={block}
      onCutCapture={block}
      onDropCapture={block}
      onDragStartCapture={block}
    >
      {children}
    </div>
  );
}
