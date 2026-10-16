"use client";

import type { DocSize, LayoutPreview } from "@/lib/autoLayout";
import { cn } from "@/lib/utils";

export interface LayoutPreviewCardProps {
  preview: LayoutPreview;
  doc: DocSize;
  src: string | null;
  active: boolean;
  onSelect: () => void;
}

export function LayoutPreviewCard({ preview, doc, src, active, onSelect }: LayoutPreviewCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={preview.description}
      aria-pressed={active}
      className={cn(
        "group flex flex-col gap-1 rounded-lg border p-1 text-left transition-colors",
        active ? "border-accent bg-accent-wash" : "border-line bg-paper hover:border-accent/40",
      )}
    >
      <span
        className="relative block w-full overflow-hidden rounded bg-ink/5"
        style={{
          aspectRatio: `${doc.width} / ${doc.height}`,
          backgroundImage: src ? `url("${src}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {preview.placements.map((p) => (
          <span
            key={p.id}
            className="absolute block rounded-[1.5px]"
            style={{
              left: `${(p.left / doc.width) * 100}%`,
              top: `${(p.top / doc.height) * 100}%`,
              width: `${(p.width / doc.width) * 100}%`,
              height: `${(p.height / doc.height) * 100}%`,
              background: p.fill,
              opacity: 0.85,
              boxShadow: "0 0 0 0.5px rgba(127,127,127,0.5)",
            }}
          />
        ))}
      </span>
      <span
        className={cn(
          "block truncate px-0.5 text-[10px] font-medium",
          active ? "text-accent" : "text-ink-soft",
        )}
      >
        {preview.name}
      </span>
    </button>
  );
}
