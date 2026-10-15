import { getEngine } from "@/lib/editor/engineRef";
import type { ExportFormat } from "@/types/poster";

function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "poster"
  );
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface ExportOptions {
  /** Resolution multiplier relative to the document's native pixel size. */
  scale?: number;
  /** JPEG quality between 0 and 1 (ignored for PNG). */
  quality?: number;
  filename?: string;
}

function extensionFor(format: ExportFormat): string {
  return format === "jpeg" ? "jpg" : "png";
}

async function exportImage(format: ExportFormat, opts: ExportOptions = {}): Promise<void> {
  const engine = getEngine();
  if (!engine) throw new Error("The editor canvas is not ready yet.");
  const { scale = 2, quality = 0.92, filename } = opts;
  const doc = engine.getDocument();
  const dataUrl = engine.toDataURL({ multiplier: scale, format, quality });
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    throw new Error("Could not render the poster to an image.");
  }
  triggerDownload(dataUrl, `${safeFilename(filename ?? doc.name)}.${extensionFor(format)}`);
}

export function exportPNG(opts: ExportOptions = {}): Promise<void> {
  return exportImage("png", opts);
}

export function exportJPEG(opts: ExportOptions = {}): Promise<void> {
  return exportImage("jpeg", opts);
}

export function exportImageAs(format: ExportFormat, opts: ExportOptions = {}): Promise<void> {
  return exportImage(format, opts);
}

export async function exportPDF(opts: ExportOptions = {}): Promise<void> {
  const engine = getEngine();
  if (!engine) throw new Error("The editor canvas is not ready yet.");
  const { scale = 2, filename } = opts;
  const doc = engine.getDocument();
  // PDF embeds a raster image, so always render PNG (lossless, alpha-safe).
  const dataUrl = engine.toDataURL({ multiplier: scale, format: "png" });

  const { jsPDF } = await import("jspdf");
  const orientation = doc.width >= doc.height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [doc.width, doc.height],
    hotfixes: ["px_scaling"],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, doc.width, doc.height, undefined, "FAST");
  pdf.save(`${safeFilename(filename ?? doc.name)}.pdf`);
}
