"use client";

import { Plus, Trash2 } from "lucide-react";
import { ColorField } from "@/components/ui/ColorField";
import { Slider } from "@/components/ui/Slider";
import type { GradientStop, LinearGradientBg } from "@/types/poster";
import { backgroundToCss } from "@/lib/background";

export interface GradientEditorProps {
  value: LinearGradientBg;
  onChange: (value: LinearGradientBg) => void;
  onCommit?: () => void;
}

function mixHex(a: string, b: string): string {
  const parse = (hex: string) => {
    const full = hex.replace("#", "");
    const c = full.length === 3 ? full.split("").map((x) => x + x).join("") : full;
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  try {
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const to = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return `#${to((r1 + r2) / 2)}${to((g1 + g2) / 2)}${to((b1 + b2) / 2)}`;
  } catch {
    return a;
  }
}

export function GradientEditor({ value, onChange, onCommit }: GradientEditorProps) {
  const indexed = value.stops
    .map((stop, index) => ({ ...stop, index }))
    .sort((a, b) => a.offset - b.offset);

  const setAngle = (angle: number) => onChange({ ...value, angle });

  const updateStop = (index: number, patch: Partial<GradientStop>) => {
    const stops = value.stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop));
    onChange({ ...value, stops });
  };

  const removeStop = (index: number) => {
    if (value.stops.length <= 2) return;
    onChange({ ...value, stops: value.stops.filter((_, i) => i !== index) });
  };

  const addStop = () => {
    const sorted = [...value.stops].sort((a, b) => a.offset - b.offset);
    let gapStart = sorted[0];
    let gapEnd = sorted[sorted.length - 1];
    let widest = -1;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const gap = sorted[i + 1].offset - sorted[i].offset;
      if (gap > widest) {
        widest = gap;
        gapStart = sorted[i];
        gapEnd = sorted[i + 1];
      }
    }
    const stop: GradientStop = {
      offset: (gapStart.offset + gapEnd.offset) / 2,
      color: mixHex(gapStart.color, gapEnd.color),
    };
    onChange({ ...value, stops: [...value.stops, stop] });
  };

  return (
    <div className="space-y-3">
      <div
        className="h-10 w-full rounded-lg border border-line"
        style={{ background: backgroundToCss(value) }}
      />

      <Slider
        label="Angle"
        min={0}
        max={360}
        step={1}
        value={value.angle}
        suffix="°"
        onChange={setAngle}
        onCommit={onCommit}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="field-label">Colour stops</span>
          <button
            type="button"
            onClick={addStop}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent/40 hover:text-accent"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        {indexed.map((stop) => (
          <div key={stop.index} className="flex items-end gap-2">
            <div className="flex-1">
              <ColorField
                value={stop.color}
                onChange={(color) => updateStop(stop.index, { color })}
                onCommit={onCommit}
              />
            </div>
            <div className="w-24">
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={stop.offset}
                onChange={(offset) => updateStop(stop.index, { offset })}
                onCommit={onCommit}
              />
            </div>
            <button
              type="button"
              aria-label="Remove stop"
              onClick={() => removeStop(stop.index)}
              disabled={value.stops.length <= 2}
              className="mb-1.5 rounded-md p-1 text-ink-mute transition-colors hover:bg-black/5 hover:text-danger disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
