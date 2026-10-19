import type { PosterBackground, TextAlign, TextShadow } from "@/types/poster";
import { nearestWeight } from "@/lib/fonts";
import { clamp } from "@/lib/utils";

/**
 * Lightweight, dependency-free image analysis + typography layout planning.
 *
 * IMPORTANT: this module does NOT perform face or object recognition. It uses
 * local brightness, contrast, colourfulness and edge heuristics to estimate
 * where the visually "busy" or "quiet" parts of an image are. Those estimates
 * are only ever used as soft placement hints, and the UI labels them honestly.
 */

export interface DocSize {
  width: number;
  height: number;
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextRole = "headline" | "subhead" | "quote" | "body" | "eyebrow";

export type LayoutId =
  | "editorial-top"
  | "centered-focus"
  | "cinematic-bottom"
  | "modern-left"
  | "minimal";

export interface ImageAnalysis {
  docWidth: number;
  docHeight: number;
  resW: number;
  resH: number;
  /** Mean sRGB luminance (0..1) per analysed pixel. */
  luminance: Float32Array;
  /** Edge energy (0..1) per analysed pixel — a proxy for visual detail. */
  detail: Float32Array;
  /** Colourfulness (0..1) per analysed pixel. */
  color: Float32Array;
  /** Average channel values (0..255) per analysed pixel. */
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  avgLuminance: number;
  avgDetail: number;
  /** Normalised bounding box of the estimated focal area, or null if unclear. */
  subject: NormRect | null;
  subjectCoverage: number;
}

export interface RegionSample {
  r: number;
  g: number;
  b: number;
  luminance: number;
  detail: number;
  color: number;
}

export interface LayoutSlot {
  role: TextRole | "any";
  rect: NormRect;
  align: TextAlign;
}

export interface LayoutDef {
  id: LayoutId;
  name: string;
  description: string;
  slots: LayoutSlot[];
}

export interface PlanInput {
  id: string;
  text: string;
  name?: string;
  role: TextRole;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  textAlign: TextAlign;
  charSpacing: number;
  lineHeight: number;
  fill: string;
  shadow: TextShadow | null;
  backgroundColor?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type Readability = "good" | "shadow" | "panel";

export interface PlacementPlan {
  id: string;
  role: TextRole;
  layoutId: LayoutId;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  charSpacing: number;
  lineHeight: number;
  textAlign: TextAlign;
  fill: string;
  shadow: TextShadow | null;
  backgroundColor: string;
  stroke: string;
  strokeWidth: number;
  overSubject: boolean;
  readability: Readability;
  contrastRatio: number;
}

export interface LayoutPreview {
  id: LayoutId;
  name: string;
  description: string;
  placements: PlacementPlan[];
}

export interface AnalyzeSource {
  /** The decoded image element to sample (data URL sources are same-origin). */
  element: CanvasImageSource | null;
  naturalWidth: number;
  naturalHeight: number;
  /** Placement of the image within the document, in document pixels. */
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

const ANALYSIS_MAX = 128;
const ANALYSIS_MIN = 24;
const SAFE = 0.05;

export const LAYOUTS: LayoutDef[] = [
  {
    id: "editorial-top",
    name: "Top editorial",
    description: "Headline anchored high with a stacked left-aligned editorial column.",
    slots: [
      { role: "eyebrow", rect: { x: 0.09, y: 0.06, w: 0.6, h: 0.045 }, align: "left" },
      { role: "headline", rect: { x: 0.09, y: 0.12, w: 0.82, h: 0.22 }, align: "left" },
      { role: "subhead", rect: { x: 0.09, y: 0.36, w: 0.62, h: 0.07 }, align: "left" },
      { role: "quote", rect: { x: 0.09, y: 0.45, w: 0.6, h: 0.16 }, align: "left" },
      { role: "body", rect: { x: 0.09, y: 0.63, w: 0.62, h: 0.2 }, align: "left" },
      { role: "any", rect: { x: 0.09, y: 0.85, w: 0.6, h: 0.09 }, align: "left" },
    ],
  },
  {
    id: "centered-focus",
    name: "Centered",
    description: "Symmetric centred typography built around a strong vertical axis.",
    slots: [
      { role: "eyebrow", rect: { x: 0.18, y: 0.1, w: 0.64, h: 0.045 }, align: "center" },
      { role: "headline", rect: { x: 0.08, y: 0.17, w: 0.84, h: 0.22 }, align: "center" },
      { role: "subhead", rect: { x: 0.15, y: 0.41, w: 0.7, h: 0.06 }, align: "center" },
      { role: "quote", rect: { x: 0.14, y: 0.49, w: 0.72, h: 0.16 }, align: "center" },
      { role: "body", rect: { x: 0.18, y: 0.67, w: 0.64, h: 0.18 }, align: "center" },
      { role: "any", rect: { x: 0.15, y: 0.86, w: 0.7, h: 0.08 }, align: "center" },
    ],
  },
  {
    id: "cinematic-bottom",
    name: "Cinematic",
    description: "Headline low with generous sky or subject space above.",
    slots: [
      { role: "eyebrow", rect: { x: 0.14, y: 0.37, w: 0.72, h: 0.04 }, align: "center" },
      { role: "headline", rect: { x: 0.08, y: 0.43, w: 0.84, h: 0.24 }, align: "center" },
      { role: "quote", rect: { x: 0.14, y: 0.685, w: 0.72, h: 0.11 }, align: "center" },
      { role: "subhead", rect: { x: 0.14, y: 0.81, w: 0.72, h: 0.05 }, align: "center" },
      { role: "body", rect: { x: 0.16, y: 0.87, w: 0.68, h: 0.07 }, align: "center" },
      { role: "any", rect: { x: 0.18, y: 0.6, w: 0.64, h: 0.06 }, align: "center" },
    ],
  },
  {
    id: "modern-left",
    name: "Modern left",
    description: "A bold left-aligned stack that leaves the right side breathing.",
    slots: [
      { role: "eyebrow", rect: { x: 0.08, y: 0.08, w: 0.5, h: 0.045 }, align: "left" },
      { role: "headline", rect: { x: 0.08, y: 0.15, w: 0.6, h: 0.28 }, align: "left" },
      { role: "subhead", rect: { x: 0.08, y: 0.46, w: 0.5, h: 0.06 }, align: "left" },
      { role: "quote", rect: { x: 0.08, y: 0.54, w: 0.5, h: 0.15 }, align: "left" },
      { role: "body", rect: { x: 0.08, y: 0.71, w: 0.46, h: 0.17 }, align: "left" },
      { role: "any", rect: { x: 0.08, y: 0.89, w: 0.5, h: 0.05 }, align: "left" },
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Quiet type with deliberate negative space and small supporting copy.",
    slots: [
      { role: "eyebrow", rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.04 }, align: "left" },
      { role: "headline", rect: { x: 0.1, y: 0.16, w: 0.52, h: 0.17 }, align: "left" },
      { role: "quote", rect: { x: 0.1, y: 0.36, w: 0.5, h: 0.13 }, align: "left" },
      { role: "subhead", rect: { x: 0.1, y: 0.52, w: 0.42, h: 0.05 }, align: "left" },
      { role: "body", rect: { x: 0.1, y: 0.6, w: 0.4, h: 0.24 }, align: "left" },
      { role: "any", rect: { x: 0.1, y: 0.87, w: 0.42, h: 0.07 }, align: "left" },
    ],
  },
];

export function getLayout(id: LayoutId): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function analysisSize(doc: DocSize): { resW: number; resH: number } {
  const maxSide = Math.max(1, Math.max(doc.width, doc.height));
  const factor = ANALYSIS_MAX / maxSide;
  return {
    resW: clamp(Math.round(doc.width * factor), ANALYSIS_MIN, ANALYSIS_MAX),
    resH: clamp(Math.round(doc.height * factor), ANALYSIS_MIN, ANALYSIS_MAX),
  };
}

/**
 * Analyse a drawn, document-sized (downscaled) composite of the background.
 * Everything runs locally on the canvas — no network calls, no cost.
 */
export function analyzeImageData(data: ImageData, doc: DocSize): ImageAnalysis {
  const { width: resW, height: resH, data: px } = data;
  const total = resW * resH;
  const luminance = new Float32Array(total);
  const detail = new Float32Array(total);
  const color = new Float32Array(total);
  const red = new Float32Array(total);
  const green = new Float32Array(total);
  const blue = new Float32Array(total);

  let sumLum = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    luminance[i] = lum;
    color[i] = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    red[i] = r;
    green[i] = g;
    blue[i] = b;
    sumLum += lum;
  }

