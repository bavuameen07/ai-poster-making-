"use client";

import { cn } from "@/lib/utils";

export interface FieldProps {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between">
          <label className="field-label">{label}</label>
          {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ className, invalid, ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-lg border bg-panel px-2.5 text-sm text-ink outline-none transition-colors",
        "placeholder:text-ink-faint focus:border-accent",
        invalid ? "border-danger" : "border-line",
        className,
      )}
      {...props}
    />
  );
}

export function NumberInput({ className, ...props }: TextInputProps) {
  return (
    <input
      type="number"
      className={cn(
        "h-8 w-full rounded-lg border border-line bg-panel px-2.5 font-mono text-xs tabular-nums text-ink",
        "outline-none transition-colors focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
