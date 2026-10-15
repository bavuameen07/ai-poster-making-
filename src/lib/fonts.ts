export type FontCategory = "sans" | "serif" | "display" | "mono";

export interface FontDef {
  family: string;
  label: string;
  category: FontCategory;
  weights: number[];
  italic?: boolean;
}

export const FONTS: FontDef[] = [
  { family: "Inter", label: "Inter", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: "Montserrat", label: "Montserrat", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Poppins", label: "Poppins", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Space Grotesk", label: "Space Grotesk", category: "sans", weights: [300, 400, 500, 600, 700] },
  { family: "Archivo", label: "Archivo", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Syne", label: "Syne", category: "display", weights: [400, 500, 600, 700, 800] },
  { family: "Archivo Black", label: "Archivo Black", category: "display", weights: [400] },
  { family: "Anton", label: "Anton", category: "display", weights: [400] },
  { family: "Bebas Neue", label: "Bebas Neue", category: "display", weights: [400] },
  { family: "Oswald", label: "Oswald", category: "sans", weights: [200, 300, 400, 500, 600, 700] },
  { family: "Barlow Condensed", label: "Barlow Condensed", category: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Playfair Display", label: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: "DM Serif Display", label: "DM Serif Display", category: "serif", weights: [400], italic: true },
  { family: "Cormorant Garamond", label: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700], italic: true },
  { family: "Libre Baskerville", label: "Libre Baskerville", category: "serif", weights: [400, 700], italic: true },
  { family: "JetBrains Mono", label: "JetBrains Mono", category: "mono", weights: [300, 400, 500, 600, 700] },
];

export const FONT_FAMILIES = FONTS.map((f) => f.family);

const WEIGHT_LABELS: Record<number, string> = {
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

export function weightLabel(weight: number): string {
  return WEIGHT_LABELS[weight] ?? String(weight);
}

export function getFont(family: string): FontDef | undefined {
  return FONTS.find((f) => f.family === family);
}

export function nearestWeight(family: string, weight: number): number {
  const font = getFont(family);
  if (!font) return weight;
  return font.weights.reduce((prev, curr) =>
    Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev,
  );
}

const loaded = new Set<string>();

export async function loadFont(family: string, weight = 400, italic = false): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const key = `${family}:${weight}:${italic}`;
  if (loaded.has(key)) return;
  try {
    await (document as Document & { fonts: FontFaceSet }).fonts.load(
      `${italic ? "italic " : ""}${weight} 24px "${family}"`,
    );
    loaded.add(key);
  } catch {
    /* font may not be available offline; canvas falls back gracefully */
  }
}

export function preloadAllFonts(): Promise<void> {
  return Promise.all(
    FONTS.flatMap((font) =>
      font.weights.map((weight) => loadFont(font.family, weight)),
    ),
  ).then(() => {
    /* all fonts resolved (or failed gracefully) */
  });
}
