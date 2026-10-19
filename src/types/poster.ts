export type GradientStop = { offset: number; color: string };

export interface LinearGradientBg {
  type: "linear";
  angle: number;
  stops: GradientStop[];
}

export type PosterBackground = string | LinearGradientBg;

export interface TextShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export type TextAlign = "left" | "center" | "right" | "justify";

export interface PosterTextObject {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  fill: string;
  left: number;
  top: number;
  width: number;
  textAlign: TextAlign;
  charSpacing: number;
  lineHeight: number;
  angle: number;
  opacity: number;
  backgroundColor?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: TextShadow | null;
  name?: string;
  locked?: boolean;
}

export interface PosterDoc {
  name: string;
  width: number;
  height: number;
  background: PosterBackground;
}

export interface LayerMeta {
  id: string;
  name: string;
  text: string;
  visible: boolean;
  locked: boolean;
  kind: "text" | "image";
}

export interface DetectedTextRegion {
  id: string;
  text: string;
  confidence: number;
  left: number;
  top: number;
  width: number;
  height: number;
  covered?: boolean;
}

export interface CanvasSize {
  id: string;
  label: string;
  width: number;
  height: number;
  group: "Portrait" | "Square" | "Landscape" | "Story";
  ratio: string;
}

export type ImageFit = "cover" | "contain" | "stretch" | "custom";

export interface BackgroundImageInfo {
  present: boolean;
  name: string;
  fit: ImageFit;
  zoom: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export type ExportFormat = "png" | "jpeg";

export interface PosterTemplate {
  id: string;
  name: string;
  category: string;
  mood: string;
  tags: string[];
  width: number;
  height: number;
  background: PosterBackground;
  objects: PosterTextObject[];
}

export interface PersistedProject {
  version: number;
  projectId: string;
  doc: PosterDoc;
  canvas: Record<string, unknown>;
  savedAt: number;
}

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  doc: PosterDoc;
  objects: unknown[];
  thumbnail?: string | null;
  hasBackgroundImage?: boolean;
  imageMode?: "poster" | "background";
  detectedText?: DetectedTextRegion[];
}