  let sumDetail = 0;
  for (let y = 0; y < resH; y++) {
    for (let x = 0; x < resW; x++) {
      const i = y * resW + x;
      const gx = x < resW - 1 ? Math.abs(luminance[i] - luminance[i + 1]) : 0;
      const gy = y < resH - 1 ? Math.abs(luminance[i] - luminance[i + resW]) : 0;
      const mag = clamp(Math.hypot(gx, gy) * 3.2, 0, 1);
      detail[i] = mag;
      sumDetail += mag;
    }
  }

  const avgLuminance = total ? sumLum / total : 0;
  const avgDetail = total ? sumDetail / total : 0;
  const subject = estimateSubject(luminance, detail, color, resW, resH);

  return {
    docWidth: doc.width,
    docHeight: doc.height,
    resW,
    resH,
    luminance,
    detail,
    color,
    red,
    green,
    blue,
    avgLuminance,
    avgDetail,
    subject: subject?.rect ?? null,
    subjectCoverage: subject?.coverage ?? 0,
  };
}

function estimateSubject(
  luminance: Float32Array,
  detail: Float32Array,
  color: Float32Array,
  resW: number,
  resH: number,
): { rect: NormRect; coverage: number } | null {
  const cellsX = Math.max(4, Math.round(resW / 12));
  const cellsY = Math.max(4, Math.round(resH / 12));
  const cw = resW / cellsX;
  const ch = resH / cellsY;

  const cellDetail: number[] = [];
  const cellColor: number[] = [];
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      let dSum = 0;
      let cSum = 0;
      let n = 0;
      const x0 = Math.floor(cx * cw);
      const x1 = Math.min(resW, Math.ceil((cx + 1) * cw));
      const y0 = Math.floor(cy * ch);
      const y1 = Math.min(resH, Math.ceil((cy + 1) * ch));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * resW + x;
          dSum += detail[i];
          cSum += color[i];
          n++;
        }
      }
      cellDetail.push(n ? dSum / n : 0);
      cellColor.push(n ? cSum / n : 0);
    }
  }

  const mean = cellDetail.reduce((a, b) => a + b, 0) / cellDetail.length;
  const variance =
    cellDetail.reduce((a, b) => a + (b - mean) * (b - mean), 0) / cellDetail.length;
  const threshold = mean + Math.max(0.02, Math.sqrt(variance) * 0.55);

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let marked = 0;
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const idx = cy * cellsX + cx;
      const hot =
        cellDetail[idx] > threshold ||
        (cellColor[idx] > 0.42 && cellDetail[idx] > mean * 1.05);
      if (!hot) continue;
      const nx = cx / cellsX;
      const ny = cy / cellsY;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, (cx + 1) / cellsX);
      maxY = Math.max(maxY, (cy + 1) / cellsY);
      marked++;
    }
  }

  const coverage = marked / (cellsX * cellsY);
  if (coverage < 0.02) return null;
  return {
    rect: {
      x: clamp(minX, 0, 1),
      y: clamp(minY, 0, 1),
      w: clamp(maxX - minX, 0, 1),
      h: clamp(maxY - minY, 0, 1),
    },
    coverage,
  };
}

