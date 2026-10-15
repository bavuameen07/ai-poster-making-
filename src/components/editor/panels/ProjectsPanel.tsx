"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useEditorStore } from "@/store/editorStore";
import { useProjectsStore } from "@/store/projectsStore";
import { getEngine } from "@/lib/editor/engineRef";
import { getProject, putProject } from "@/lib/storage/db";
import { uid } from "@/lib/utils";
import type { StoredProject } from "@/types/poster";

function formatWhen(timestamp: number): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProjectsPanel() {
  const projects = useProjectsStore((s) => s.projects);
  const loading = useProjectsStore((s) => s.loading);
  const refresh = useProjectsStore((s) => s.refresh);
  const activeId = useEditorStore((s) => s.projectId);
  const setLastError = useEditorStore((s) => s.setLastError);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const newProject = () => {
    getEngine()?.newProject();
    setTimeout(() => void refresh(), 300);
  };

  const openProject = async (project: StoredProject) => {
    const engine = getEngine();
    if (!engine) return;
    setBusyId(project.id);
    try {
      await engine.loadProjectById(project.id);
    } catch {
      setLastError("Could not open that project.");
    } finally {
      setBusyId(null);
    }
  };

  const saveRename = async (project: StoredProject) => {
    const name = draftName.trim() || project.name;
    try {
      await putProject({ ...project, name, updatedAt: Date.now() });
      if (project.id === activeId) getEngine()?.setDocName(name);
      setEditingId(null);
      await refresh();
    } catch {
      setLastError("Could not rename that project.");
    }
  };

  const duplicateProject = async (project: StoredProject) => {
    try {
      const source = (await getProject(project.id)) ?? project;
      const now = Date.now();
      await putProject({
        ...source,
        id: uid("project"),
        name: `${source.name} (copy)`,
        createdAt: now,
        updatedAt: now,
      });
      await refresh();
    } catch {
      setLastError("Could not duplicate that project.");
    }
  };

  const confirmDelete = async () => {
    const project = pendingDelete;
    setPendingDelete(null);
    if (!project) return;
    try {
      await getEngine()?.deleteProjectById(project.id);
      if (project.id === activeId) getEngine()?.newProject();
      await refresh();
    } catch {
      setLastError("Could not delete that project.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="px-0.5 text-xs leading-relaxed text-ink-mute">
          Saved locally on this device.
        </p>
        <Button size="sm" variant="secondary" onClick={newProject}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {loading && projects.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-ink-mute">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
          <FolderOpen className="h-5 w-5 text-ink-faint" />
          <p className="text-xs text-ink-mute">
            No saved projects yet. Your work is saved here automatically.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {projects.map((project) => {
          const isActive = project.id === activeId;
          const isEditing = editingId === project.id;
          return (
            <div
              key={project.id}
              className={
                "rounded-lg border p-2 transition-colors " +
                (isActive ? "border-accent/40 bg-accent-wash" : "border-line bg-panel hover:bg-paper")
              }
            >
              <div className="flex items-center gap-2">
                <span className="h-10 w-8 shrink-0 overflow-hidden rounded-md border border-line bg-paper">
                  {project.thumbnail ? (
                    <span
                      aria-hidden
                      className="block h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${project.thumbnail})` }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ink-faint">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>

                {isEditing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <TextInput
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename(project);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7"
                    />
                    <button
                      type="button"
                      aria-label="Save name"
                      onClick={() => void saveRename(project)}
                      className="rounded-md p-1 text-ink-mute transition-colors hover:bg-black/5 hover:text-accent"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel rename"
                      onClick={() => setEditingId(null)}
                      className="rounded-md p-1 text-ink-mute transition-colors hover:bg-black/5 hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openProject(project)}
                    className="min-w-0 flex-1 text-left"
                    title={`Open ${project.name}`}
                  >
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {project.name}
                    </span>
                    <span className="block truncate text-[10px] text-ink-faint">
                      {formatWhen(project.updatedAt)}
                      {isActive ? " · current" : ""}
                    </span>
                  </button>
                )}
              </div>

              {!isEditing && (
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openProject(project)}
                    disabled={busyId === project.id}
                    className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-md border border-line bg-paper text-[11px] text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                  >
                    {busyId === project.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FolderOpen className="h-3 w-3" />
                    )}
                    Open
                  </button>
                  <button
                    type="button"
                    aria-label="Rename project"
                    onClick={() => {
                      setEditingId(project.id);
                      setDraftName(project.name);
                    }}
                    className="rounded-md border border-line bg-paper p-1 text-ink-mute transition-colors hover:text-accent"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Duplicate project"
                    onClick={() => void duplicateProject(project)}
                    className="rounded-md border border-line bg-paper p-1 text-ink-mute transition-colors hover:text-accent"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete project"
                    onClick={() => setPendingDelete(project)}
                    className="rounded-md border border-line bg-paper p-1 text-ink-mute transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete project?"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          “{pendingDelete?.name}” will be permanently removed from this device. This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
