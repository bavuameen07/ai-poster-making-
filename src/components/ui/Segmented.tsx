"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-paper p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            title={option.title}
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[7px] font-medium transition-all duration-150 ease-smooth",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              active
                ? "bg-panel text-ink shadow-panel"
                : "text-ink-mute hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
