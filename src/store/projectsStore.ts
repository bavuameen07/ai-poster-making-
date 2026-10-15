import { create } from "zustand";
import type { StoredProject } from "@/types/poster";
import { deleteProject, listProjects } from "@/lib/storage/db";

interface ProjectsState {
  projects: StoredProject[];
  loading: boolean;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const projects = await listProjects();
      set({ projects });
    } finally {
      set({ loading: false });
    }
  },
  remove: async (id) => {
    await deleteProject(id);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  },
}));
