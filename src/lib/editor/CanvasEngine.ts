import * as fabric from "fabric";
import type {
  LayerMeta,
  PersistedProject,
  PosterBackground,
  PosterDoc,
  PosterTemplate,
  PosterTextObject,
  TextAlign,
} from "@/types/poster";
import type { SelectedObjectProps } from "@/store/editorStore";
import { useEditorStore } from "@/store/editorStore";
import { clamp, debounce, round, uid } from "@/lib/utils";
import { loadFont, nearestWeight, preloadAllFonts } from "@/lib/fonts";
import { TEMPLATES } from "@/lib/templates";

type PosterTextbox = fabric.Textbox & {
  id: string;
  posterName: string;
  locked: boolean;
};

const EXTRA_PROPS = ["id", "posterName", "locked"];
export const STORAGE_KEY = "ai-typography-poster:project:v1";
const HISTORY_LIMIT = 60;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

export interface TextPreset extends Partial<PosterTextObject> {
  text: string;
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

    this.applyBackground(this.store().doc.background, false);
    this.syncAll();
    this.setBaseline();
    this.store().setHydrated(true);
    if (requested) this.persistNow();
  }

  dispose(): void {
    this.commitSoon.cancel();
    if (this.canvas) {
      this.canvas.off();
      void this.canvas.dispose();
      this.canvas = null;
    }
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
      if (this.suspend > 0 || this.suppressCommit) return;
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
  }

  private applyDimensions(): void {
    if (!this.canvas) return;
    const { width, height } = this.store().doc;
    const zoom = this.store().zoom;
    this.canvas.setDimensions({ width: Math.round(width * zoom), height: Math.round(height * zoom) });
    this.canvas.setZoom(zoom);
    this.canvas.requestRenderAll();
  }

  resizeCanvas(width: number, height: number): void {
    this.store().setDoc({ width, height });
    this.applyDimensions();
    this.syncAll();
    this.commit();
  }

  // ----- templates & creation -----

  private async loadTemplateInternal(template: PosterTemplate): Promise<void> {
    this.suspend += 1;
    try {
      if (!this.canvas) return;
      this.canvas.remove(...this.canvas.getObjects());
      this.store().setDoc({
        name: template.name,
        width: template.width,
        height: template.height,
        background: template.background,
      });
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
    if (direction === "bottom") target = 0;
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

  private snapshot(): string {
    if (!this.canvas) return "";
    return JSON.stringify({
      objects: this.canvas.toObject(EXTRA_PROPS as never).objects,
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
    const layers: LayerMeta[] = objects.map((o) => {
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
  }

  // ----- persistence -----

  private scheduleSave(): void {
    this.store().markDirty();
    this.persistDebounced();
  }

  private persistDebounced = debounce(() => {
    this.persistNow();
  }, 700);

  persistNow(): void {
    if (typeof window === "undefined" || !this.canvas) return;
    const store = this.store();
    try {
      store.setSaveStatus("saving");
      const project: PersistedProject = {
        version: 1,
        projectId: store.projectId,
        doc: store.doc,
        canvas: { objects: this.canvas.toObject(EXTRA_PROPS as never).objects },
        savedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      store.setSaveStatus("saved");
    } catch {
      store.setSaveStatus("error");
      store.setLastError("Could not save your work locally.");
    }
  }

  private async hydrate(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const project = JSON.parse(raw) as PersistedProject;
      if (!project?.doc || !project?.canvas) return false;
      const store = this.store();
      store.setDoc(project.doc);
      store.setProjectId(project.projectId ?? store.projectId);
      this.suspend += 1;
      await this.canvas!.loadFromJSON({
        objects: (project.canvas as { objects?: unknown[] }).objects ?? [],
        version: "6.0.0",
      });
      this.suspend -= 1;
      this.ensureIds();
      this.applyDocToCanvas();
      return true;
    } catch {
      return false;
    }
  }

  clearProject(): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  // ----- export -----

  toDataURL(multiplier: number): string {
    const canvas = this.canvas;
    if (!canvas) throw new Error("Canvas is not ready.");
    const doc = this.store().doc;
    const prevZoom = canvas.getZoom();
    const prevWidth = canvas.getWidth();
    const prevHeight = canvas.getHeight();
    try {
      // Render at 1:1 document scale so export dimensions are exact
      // regardless of the on-screen zoom level. fabric multiplies the
      // canvas width and its current zoom by the export multiplier.
      canvas.setZoom(1);
      canvas.setDimensions({ width: doc.width, height: doc.height });
      canvas.renderAll();
      return canvas.toDataURL({
        format: "png",
        multiplier,
        enableRetinaScaling: false,
      });
    } finally {
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
