import * as fabric from "fabric";
import type {
  BackgroundImageInfo,
  DetectedTextRegion,
  ImageFit,
  LayerMeta,
  PersistedProject,
  PosterBackground,
  PosterDoc,
  PosterTemplate,
  PosterTextObject,
  StoredProject,
  TextAlign,
} from "@/types/poster";
import type { SelectedImageProps, SelectedObjectProps } from "@/store/editorStore";
import { useEditorStore } from "@/store/editorStore";
import { clamp, debounce, round, uid } from "@/lib/utils";
import { loadFont, nearestWeight, preloadAllFonts } from "@/lib/fonts";
import { TEMPLATES } from "@/lib/templates";
import { deleteProject, getProject, listProjects, putProject } from "@/lib/storage/db";
import {
  analyzeImageData,
  analysisSize,
  buildLayoutPreviews,
  classifyRole,
  drawPosterBackground,
  planLayout,
  suggestLayout,
  type DocSize,
  type ImageAnalysis,
  type LayoutId,
  type LayoutPreview,
  type PlacementPlan,
  type PlanInput,
} from "@/lib/autoLayout";

type PosterTextbox = fabric.Textbox & {
  id: string;
  posterName: string;
  locked: boolean;
};

type PosterImage = fabric.FabricImage & {
  id?: string;
  posterName?: string;
  locked?: boolean;
  role?: string;
  fit?: ImageFit;
  baseScale?: number;
};

type PosterArtworkImage = PosterImage & { role?: "poster-art" };

type EditableObject = fabric.Object & {
  id?: string;
  posterName?: string;
  locked?: boolean;
  role?: string;
};

const EXTRA_PROPS = ["id", "posterName", "locked", "role", "fit", "baseScale", "offsetX", "offsetY"];
export const STORAGE_KEY = "ai-typography-poster:project:v1";
const HISTORY_LIMIT = 60;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const THUMB_MAX = 260;
const THUMB_INTERVAL = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export interface TextPreset extends Partial<PosterTextObject> {
  text: string;
}

export interface ExportRenderOptions {
  multiplier?: number;
  format?: "png" | "jpeg";
  quality?: number;
}

function createShadow(shadow: NonNullable<PosterTextObject["shadow"]>): fabric.Shadow {
  return new fabric.Shadow({
    color: shadow.color,
    blur: shadow.blur,
    offsetX: shadow.offsetX,
    offsetY: shadow.offsetY,
  });
}

function gradientCoords(angle: number) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  return {
    x1: 0.5 - dx / 2,
    y1: 0.5 - dy / 2,
    x2: 0.5 + dx / 2,
    y2: 0.5 + dy / 2,
  };
}

export function toFabricBackground(
  bg: PosterBackground,
): string | fabric.Gradient<"linear"> {
  if (typeof bg === "string") return bg;
  return new fabric.Gradient<"linear">({
    type: "linear",
    gradientUnits: "percentage",
    coords: gradientCoords(bg.angle),
    colorStops: bg.stops.map((s) => ({ offset: s.offset, color: s.color })),
  });
}

export class CanvasEngine {
  private canvas: fabric.Canvas | null = null;
  private history: string[] = [];
  private cursor = -1;
  private suspend = 0;
  private suppressCommit = false;
  private mounted = false;
  private counter = 0;
  private viewport = { width: 900, height: 700 };
  private bgImage: PosterImage | null = null;
  private imageAnalysis: ImageAnalysis | null = null;
  private projectCreatedAt = Date.now();
  private lastThumbnail: string | null = null;
  private lastThumbAt = 0;

  private store() {
    return useEditorStore.getState();
  }

  private commitSoon = debounce(() => {
    if (this.suspend > 0) return;
    this.commit();
  }, 450);

  async mount(element: HTMLCanvasElement, opts: { templateId?: string } = {}): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;

    await preloadAllFonts();

    this.canvas = new fabric.Canvas(element, {
      backgroundColor: "#F4F1EA",
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      fireRightClick: false,
    });

    this.applyGlobalStyles();
    this.attachEvents();

    const requested = opts.templateId ? TEMPLATES.find((t) => t.id === opts.templateId) : undefined;
    let loaded = false;
    if (!requested) {
      loaded = await this.hydrate();
    }
    if (requested) {
      await this.loadTemplateInternal(requested);
    } else if (!loaded) {
      await this.loadTemplateInternal(TEMPLATES[0]);
    } else {
      this.applyDocToCanvas();
    }

