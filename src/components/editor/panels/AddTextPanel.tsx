"use client";

import type { LucideIcon } from "lucide-react";
import {
  Heading1,
  Heading2,
  AlignLeft,
  Quote,
  Tag,
  Hash,
  MousePointerClick,
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { idealTextColor } from "@/lib/background";
import type { TextPreset } from "@/lib/editor/CanvasEngine";

interface Preset {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  build: (color: string) => TextPreset;
}

const PRESETS: Preset[] = [
  {
    id: "heading",
    label: "Heading",
    hint: "Anton · 128px",
    icon: Heading1,
    build: (color) => ({
      text: "HEADLINE",
      fontFamily: "Anton",
      fontSize: 128,
      fontWeight: 400,
      fill: color,
      textAlign: "center",
      lineHeight: 1,
      name: "Heading",
    }),
  },
  {
    id: "subheading",
    label: "Subheading",
    hint: "Inter · 54px",
    icon: Heading2,
    build: (color) => ({
      text: "Supporting subheading",
      fontFamily: "Inter",
      fontSize: 54,
      fontWeight: 600,
      fill: color,
      textAlign: "center",
      lineHeight: 1.15,
      name: "Subheading",
    }),
  },
  {
    id: "body",
    label: "Body text",
    hint: "Inter · 30px",
    icon: AlignLeft,
    build: (color) => ({
      text: "Add your supporting paragraph here. Keep it short and intentional.",
      fontFamily: "Inter",
      fontSize: 30,
      fontWeight: 400,
      fill: color,
      textAlign: "left",
      lineHeight: 1.45,
      name: "Body",
    }),
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Playfair · italic",
    icon: Quote,
    build: (color) => ({
      text: "\u201CA short, memorable line.\u201D",
      fontFamily: "Playfair Display",
      fontSize: 68,
      fontWeight: 600,
      fontStyle: "italic",
      fill: color,
      textAlign: "center",
      lineHeight: 1.2,
      name: "Quote",
    }),
  },
  {
    id: "label",
    label: "Label",
    hint: "JetBrains Mono",
    icon: Tag,
    build: (color) => ({
      text: "LABEL TEXT",
      fontFamily: "JetBrains Mono",
      fontSize: 24,
      fontWeight: 500,
      fill: color,
      textAlign: "center",
      charSpacing: 220,
      lineHeight: 1.2,
      name: "Label",
    }),
  },
  {
    id: "number",
    label: "Number",
    hint: "Archivo Black",
    icon: Hash,
    build: (color) => ({
      text: "01",
      fontFamily: "Archivo Black",
      fontSize: 200,
      fontWeight: 400,
      fill: color,
      textAlign: "center",
      lineHeight: 1,
      name: "Number",
    }),
  },
];

export function AddTextPanel() {
  const background = useEditorStore((s) => s.doc.background);
  const color = idealTextColor(background);

  return (
    <div className="space-y-2">
      <p className="px-0.5 text-xs leading-relaxed text-ink-mute">
        Add a text layer, then edit it directly on the canvas.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => getEngine()?.addTextObject(preset.build(color))}
            className="flex items-center gap-2.5 rounded-lg border border-line bg-panel px-2.5 py-2 text-left transition-all duration-150 ease-smooth hover:border-accent/40 hover:bg-paper"
          >
            <preset.icon className="h-4 w-4 shrink-0 text-ink-mute" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">{preset.label}</span>
              <span className="block truncate text-[10px] text-ink-faint">{preset.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[11px] text-ink-mute">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Double-click any text on the canvas to edit it in place.</span>
      </div>
    </div>
  );
}
