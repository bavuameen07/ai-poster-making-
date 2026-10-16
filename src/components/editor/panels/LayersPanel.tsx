"use client";

import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Layers as LayersIcon,
  Type,
  Image as ImageIcon,
  ScanText,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { DetectedTextRegion } from "@/types/poster";
import { useState } from "react";
import { Loader2, Paintbrush, Plus } from "lucide-react";

export function LayersPanel() {
  const layers = useEditorStore((s) => s.layers);
  const selectedId = useEditorStore((s) => s.selectedId);
  const detectedText = useEditorStore((s) => s.detectedText);
  const setDetectedText = useEditorStore((s) => s.setDetectedText);
  const imageMode = useEditorStore((s) => s.imageMode);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractText = async () => {
    const engine = getEngine();
    const source = engine?.getPosterImageForOCR();
    if (!engine || !source) { setError("Upload an image in Poster Image Mode first."); return; }
    setError(null); setProgress(0); setWorking(true);
    let worker: import("tesseract.js").Worker | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(source.dataUrl, {}, { blocks: true });
      const lines = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) ?? [];
      const regions = engine.mapOCRRegions(lines.map((line) => ({
        text: line.text,
        confidence: line.confidence,
        left: line.bbox.x0,
        top: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0,
      })));
      setDetectedText(regions);
      engine.persistNow();
      if (!regions.length) setError("No text was found. Try a clearer, higher-resolution image.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Text extraction failed. Please try again.");
    } finally {
      await worker?.terminate();
      setWorking(false);
    }
  };

  const updateRegion = (id: string, patch: Partial<DetectedTextRegion>) => {
    const updated = detectedText.map((region) => region.id === id ? { ...region, ...patch } : region);
    setDetectedText(updated);
    getEngine()?.persistNow();
  };

  const coverRegion = (region: DetectedTextRegion) => {
    try {
      getEngine()?.coverOCRRegion(region);
      updateRegion(region.id, { covered: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cover this text region.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-lg border border-line bg-paper p-2.5">
        <div className="flex items-center gap-2">
          <ScanText className="h-4 w-4 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">Poster text recognition</p>
            <p className="text-[10px] text-ink-mute">Local English OCR finds text; it cannot remove pixels from the source.</p>
          </div>
        </div>
        <Button size="sm" variant="primary" className="w-full" onClick={extractText} loading={working} disabled={imageMode !== "poster"}>
          {!working && <ScanText className="h-3.5 w-3.5" />} Extract Text
        </Button>
        {working && <div className="flex items-center gap-2 text-[11px] text-ink-soft"><Loader2 className="h-3 w-3 animate-spin" /> Recognizing text… {progress}%</div>}
        {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
        {detectedText.map((region) => (
          <div key={region.id} className="space-y-2 rounded-md border border-line bg-panel p-2">
            <label className="block space-y-1">
              <span className="flex justify-between text-[10px] text-ink-mute"><span>Edit Text · {region.confidence}%</span><span>{Math.round(region.left)},{Math.round(region.top)}</span></span>
              <textarea value={region.text} onChange={(e) => updateRegion(region.id, { text: e.target.value })} rows={2} className="w-full resize-y rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none focus:border-accent" />
            </label>
            <div className="flex gap-1.5">
              <Button size="sm" className="min-w-0 flex-1 px-2 text-[11px]" onClick={() => coverRegion(region)} disabled={region.covered}>
                <Paintbrush className="h-3 w-3" /> {region.covered ? "Covered" : "Cover Original Text"}
              </Button>
              <Button size="sm" variant="secondary" className="min-w-0 flex-1 px-2 text-[11px]" onClick={() => void getEngine()?.addOCRReplacement(region, region.text)}>
                <Plus className="h-3 w-3" /> Add Replacement Text
              </Button>
            </div>
          </div>
        ))}
        {detectedText.length > 0 && <p className="text-[10px] leading-relaxed text-ink-mute">Cover uses nearby colour samples and works best on flat backgrounds. Textured artwork or photos need advanced AI inpainting for a natural repair.</p>}
      </section>
      <section className="space-y-1">
        <p className="field-label">Canvas layers</p>
        {layers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
            <LayersIcon className="h-5 w-5 text-ink-faint" />
            <p className="text-xs text-ink-mute">No editable layers yet.</p>
          </div>
        ) : <>
      {layers.map((layer, index) => {
        const active = layer.id === selectedId;
        return (
          <div
            key={layer.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition-colors",
              active ? "border-accent/40 bg-accent-wash" : "border-transparent hover:bg-black/[0.035]",
            )}
          >
            <button
              type="button"
              onClick={() => getEngine()?.selectById(layer.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={layer.name}
            >
              {layer.kind === "image" ? (
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              ) : (
                <Type className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{layer.name}</span>
                <span className="block truncate text-[10px] text-ink-faint">
                  {layer.kind === "image"
                    ? "Image"
                    : layer.text.replace(/\n/g, " ").slice(0, 40) || "Empty"}
                </span>
              </span>
            </button>

            <IconButton
              label={layer.visible ? "Hide layer" : "Show layer"}
              className="h-7 w-7"
              onClick={() => getEngine()?.toggleVisibility(layer.id)}
            >
              {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton
              label={layer.locked ? "Unlock layer" : "Lock layer"}
              className="h-7 w-7"
              onClick={() => getEngine()?.toggleLock(layer.id)}
            >
              {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </IconButton>

            <div className="flex flex-col">
              <IconButton
                label="Bring forward"
                className="h-4 w-7 rounded-md"
                disabled={index === 0}
                onClick={() => getEngine()?.moveLayer(layer.id, "up")}
              >
                <ChevronUp className="h-3 w-3" />
              </IconButton>
              <IconButton
                label="Send backward"
                className="h-4 w-7 rounded-md"
                disabled={index === layers.length - 1}
                onClick={() => getEngine()?.moveLayer(layer.id, "down")}
              >
                <ChevronDown className="h-3 w-3" />
              </IconButton>
            </div>

            <div className="hidden items-center group-hover:flex">
              <IconButton
                label="Duplicate layer"
                className="h-7 w-7"
                onClick={() => {
                  getEngine()?.selectById(layer.id);
                  void getEngine()?.duplicateSelected();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Delete layer"
                tone="danger"
                className="h-7 w-7"
                onClick={() => {
                  getEngine()?.selectById(layer.id);
                  getEngine()?.deleteSelected();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        );
      })}
        </>}
      </section>
    </div>
  );
}
