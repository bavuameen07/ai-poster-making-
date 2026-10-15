import type { PosterBackground, LinearGradientBg } from "@/types/poster";
import { isLightColor } from "@/lib/utils";

export function isGradient(bg: PosterBackground): bg is LinearGradientBg {
  return typeof bg === "object" && bg !== null && bg.type === "linear";
}

export function backgroundToCss(bg: PosterBackground): string {
  if (typeof bg === "string") return bg;
  const stops = [...bg.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(", ");
  return `linear-gradient(${bg.angle}deg, ${stops})`;
}

export function idealTextColor(bg: PosterBackground): string {
  const hex =
    typeof bg === "string" ? bg : bg.stops[bg.stops.length - 1]?.color ?? "#000000";
  return isLightColor(hex) ? "#111111" : "#FFFFFF";
}

export const GRADIENT_PRESETS: LinearGradientBg[] = [
  { type: "linear", angle: 160, stops: [{ offset: 0, color: "#1D1D2B" }, { offset: 1, color: "#0A0A0B" }] },
  { type: "linear", angle: 135, stops: [{ offset: 0, color: "#FF8A5C" }, { offset: 1, color: "#FF2E63" }] },
  { type: "linear", angle: 180, stops: [{ offset: 0, color: "#F4F1EA" }, { offset: 1, color: "#DCD5C6" }] },
  { type: "linear", angle: 135, stops: [{ offset: 0, color: "#2A6BFF" }, { offset: 1, color: "#101B3B" }] },
  { type: "linear", angle: 200, stops: [{ offset: 0, color: "#00E5FF" }, { offset: 1, color: "#6C3BAA" }] },
  { type: "linear", angle: 160, stops: [{ offset: 0, color: "#0F3D2E" }, { offset: 1, color: "#07130F" }] },
  { type: "linear", angle: 135, stops: [{ offset: 0, color: "#FFE066" }, { offset: 1, color: "#FF9E4D" }] },
  { type: "linear", angle: 180, stops: [{ offset: 0, color: "#101014" }, { offset: 1, color: "#3B0F2B" }] },
  { type: "linear", angle: 135, stops: [{ offset: 0, color: "#F3E3DE" }, { offset: 1, color: "#E7C8BE" }] },
  { type: "linear", angle: 160, stops: [{ offset: 0, color: "#EEF0F3" }, { offset: 1, color: "#C7CCD3" }] },
];

export const SOLID_SWATCHES = [
  "#FFFFFF",
  "#F6F6F4",
  "#F4F1EA",
  "#EEF0F3",
  "#E7EDE4",
  "#F3E3DE",
  "#FFE066",
  "#FF5A3C",
  "#E11D2E",
  "#C9A227",
  "#1D4ED8",
  "#2563EB",
  "#00E5FF",
  "#3E6A4C",
  "#101B3B",
  "#0A0A0B",
  "#111111",
  "#000000",
];