export function sampleRegion(analysis: ImageAnalysis, rect: NormRect): RegionSample {
  const x0 = clamp(Math.floor(rect.x * analysis.resW), 0, analysis.resW - 1);
  const y0 = clamp(Math.floor(rect.y * analysis.resH), 0, analysis.resH - 1);
  const x1 = clamp(Math.ceil((rect.x + rect.w) * analysis.resW), x0 + 1, analysis.resW);
  const y1 = clamp(Math.ceil((rect.y + rect.h) * analysis.resH), y0 + 1, analysis.resH);
  let lum = 0;
  let det = 0;
  let col = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;
  const count = analysis.resW * analysis.resH;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * analysis.resW + x;
      if (i >= count) continue;
      lum += analysis.luminance[i];
      det += analysis.detail[i];
      col += analysis.color[i];
      rSum += analysis.red[i];
      gSum += analysis.green[i];
      bSum += analysis.blue[i];
      n++;
    }
  }
  if (n === 0) return { r: 128, g: 128, b: 128, luminance: 0.5, detail: 0, color: 0 };
  return {
    r: Math.round(rSum / n),
    g: Math.round(gSum / n),
    b: Math.round(bSum / n),
    luminance: lum / n,
    detail: det / n,
    color: col / n,
  };
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(l1: number, l2: number): number {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

/** Relative luminance of a hex colour (#RGB, #RGBA, #RRGGBB or #RRGGBBAA). */
export function hexColorLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return relativeLuminance(r, g, b);
}

