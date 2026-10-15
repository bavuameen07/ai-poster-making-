import { getEngine } from "@/lib/editor/engineRef";

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
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface ExportOptions {
  scale?: number;
  filename?: string;
}

export async function exportPNG({ scale = 2, filename }: ExportOptions = {}): Promise<void> {
  const engine = getEngine();
  if (!engine) throw new Error("The editor canvas is not ready yet.");
  const doc = engine.getDocument();
  const dataUrl = engine.toDataURL(scale);
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    throw new Error("Could not render the poster to an image.");
  }
  triggerDownload(dataUrl, `${safeFilename(filename ?? doc.name)}.png`);
}

export async function exportPDF({ scale = 2, filename }: ExportOptions = {}): Promise<void> {
  const engine = getEngine();
  if (!engine) throw new Error("The editor canvas is not ready yet.");
  const doc = engine.getDocument();
  const dataUrl = engine.toDataURL(scale);

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
