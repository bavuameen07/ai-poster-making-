"use client";

import { cn } from "@/lib/utils";

export interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
  className?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  onCommit,
  className,
}: SliderProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="field-label">{label}</span>
          <span className="font-mono text-[11px] tabular-nums text-ink-soft">
            {typeof value === "number" ? Math.round(value * 100) / 100 : value}
            {suffix}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}