const WHITE_L = 1;
const INK_L = relativeLuminance(17, 17, 17);

export interface ReadableStyle {
  fill: string;
  shadow: TextShadow | null;
  backgroundColor: string;
  readability: Readability;
  ratio: number;
}

export function chooseReadableStyle(sample: RegionSample): ReadableStyle {
  const bgL = relativeLuminance(sample.r, sample.g, sample.b);
  const cw = contrastRatio(WHITE_L, bgL);
  const cb = contrastRatio(INK_L, bgL);
  const useLight = cw >= cb;
  const fill = useLight ? "#FFFFFF" : "#111111";
  const ratio = useLight ? cw : cb;

  let readability: Readability = "good";
  let shadow: TextShadow | null = null;
  let backgroundColor = "";

  if (ratio < 4.5) {
    readability = "shadow";
    shadow = {
      color: useLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)",
      blur: 16,
      offsetX: 0,
      offsetY: 3,
    };
  }
  if (ratio < 3 || sample.detail > 0.32) {
    readability = "panel";
    backgroundColor = useLight ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.6)";
    shadow = null;
  }

  return { fill, shadow, backgroundColor, readability, ratio };
}

const CONDENSED: Record<string, number> = {
  Anton: 0.44,
  "Bebas Neue": 0.42,
  Oswald: 0.46,
  "Barlow Condensed": 0.46,
  "Archivo Black": 0.6,
};

function charWidthFactor(family: string): number {
  if (family in CONDENSED) return CONDENSED[family];
  if (family === "JetBrains Mono") return 0.62;
  if (
    family === "Playfair Display" ||
    family === "DM Serif Display" ||
    family === "Cormorant Garamond" ||
    family === "Libre Baskerville"
  ) {
    return 0.52;
  }
  return 0.55;
}

export function estimateLines(text: string, family: string, fontSize: number, width: number): number {
  const factor = charWidthFactor(family);
  let lines = 0;
  for (const para of text.split("\n")) {
    const w = Math.max(1, para.length * fontSize * factor);
    lines += Math.max(1, Math.ceil(w / Math.max(1, width) - 1e-6));
  }
  return Math.max(1, lines);
}

export function estimateTextHeight(
  text: string,
  family: string,
  fontSize: number,
  width: number,
  lineHeight: number,
): number {
  return estimateLines(text, family, fontSize, width) * fontSize * lineHeight;
}

function lineHeightFor(role: TextRole): number {
  switch (role) {
    case "headline":
      return 0.98;
    case "quote":
      return 1.22;
    case "subhead":
      return 1.14;
    case "eyebrow":
      return 1.2;
    default:
      return 1.42;
  }
}

function weightFor(role: TextRole, family: string): number {
  switch (role) {
    case "headline":
      return nearestWeight(family, 800);
    case "subhead":
      return nearestWeight(family, 600);
    case "eyebrow":
      return nearestWeight(family, 500);
    case "quote":
      return nearestWeight(family, 500);
    default:
      return nearestWeight(family, 400);
  }
}

function charSpacingFor(role: TextRole): number {
  return role === "eyebrow" ? 220 : 0;
}

const ROLE_RANK: Record<TextRole, number> = {
  headline: 0,
  quote: 1,
  subhead: 2,
  body: 3,
  eyebrow: 4,
};

