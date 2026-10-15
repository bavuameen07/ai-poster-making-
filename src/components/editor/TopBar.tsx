"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FileText,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Type,
  Undo2,
  PanelLeft,
  PanelRight,
  Check,
  Loader2,
  AlertCircle,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { exportPDF, exportPNG } from "@/lib/export";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  idle: { label: "Draft", icon: <Cloud className="h-3.5 w-3.5" />, tone: "text-ink-mute" },
  saving: { label: "Saving…", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tone: "text-ink-soft" },
  saved: { label: "Saved locally", icon: <Check className="h-3.5 w-3.5" />, tone: "text-emerald-600" },
  dirty: { label: "Unsaved changes", icon: <Cloud className="h-3.5 w-3.5" />, tone: "text-ink-soft" },
  error: { label: "Save failed", icon: <AlertCircle className="h-3.5 w-3.5" />, tone: "text-danger" },
};

export interface TopBarProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function TopBar({ onToggleLeft, onToggleRight }: TopBarProps) {
  const name = useEditorStore((s) => s.doc.name);
  const zoom = useEditorStore((s) => s.zoom);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const exporting = useEditorStore((s) => s.exporting);
  const setExporting = useEditorStore((s) => s.setExporting);
  const setLastError = useEditorStore((s) => s.setLastError);

  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const status = STATUS[saveStatus] ?? STATUS.idle;

  const runExport = async (kind: "png" | "pdf", scale: number) => {
    setMenuOpen(false);
    setBusy(`${kind}-${scale}`);
    setExporting(true);
    try {
      if (kind === "png") await exportPNG({ scale });
      else await exportPDF({ scale });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
      setBusy(null);
    }
  };

  const changeZoom = (delta: number) => {
    const engine = getEngine();
    if (engine) engine.setZoom(useEditorStore.getState().zoom + delta);
  };

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
      <Link href="/" className="flex items-center gap-2 pr-1" title="Back to home">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white">
          <Type className="h-3.5 w-3.5" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Typeset</span>
      </Link>

      <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

      <IconButton label="Toggle templates panel" onClick={onToggleLeft} className="lg:hidden">
        <PanelLeft className="h-4 w-4" />
      </IconButton>

      <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <span className="sr-only">Project name</span>
        <input
          value={name}
          onChange={(e) => getEngine()?.setDocName(e.target.value)}
          className="h-8 w-full max-w-[240px] min-w-0 rounded-lg border border-transparent px-2 text-sm font-medium text-ink outline-none transition-colors hover:border-line focus:border-accent"
        />
      </label>

      <span className={cn("hidden items-center gap-1.5 text-xs font-medium sm:inline-flex", status.tone)}>
        {status.icon}
        {status.label}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo" onClick={() => getEngine()?.undo()} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
        <IconButton label="Redo" onClick={() => getEngine()?.redo()} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </IconButton>

        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

        <div className="hidden items-center gap-0.5 sm:flex">
          <IconButton label="Zoom out" onClick={() => changeZoom(-0.1)} disabled={zoom <= 0.12}>
            <Minus className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => getEngine()?.fitToViewport()}
            title="Fit to screen"
            className="h-8 min-w-[52px] rounded-lg px-1.5 text-center font-mono text-xs tabular-nums text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in" onClick={() => changeZoom(0.1)} disabled={zoom >= 2}>
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton label="Fit to screen" onClick={() => getEngine()?.fitToViewport()}>
            <Maximize className="h-4 w-4" />
          </IconButton>
        </div>

        <IconButton label="Toggle properties panel" onClick={onToggleRight} className="lg:hidden">
          <PanelRight className="h-4 w-4" />
        </IconButton>

        <div className="relative ml-1" ref={menuRef}>
          <Button variant="primary" size="sm" onClick={() => setMenuOpen((v) => !v)} loading={exporting}>
            {!exporting && <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export</span>
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-in overflow-hidden rounded-panel border border-line bg-panel shadow-pop">
              <div className="px-3 py-2">
                <p className="field-label">PNG</p>
              </div>
              <div className="pb-1">
                {[1, 2, 3].map((scale) => (
                  <button
                    key={`png-${scale}`}
                    type="button"
                    onClick={() => runExport("png", scale)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-paper"
                  >
                    <FileImage className="h-4 w-4 text-ink-mute" />
                    PNG · {scale}×
                    {busy === `png-${scale}` && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-line px-3 py-2">
                <p className="field-label">PDF (print)</p>
              </div>
              <div className="pb-1">
                {[2, 3].map((scale) => (
                  <button
                    key={`pdf-${scale}`}
                    type="button"
                    onClick={() => runExport("pdf", scale)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-paper"
                  >
                    <FileText className="h-4 w-4 text-ink-mute" />
                    PDF · {scale}×
                    {busy === `pdf-${scale}` && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
