"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { CanvasStage } from "./CanvasStage";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { cn } from "@/lib/utils";

export interface EditorShellProps {
  initialTemplateId?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function EditorShell({ initialTemplateId }: EditorShellProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const lastError = useEditorStore((s) => s.lastError);
  const setLastError = useEditorStore((s) => s.setLastError);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const engine = getEngine();
      const mod = event.ctrlKey || event.metaKey;
      if (isTypingTarget(event.target)) return;
      if (!engine) return;

      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        void engine.undo();
        return;
      }
      if ((mod && event.key.toLowerCase() === "z" && event.shiftKey) || (mod && event.key.toLowerCase() === "y")) {
        event.preventDefault();
        void engine.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void engine.duplicateSelected();
        return;
      }
      if (engine.isEditingText()) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        engine.deleteSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper">
      <TopBar onToggleLeft={() => setLeftOpen((v) => !v)} onToggleRight={() => setRightOpen((v) => !v)} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {(leftOpen || rightOpen) && (
          <button
            type="button"
            aria-label="Close panels"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
            className="absolute inset-0 z-10 bg-ink/20 lg:hidden"
          />
        )}

        <div
          className={cn(
            "absolute inset-y-0 left-0 z-20 h-full w-[300px] shrink-0 shadow-pop transition-transform duration-200 ease-smooth lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
            leftOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <LeftSidebar />
        </div>

        <CanvasStage initialTemplateId={initialTemplateId} />

        <div
          className={cn(
            "absolute inset-y-0 right-0 z-20 h-full w-[320px] shrink-0 shadow-pop transition-transform duration-200 ease-smooth lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
            rightOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <RightSidebar />
        </div>
      </div>

      {lastError && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
          <div className="pointer-events-auto flex items-start gap-3 rounded-panel border border-danger/30 bg-panel px-4 py-3 shadow-pop animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="max-w-sm text-sm text-ink">{lastError}</p>
            <button
              type="button"
              onClick={() => setLastError(null)}
              aria-label="Dismiss"
              className="rounded-md p-0.5 text-ink-mute transition-colors hover:bg-black/5 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
