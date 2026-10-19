"use client";

import { useEffect, useRef, useState } from "react";
import { getEngine, setEngine } from "@/lib/editor/engineRef";
import type { CanvasEngine } from "@/lib/editor/CanvasEngine";
import { useEditorStore } from "@/store/editorStore";

export interface CanvasStageProps {
  initialTemplateId?: string;
}

export function CanvasStage({ initialTemplateId }: CanvasStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const zoom = useEditorStore((s) => s.zoom);
  const doc = useEditorStore((s) => s.doc);

  useEffect(() => {
    let cancelled = false;
    let engine: CanvasEngine | null = null;
    const frame = frameRef.current;
    if (!frame) return;

    const canvasEl = document.createElement("canvas");
    frame.appendChild(canvasEl);

    (async () => {
      const mod = await import("@/lib/editor/CanvasEngine");
      if (cancelled) return;
      engine = new mod.CanvasEngine();
      setEngine(engine);
      try {
        await engine.mount(canvasEl, { templateId: initialTemplateId });
        const el = viewportRef.current;
        if (el) {
          engine.setViewport(el.clientWidth, el.clientHeight);
          engine.fitToViewport();
        }
      } catch (error) {
        console.error("Failed to initialise the editor canvas", error);
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      setEngine(null);
      engine?.dispose();
      if (canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    };
  }, [initialTemplateId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const engine = getEngine();
      if (engine) engine.setViewport(el.clientWidth, el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const displayWidth = Math.round(doc.width * zoom);
  const displayHeight = Math.round(doc.height * zoom);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-auto scrollbar-thin"
        style={{ background: "#EDEDEA" }}
      >
        <div className="grid min-h-full w-max min-w-full place-items-center p-10">
          <div
            ref={frameRef}
            className="poster-frame relative"
            style={{ width: displayWidth, height: displayHeight }}
          />
        </div>

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#EDEDEA]/80">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-ink-soft shadow-panel">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Preparing canvas…
            </span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2">
        <span className="rounded-md border border-line bg-panel/90 px-2 py-1 font-mono text-[11px] tabular-nums text-ink-soft shadow-panel backdrop-blur">
          {doc.width} × {doc.height} px
        </span>
        <span className="rounded-md border border-line bg-panel/90 px-2 py-1 font-mono text-[11px] tabular-nums text-ink-soft shadow-panel backdrop-blur">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
