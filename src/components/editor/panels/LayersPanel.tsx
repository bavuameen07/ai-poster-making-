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
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { cn } from "@/lib/utils";

export function LayersPanel() {
  const layers = useEditorStore((s) => s.layers);
  const selectedId = useEditorStore((s) => s.selectedId);

  if (layers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-10 text-center">
        <LayersIcon className="h-5 w-5 text-ink-faint" />
        <p className="text-xs text-ink-mute">No layers yet. Add a text object to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
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
              className="min-w-0 flex-1 text-left"
              title={layer.text}
            >
              <span className="block truncate text-[13px] font-medium text-ink">{layer.name}</span>
              <span className="block truncate text-[10px] text-ink-faint">
                {layer.text.replace(/\n/g, " ").slice(0, 40) || "Empty"}
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
    </div>
  );
}
