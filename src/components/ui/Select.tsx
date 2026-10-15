"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  style?: React.CSSProperties;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function Select({ value, options, onChange, ariaLabel, className }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 w-full appearance-none truncate rounded-lg border border-line bg-panel pl-2.5 pr-8",
          "text-sm text-ink outline-none transition-colors focus:border-accent",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} style={option.style}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
    </div>
  );
}
