"use client";

import { RectangleHorizontal, Sparkles } from "lucide-react";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { CANVAS_SIZES } from "@/lib/sizes";
import { GRADIENT_PRESETS, SOLID_SWATCHES, backgroundToCss } from "@/lib/background";
import { PALETTES } from "@/lib/palettes";
import { cn } from "@/lib/utils";

export function BackgroundPanel() {
  const doc = useEditorStore((s) => s.doc);
  const background = doc.background;
  const solidValue = typeof background === "string" ? background : background.stops[0]?.color ?? "#ffffff";
  const currentSizeId =
    CANVAS_SIZES.find((s) => s.width === doc.width && s.height === doc.height)?.id ?? "custom";

  return (
    <div className="space-y-5">
      <section className="space-y-1.5">
        <p className="field-label">Canvas size</p>
        <Select
          ariaLabel="Canvas size"
          value={currentSizeId}
          onChange={(id) => {
            const size = CANVAS_SIZES.find((s) => s.id === id);
            if (size) getEngine()?.resizeCanvas(size.width, size.height);
          }}
          options={[
            ...(currentSizeId === "custom"
              ? [{ value: "custom", label: `Custom · ${doc.width}×${doc.height}` }]
              : []),
            ...CANVAS_SIZES.map((s) => ({
              value: s.id,
              label: `${s.group} — ${s.label} · ${s.width}×${s.height}`,
            })),
          ]}
        />
      </section>

      <section className="space-y-2">
        <p className="field-label">Background colour</p>
        <ColorField
          value={solidValue}
          onChange={(value) => getEngine()?.setBackground(value)}
        />
        <div className="grid grid-cols-9 gap-1.5">
          {SOLID_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              title={swatch}
              onClick={() => getEngine()?.setBackground(swatch)}
              className={cn(
                "aspect-square rounded-md border transition-transform hover:scale-110",
                solidValue.toLowerCase() === swatch.toLowerCase() && typeof background === "string"
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-line",
              )}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-ink-mute" />
          <p className="field-label">Gradients</p>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {GRADIENT_PRESETS.map((gradient, index) => (
            <button
              key={index}
              type="button"
              title={`Gradient ${index + 1}`}
              onClick={() => getEngine()?.setBackground(gradient)}
              className="aspect-square rounded-md border border-line transition-transform hover:scale-105"
              style={{ background: backgroundToCss(gradient) }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <RectangleHorizontal className="h-3.5 w-3.5 text-ink-mute" />
          <p className="field-label">Curated palettes</p>
        </div>
        <div className="space-y-1.5">
          {PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              onClick={() => getEngine()?.setBackground(palette.background)}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel p-1.5 text-left transition-colors hover:bg-paper"
            >
              <span className="flex overflow-hidden rounded-md border border-line">
                {palette.colors.slice(0, 5).map((color) => (
                  <span key={color} className="h-6 w-6" style={{ background: color }} />
                ))}
              </span>
              <span className="truncate text-xs font-medium text-ink-soft">{palette.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
