import type { CanvasEngine } from "./CanvasEngine";

let engine: CanvasEngine | null = null;

export function setEngine(next: CanvasEngine | null): void {
  engine = next;
}

export function getEngine(): CanvasEngine | null {
  return engine;
}

export function requireEngine(): CanvasEngine {
  if (!engine) {
    throw new Error("Editor canvas is not ready yet.");
  }
  return engine;
}
