import * as fabric from "fabric";
import type {
  BackgroundImageInfo,
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
import type { SelectedObjectProps } from "@/store/editorStore";
import { useEditorStore } from "@/store/editorStore";
import { clamp, debounce, round, uid } from "@/lib/utils";
import { loadFont, nearestWeight, preloadAllFonts } from "@/lib/fonts";
import { TEMPLATES } from "@/lib/templates";
import { deleteProject, getProject, listProjects, putProject } from "@/lib/storage/db";

type PosterTextbox = fabric.Textbox & {
  id: string;
  posterName: string;
  locked: boolean;
};

type PosterImage = fabric.FabricImage & {
  id?: string;
  posterName?: string;
  role?: string;
  fit?: ImageFit;
  baseScale?: number;
};

const EXTRA_PROPS = ["id", "posterName", "locked", "role", "fit", "baseScale"];
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

  private getActiveObjects(): PosterTextbox[] {
    if (!this.canvas) return [];
    const active = this.canvas.getActiveObjects();
    return active.filter((o) => o instanceof fabric.Textbox) as PosterTextbox[];
  }

  private findById(id: string): PosterTextbox | null {
    return this.getTextObjects().find((o) => o.id === id) ?? null;
  }

  private ensureIds(): void {
    for (const obj of this.getTextObjects()) {
      if (!obj.id) obj.id = this.nextId();
      if (!obj.posterName) obj.posterName = obj.text.split("\n")[0].slice(0, 24) || "Text";
      if (typeof obj.locked !== "boolean") obj.locked = false;
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
    this.canvas.add(img);
    this.addToBottom(img);
    this.updateBackgroundImageClip();
    this.placeBackgroundImage("cover", 1, 0, 0);
    this.suspend -= 1;
    this.canvas.requestRenderAll();
    this.syncAll();
    this.scheduleSave();
  }

  setBackgroundImageFit(fit: ImageFit): void {
    if (!this.bgImage) return;
    this.placeBackgroundImage(fit, 1, 0, 0);
    this.canvas?.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  setBackgroundImageZoom(zoom: number): void {
    const img = this.bgImage;
    if (!img || !this.canvas) return;
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
    img.set({ opacity: clamp(opacity, 0.05, 1) });
    this.canvas.requestRenderAll();
    this.syncBackgroundImage();
    this.scheduleSave();
  }

  removeBackgroundImage(): void {
    if (!this.bgImage || !this.canvas) return;
    this.canvas.remove(this.bgImage);
    this.bgImage = null;
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
      this.store().setBgImage(null);
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

  addImageObject(dataUrl: string, name = "Image"): void {
    if (!this.canvas) return;
    void fabric.FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" })
      .then((img) => {
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
        (img as PosterImage).id = this.nextId();
        (img as PosterImage).posterName = name;
        this.canvas!.add(img);
        this.canvas!.setActiveObject(img);
        this.canvas!.requestRenderAll();
        this.syncAll();
        this.commit();
      })
      .catch(() => {
        this.store().setLastError("Could not add that image.");
      });
  }

  async duplicateSelected(): Promise<void> {
    if (!this.canvas) return;
    const objs = this.getActiveObjects();
    if (objs.length === 0) return;
    this.suppressCommit = true;
    const serialized = objs.map((o) => o.toObject(EXTRA_PROPS as never));
    const enlivened = await fabric.util.enlivenObjects<PosterTextbox>(serialized);
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
    const objs = this.getActiveObjects();
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
      const parsed = JSON.parse(snapshot) as { objects: unknown[]; background: PosterBackground };
      await this.canvas.loadFromJSON({ objects: parsed.objects, version: "6.0.0" });
      this.ensureIds();
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
    const layers: LayerMeta[] = objects
      .filter((o) => o instanceof fabric.Textbox)
      .map((o) => {
        const tb = o as PosterTextbox;
        return {
          id: tb.id,
          name: tb.posterName || tb.text?.split("\n")[0]?.slice(0, 24) || "Text",
          text: tb.text ?? "",
          visible: o.visible !== false,
          locked: Boolean(tb.locked),
        };
      });
    this.store().setLayers(layers);
  }

  private syncSelected(): void {
    const objs = this.getActiveObjects();
    if (objs.length === 0) {
      this.store().setSelected(null, null);
      return;
    }
    const o = objs[0];
    const props = this.readProps(o);
    this.store().setSelected(props.id, props);
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
      this.projectCreatedAt = project.createdAt ?? Date.now();
      this.lastThumbnail = project.thumbnail ?? null;
      this.lastThumbAt = 0;
      await this.canvas.loadFromJSON({ objects: project.objects ?? [], version: "6.0.0" });
      this.ensureIds();
      this.bgImage = this.findBackgroundImage();
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
