"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: "default" | "accent" | "danger";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active = false, tone = "default", className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-ink-soft",
        "transition-all duration-150 ease-smooth hover:bg-black/[0.05] hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "border-line bg-panel text-ink shadow-panel",
        active && tone === "accent" && "border-accent/30 bg-accent-wash text-accent",
        tone === "danger" && "hover:bg-red-50 hover:text-danger",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
