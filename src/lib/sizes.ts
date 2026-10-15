import type { CanvasSize } from "@/types/poster";

export const CANVAS_SIZES: CanvasSize[] = [
  { id: "poster-4x5", label: "Poster 4:5", width: 1080, height: 1350, group: "Portrait" },
  { id: "a4-portrait", label: "A4 Portrait", width: 1240, height: 1754, group: "Portrait" },
  { id: "story-9x16", label: "Story 9:16", width: 1080, height: 1920, group: "Story" },
  { id: "square-1x1", label: "Square 1:1", width: 1080, height: 1080, group: "Square" },
  { id: "social-4x5", label: "Social 4:5", width: 1080, height: 1350, group: "Square" },
  { id: "landscape-3x2", label: "Landscape 3:2", width: 1500, height: 1000, group: "Landscape" },
  { id: "wide-16x9", label: "Wide 16:9", width: 1600, height: 900, group: "Landscape" },
];

export function sizeById(id: string): CanvasSize | undefined {
  return CANVAS_SIZES.find((s) => s.id === id);
}

export const DEFAULT_SIZE = CANVAS_SIZES[0];
