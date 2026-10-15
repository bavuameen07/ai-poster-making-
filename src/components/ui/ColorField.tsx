"use client";

import { useEffect, useState } from "react";
import { cn, safeHex } from "@/lib/utils";

export interface ColorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  allowClear?: boolean;
  onClear?: () => void;
  className?: string;
}

export function ColorField({
  label,
  value,
  onChange,
  onCommit,
  allowClear = false,
  onClear,
  className,
}: ColorFieldProps) {
  const [draft, setDraft] = useState(value);
  const isClear = value === "" || value === "transparent";

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="field-label">{label}</span>
          {allowClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-ink-mute transition-colors hover:text-accent"
            >
              {isClear ? "Add" : "Clear"}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-line bg-panel">
          <span
            className="absolute inset-0"
            style={{
              background: isClear
                ? "repeating-conic-gradient(#e6e6e2 0% 25%, #ffffff 0% 50%) 50% / 10px 10px"
                : draft,
            }}
          />
          <input
            type="color"
            aria-label={label ?? "Colour"}
            value={safeHex(draft, "#000000")}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            onBlur={onCommit}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={isClear ? "" : draft}
          placeholder="#000000"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft.trim())) {
              onChange(draft.trim());
            } else {
              setDraft(value);
            }
            onCommit?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "h-8 w-full rounded-lg border border-line bg-panel px-2.5 font-mono text-xs uppercase",
            "text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent",
          )}
        />
      </div>
    </div>
  );
}
