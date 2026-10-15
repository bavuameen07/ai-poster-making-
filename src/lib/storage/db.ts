import type { StoredProject } from "@/types/poster";

const DB_NAME = "typeset-studio";
const DB_VERSION = 1;
const STORE = "projects";
const FALLBACK_KEY = "typeset-studio:projects:v2";

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

// ----- localStorage fallback (used only when IndexedDB is unavailable) -----

function readFallback(): StoredProject[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredProject[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallback(projects: StoredProject[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(projects));
}

// ----- public API -----

export async function listProjects(): Promise<StoredProject[]> {
  try {
    const all = await tx<StoredProject[]>("readonly", (store) => store.getAll() as IDBRequest<StoredProject[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return readFallback().sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  try {
    return await tx<StoredProject | undefined>("readonly", (store) => store.get(id) as IDBRequest<StoredProject | undefined>);
  } catch {
    return readFallback().find((p) => p.id === id);
  }
}

export async function putProject(project: StoredProject): Promise<void> {
  try {
    await tx("readwrite", (store) => store.put(project));
  } catch {
    const projects = readFallback().filter((p) => p.id !== project.id);
    projects.push(project);
    writeFallback(projects);
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await tx("readwrite", (store) => store.delete(id));
  } catch {
    writeFallback(readFallback().filter((p) => p.id !== id));
  }
}
