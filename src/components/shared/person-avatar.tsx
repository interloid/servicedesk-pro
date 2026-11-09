"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * A person's photo, or their initials while it loads, when it fails, or when
 * they have none. `className` sizes the circle; `fallbackClassName` colours
 * the initials, so each place keeps the look it had before photos.
 */
export function PersonAvatar({
  src,
  initials,
  className,
  fallbackClassName,
}: {
  src?: string | null;
  initials: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar aria-hidden className={cn("after:hidden", className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className={cn("font-bold", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