export function classifyRole(
  block: Pick<PlanInput, "text" | "name" | "fontSize" | "charSpacing" | "fontStyle">,
  doc: DocSize,
): TextRole {
  const name = (block.name ?? "").toLowerCase();
  const text = block.text.trim();
  const minSide = Math.max(1, Math.min(doc.width, doc.height));
  const ratio = block.fontSize / minSide;
  const upper = text.length > 0 && text === text.toUpperCase();
  const looksQuoted = /[\u201C\u201D"]/.test(text);

  if (name.includes("label") || name.includes("eyebrow") || name.includes("kicker")) return "eyebrow";
  if (name.includes("sub")) return "subhead";
  if (name.includes("head") || name.includes("title") || name.includes("number")) return "headline";
  if (name.includes("body") || name.includes("paragraph") || name.includes("caption")) return "body";
  if (name.includes("quote")) return "quote";

  if (looksQuoted) return "quote";
  if (upper && block.charSpacing > 120 && ratio < 0.05) return "eyebrow";
  if (ratio >= 0.075) return "headline";
  if (ratio >= 0.045) return "subhead";
  if (ratio <= 0.03) return "eyebrow";
  return "body";
}

function fitFontSize(
  text: string,
  family: string,
  width: number,
  maxHeight: number,
  role: TextRole,
  doc: DocSize,
): number {
  const lh = lineHeightFor(role);
  const cap = Math.min(doc.height * (role === "headline" ? 0.32 : role === "eyebrow" ? 0.06 : 0.13), maxHeight * 1.4);
  let lo = 9;
  let hi = Math.max(10, cap);
  let best = lo;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const h = estimateTextHeight(text, family, mid, width, lh);
    if (h <= maxHeight * 0.98) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.max(9, Math.round(best));
}

function rectOverlapArea(a: NormRect, b: NormRect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export interface PlanOptions {
  autoColor: boolean;
}

export function planLayout(
  inputs: PlanInput[],
  analysis: ImageAnalysis,
  doc: DocSize,
  layoutId: LayoutId,
  opts: PlanOptions,
): PlacementPlan[] {
  const def = getLayout(layoutId);
  const ordered = [...inputs].sort((a, b) => {
    const rank = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    return rank !== 0 ? rank : b.fontSize - a.fontSize;
  });

  const used = def.slots.map(() => false);
  const placedRects: NormRect[] = [];
  const plans: PlacementPlan[] = [];

  for (const input of ordered) {
    let slotIndex = def.slots.findIndex((s, i) => !used[i] && s.role === input.role);
    if (slotIndex < 0) slotIndex = def.slots.findIndex((s, i) => !used[i] && s.role === "any");
    let slot: LayoutSlot;
    if (slotIndex >= 0) {
      used[slotIndex] = true;
      slot = def.slots[slotIndex];
    } else {
      const lastBottom = placedRects.length
        ? Math.max(...placedRects.map((r) => r.y + r.h))
        : 0.6;
      slot = {
        role: "any",
        rect: {
          x: 0.5 - 0.21,
          y: clamp(lastBottom + 0.015, SAFE, 0.98 - 0.06 - SAFE),
          w: 0.42,
          h: 0.06,
        },
        align: "center",
      };
    }

    plans.push(buildPlacement(input, slot, analysis, doc, layoutId, opts, placedRects));
  }

  return plans;
}

function buildPlacement(
  input: PlanInput,
  slot: LayoutSlot,
  analysis: ImageAnalysis,
  doc: DocSize,
  layoutId: LayoutId,
  opts: PlanOptions,
  placedRects: NormRect[],
): PlacementPlan {
  const lineHeight = lineHeightFor(input.role);
  const fontWeight = weightFor(input.role, input.fontFamily);
  const charSpacing = charSpacingFor(input.role);

  const slotX = slot.rect.x * doc.width;
  const slotY = slot.rect.y * doc.height;
  const slotW = slot.rect.w * doc.width;
  const slotH = slot.rect.h * doc.height;
  const wrapWidth = Math.max(60, slotW);
  const fontSize = fitFontSize(input.text, input.fontFamily, wrapWidth, slotH, input.role, doc);
  const estHeight = Math.min(
    slotH,
    estimateTextHeight(input.text, input.fontFamily, fontSize, wrapWidth, lineHeight),
  );

  const baseRect: NormRect = {
    x: slotX / doc.width,
    y: (slotY + Math.max(0, (slotH - estHeight) / 2)) / doc.height,
    w: wrapWidth / doc.width,
    h: estHeight / doc.height,
  };

  const refined = refinePlacement(baseRect, slot, analysis, placedRects);
  placedRects.push(refined.rect);

  const sample = sampleRegion(analysis, refined.rect);
  const subjectOverlap = analysis.subject ? rectOverlapArea(refined.rect, analysis.subject) : 0;
  const overSubject = subjectOverlap > 0.12;

  let fill = input.fill;
  let shadow = input.shadow;
  let backgroundColor = input.backgroundColor ?? "";
  let stroke = input.stroke ?? "";
  let strokeWidth = input.strokeWidth ?? 0;
  let readability: Readability = "good";
  let ratio = 0;

  if (opts.autoColor) {
    const bgL = relativeLuminance(sample.r, sample.g, sample.b);
    const originalL = hexColorLuminance(input.fill);
    const originalContrast = originalL === null ? 0 : contrastRatio(originalL, bgL);
    // Keep the user's own colour when it already reads well on this region.
    if (originalL !== null && originalContrast >= 4.5 && sample.detail <= 0.32) {
      readability = "good";
      ratio = originalContrast;
    } else {
      const style = chooseReadableStyle(sample);
      fill = style.fill;
      shadow = style.shadow;
      backgroundColor = style.backgroundColor;
      stroke = "";
      strokeWidth = 0;
      readability = style.readability;
      ratio = style.ratio;
    }
  }

  const left = refined.rect.x * doc.width;
  const top = refined.rect.y * doc.height;

  return {
    id: input.id,
    role: input.role,
    layoutId,
    left,
    top,
    width: refined.rect.w * doc.width,
    height: refined.rect.h * doc.height,
    fontSize,
    fontWeight,
    charSpacing,
    lineHeight,
    textAlign: slot.align,
    fill,
    shadow,
    backgroundColor,
    stroke,
    strokeWidth,
    overSubject,
    readability,
    contrastRatio: ratio,
  };
}

function refinePlacement(
  base: NormRect,
  slot: LayoutSlot,
  analysis: ImageAnalysis,
  placedRects: NormRect[],
): { rect: NormRect; score: number } {
  const dxs = [-0.5, -0.25, 0, 0.25, 0.5];
  const dys = [-0.5, -0.25, 0, 0.25, 0.5];
  const slackX = slot.rect.w * 0.16;
  const slackY = slot.rect.h * 0.34;

  let best = { rect: base, score: Number.POSITIVE_INFINITY };

  for (const dx of dxs) {
    for (const dy of dys) {
      const rect: NormRect = {
        x: base.x + dx * slackX,
        y: base.y + dy * slackY,
        w: base.w,
        h: base.h,
      };
      if (
        rect.x < SAFE ||
        rect.y < SAFE ||
        rect.x + rect.w > 1 - SAFE ||
        rect.y + rect.h > 1 - SAFE
      ) {
        continue;
      }
      const sample = sampleRegion(analysis, rect);
      const subjectOverlap = analysis.subject ? rectOverlapArea(rect, analysis.subject) : 0;
      let overlap = 0;
      for (const r of placedRects) overlap = Math.max(overlap, rectOverlapArea(rect, r));

      const score =
        subjectOverlap * 14 +
        overlap * 22 +
        sample.detail * 3.2 +
        sample.color * 1.4 +
        Math.abs(dx) * 0.35 +
        Math.abs(dy) * 0.2;

      if (score < best.score) best = { rect, score };
    }
  }

  if (!Number.isFinite(best.score)) {
    return { rect: base, score: 0 };
  }
  return best;
}

export function suggestLayout(analysis: ImageAnalysis): LayoutId {
  const subject = analysis.subject;
  if (!subject) return analysis.avgDetail < 0.12 ? "minimal" : "centered-focus";
  const cy = subject.y + subject.h / 2;

  if (analysis.subjectCoverage > 0.34) {
    return cy < 0.5 ? "cinematic-bottom" : "editorial-top";
  }
  if (cy < 0.44) return "cinematic-bottom";
  if (cy > 0.62) return "editorial-top";
  if (analysis.avgDetail < 0.14) return "minimal";
  return "centered-focus";
}

export function buildLayoutPreviews(
  inputs: PlanInput[],
  analysis: ImageAnalysis,
  doc: DocSize,
  autoColor: boolean,
): LayoutPreview[] {
  return LAYOUTS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    placements: planLayout(inputs, analysis, doc, def.id, { autoColor }),
  }));
}

export function drawPosterBackground(
  ctx: CanvasRenderingContext2D,
  background: PosterBackground,
  width: number,
  height: number,
): void {
  if (typeof background === "string") {
    ctx.fillStyle = background || "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const radians = (background.angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const grad = ctx.createLinearGradient(
    (0.5 - dx / 2) * width,
    (0.5 - dy / 2) * height,
    (0.5 + dx / 2) * width,
    (0.5 + dy / 2) * height,
  );
  for (const stop of [...background.stops].sort((a, b) => a.offset - b.offset)) {
    grad.addColorStop(clamp(stop.offset, 0, 1), stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
