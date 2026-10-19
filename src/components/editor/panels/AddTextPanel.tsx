"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Heading1,
  Heading2,
  AlignLeft,
  Quote,
  Tag,
  Hash,
  MousePointerClick,
  ImageUp,
  Loader2,
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { idealTextColor } from "@/lib/background";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageMode = useEditorStore((s) => s.imageMode);
  const posterArt = useEditorStore((s) => s.posterArt);

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (imageMode === "poster") await getEngine()?.addPosterImageFromFile(file);
      else await getEngine()?.setBackgroundImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="field-label">Image</span>
        <Segmented
          className="w-full [&>button]:flex-1"
          value={imageMode}
          onChange={(value) => getEngine()?.switchImageMode(value as "poster" | "background")}
          options={[
            { value: "poster", label: "Poster Image Mode" },
            { value: "background", label: "Background Image Mode" },
          ]}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addImage(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-5 text-center transition-colors",
            dragging ? "border-accent bg-accent-wash" : "border-line bg-paper",
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-ink-mute">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          </span>
          <p className="text-[11px] leading-relaxed text-ink-mute">
            {imageMode === "poster" ? "Upload a poster to preserve it as editable artwork." : "Upload a photo to use behind your text."}
            <br /> upload from your device.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
          >
            {busy ? "Loading…" : "Upload image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void addImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <span className="text-[10px] text-ink-faint">JPG, PNG or WebP · up to 15 MB</span>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        {imageMode === "poster" && posterArt?.present && (
          <div className="space-y-2 rounded-lg border border-line bg-panel p-2.5">
            <p className="truncate text-xs font-medium text-ink">Main artwork · {posterArt.name}</p>
            <Segmented size="sm" className="w-full [&>button]:flex-1" value={posterArt.fit}
              onChange={(value) => getEngine()?.setPosterImageFit(value as "contain" | "cover" | "custom")}
              options={[{ value: "contain", label: "Fit" }, { value: "cover", label: "Fill" }, { value: "custom", label: "Crop" }]} />
            <Slider label="Zoom" min={0.2} max={4} step={0.01} value={posterArt.zoom} suffix="×" onChange={(v) => getEngine()?.setPosterImageZoom(v)} />
            <Slider label="Horizontal position" min={-60} max={60} step={1} value={posterArt.offsetX} suffix="%" onChange={(v) => getEngine()?.setPosterImageOffset(v, posterArt.offsetY)} />
            <Slider label="Vertical position" min={-60} max={60} step={1} value={posterArt.offsetY} suffix="%" onChange={(v) => getEngine()?.setPosterImageOffset(posterArt.offsetX, v)} />
            <p className="text-[10px] leading-relaxed text-ink-mute">The source artwork remains intact. Covering text adds a reversible overlay.</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span className="field-label">Text</span>
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
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[11px] text-ink-mute">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Double-click any text on the canvas to edit it in place.</span>
      </div>
    </div>
  );
}
