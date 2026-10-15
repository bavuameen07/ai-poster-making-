import { create } from "zustand";
import type { BackgroundImageInfo, LayerMeta, PosterDoc, TextAlign, TextShadow } from "@/types/poster";
import { DEFAULT_SIZE } from "@/lib/sizes";
import { uid } from "@/lib/utils";

export type LeftTab = "templates" | "text" | "ai" | "background" | "layers" | "projects";
export type SaveStatus = "idle" | "saving" | "saved" | "dirty" | "error";

export interface SelectedObjectProps {
  id: string;
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fill: string;
  textAlign: TextAlign;
  charSpacing: number;
  lineHeight: number;
  angle: number;
  opacity: number;
  backgroundColor: string;
  stroke: string;
  strokeWidth: number;
  shadow: TextShadow | null;
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  name: string;
}

export interface EditorState {
  projectId: string;
  projectName: string;
  hydrated: boolean;
  doc: PosterDoc;
  layers: LayerMeta[];
  selectedId: string | null;
  selected: SelectedObjectProps | null;
  bgImage: BackgroundImageInfo | null;
  zoom: number;
  leftTab: LeftTab;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  lastError: string | null;
  exporting: boolean;
  lastSavedAt: number;

  setDoc: (patch: Partial<PosterDoc>) => void;
  setLayers: (layers: LayerMeta[]) => void;
  setSelected: (id: string | null, props: SelectedObjectProps | null) => void;
  setBgImage: (info: BackgroundImageInfo | null) => void;
  setZoom: (zoom: number) => void;
  setLeftTab: (tab: LeftTab) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;
  setHydrated: (value: boolean) => void;
  setProjectId: (id: string) => void;
  setActiveProjectName: (name: string) => void;
  setLastError: (message: string | null) => void;
  setExporting: (value: boolean) => void;
  setLastSavedAt: (value: number) => void;
  markDirty: () => void;
  reset: () => void;
}

function initialDoc(): PosterDoc {
  return {
    name: "Untitled Poster",
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
    background: "#F4F1EA",
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  projectId: uid("project"),
  projectName: "Untitled Poster",
  hydrated: false,
  doc: initialDoc(),
  layers: [],
  selectedId: null,
  selected: null,
  bgImage: null,
  zoom: 0.5,
  leftTab: "templates",
  saveStatus: "idle",
  canUndo: false,
  canRedo: false,
  lastError: null,
  exporting: false,
  lastSavedAt: 0,

  setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
  setLayers: (layers) => set({ layers }),
  setSelected: (selectedId, selected) => set({ selectedId, selected }),
  setBgImage: (bgImage) => set({ bgImage }),
  setZoom: (zoom) => set({ zoom }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setHydrated: (hydrated) => set({ hydrated }),
  setProjectId: (projectId) => set({ projectId }),
  setActiveProjectName: (projectName) => set({ projectName }),
  setLastError: (lastError) => set({ lastError }),
  setExporting: (exporting) => set({ exporting }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  markDirty: () => set({ saveStatus: "dirty" }),
  reset: () =>
    set({
      projectId: uid("project"),
      projectName: "Untitled Poster",
      doc: initialDoc(),
      layers: [],
      selectedId: null,
      selected: null,
      bgImage: null,
      canUndo: false,
      canRedo: false,
      saveStatus: "idle",
      lastError: null,
      lastSavedAt: 0,
    }),
}));
