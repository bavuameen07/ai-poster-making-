"use client";

import { LayoutTemplate, PlusSquare, Wand2, PaintBucket, Layers, FolderOpen } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import type { LeftTab } from "@/store/editorStore";
import { cn } from "@/lib/utils";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { AddTextPanel } from "./panels/AddTextPanel";
import { AIPanel } from "./panels/AIPanel";
import { BackgroundPanel } from "./panels/BackgroundPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ProjectsPanel } from "./panels/ProjectsPanel";

const TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "templates", label: "Templates", icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: "text", label: "Add", icon: <PlusSquare className="h-4 w-4" /> },
  { id: "ai", label: "AI", icon: <Wand2 className="h-4 w-4" /> },
  { id: "background", label: "Canvas", icon: <PaintBucket className="h-4 w-4" /> },
  { id: "layers", label: "Layers", icon: <Layers className="h-4 w-4" /> },
  { id: "projects", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
];

export function LeftSidebar() {
  const leftTab = useEditorStore((s) => s.leftTab);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);

  return (
    <aside className="flex min-h-0 w-full flex-col border-line bg-panel lg:w-[300px] lg:border-r">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 py-2">
        {TABS.map((tab) => {
          const active = tab.id === leftTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLeftTab(tab.id)}
              aria-pressed={active}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                active ? "bg-accent-wash text-accent" : "text-ink-mute hover:bg-black/[0.04] hover:text-ink",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-3">
        {leftTab === "templates" && <TemplatesPanel />}
        {leftTab === "text" && <AddTextPanel />}
        {leftTab === "ai" && <AIPanel />}
        {leftTab === "background" && <BackgroundPanel />}
        {leftTab === "layers" && <LayersPanel />}
        {leftTab === "projects" && <ProjectsPanel />}
      </div>
    </aside>
  );
}
