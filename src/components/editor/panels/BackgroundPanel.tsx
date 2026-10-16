"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  RectangleHorizontal,
  Sparkles,
  Trash2,
  Move,
  Layers3,
  Camera,
  Wand2,
  Undo2,
  LayoutTemplate,
} from "lucide-react";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { CANVAS_SIZES } from "@/lib/sizes";
import { GRADIENT_PRESETS, SOLID_SWATCHES, backgroundToCss, isGradient } from "@/lib/background";
import { PALETTES } from "@/lib/palettes";
import { cn } from "@/lib/utils";
import type { ImageFit, LinearGradientBg } from "@/types/poster";
import type { LayoutId } from "@/lib/autoLayout";
import { GradientEditor } from "./GradientEditor";
import { LayoutPreviewCard } from "./LayoutPreviewCard";

type BgTab = "colour" | "gradient" | "image";

const DEFAULT_GRADIENT: LinearGradientBg = {
  type: "linear",
  angle: 135,
  stops: [
    { offset: 0, color: "#2A6BFF" },
    { offset: 1, color: "#101B3B" },
  ],
};

export function BackgroundPanel() {
  const doc = useEditorStore((s) => s.doc);
  const background = doc.background;
  const bgImage = useEditorStore((s) => s.bgImage);
  const setLastError = useEditorStore((s) => s.setLastError);
  const autoStyleText = useEditorStore((s) => s.autoStyleText);
  const autoArrangeOnUpload = useEditorStore((s) => s.autoArrangeOnUpload);
  const setAutoStyleText = useEditorStore((s) => s.setAutoStyleText);
  const setAutoArrangeOnUpload = useEditorStore((s) => s.setAutoArrangeOnUpload);

  const [tab, setTab] = useState<BgTab>(isGradient(background) ? "gradient" : "colour");
  const [scaleContent, setScaleContent] = useState(true);
  const [gradient, setGradient] = useState<LinearGradientBg>(
    isGradient(background) ? background : DEFAULT_GRADIENT,
  );
  const [uploading, setUploading] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<LayoutId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGradient(background)) setGradient(background);
  }, [background]);

  // Refresh the estimated compositions whenever the visible photo composition
  // changes (fit, zoom, offset, opacity) or the auto-colour setting changes.
  const previews = useMemo(() => {
    const engine = getEngine();
    if (!engine || !bgImage?.present) return [];
    if (doc.width <= 0 || doc.height <= 0) return [];
    return engine.getLayoutPreviews(autoStyleText);
  }, [bgImage, doc.width, doc.height, autoStyleText]);

  const previewSrc = useMemo(() => {
    const engine = getEngine();
    return engine && bgImage?.present ? engine.getBackgroundImageSrc() : null;
  }, [bgImage]);

  useEffect(() => {
    const engine = getEngine();
    if (!bgImage?.present) {
      setSelectedLayout(null);
      return;
    }
    setSelectedLayout(engine?.suggestedLayout() ?? null);
  }, [bgImage?.present, bgImage?.name]);

  const solidValue =
    typeof background === "string" ? background : background.stops[0]?.color ?? "#ffffff";
  const currentSizeId =
    CANVAS_SIZES.find((s) => s.width === doc.width && s.height === doc.height)?.id ?? "custom";

  const applyGradient = (next: LinearGradientBg, commit: boolean) => {
    setGradient(next);
    const engine = getEngine();
    if (!engine) return;
    engine.applyBackground(next, true);
    if (commit) engine.commit();
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    const engine = getEngine();
    if (!engine) return;
    setUploading(true);
    try {
      await engine.setBackgroundImage(file);
      if (useEditorStore.getState().autoArrangeOnUpload) {
        const result = engine.autoArrangeText();
        if (result) setSelectedLayout(result.layoutId);
        if (result && result.applied === 0) {
          setLastError("Image added. Add a text layer to use automatic arrangement.");
        }
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Could not use that image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runAutoArrange = () => {
    const engine = getEngine();
    if (!engine) return;
    setArranging(true);
    try {
      const result = engine.autoArrangeText();
      if (!result) return;
      setSelectedLayout(result.layoutId);
      if (result.applied === 0) setLastError("There are no text layers to arrange yet.");
    } finally {
      setArranging(false);
    }
  };

  const applySelectedLayout = () => {
    const engine = getEngine();
    if (!engine || !selectedLayout) return;
    const result = engine.applyLayout(selectedLayout);
    if (result.applied === 0) setLastError("There are no text layers to arrange yet.");
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="field-label">Canvas size</p>
        <Select
          ariaLabel="Canvas size"
          value={currentSizeId}
          onChange={(id) => {
            const size = CANVAS_SIZES.find((s) => s.id === id);
            if (size) getEngine()?.resizeCanvas(size.width, size.height, { scaleContent });
          }}
          options={[
            ...(currentSizeId === "custom"
              ? [{ value: "custom", label: `Custom · ${doc.width}×${doc.height}` }]
              : []),
            ...CANVAS_SIZES.map((s) => ({
              value: s.id,
              label: `${s.ratio} — ${s.label} · ${s.width}×${s.height}`,
            })),
          ]}
        />
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-panel px-2.5 py-2">
          <span className="text-xs text-ink-soft">Scale existing content</span>
          <input
            type="checkbox"
            checked={scaleContent}
            onChange={(e) => setScaleContent(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--accent,#1D4ED8)]"
          />
        </label>
      </section>

      <section className="space-y-3">
        <Segmented
          className="w-full [&>button]:flex-1"
          value={tab}
          onChange={(value) => setTab(value as BgTab)}
          options={[
            { value: "colour", label: "Colour" },
            { value: "gradient", label: "Gradient" },
            { value: "image", label: "Image" },
          ]}
        />

        {tab === "colour" && (
          <div className="space-y-3">
            <ColorField value={solidValue} onChange={(value) => getEngine()?.setBackground(value)} />
            <div className="grid grid-cols-9 gap-1.5">
              {SOLID_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  onClick={() => getEngine()?.setBackground(swatch)}
                  className={cn(
                    "aspect-square rounded-md border transition-transform hover:scale-110",
                    typeof background === "string" && solidValue.toLowerCase() === swatch.toLowerCase()
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-line",
                  )}
                  style={{ background: swatch }}
                />
              ))}
            </div>
            <div className="space-y-2 pt-1">
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
            </div>
          </div>
        )}

        {tab === "gradient" && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-ink-mute" />
              <p className="field-label">Presets</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {GRADIENT_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  title={`Gradient ${index + 1}`}
                  onClick={() => applyGradient(preset, true)}
                  className="aspect-square rounded-md border border-line transition-transform hover:scale-105"
                  style={{ background: backgroundToCss(preset) }}
                />
              ))}
            </div>
            <GradientEditor
              value={gradient}
              onChange={(next) => applyGradient(next, false)}
              onCommit={() => getEngine()?.commit()}
            />
          </div>
        )}

        {tab === "image" && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0])}
            />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPickImage(e.dataTransfer.files?.[0]);
              }}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-paper px-4 py-6 text-center"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-ink-mute">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </span>
              <p className="text-[11px] leading-relaxed text-ink-mute">
                Drag &amp; drop or choose a JPG, PNG or WebP (under 15&nbsp;MB).
              </p>
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-3.5 w-3.5" /> Choose image
              </Button>
            </div>

            {bgImage?.present ? (
              <div className="space-y-3 rounded-lg border border-line bg-panel p-2.5">
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 shrink-0 text-ink-mute" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                    {bgImage.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove background image"
                    onClick={() => getEngine()?.removeBackgroundImage()}
                    className="rounded-md p-1 text-ink-mute transition-colors hover:bg-black/5 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="field-label">Fit</span>
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    size="sm"
                    value={bgImage.fit === "custom" ? "cover" : bgImage.fit}
                    onChange={(value) => getEngine()?.setBackgroundImageFit(value as ImageFit)}
                    options={[
                      { value: "cover", label: "Cover" },
                      { value: "contain", label: "Contain" },
                      { value: "stretch", label: "Stretch" },
                    ]}
                  />
                </div>

                {bgImage.fit !== "stretch" && (
                  <Slider
                    label="Zoom"
                    min={0.2}
                    max={4}
                    step={0.01}
                    value={bgImage.zoom}
                    suffix="×"
                    onChange={(v) => getEngine()?.setBackgroundImageZoom(v)}
                  />
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Move className="h-3 w-3 text-ink-mute" />
                    <span className="field-label">Position</span>
                  </div>
                  <Slider
                    label="Horizontal"
                    min={-60}
                    max={60}
                    step={1}
                    value={bgImage.offsetX}
                    suffix="%"
                    onChange={(v) => getEngine()?.setBackgroundImageOffset(v, bgImage.offsetY)}
                  />
                  <Slider
                    label="Vertical"
                    min={-60}
                    max={60}
                    step={1}
                    value={bgImage.offsetY}
                    suffix="%"
                    onChange={(v) => getEngine()?.setBackgroundImageOffset(bgImage.offsetX, v)}
                  />
                </div>

                <Slider
                  label="Opacity"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={bgImage.opacity}
                  onChange={(v) => getEngine()?.setBackgroundImageOpacity(v)}
                />
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[11px] text-ink-mute">
                <Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>The background image sits behind every text layer.</span>
              </div>
            )}

            {bgImage?.present && (
              <div className="space-y-3 rounded-lg border border-line bg-panel p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-wash text-accent">
                    <Wand2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">Intelligent layout</p>
                    <p className="text-[11px] text-ink-mute">Reposition your text to suit the photo</p>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-ink-mute">
                  Your words are never changed — only moved, resized and styled for balance and
                  readability.
                </p>

                {previews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {previews.map((preview) => (
                      <LayoutPreviewCard
                        key={preview.id}
                        preview={preview}
                        doc={doc}
                        src={previewSrc}
                        active={selectedLayout === preview.id}
                        onSelect={() => setSelectedLayout(preview.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-line px-2.5 py-3 text-center text-[11px] text-ink-faint">
                    Preparing layout estimates…
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    loading={arranging}
                    onClick={runAutoArrange}
                  >
                    {!arranging && <Wand2 className="h-3.5 w-3.5" />}
                    Auto arrange
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!selectedLayout}
                    onClick={applySelectedLayout}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" /> Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Undo layout change"
                    title="Undo layout change"
                    onClick={() => getEngine()?.undo()}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-1.5 border-t border-line pt-2.5">
                  <ToggleRow
                    label="Auto arrange after upload"
                    checked={autoArrangeOnUpload}
                    onChange={setAutoArrangeOnUpload}
                  />
                  <ToggleRow
                    label="Automatic text colour"
                    checked={autoStyleText}
                    onChange={setAutoStyleText}
                  />
                </div>

                <p className="text-[10px] leading-relaxed text-ink-faint">
                  Placement uses local brightness, contrast and edge analysis. It does not detect
                  faces or specific objects — treat the suggestions as a starting point.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-xs text-ink-soft">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
