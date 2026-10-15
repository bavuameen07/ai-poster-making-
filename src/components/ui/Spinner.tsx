"use client";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent",
        className,
      )}
    />
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block h-3 w-full rounded-full bg-[linear-gradient(90deg,#efefec_0px,#f8f8f6_120px,#efefec_240px)] bg-[length:400px_100%] animate-shimmer",
        className,
      )}
    />
  );
}
