import type { CanvasSize } from "@/types/poster";

/**
 * Canonical poster presets. Order is intentional: the five requested ratios
 * come first, followed by a few practical extras. `group` drives the picker
 * sections; `ratio` is the friendly aspect-ratio label.
 */
export const CANVAS_SIZES: CanvasSize[] = [
  { id: "portrait-2x3", label: "Portrait 2:3", ratio: "2:3", width: 1000, height: 1500, group: "Portrait" },
  { id: "social-4x5", label: "Social Portrait 4:5", ratio: "4:5", width: 1080, height: 1350, group: "Portrait" },
  { id: "square-1x1", label: "Square 1:1", ratio: "1:1", width: 1080, height: 1080, group: "Square" },
  { id: "landscape-3x2", label: "Landscape 3:2", ratio: "3:2", width: 1500, height: 1000, group: "Landscape" },
  { id: "story-9x16", label: "Story 9:16", ratio: "9:16", width: 1080, height: 1920, group: "Story" },
  { id: "a4-portrait", label: "A4 Portrait", ratio: "1:1.41", width: 1240, height: 1754, group: "Portrait" },
  { id: "wide-16x9", label: "Wide 16:9", ratio: "16:9", width: 1600, height: 900, group: "Landscape" },
];

export function sizeById(id: string): CanvasSize | undefined {
  return CANVAS_SIZES.find((s) => s.id === id);
}

/** Find the preset that matches a width/height pair, else undefined (custom). */
export function sizeByDimensions(width: number, height: number): CanvasSize | undefined {
  return CANVAS_SIZES.find((s) => s.width === width && s.height === height);
}

export const DEFAULT_SIZE = CANVAS_SIZES[0];
