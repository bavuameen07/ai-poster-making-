"use client";

import { useRef, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  BringToFront,
  SendToBack,
  SlidersHorizontal,
  Image as ImageIcon,
  ImageUp,
} from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { ColorField } from "@/components/ui/ColorField";
import { NumberInput } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editorStore";
import type { SelectedImageProps, SelectedObjectProps } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { FONTS, getFont, weightLabel } from "@/lib/fonts";
import type { TextAlign } from "@/types/poster";

export function RightSidebar() {
  const selected = useEditorStore((s) => s.selected);
  const background = useEditorStore((s) => s.doc.background);

  if (!selected) {
    return (
      <aside className="flex min-h-0 w-full flex-col border-line bg-panel lg:w-[320px] lg:border-l">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
          <SlidersHorizontal className="h-3.5 w-3.5 text-ink-mute" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Properties</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-line text-ink-faint">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <p className="max-w-[220px] text-xs leading-relaxed text-ink-mute">
            Select a text layer on the canvas to edit its typography, colour and effects.
          </p>
        </div>
      </aside>
    );
  }

  const engine = getEngine();

  if (selected.type === "image") {
    return <ImageProperties selected={selected} />;
  }

  const font = getFont(selected.fontFamily);
  const weights = font?.weights ?? [400, 700];
  const update = (patch: Parameters<NonNullable<typeof engine>["updateSelected"]>[0], commit: "now" | "soon" = "soon") =>
    engine?.updateSelected(patch, commit);

  return (
    <aside className="flex min-h-0 w-full flex-col border-line bg-panel lg:w-[320px] lg:border-l">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-ink-mute" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Properties</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Duplicate" className="h-7 w-7" onClick={() => void engine?.duplicateSelected()}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={selected.locked ? "Unlock" : "Lock"}
            className="h-7 w-7"
            onClick={() => update({ locked: !selected.locked }, "now")}
          >
            {selected.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton
            label={selected.visible ? "Hide" : "Show"}
            className="h-7 w-7"
            onClick={() => update({ visible: !selected.visible }, "now")}
          >
            {selected.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton label="Delete layer" tone="danger" className="h-7 w-7" onClick={() => engine?.deleteSelected()}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-thin p-3">
        <Group title="Typography">
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <span className="field-label">Font family</span>
              <Select
                ariaLabel="Font family"
                value={selected.fontFamily}
                onChange={(value) => update({ fontFamily: value }, "now")}
                options={FONTS.map((f) => ({
                  value: f.family,
                  label: f.label,
                  style: { fontFamily: `"${f.family}", sans-serif` },
                }))}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <span className="field-label">Weight</span>
                <Select
                  ariaLabel="Font weight"
                  value={String(selected.fontWeight)}
                  onChange={(value) => update({ fontWeight: Number(value) }, "now")}
                  options={weights.map((w) => ({ value: String(w), label: `${w} · ${weightLabel(w)}` }))}
                />
              </div>
              <Segmented
                size="sm"
                value={selected.fontStyle}
                onChange={(value) => update({ fontStyle: value as "normal" | "italic" }, "now")}
                options={[
                  { value: "normal", label: <Bold className="h-3.5 w-3.5" />, title: "Normal" },
                  { value: "italic", label: <Italic className="h-3.5 w-3.5" />, title: "Italic" },
                ]}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Slider
                  label="Size"
                  min={6}
                  max={400}
                  step={1}
                  value={selected.fontSize}
                  suffix="px"
                  onChange={(v) => update({ fontSize: Math.round(v) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="field-label">Alignment</span>
              <Segmented
                value={selected.textAlign}
                onChange={(value) => update({ textAlign: value as TextAlign }, "now")}
                options={[
                  { value: "left", label: <AlignLeft className="h-3.5 w-3.5" />, title: "Left" },
                  { value: "center", label: <AlignCenter className="h-3.5 w-3.5" />, title: "Center" },
                  { value: "right", label: <AlignRight className="h-3.5 w-3.5" />, title: "Right" },
                  { value: "justify", label: <AlignJustify className="h-3.5 w-3.5" />, title: "Justify" },
                ]}
              />
            </div>

            <Slider
              label="Letter spacing"
              min={-50}
              max={800}
              step={5}
              value={selected.charSpacing}
              onChange={(v) => update({ charSpacing: Math.round(v) })}
            />
            <Slider
              label="Line height"
              min={0.7}
              max={2.4}
              step={0.02}
              value={selected.lineHeight}
              onChange={(v) => update({ lineHeight: v })}
            />
          </div>
        </Group>

        <Group title="Colour">
          <div className="space-y-3">
            <ColorField label="Text colour" value={selected.fill} onChange={(v) => update({ fill: v })} />
            <ColorField
              label="Highlight / accent"
              value={selected.backgroundColor || ""}
              allowClear
              onClear={() => update({ backgroundColor: "" }, "now")}
              onChange={(v) => update({ backgroundColor: v })}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="field-label">Outline</span>
                <span className="font-mono text-[11px] text-ink-soft">{selected.strokeWidth}px</span>
              </div>
              <ColorField
                value={selected.stroke || "#111111"}
                onChange={(v) => update({ stroke: v, strokeWidth: selected.strokeWidth || 2 })}
              />
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={selected.strokeWidth}
                onChange={(e) => {
                  const width = Number(e.target.value);
                  update({ strokeWidth: width, stroke: width > 0 ? selected.stroke || "#111111" : selected.stroke });
                }}
              />
            </div>
            <Slider
              label="Opacity"
              min={0.05}
              max={1}
              step={0.01}
              value={selected.opacity}
              onChange={(v) => update({ opacity: v })}
            />
          </div>
        </Group>

        <Group title="Shadow">
          <ShadowControls selected={selected} update={update} />
        </Group>

        <Group title="Transform">
          <div className="space-y-3">
            <Slider
              label="Rotation"
              min={-180}
              max={180}
              step={1}
              value={selected.angle}
              suffix="°"
              onChange={(v) => update({ angle: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="field-label">X</span>
                <NumberInput
                  value={selected.left}
                  onChange={(e) => update({ left: Number(e.target.value) }, "now")}
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">Y</span>
                <NumberInput
                  value={selected.top}
                  onChange={(e) => update({ top: Number(e.target.value) }, "now")}
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">Width</span>
                <NumberInput
                  min={40}
                  value={selected.width}
                  onChange={(e) => update({ width: Math.max(40, Number(e.target.value)) }, "now")}
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">Height</span>
                <NumberInput value={selected.height} readOnly className="opacity-60" />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selected && getEngine()?.moveLayer(selected.id, "top")}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                <BringToFront className="h-3.5 w-3.5" /> Front
              </button>
              <button
                type="button"
                onClick={() => selected && getEngine()?.moveLayer(selected.id, "bottom")}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                <SendToBack className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </div>
        </Group>

        <p className="px-0.5 pb-2 text-[10px] leading-relaxed text-ink-faint">
          Editing against {typeof background === "string" ? background.toUpperCase() : "a gradient"} background.
        </p>
      </div>
    </aside>
  );
}

function ImageProperties({ selected }: { selected: SelectedImageProps }) {
  const engine = getEngine();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<SelectedImageProps>, commit: "now" | "soon" = "soon") =>
    engine?.updateSelectedImage(patch, commit);

  const onReplace = async (file: File | undefined) => {
    if (!file || !engine) return;
    setError(null);
    setBusy(true);
    try {
      await engine.replaceSelectedImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not replace that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex min-h-0 w-full flex-col border-line bg-panel lg:w-[320px] lg:border-l">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-ink-mute" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Image</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Duplicate" className="h-7 w-7" onClick={() => void engine?.duplicateSelected()}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={selected.locked ? "Unlock" : "Lock"}
            className="h-7 w-7"
            onClick={() => update({ locked: !selected.locked }, "now")}
          >
            {selected.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton
            label={selected.visible ? "Hide" : "Show"}
            className="h-7 w-7"
            onClick={() => update({ visible: !selected.visible }, "now")}
          >
            {selected.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton label="Delete layer" tone="danger" className="h-7 w-7" onClick={() => engine?.deleteSelected()}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-thin p-3">
        <Group title="Source">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-line bg-panel text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
          >
            <ImageUp className="h-3.5 w-3.5" /> {busy ? "Loading…" : "Replace image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void onReplace(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="text-[10px] leading-relaxed text-ink-faint">
            JPG, PNG or WebP · up to 15 MB. Drag the corners on the canvas to resize.
          </p>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </Group>

        <Group title="Adjust">
          <Slider
            label="Opacity"
            min={0.05}
            max={1}
            step={0.01}
            value={selected.opacity}
            onChange={(v) => update({ opacity: v })}
          />
        </Group>

        <Group title="Transform">
          <div className="space-y-3">
            <Slider
              label="Rotation"
              min={-180}
              max={180}
              step={1}
              value={selected.angle}
              suffix="°"
              onChange={(v) => update({ angle: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="field-label">X</span>
                <NumberInput value={selected.left} onChange={(e) => update({ left: Number(e.target.value) }, "now")} />
              </label>
              <label className="space-y-1">
                <span className="field-label">Y</span>
                <NumberInput value={selected.top} onChange={(e) => update({ top: Number(e.target.value) }, "now")} />
              </label>
              <label className="space-y-1">
                <span className="field-label">Width</span>
                <NumberInput
                  min={8}
                  value={selected.width}
                  onChange={(e) => update({ width: Math.max(8, Number(e.target.value)) }, "now")}
                />
              </label>
              <label className="space-y-1">
                <span className="field-label">Height</span>
                <NumberInput
                  min={8}
                  value={selected.height}
                  onChange={(e) => update({ height: Math.max(8, Number(e.target.value)) }, "now")}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => getEngine()?.moveLayer(selected.id, "top")}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                <BringToFront className="h-3.5 w-3.5" /> Front
              </button>
              <button
                type="button"
                onClick={() => getEngine()?.moveLayer(selected.id, "bottom")}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                <SendToBack className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </div>
        </Group>

        <p className="px-0.5 pb-2 text-[10px] leading-relaxed text-ink-faint">
          Hold the top handle to rotate. Use the Layers tab to reorder or hide this image.
        </p>
      </div>
    </aside>
  );
}

function ShadowControls({
  selected,
  update,
}: {
  selected: SelectedObjectProps;
  update: (patch: Record<string, unknown>, commit?: "now" | "soon") => void;
}) {
  const shadow = selected.shadow;
  const enabled = Boolean(shadow);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-soft">Drop shadow</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() =>
            update(
              enabled
                ? { shadow: null }
                : { shadow: { color: "#00000066", blur: 18, offsetX: 0, offsetY: 10 } },
              "now",
            )
          }
          className={
            "relative h-5 w-9 rounded-full transition-colors " + (enabled ? "bg-accent" : "bg-line")
          }
        >
          <span
            className={
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all " +
              (enabled ? "left-[18px]" : "left-0.5")
            }
          />
        </button>
      </div>

      {enabled && shadow && (
        <div className="space-y-3">
          <ColorField
            label="Shadow colour"
            value={shadow.color.length > 7 ? shadow.color.slice(0, 7) : shadow.color}
            onChange={(v) => update({ shadow: { ...shadow, color: v } })}
          />
          <Slider
            label="Blur"
            min={0}
            max={80}
            step={1}
            value={shadow.blur}
            onChange={(v) => update({ shadow: { ...shadow, blur: Math.round(v) } })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Slider
              label="Offset X"
              min={-50}
              max={50}
              step={1}
              value={shadow.offsetX}
              onChange={(v) => update({ shadow: { ...shadow, offsetX: Math.round(v) } })}
            />
            <Slider
              label="Offset Y"
              min={-50}
              max={50}
              step={1}
              value={shadow.offsetY}
              onChange={(v) => update({ shadow: { ...shadow, offsetY: Math.round(v) } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h4>
      {children}
    </section>
  );
}