    await this.restoreBackgroundImageFromCanvas();
    this.applyBackground(this.store().doc.background, false);
    this.applyDimensions();
    this.syncAll();
    this.setBaseline();
    this.store().setHydrated(true);
    this.store().setActiveProjectName(this.store().doc.name);
    if (requested) this.persistNow();
  }

  dispose(): void {
    this.commitSoon.cancel();
    this.persistDebounced.cancel();
    if (this.canvas) {
      this.canvas.off();
      void this.canvas.dispose();
      this.canvas = null;
    }
    this.bgImage = null;
    this.mounted = false;
  }

  private applyGlobalStyles(): void {
    const proto = fabric.Object.prototype;
    proto.cornerStyle = "circle";
    proto.cornerColor = "#FFFFFF";
    proto.cornerStrokeColor = "#1D4ED8";
    proto.borderColor = "#1D4ED8";
    proto.borderScaleFactor = 1.4;
    proto.cornerSize = 11;
    proto.transparentCorners = false;
    proto.padding = 6;
  }

  private attachEvents(): void {
    const canvas = this.canvas!;

    canvas.on("selection:created", () => this.syncSelected());
    canvas.on("selection:updated", () => this.syncSelected());
    canvas.on("selection:cleared", () => {
      this.store().setSelected(null, null);
    });

    canvas.on("object:moving", () => this.syncSelected());
    canvas.on("object:scaling", () => this.syncSelected());
    canvas.on("object:rotating", () => this.syncSelected());

    canvas.on("object:modified", (e) => {
      if (this.suppressCommit) return;
      if (this.suspend > 0) return;
      this.normalizeScaledText(e.target);
      this.canvas?.requestRenderAll();
      this.syncAll();
      this.commit();
    });

    canvas.on("object:added", () => {
      if (this.suspend > 0 || this.suppressCommit) return;
      this.syncAll();
      this.commit();
    });

    canvas.on("object:removed", () => {
      if (this.suspend > 0 || this.suppressCommit) return;
      this.syncAll();
      this.commit();
    });

    canvas.on("text:changed", () => {
      this.syncLayers();
      this.syncSelected();
      this.store().markDirty();
    });

    canvas.on("text:editing:exited", () => {
      if (this.suspend > 0) return;
      this.syncAll();
      this.commit();
    });
  }

  private normalizeScaledText(target: fabric.Object | null): void {
    if (!target || !(target instanceof fabric.Textbox)) return;
    const sx = target.scaleX ?? 1;
    const sy = target.scaleY ?? 1;
    if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return;
    const nextFont = Math.max(6, Math.round((target.fontSize ?? 40) * sy));
    const nextWidth = Math.max(40, Math.round((target.width ?? 200) * sx));
    target.set({ fontSize: nextFont, width: nextWidth, scaleX: 1, scaleY: 1 });
    target.setCoords();
  }

  // ----- object helpers -----

  private nextId(): string {
    this.counter += 1;
    return uid(`t${this.counter}`);
  }

  private createTextbox(obj: PosterTextObject): PosterTextbox {
    const tb = new fabric.Textbox(obj.text, {
      left: obj.left,
      top: obj.top,
      width: obj.width,
      fontFamily: obj.fontFamily,
      fontSize: obj.fontSize,
      fontWeight: obj.fontWeight,
      fontStyle: obj.fontStyle ?? "normal",
      fill: obj.fill,
      textAlign: obj.textAlign,
      charSpacing: obj.charSpacing,
      lineHeight: obj.lineHeight,
      angle: obj.angle,
      opacity: obj.opacity,
      backgroundColor: obj.backgroundColor ?? "",
      stroke: obj.stroke ?? undefined,
      strokeWidth: obj.strokeWidth ?? 0,
      shadow: obj.shadow ? createShadow(obj.shadow) : null,
      splitByGrapheme: false,
      editable: true,
    }) as PosterTextbox;
    tb.id = this.nextId();
    tb.posterName = obj.name ?? (obj.text.split("\n")[0].slice(0, 24) || "Text");
    tb.locked = false;
    tb.setCoords();
    return tb;
  }

  private getTextObjects(): PosterTextbox[] {
    if (!this.canvas) return [];
    return this.canvas.getObjects().filter((o) => o instanceof fabric.Textbox) as PosterTextbox[];
  }

  private getEditableObjects(): fabric.Object[] {
    if (!this.canvas) return [];
    return this.canvas.getObjects().filter((o) => (o as EditableObject).role !== "background");
  }

  private getActiveObjects(): fabric.Object[] {
    if (!this.canvas) return [];
    return this.canvas.getActiveObjects().filter((o) => (o as EditableObject).role !== "background");
  }

  private getActiveTextObjects(): PosterTextbox[] {
    return this.getActiveObjects().filter((o) => o instanceof fabric.Textbox) as PosterTextbox[];
  }

  private getActiveImages(): PosterImage[] {
    return this.getActiveObjects().filter(
      (o) => o instanceof fabric.FabricImage && (o as EditableObject).role !== "background",
    ) as PosterImage[];
  }

  private findById(id: string): EditableObject | null {
    return (this.getEditableObjects().find((o) => (o as EditableObject).id === id) as
      | EditableObject
      | undefined) ?? null;
  }

  private ensureIds(): void {
    for (const obj of this.getEditableObjects()) {
      const o = obj as EditableObject;
      if (!o.id) o.id = this.nextId();
      if (!o.posterName) {
        o.posterName =
          obj instanceof fabric.Textbox
            ? obj.text.split("\n")[0].slice(0, 24) || "Text"
            : "Image";
      }
      if (typeof o.locked !== "boolean") o.locked = false;
    }
  }

  // ----- background image -----

  private findBackgroundImage(): PosterImage | null {
    if (!this.canvas) return null;
    const found = this.canvas.getObjects().find((o) => (o as PosterImage).role === "background");
    return (found as PosterImage | undefined) ?? null;
  }

  private async restoreBackgroundImageFromCanvas(): Promise<void> {
    const img = this.findBackgroundImage();
    this.bgImage = img;
    if (img) {
      img.set({ selectable: false, evented: false, hoverCursor: "default" });
      this.updateBackgroundImageClip();
    }
    this.syncBackgroundImage();
  }

  private addToBottom(obj: fabric.Object): void {
    if (!this.canvas) return;
    const objects = (this.canvas as unknown as { _objects: fabric.Object[] })._objects;
    const index = objects.indexOf(obj);
    if (index >= 0) objects.splice(index, 1);
    objects.unshift(obj);
    this.canvas.requestRenderAll();
  }

  private addPosterArtworkUnderText(obj: fabric.Object): void {
    if (!this.canvas) return;
    const objects = (this.canvas as unknown as { _objects: fabric.Object[] })._objects;
    const oldIndex = objects.indexOf(obj);
    if (oldIndex >= 0) objects.splice(oldIndex, 1);
    const backgroundIndex = this.bgImage ? objects.indexOf(this.bgImage) : -1;
    objects.splice(backgroundIndex >= 0 ? backgroundIndex + 1 : 0, 0, obj);
    this.canvas.requestRenderAll();
  }

  private updateBackgroundImageClip(): void {
    const img = this.bgImage;
    if (!img) return;
    const doc = this.store().doc;
    const rect = new fabric.Rect({
      width: doc.width,
      height: doc.height,
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      absolutePositioned: true,
    } as never);
    img.clipPath = rect as never;
    img.dirty = true;
  }

  private placeBackgroundImage(fit: ImageFit, zoom: number, offsetX: number, offsetY: number): void {
    const img = this.bgImage;
    if (!img || !this.canvas) return;
    const doc = this.store().doc;
    const natW = img.width || 1;
    const natH = img.height || 1;
    let base = img.baseScale ?? 1;
    if (fit === "cover") base = Math.max(doc.width / natW, doc.height / natH);
    else if (fit === "contain") base = Math.min(doc.width / natW, doc.height / natH);
    else if (fit === "stretch") base = doc.width / natW;
    img.baseScale = base;
    img.fit = fit;
    if (fit === "stretch") {
      img.set({ scaleX: doc.width / natW, scaleY: doc.height / natH });
    } else {
      img.set({ scaleX: base * zoom, scaleY: base * zoom });
    }
    img.set({
      left: doc.width / 2 + (offsetX / 100) * doc.width,
      top: doc.height / 2 + (offsetY / 100) * doc.height,
      originX: "center",
      originY: "center",
    });
    img.setCoords();
    img.dirty = true;
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Could not read the image file."));
      reader.readAsDataURL(file);
    });
  }

  async setBackgroundImage(file: File): Promise<void> {
    if (!this.canvas) throw new Error("The editor canvas is not ready yet.");
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Unsupported image type. Please upload a JPG, PNG or WebP file.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("That image is too large. Please use a file under 15 MB.");
    }
    const dataUrl = await this.readFileAsDataURL(file);
    await this.applyBackgroundImageDataUrl(dataUrl, file.name);
  }

  async applyBackgroundImageDataUrl(dataUrl: string, name: string): Promise<void> {
    if (!this.canvas) return;
    let img: PosterImage;
    try {
      img = (await fabric.FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" })) as PosterImage;
    } catch {
      throw new Error("Could not load that image. It may be corrupt or unsupported.");
    }
    this.suspend += 1;
    if (this.bgImage) this.canvas.remove(this.bgImage);
    img.role = "background";
    img.posterName = name || "Background image";
    img.set({
      selectable: false,
      evented: false,
      hoverCursor: "default",
      originX: "center",
      originY: "center",
      opacity: 1,
    });
    img.baseScale = 1;
    img.fit = "cover";
    this.bgImage = img;
    for (const object of this.canvas.getObjects()) {
      if ((object as PosterImage).role === "poster-art") object.visible = false;
    }
    this.imageAnalysis = null;
    this.canvas.add(img);
    this.addToBottom(img);
    this.updateBackgroundImageClip();
    // Preserve the photo's aspect ratio: only crop when it closely matches the
    // poster, otherwise letterbox it inside the canvas with "contain".
    const doc = this.store().doc;
    const natW = img.width || 1;
    const natH = img.height || 1;
    const docAspect = doc.width / doc.height;
    const imgAspect = natW / natH;
    const fit: ImageFit = Math.abs(Math.log(imgAspect / docAspect)) < 0.08 ? "cover" : "contain";
    this.placeBackgroundImage(fit, 1, 0, 0);
    this.suspend -= 1;
    this.store().setImageMode("background");
    this.store().setDetectedText([]);
    this.canvas.requestRenderAll();
    this.syncAll();
    this.scheduleSave();
  }

  setBackgroundImageFit(fit: ImageFit): void {
    if (!this.bgImage) return;
    this.imageAnalysis = null;
    this.placeBackgroundImage(fit, 1, 0, 0);
    this.canvas?.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  setBackgroundImageZoom(zoom: number): void {
    const img = this.bgImage;
    if (!img || !this.canvas) return;
    this.imageAnalysis = null;
    const base = img.baseScale ?? 1;
    const next = base * clamp(zoom, 0.2, 4);
    img.set({ scaleX: next, scaleY: next, fit: img.fit === "stretch" ? "custom" : img.fit });
    img.setCoords();
    img.dirty = true;
    this.canvas.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  setBackgroundImageOffset(offsetX: number, offsetY: number): void {
    const img = this.bgImage;
    if (!img || !this.canvas) return;
    this.imageAnalysis = null;
    const doc = this.store().doc;
    img.set({
      left: doc.width / 2 + (offsetX / 100) * doc.width,
      top: doc.height / 2 + (offsetY / 100) * doc.height,
    });
    img.setCoords();
    this.canvas.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  setBackgroundImageOpacity(opacity: number): void {
    const img = this.bgImage;
    if (!img || !this.canvas) return;
    this.imageAnalysis = null;
    img.set({ opacity: clamp(opacity, 0.05, 1) });
    this.canvas.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  removeBackgroundImage(): void {
    if (!this.bgImage || !this.canvas) return;
    this.canvas.remove(this.bgImage);
    this.bgImage = null;
    this.imageAnalysis = null;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.scheduleSave();
  }

  switchImageMode(mode: "poster" | "background"): void {
    if (!this.canvas) return;
    this.store().setImageMode(mode);
    for (const object of this.canvas.getObjects()) {
      const role = (object as PosterImage).role;
      if (role === "poster-art") object.visible = mode === "poster";
      if (role === "background") object.visible = mode === "background";
    }
    this.canvas.requestRenderAll();
    this.syncAll();
    this.scheduleSave();
  }

  hasBackgroundImage(): boolean {
    return Boolean(this.bgImage);
  }

  backgroundImageInfo(): BackgroundImageInfo | null {
    return this.readBackgroundImageInfo();
  }

  private readBackgroundImageInfo(): BackgroundImageInfo | null {
    const img = this.bgImage;
    if (!img) return null;
    const doc = this.store().doc;
    const base = img.baseScale ?? 1;
    return {
      present: true,
      name: img.posterName || "Background image",
      fit: (img.fit ?? "custom") as ImageFit,
      zoom: base ? round((img.scaleX ?? 1) / base, 2) : 1,
      offsetX: Math.round((((img.left ?? doc.width / 2) - doc.width / 2) / doc.width) * 100),
      offsetY: Math.round((((img.top ?? doc.height / 2) - doc.height / 2) / doc.height) * 100),
      opacity: round(img.opacity ?? 1, 2),
    };
  }

  private syncBackgroundImage(): void {
    this.store().setBgImage(this.readBackgroundImageInfo());
  }

  // ----- intelligent background analysis & auto layout -----

  getBackgroundImageSrc(): string | null {
    const img = this.bgImage as unknown as { getSrc?: () => string } | null;
    if (!img || typeof img.getSrc !== "function") return null;
    try {
      return img.getSrc();
    } catch {
      return null;
    }
  }

  private imageElement(): CanvasImageSource | null {
    const img = this.bgImage as unknown as {
      getElement?: () => CanvasImageSource | null;
      _element?: CanvasImageSource;
    } | null;
    if (!img) return null;
    try {
      if (typeof img.getElement === "function") return img.getElement();
    } catch {
      /* fall through to the raw element */
    }
    return img._element ?? null;
  }

  private analysisInputs(): PlanInput[] {
    const doc = this.store().doc;
    const size: DocSize = { width: doc.width, height: doc.height };
    return this.getTextObjects().map((tb) => {
      const props = this.readProps(tb);
      const role = classifyRole(
        {
          text: props.text,
          name: props.name,
          fontSize: props.fontSize,
          charSpacing: props.charSpacing,
          fontStyle: props.fontStyle,
        },
        size,
      );
      return {
        id: props.id,
        text: props.text,
        name: props.name,
        role,
        fontFamily: props.fontFamily,
        fontWeight: props.fontWeight,
        fontStyle: props.fontStyle,
        fontSize: props.fontSize,
        textAlign: props.textAlign,
        charSpacing: props.charSpacing,
        lineHeight: props.lineHeight,
        fill: props.fill,
        shadow: props.shadow,
        backgroundColor: props.backgroundColor,
        stroke: props.stroke,
        strokeWidth: props.strokeWidth,
      };
    });
  }

  /**
   * Draw the *visible* background (honouring fit, zoom, offset, opacity and the
   * poster background beneath it) into a small offscreen canvas and analyse it.
   * Returns null when the image or a 2D context is unavailable.
   */
  analyzeBackground(): ImageAnalysis | null {
    if (!this.bgImage) return null;
    const el = this.imageElement();
    if (!el) return null;
    const doc = this.store().doc;
    const { resW, resH } = analysisSize(doc);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = resW;
      canvas.height = resH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawPosterBackground(ctx, this.store().doc.background, resW, resH);

      const img = this.bgImage;
      const sx = resW / doc.width;
      const sy = resH / doc.height;
      const natW = img.width || 1;
      const natH = img.height || 1;
      const dw = natW * (img.scaleX ?? 1) * sx;
      const dh = natH * (img.scaleY ?? 1) * sy;
      const cx = (img.left ?? doc.width / 2) * sx;
      const cy = (img.top ?? doc.height / 2) * sy;
      ctx.globalAlpha = clamp(img.opacity ?? 1, 0, 1);
      ctx.drawImage(el, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.globalAlpha = 1;

      const data = ctx.getImageData(0, 0, resW, resH);
      return analyzeImageData(data, { width: doc.width, height: doc.height });
    } catch {
      // Tainted canvas or unsupported source — degrade gracefully.
      return null;
    }
  }

  private ensureAnalysis(): ImageAnalysis | null {
    if (!this.bgImage) return null;
    if (!this.imageAnalysis) this.imageAnalysis = this.analyzeBackground();
    return this.imageAnalysis;
  }

  suggestedLayout(): LayoutId | null {
    const analysis = this.ensureAnalysis();
    if (!analysis) return null;
    return suggestLayout(analysis);
  }

  getLayoutPreviews(autoColor = this.store().autoStyleText): LayoutPreview[] {
    const analysis = this.ensureAnalysis();
    if (!analysis) return [];
    const doc = this.store().doc;
    return buildLayoutPreviews(
      this.analysisInputs(),
      analysis,
      { width: doc.width, height: doc.height },
      autoColor,
    );
  }

  private planFor(layoutId: LayoutId, autoColor: boolean): PlacementPlan[] {
    const analysis = this.ensureAnalysis();
    if (!analysis) return [];
    const doc = this.store().doc;
    return planLayout(
      this.analysisInputs(),
      analysis,
      { width: doc.width, height: doc.height },
      layoutId,
      { autoColor },
    );
  }

  private applyPlacements(plans: PlacementPlan[], autoColor: boolean): number {
    if (!this.canvas || plans.length === 0) return 0;
    this.suspend += 1;
    let applied = 0;
    for (const plan of plans) {
      const obj = this.findById(plan.id);
      if (!obj || !(obj instanceof fabric.Textbox)) continue;
      obj.set({
        left: plan.left,
        top: plan.top,
        width: plan.width,
        fontSize: plan.fontSize,
        fontWeight: plan.fontWeight,
        charSpacing: plan.charSpacing,
        lineHeight: plan.lineHeight,
        textAlign: plan.textAlign,
      });
      if (autoColor) {
        obj.set({
          fill: plan.fill,
          shadow: plan.shadow ? createShadow(plan.shadow) : null,
          backgroundColor: plan.backgroundColor,
          stroke: plan.stroke,
          strokeWidth: plan.strokeWidth,
        });
      }
      obj.setCoords();
      applied++;
    }
    this.suspend -= 1;
    this.canvas.requestRenderAll();
    this.syncAll();
    return applied;
  }

  /** Apply a specific composition to the existing text layers (undoable). */
  applyLayout(
    layoutId: LayoutId,
    opts: { autoColor?: boolean } = {},
  ): { applied: number; layoutId: LayoutId } {
    const autoColor = opts.autoColor ?? this.store().autoStyleText;
    const plans = this.planFor(layoutId, autoColor);
    const applied = this.applyPlacements(plans, autoColor);
    if (applied > 0) {
      this.commit();
    }
    return { applied, layoutId };
  }

  /**
   * Automatically choose and apply the composition that best fits the uploaded
   * photo (based on the estimated focal area). Never invents text.
   */
  autoArrangeText(
    opts: { layoutId?: LayoutId; autoColor?: boolean } = {},
  ): { applied: number; layoutId: LayoutId } | null {
    if (!this.bgImage) return null;
    const autoColor = opts.autoColor ?? this.store().autoStyleText;
    const layoutId = opts.layoutId ?? this.suggestedLayout() ?? "centered-focus";
    return this.applyLayout(layoutId, { autoColor });
  }

  // ----- background & document -----

  applyBackground(bg: PosterBackground, updateStore = true): void {
    if (!this.canvas) return;
    this.canvas.backgroundColor = toFabricBackground(bg) as never;
    if (updateStore) this.store().setDoc({ background: bg });
    this.canvas.requestRenderAll();
  }

  setBackground(bg: PosterBackground): void {
    this.store().setDoc({ background: bg });
    this.applyBackground(bg, false);
    this.commit();
  }

  setDocName(name: string): void {
    this.store().setDoc({ name });
    this.store().setActiveProjectName(name);
    this.scheduleSave();
  }

  setZoom(zoom: number): void {
    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.store().setZoom(next);
    this.applyDimensions();
  }

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  fitToViewport(): void {
    const doc = this.store().doc;
    const padX = 96;
    const padY = 96;
    const zoom = clamp(
      Math.min(
        (this.viewport.width - padX) / doc.width,
        (this.viewport.height - padY) / doc.height,
      ),
      0.12,
      MAX_ZOOM,
    );
    this.setZoom(round(zoom, 3));
  }

  private applyDocToCanvas(): void {
    this.applyDimensions();
    this.syncBackgroundImage();
  }

  private applyDimensions(): void {
    if (!this.canvas) return;
    const { width, height } = this.store().doc;
    const zoom = this.store().zoom;
    this.canvas.setDimensions({ width: Math.round(width * zoom), height: Math.round(height * zoom) });
    this.canvas.setZoom(zoom);
    this.canvas.requestRenderAll();
  }

  resizeCanvas(width: number, height: number, opts: { scaleContent?: boolean } = {}): void {
    if (!this.canvas) return;
    const scaleContent = opts.scaleContent ?? true;
    const old = this.store().doc;
    const newWidth = Math.max(64, Math.round(width));
    const newHeight = Math.max(64, Math.round(height));
    if (newWidth === old.width && newHeight === old.height) return;

    const factor = scaleContent ? Math.min(newWidth / old.width, newHeight / old.height) : 1;
    const oldCx = old.width / 2;
    const oldCy = old.height / 2;
    const newCx = newWidth / 2;
    const newCy = newHeight / 2;
    const bgInfo = this.readBackgroundImageInfo();
    this.imageAnalysis = null;

    this.suspend += 1;
    this.store().setDoc({ width: newWidth, height: newHeight });

    for (const obj of this.canvas.getObjects()) {
      if (obj === this.bgImage) continue;
      obj.scaleX = (obj.scaleX ?? 1) * factor;
      obj.scaleY = (obj.scaleY ?? 1) * factor;
      obj.left = newCx + ((obj.left ?? 0) - oldCx) * factor;
      obj.top = newCy + ((obj.top ?? 0) - oldCy) * factor;
      obj.setCoords();
    }
    for (const textObject of this.getTextObjects()) {
      this.normalizeScaledText(textObject);
    }

    if (this.bgImage) {
      this.updateBackgroundImageClip();
      if (bgInfo) {
        this.placeBackgroundImage(bgInfo.fit, bgInfo.zoom, bgInfo.offsetX, bgInfo.offsetY);
      }
    }

    this.suspend -= 1;
    this.applyDimensions();
    this.syncAll();
    this.commit();
  }

  resetCanvas(): void {
    if (!this.canvas) return;
    this.suspend += 1;
    this.canvas.remove(...this.canvas.getObjects());
    this.bgImage = null;
    this.imageAnalysis = null;
    this.store().setBgImage(null);
    this.store().setDoc({ background: "#F4F1EA" });
    this.applyBackground("#F4F1EA", false);
    this.suspend -= 1;
    this.applyDimensions();
    this.syncAll();
    this.setBaseline();
    this.persistNow();
  }

  newProject(name = "Untitled Poster"): void {
    this.store().setProjectId(uid("project"));
    this.projectCreatedAt = Date.now();
    this.lastThumbnail = null;
    this.lastThumbAt = 0;
    this.store().setDoc({ name });
    this.store().setActiveProjectName(name);
    this.resetInternal("#F4F1EA");
    this.persistNow();
  }

  private resetInternal(background: string): void {
    if (!this.canvas) return;
    this.suspend += 1;
    this.canvas.remove(...this.canvas.getObjects());
    this.bgImage = null;
    this.imageAnalysis = null;
    this.store().setBgImage(null);
    this.store().setDoc({ background });
    this.applyBackground(background, false);
    this.suspend -= 1;
    this.applyDimensions();
    this.syncAll();
    this.setBaseline();
  }

  // ----- templates & creation -----

  private async loadTemplateInternal(template: PosterTemplate): Promise<void> {
    this.suspend += 1;
    try {
      if (!this.canvas) return;
      this.canvas.remove(...this.canvas.getObjects());
      this.bgImage = null;
      this.imageAnalysis = null;
      this.store().setBgImage(null);
      this.store().setDetectedText([]);
      this.store().setImageMode("poster");
      this.store().setDoc({
        name: template.name,
        width: template.width,
        height: template.height,
        background: template.background,
      });
      this.store().setActiveProjectName(template.name);
      await Promise.all(
        template.objects.map((o) => loadFont(o.fontFamily, nearestWeight(o.fontFamily, o.fontWeight))),
      );
      for (const obj of template.objects) {
        this.canvas.add(this.createTextbox(obj));
      }
      this.applyBackground(template.background, false);
      this.ensureIds();
      this.applyDimensions();
    } finally {
      this.suspend -= 1;
    }
  }

  async applyTemplate(template: PosterTemplate): Promise<void> {
    await this.loadTemplateInternal(template);
    this.syncAll();
    this.fitToViewport();
    this.commit();
    this.persistNow();
  }

  async addTextObject(preset: TextPreset, opts: { edit?: boolean } = {}): Promise<void> {
    if (!this.canvas) return;
    const doc = this.store().doc;
    const family = preset.fontFamily ?? "Inter";
    await loadFont(family, nearestWeight(family, preset.fontWeight ?? 700));
    const width = preset.width ?? Math.round(doc.width * 0.7);
    const top = preset.top ?? Math.round(doc.height / 2 - (preset.fontSize ?? 96) / 2);
    const full: PosterTextObject = {
      text: preset.text,
      fontFamily: family,
      fontSize: preset.fontSize ?? 96,
      fontWeight: preset.fontWeight ?? 700,
      fontStyle: preset.fontStyle ?? "normal",
      fill: preset.fill ?? "#111111",
      left: preset.left ?? Math.round((doc.width - width) / 2),
      top,
      width,
      textAlign: preset.textAlign ?? "center",
      charSpacing: preset.charSpacing ?? 0,
      lineHeight: preset.lineHeight ?? 1.1,
      angle: preset.angle ?? 0,
      opacity: preset.opacity ?? 1,
      backgroundColor: preset.backgroundColor,
      stroke: preset.stroke,
      strokeWidth: preset.strokeWidth,
      shadow: preset.shadow ?? null,
      name: preset.name,
    };
    this.suppressCommit = true;
    const tb = this.createTextbox(full);
    this.canvas.add(tb);
    this.canvas.setActiveObject(tb);
    this.suppressCommit = false;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
    if (opts.edit ?? true) {
      setTimeout(() => {
        if (!this.canvas) return;
        this.canvas.setActiveObject(tb);
        tb.enterEditing();
        tb.selectAll();
        this.canvas.requestRenderAll();
      }, 30);
    }
  }

  async addImageObject(dataUrl: string, name = "Image"): Promise<void> {
    if (!this.canvas) return;
    let img: PosterImage;
    try {
      img = (await fabric.FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" })) as PosterImage;
    } catch {
      throw new Error("Could not load that image. It may be corrupt or unsupported.");
    }
    const doc = this.store().doc;
    const natW = img.width || 1;
    const natH = img.height || 1;
    const scale = Math.min((doc.width * 0.6) / natW, (doc.height * 0.6) / natH);
    img.set({
      left: doc.width / 2,
      top: doc.height / 2,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
    });
    img.id = this.nextId();
    img.posterName = name || "Image";
    img.locked = false;
    this.suppressCommit = true;
    this.canvas.add(img);
    this.canvas.setActiveObject(img);
    this.suppressCommit = false;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  async addImageFromFile(file: File): Promise<void> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Unsupported image type. Please upload a JPG, PNG or WebP file.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("That image is too large. Please use a file under 15 MB.");
    }
    const dataUrl = await this.readFileAsDataURL(file);
    await this.addImageObject(dataUrl, file.name);
  }

  async addPosterImageFromFile(file: File): Promise<void> {
    if (!this.canvas) throw new Error("The editor canvas is not ready yet.");
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Unsupported image type. Please upload a JPG, PNG or WebP file.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("That image is too large. Please use a file under 15 MB.");
    const dataUrl = await this.readFileAsDataURL(file);
    let image: PosterArtworkImage;
    try {
      image = (await fabric.FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" })) as PosterArtworkImage;
    } catch {
      throw new Error("Could not load that image. It may be corrupt or unsupported.");
    }
    const doc = this.store().doc;
    const scale = Math.min(doc.width / (image.width || 1), doc.height / (image.height || 1));
    image.id = this.nextId();
    image.role = "poster-art";
    image.fit = "contain";
    image.baseScale = scale;
    (image as PosterArtworkImage & { offsetX?: number; offsetY?: number }).offsetX = 0;
    (image as PosterArtworkImage & { offsetX?: number; offsetY?: number }).offsetY = 0;
    image.posterName = file.name || "Poster artwork";
    image.locked = true;
    image.set({
      left: doc.width / 2, top: doc.height / 2, originX: "center", originY: "center",
      scaleX: scale, scaleY: scale, selectable: false, evented: false,
    });
    this.suspend += 1;
    const previous = this.canvas.getObjects().filter((obj) => (obj as PosterImage).role === "poster-art");
    this.canvas.remove(...previous);
    if (this.bgImage) this.bgImage.visible = false;
    this.canvas.add(image);
    this.addPosterArtworkUnderText(image);
    this.suspend -= 1;
    this.store().setImageMode("poster");
    image.visible = true;
    this.syncPosterArtwork();
    this.store().setDetectedText([]);
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  getPosterImageForOCR(): { dataUrl: string; width: number; height: number; left: number; top: number; scaleX: number; scaleY: number } | null {
    const image = this.canvas?.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as PosterArtworkImage | undefined;
    if (!image) return null;
    const element = image.getElement() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = image.width || element.naturalWidth || 1;
    canvas.height = image.height || element.naturalHeight || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height,
      left: (image.left || 0) - (canvas.width * (image.scaleX || 1)) / 2,
      top: (image.top || 0) - (canvas.height * (image.scaleY || 1)) / 2,
      scaleX: image.scaleX || 1, scaleY: image.scaleY || 1,
    };
  }

  private syncPosterArtwork(): void {
    const art = this.canvas?.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as (PosterArtworkImage & { offsetX?: number; offsetY?: number }) | undefined;
    if (!art) { this.store().setPosterArt(null); return; }
    const doc = this.store().doc;
    const base = art.baseScale || 1;
    this.store().setPosterArt({
      present: true, name: art.posterName || "Poster artwork", fit: art.fit ?? "contain",
      zoom: round((art.scaleX || base) / base, 2),
      offsetX: Math.round(art.offsetX ?? (((art.left ?? doc.width / 2) - doc.width / 2) / doc.width) * 100),
      offsetY: Math.round(art.offsetY ?? (((art.top ?? doc.height / 2) - doc.height / 2) / doc.height) * 100),
      opacity: art.opacity ?? 1,
    });
  }

  private placePosterArtwork(fit: ImageFit, zoom: number, offsetX: number, offsetY: number): void {
    const art = this.canvas?.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as (PosterArtworkImage & { offsetX?: number; offsetY?: number }) | undefined;
    if (!art || !this.canvas) return;
    const doc = this.store().doc;
    const nw = art.width || 1; const nh = art.height || 1;
    const base = fit === "cover" || fit === "custom" ? Math.max(doc.width / nw, doc.height / nh) : Math.min(doc.width / nw, doc.height / nh);
    art.fit = fit; art.baseScale = base; art.offsetX = offsetX; art.offsetY = offsetY;
    const scale = fit === "stretch" ? doc.width / nw : base * zoom;
    art.set({ left: doc.width / 2 + offsetX / 100 * doc.width, top: doc.height / 2 + offsetY / 100 * doc.height,
      scaleX: scale, scaleY: fit === "stretch" ? doc.height / nh : scale });
    art.setCoords(); art.dirty = true;
    this.canvas.requestRenderAll(); this.syncPosterArtwork(); this.scheduleSave();
  }

  setPosterImageFit(fit: ImageFit): void { this.placePosterArtwork(fit, fit === "custom" ? 1.15 : 1, 0, 0); }
  setPosterImageZoom(zoom: number): void {
    const art = this.canvas?.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as (PosterArtworkImage & { offsetX?: number; offsetY?: number }) | undefined;
    if (art) this.placePosterArtwork(art.fit ?? "contain", clamp(zoom, 0.2, 4), art.offsetX ?? 0, art.offsetY ?? 0);
  }
  setPosterImageOffset(offsetX: number, offsetY: number): void {
    const art = this.canvas?.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as (PosterArtworkImage & { offsetX?: number; offsetY?: number }) | undefined;
    if (art) this.placePosterArtwork(art.fit ?? "contain", this.store().posterArt?.zoom ?? 1, offsetX, offsetY);
  }

  mapOCRRegions(regions: Array<{ text: string; confidence: number; left: number; top: number; width: number; height: number }>): DetectedTextRegion[] {
    const image = this.getPosterImageForOCR();
    if (!image) return [];
    return regions.filter((r) => r.text.trim()).map((r) => ({
      id: uid("ocr"), text: r.text.trim(), confidence: Math.round(r.confidence),
      left: Math.max(0, image.left + r.left * image.scaleX),
      top: Math.max(0, image.top + r.top * image.scaleY),
      width: Math.min(r.width * image.scaleX, this.store().doc.width),
      height: Math.min(r.height * image.scaleY, this.store().doc.height),
    }));
  }

  async addOCRReplacement(region: DetectedTextRegion, text: string): Promise<void> {
    const doc = this.store().doc;
    const width = Math.min(region.width, doc.width - region.left);
    const left = Math.max(0, Math.min(region.left, doc.width - width));
    const top = Math.max(0, Math.min(region.top, doc.height - region.height));
    await this.addTextObject({
      text: text || region.text, left, top, width,
      fontSize: Math.max(12, Math.round(region.height * 0.8)),
      fontFamily: "Inter", fontWeight: 700, fill: "#111111", textAlign: "left",
      lineHeight: 1, charSpacing: 0, name: `Replacement: ${text || region.text}`,
    }, { edit: false });
  }

  coverOCRRegion(region: DetectedTextRegion): void {
    if (!this.canvas) return;
    const art = this.canvas.getObjects().find((obj) => (obj as PosterImage).role === "poster-art") as PosterArtworkImage | undefined;
    if (!art) throw new Error("Poster artwork is no longer available.");
    const x = (region.left - ((art.left || 0) - (art.width || 0) * (art.scaleX || 1) / 2)) / (art.scaleX || 1);
    const y = (region.top - ((art.top || 0) - (art.height || 0) * (art.scaleY || 1) / 2)) / (art.scaleY || 1);
    const w = Math.max(1, region.width / (art.scaleX || 1));
    const h = Math.max(1, region.height / (art.scaleY || 1));
    const scratch = document.createElement("canvas");
    scratch.width = art.width || 1; scratch.height = art.height || 1;
    const ctx = scratch.getContext("2d");
    if (!ctx) throw new Error("Local image cleanup is unavailable in this browser.");
    ctx.drawImage(art.getElement(), 0, 0, scratch.width, scratch.height);
    const imageData = ctx.getImageData(0, 0, scratch.width, scratch.height);
    const samples: number[][] = [];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      for (const [sx, sy] of [[x + t * w, y - 2], [x + t * w, y + h + 2], [x - 2, y + t * h], [x + w + 2, y + t * h]]) {
        const px = Math.max(0, Math.min(scratch.width - 1, Math.round(sx)));
        const py = Math.max(0, Math.min(scratch.height - 1, Math.round(sy)));
        const idx = (py * scratch.width + px) * 4;
        samples.push([imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]]);
      }
    }
    const color = `rgb(${[0, 1, 2].map((channel) => Math.round(samples.reduce((sum, p) => sum + p[channel], 0) / samples.length)).join(",")})`;
    const cover = new fabric.Rect({
      left: region.left, top: region.top, width: region.width, height: region.height,
      originX: "left", originY: "top", fill: color, selectable: true, evented: true,
    }) as EditableObject;
    cover.id = this.nextId(); cover.posterName = `Cover: ${region.text}`;
    this.canvas.add(cover);
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  async replaceSelectedImage(file: File): Promise<void> {
    const img = this.getActiveImages()[0];
    if (!img || !this.canvas) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Unsupported image type. Please upload a JPG, PNG or WebP file.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("That image is too large. Please use a file under 15 MB.");
    }
    const dataUrl = await this.readFileAsDataURL(file);
    const prevW = (img.width || 1) * (img.scaleX ?? 1);
    const prevH = (img.height || 1) * (img.scaleY ?? 1);
    await img.setSrc(dataUrl, { crossOrigin: "anonymous" });
    img.posterName = file.name || img.posterName;
    const natW = img.width || 1;
    const natH = img.height || 1;
    img.set({ scaleX: prevW / natW, scaleY: prevH / natH });
    img.setCoords();
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  updateSelectedImage(
    patch: Partial<SelectedImageProps>,
    commit: "now" | "soon" | "none" = "soon",
  ): void {
    const images = this.getActiveImages();
    if (images.length === 0 || !this.canvas) return;

    for (const img of images) {
      const natW = img.width || 1;
      const natH = img.height || 1;
      if (typeof patch.opacity === "number") img.set({ opacity: clamp(patch.opacity, 0.05, 1) });
      if (typeof patch.angle === "number") img.set({ angle: patch.angle });
      if (typeof patch.left === "number") img.set({ left: patch.left });
      if (typeof patch.top === "number") img.set({ top: patch.top });
      if (typeof patch.width === "number") img.set({ scaleX: Math.max(8, patch.width) / natW });
      if (typeof patch.height === "number") img.set({ scaleY: Math.max(8, patch.height) / natH });
      if (typeof patch.visible === "boolean") img.visible = patch.visible;
      if (typeof patch.name === "string") img.posterName = patch.name;
      if (typeof patch.locked === "boolean") {
        img.locked = patch.locked;
        img.selectable = !patch.locked;
        img.evented = !patch.locked;
      }
      img.setCoords();
    }

    this.canvas.requestRenderAll();
    this.syncSelected();
    this.syncLayers();
    if (commit === "now") this.commit();
    else if (commit === "soon") this.commitSoon();
    else this.scheduleSave();
  }

  async duplicateSelected(): Promise<void> {
    if (!this.canvas) return;
    const objs = this.getActiveObjects();
    if (objs.length === 0) return;
    this.suppressCommit = true;
    const serialized = objs.map((o) => o.toObject(EXTRA_PROPS as never));
    const enlivened = await fabric.util.enlivenObjects<EditableObject>(serialized);
    const clones = enlivened.map((clone) => {
      clone.id = this.nextId();
      clone.posterName = `${clone.posterName ?? "Text"} copy`;
      clone.set({
        left: (clone.left ?? 0) + 28,
        top: (clone.top ?? 0) + 28,
      });
      clone.setCoords();
      this.canvas!.add(clone);
      return clone;
    });
    this.canvas.discardActiveObject();
    if (clones.length === 1) {
      this.canvas.setActiveObject(clones[0]);
    } else {
      const selection = new fabric.ActiveSelection(clones, { canvas: this.canvas });
      this.canvas.setActiveObject(selection);
    }
    this.suppressCommit = false;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  deleteSelected(): void {
    if (!this.canvas) return;
    const objs = this.getActiveObjects();
    if (objs.length === 0) return;
    this.suppressCommit = true;
    this.canvas.discardActiveObject();
    this.canvas.remove(...objs);
    this.suppressCommit = false;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.commit();
  }

  moveLayer(id: string, direction: "up" | "down" | "top" | "bottom"): void {
    if (!this.canvas) return;
    const obj = this.findById(id);
    if (!obj) return;
    const objects = this.canvas.getObjects();
    const index = objects.indexOf(obj);
    let target = index;
    if (direction === "up") target = Math.min(index + 1, objects.length - 1);
    if (direction === "down") target = Math.max(index - 1, 0);
    if (direction === "top") target = objects.length - 1;
    if (direction === "bottom") target = this.bgImage ? 1 : 0;
    if (target === index) return;
    const data = this.canvas as unknown as { _objects: fabric.Object[] };
    data._objects.splice(index, 1);
    data._objects.splice(target, 0, obj);
    this.canvas.requestRenderAll();
    this.syncLayers();
    this.commit();
  }

  selectById(id: string | null): void {
    if (!this.canvas) return;
    if (!id) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.store().setSelected(null, null);
      return;
    }
    const obj = this.findById(id);
    if (!obj) return;
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this.syncSelected();
  }

  toggleVisibility(id: string): void {
    const obj = this.findById(id);
    if (!obj || !this.canvas) return;
    obj.visible = !obj.visible;
    this.canvas.requestRenderAll();
    this.syncLayers();
    this.commit();
  }

  toggleLock(id: string): void {
    const obj = this.findById(id);
    if (!obj) return;
    obj.locked = !obj.locked;
    obj.selectable = !obj.locked;
    obj.evented = !obj.locked;
    if (obj.locked && this.canvas?.getActiveObject() === obj) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.store().setSelected(null, null);
    }
    this.syncLayers();
    this.syncSelected();
    this.commit();
  }

  renameObject(id: string, name: string): void {
    const obj = this.findById(id);
    if (!obj) return;
    obj.posterName = name;
    this.syncLayers();
    this.scheduleSave();
  }

  // ----- property editing -----

  updateSelected(patch: Partial<SelectedObjectProps>, commit: "now" | "soon" | "none" = "soon"): void {
    const objs = this.getActiveTextObjects();
    if (objs.length === 0 || !this.canvas) return;
    const { shadow, locked, ...rest } = patch;

    for (const obj of objs) {
      if (typeof rest.text === "string") obj.set("text", rest.text);
      if ("shadow" in patch) {
        obj.set("shadow", shadow ? createShadow(shadow) : null);
      }
      if (typeof locked === "boolean") {
        obj.locked = locked;
        obj.selectable = !locked;
        obj.evented = !locked;
      }
      const setPayload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (key === "text") continue;
        if (value !== undefined) setPayload[key] = value;
      }
      obj.set(setPayload as never);
      obj.setCoords();
    }

    const fontFamily = patch.fontFamily;
    if (fontFamily) {
      const weight = patch.fontWeight ?? objs[0].fontWeight ?? 400;
      void loadFont(fontFamily, nearestWeight(fontFamily, Number(weight))).then(() => {
        if (!this.canvas) return;
        for (const obj of objs) {
          obj.set({ fontFamily });
          obj.setCoords();
        }
        this.canvas.requestRenderAll();
      });
    }

    this.canvas.requestRenderAll();
    this.syncSelected();
    this.syncLayers();
    if (commit === "now") this.commit();
    else if (commit === "soon") this.commitSoon();
    else this.scheduleSave();
  }

  // ----- history -----

  private serializeObjects(includeBackgroundImage: boolean): unknown[] {
    if (!this.canvas) return [];
    const objects = (this.canvas as unknown as { _objects: fabric.Object[] })._objects;
    const bg = this.bgImage;
    let removedIndex = -1;
    if (bg && !includeBackgroundImage) {
      removedIndex = objects.indexOf(bg);
      if (removedIndex >= 0) objects.splice(removedIndex, 1);
    }
    const serialized = this.canvas.toObject(EXTRA_PROPS as never).objects as unknown[];
    if (removedIndex >= 0 && bg) objects.splice(removedIndex, 0, bg);
    return serialized;
  }

  private snapshot(): string {
    if (!this.canvas) return "";
    return JSON.stringify({
      objects: this.serializeObjects(false),
      background: this.store().doc.background,
      imageMode: this.store().imageMode,
      detectedText: this.store().detectedText,
    });
  }

  private setBaseline(): void {
    this.history = [this.snapshot()];
    this.cursor = 0;
    this.updateHistoryFlags();
  }

  private updateHistoryFlags(): void {
    this.store().setHistoryFlags(this.cursor > 0, this.cursor < this.history.length - 1);
  }

  commit(): void {
    if (this.suspend > 0 || !this.canvas) return;
    this.commitSoon.cancel();
    const snap = this.snapshot();
    if (snap === this.history[this.cursor]) {
      this.store().setSaveStatus("saved");
      return;
    }
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(snap);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
    this.cursor = this.history.length - 1;
    this.updateHistoryFlags();
    this.scheduleSave();
  }

  private async restore(snapshot: string): Promise<void> {
    if (!this.canvas || !snapshot) return;
    this.suspend += 1;
    try {
      const parsed = JSON.parse(snapshot) as { objects: unknown[]; background: PosterBackground; imageMode?: "poster" | "background"; detectedText?: DetectedTextRegion[] };
      this.store().setImageMode(parsed.imageMode ?? "background");
      this.store().setDetectedText(parsed.detectedText ?? []);
      await this.canvas.loadFromJSON({ objects: parsed.objects, version: "6.0.0" });
      this.ensureIds();
      this.imageAnalysis = null;
      this.applyBackground(parsed.background, true);
      if (this.bgImage) {
        this.updateBackgroundImageClip();
        const objects = (this.canvas as unknown as { _objects: fabric.Object[] })._objects;
        if (objects.indexOf(this.bgImage) < 0) this.canvas.add(this.bgImage);
        this.addToBottom(this.bgImage);
      }
      this.applyDimensions();
      this.canvas.requestRenderAll();
    } catch {
      this.store().setLastError("Could not restore a previous edit.");
    } finally {
      this.suspend -= 1;
    }
    this.syncAll();
  }

  async undo(): Promise<void> {
    if (this.cursor <= 0) return;
    this.cursor -= 1;
    await this.restore(this.history[this.cursor]);
    this.updateHistoryFlags();
    this.scheduleSave();
  }

  async redo(): Promise<void> {
    if (this.cursor >= this.history.length - 1) return;
    this.cursor += 1;
    await this.restore(this.history[this.cursor]);
    this.updateHistoryFlags();
    this.scheduleSave();
  }

  // ----- sync -----

  private syncLayers(): void {
    if (!this.canvas) return;
    const objects = [...this.canvas.getObjects()].reverse();
    const layers: LayerMeta[] = [];
    for (const o of objects) {
      if ((o as EditableObject).role === "background") continue;
      if (o instanceof fabric.Textbox) {
        const tb = o as PosterTextbox;
        layers.push({
          id: tb.id,
          name: tb.posterName || tb.text?.split("\n")[0]?.slice(0, 24) || "Text",
          text: tb.text ?? "",
          visible: o.visible !== false,
          locked: Boolean(tb.locked),
          kind: "text",
        });
      } else if (o instanceof fabric.FabricImage) {
        const img = o as PosterImage;
        if (!img.id) continue;
        layers.push({
          id: img.id,
          name: img.posterName || "Image",
          text: img.posterName || "Image",
          visible: o.visible !== false,
          locked: Boolean(img.locked),
          kind: "image",
        });
      }
    }
    this.store().setLayers(layers);
  }

  private syncSelected(): void {
    const objs = this.getActiveObjects();
    if (objs.length === 0) {
      this.store().setSelected(null, null);
      return;
    }
    const o = objs[0];
    if (o instanceof fabric.Textbox) {
      const props = this.readProps(o as PosterTextbox);
      this.store().setSelected(props.id, props);
      return;
    }
    if (o instanceof fabric.FabricImage) {
      const props = this.readImageProps(o as PosterImage);
      this.store().setSelected(props.id, props);
      return;
    }
    this.store().setSelected(null, null);
  }

  private readImageProps(o: PosterImage): SelectedImageProps {
    return {
      id: o.id ?? "",
      type: "image",
      name: o.posterName || "Image",
      opacity: round(o.opacity ?? 1, 2),
      angle: round(o.angle ?? 0, 1),
      left: Math.round(o.left ?? 0),
      top: Math.round(o.top ?? 0),
      width: Math.round((o.width ?? 0) * (o.scaleX ?? 1)),
      height: Math.round((o.height ?? 0) * (o.scaleY ?? 1)),
      visible: o.visible !== false,
      locked: Boolean(o.locked),
    };
  }

  private readProps(o: PosterTextbox): SelectedObjectProps {
    const shadow = o.shadow;
    return {
      id: o.id,
      type: "text",
      text: o.text ?? "",
      fontFamily: o.fontFamily ?? "Inter",
      fontSize: Math.round(o.fontSize ?? 40),
      fontWeight: Number(o.fontWeight) || 400,
      fontStyle: o.fontStyle === "italic" ? "italic" : "normal",
      fill: typeof o.fill === "string" ? o.fill : "#111111",
      textAlign: (o.textAlign ?? "left") as TextAlign,
      charSpacing: Math.round(o.charSpacing ?? 0),
      lineHeight: round(o.lineHeight ?? 1.1, 2),
      angle: round(o.angle ?? 0, 1),
      opacity: round(o.opacity ?? 1, 2),
      backgroundColor: typeof o.backgroundColor === "string" ? o.backgroundColor : "",
      stroke: typeof o.stroke === "string" ? o.stroke : "",
      strokeWidth: Math.round(o.strokeWidth ?? 0),
      shadow: shadow
        ? {
            color: shadow.color,
            blur: shadow.blur,
            offsetX: shadow.offsetX,
            offsetY: shadow.offsetY,
          }
        : null,
      left: Math.round(o.left ?? 0),
      top: Math.round(o.top ?? 0),
      width: Math.round(o.width ?? 0),
      height: Math.round(o.height ?? 0),
      visible: o.visible !== false,
      locked: Boolean(o.locked),
      name: o.posterName || "Text",
    };
  }

  private syncAll(): void {
    this.ensureIds();
    this.syncLayers();
    this.syncSelected();
    this.syncBackgroundImage();
    this.syncPosterArtwork();
  }

  // ----- persistence -----

  private scheduleSave(): void {
    this.store().markDirty();
    this.persistDebounced();
  }

  private persistDebounced = debounce(() => {
    this.persistNow();
  }, 700);

  private renderThumbnail(): string | null {
    if (!this.canvas) return null;
    try {
      const doc = this.store().doc;
      const multiplier = clamp(THUMB_MAX / Math.max(doc.width, doc.height), 0.06, 0.4);
      return this.toDataURL({ multiplier, format: "png" });
    } catch {
      return null;
    }
  }

  persistNow(): void {
    if (typeof window === "undefined" || !this.canvas) return;
    const store = this.store();
    const now = Date.now();
    if (!this.lastThumbnail || now - this.lastThumbAt > THUMB_INTERVAL) {
      const thumb = this.renderThumbnail();
      if (thumb) {
        this.lastThumbnail = thumb;
        this.lastThumbAt = now;
      }
    }
    const project: StoredProject = {
      id: store.projectId,
      name: store.doc.name,
      createdAt: this.projectCreatedAt,
      updatedAt: now,
      version: 2,
      doc: store.doc,
      objects: this.serializeObjects(true),
      thumbnail: this.lastThumbnail,
      hasBackgroundImage: Boolean(this.bgImage),
      imageMode: store.imageMode,
      detectedText: store.detectedText,
    };
    store.setSaveStatus("saving");
    void putProject(project)
      .then(() => {
        this.store().setSaveStatus("saved");
        this.store().setLastSavedAt(Date.now());
      })
      .catch(() => {
        this.store().setSaveStatus("error");
        this.store().setLastError("Could not save this design locally.");
      });
  }

  async loadProject(project: StoredProject): Promise<void> {
    if (!this.canvas) return;
    this.commitSoon.cancel();
    this.suspend += 1;
    try {
      const store = this.store();
      store.setProjectId(project.id);
      store.setDoc(project.doc);
      store.setActiveProjectName(project.name);
      store.setImageMode(project.imageMode ?? "background");
      store.setDetectedText(project.detectedText ?? []);
      this.projectCreatedAt = project.createdAt ?? Date.now();
      this.lastThumbnail = project.thumbnail ?? null;
      this.lastThumbAt = 0;
      await this.canvas.loadFromJSON({ objects: project.objects ?? [], version: "6.0.0" });
      this.ensureIds();
      this.bgImage = this.findBackgroundImage();
      this.imageAnalysis = null;
      if (this.bgImage) {
        this.bgImage.set({ selectable: false, evented: false, hoverCursor: "default" });
        this.addToBottom(this.bgImage);
        this.updateBackgroundImageClip();
      }
      this.applyBackground(store.doc.background, false);
      this.applyDimensions();
    } catch {
      this.store().setLastError("Could not open that project.");
    } finally {
      this.suspend -= 1;
    }
    this.syncAll();
    this.fitToViewport();
    this.setBaseline();
    this.store().setSaveStatus("saved");
  }

  saveAsNew(name: string): void {
    this.store().setProjectId(uid("project"));
    this.projectCreatedAt = Date.now();
    this.lastThumbnail = null;
    this.lastThumbAt = 0;
    this.store().setDoc({ name });
    this.store().setActiveProjectName(name);
    this.setBaseline();
    this.persistNow();
  }

  private async hydrate(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // One-time migration from the previous single-project localStorage format.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const legacy = JSON.parse(raw) as PersistedProject;
        if (legacy?.doc && legacy?.canvas) {
          this.store().setDoc(legacy.doc);
          if (legacy.projectId) this.store().setProjectId(legacy.projectId);
          this.suspend += 1;
          await this.canvas!.loadFromJSON({
            objects: (legacy.canvas as { objects?: unknown[] }).objects ?? [],
            version: "6.0.0",
          });
          this.suspend -= 1;
          this.ensureIds();
          this.applyDocToCanvas();
          window.localStorage.removeItem(STORAGE_KEY);
          return true;
        }
      }
    } catch {
      /* ignore malformed legacy data */
    }

    try {
      const projects = await listProjects();
      if (projects.length === 0) return false;
      const latest = projects[0];
      this.store().setDoc(latest.doc);
      this.store().setProjectId(latest.id);
      this.store().setActiveProjectName(latest.name);
      this.store().setImageMode(latest.imageMode ?? "background");
      this.store().setDetectedText(latest.detectedText ?? []);
      this.projectCreatedAt = latest.createdAt ?? Date.now();
      this.lastThumbnail = latest.thumbnail ?? null;
      this.suspend += 1;
      await this.canvas!.loadFromJSON({ objects: latest.objects ?? [], version: "6.0.0" });
      this.suspend -= 1;
      this.ensureIds();
      this.applyDocToCanvas();
      return true;
    } catch {
      return false;
    }
  }

  async loadProjectById(id: string): Promise<boolean> {
    const project = await getProject(id);
    if (!project) return false;
    await this.loadProject(project);
    return true;
  }

  async deleteProjectById(id: string): Promise<void> {
    await deleteProject(id);
  }

  // ----- export -----

  toDataURL(opts: ExportRenderOptions = {}): string {
    const canvas = this.canvas;
    if (!canvas) throw new Error("Canvas is not ready.");
    const { multiplier = 1, format = "png", quality } = opts;
    const doc = this.store().doc;
    const prevZoom = canvas.getZoom();
    const prevWidth = canvas.getWidth();
    const prevHeight = canvas.getHeight();
    const prevBackground = canvas.backgroundColor;
    const transparent =
      !doc.background ||
      (typeof doc.background === "string" &&
        (doc.background === "" || doc.background === "transparent"));
    try {
      // Render at 1:1 document scale so export dimensions are exact regardless
      // of the on-screen zoom level. fabric multiplies the canvas size and its
      // current zoom by the export multiplier.
      canvas.setZoom(1);
      canvas.setDimensions({ width: doc.width, height: doc.height });
      if (format === "jpeg" && transparent) canvas.backgroundColor = "#FFFFFF";
      canvas.renderAll();
      return canvas.toDataURL({
        format: format === "jpeg" ? "jpeg" : "png",
        multiplier,
        quality: format === "jpeg" ? (quality ?? 0.92) : undefined,
        enableRetinaScaling: false,
      });
    } finally {
      canvas.backgroundColor = prevBackground;
      canvas.setZoom(prevZoom);
      canvas.setDimensions({ width: prevWidth, height: prevHeight });
      canvas.renderAll();
    }
  }

  getDocument(): PosterDoc {
    return this.store().doc;
  }

  isEditingText(): boolean {
    const active = this.canvas?.getActiveObject() as { isEditing?: boolean } | undefined;
    return Boolean(active && active.isEditing);
  }
}
