import type { PosterTemplate, PosterTextObject } from "@/types/poster";

function T(partial: Partial<PosterTextObject> & { text: string }): PosterTextObject {
  return {
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 400,
    fontStyle: "normal",
    fill: "#111111",
    left: 90,
    top: 90,
    width: 600,
    textAlign: "left",
    charSpacing: 0,
    lineHeight: 1.1,
    angle: 0,
    opacity: 1,
    ...partial,
  };
}

export const TEMPLATES: PosterTemplate[] = [
  {
    id: "minimalist-type",
    name: "Less Is More",
    category: "Minimalist",
    mood: "Calm · Editorial",
    tags: ["minimal", "editorial", "quiet"],
    width: 1080,
    height: 1350,
    background: "#F4F1EA",
    objects: [
      T({ text: "N°01", fontFamily: "Inter", fontWeight: 300, fontSize: 26, charSpacing: 300, fill: "#8A8579", top: 90 }),
      T({ text: "LESS\nIS\nMORE", fontFamily: "Inter", fontWeight: 200, fontSize: 210, lineHeight: 0.92, width: 900, top: 320, fill: "#111111" }),
      T({ text: "A study in restraint and deliberate negative space.", fontSize: 30, lineHeight: 1.5, width: 700, top: 1060, fill: "#55555B" }),
      T({ text: "FORM + FUNCTION — 2026", fontWeight: 500, fontSize: 22, charSpacing: 240, top: 1240, fill: "#111111" }),
    ],
  },
  {
    id: "bold-editorial",
    name: "Fearless",
    category: "Bold Editorial",
    mood: "Loud · Magazine",
    tags: ["bold", "magazine", "impact"],
    width: 1080,
    height: 1350,
    background: "#0A0A0B",
    objects: [
      T({ text: "ISSUE 04", fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 24, charSpacing: 400, fill: "#2A6BFF", top: 100 }),
      T({ text: "FEARLESS", fontFamily: "Anton", fontSize: 250, width: 940, top: 360, fill: "#F5F5F5", lineHeight: 0.9 }),
      T({ text: "The magazine for people who refuse to blend in.", fontSize: 34, lineHeight: 1.4, width: 720, top: 940, fill: "#B8B8BE" }),
      T({ text: "EDITORIAL", fontFamily: "Bebas Neue", fontSize: 64, charSpacing: 260, top: 1210, fill: "#E11D2E" }),
    ],
  },
  {
    id: "motivational-quote",
    name: "Create The Future",
    category: "Motivational",
    mood: "Warm · Inspiring",
    tags: ["quote", "motivation", "warm"],
    width: 1080,
    height: 1350,
    background: { type: "linear", angle: 160, stops: [{ offset: 0, color: "#F6ECD8" }, { offset: 1, color: "#EFDCBE" }] },
    objects: [
      T({ text: "\u201C", fontFamily: "Playfair Display", fontSize: 260, fill: "#E4572E", top: 40, left: 70, width: 300 }),
      T({ text: "The best way\nto predict your\nfuture is to\ncreate it.", fontFamily: "Playfair Display", fontWeight: 600, fontStyle: "italic", fontSize: 92, lineHeight: 1.16, width: 900, top: 300, fill: "#3A2417" }),
      T({ text: "— PETER DRUCKER", fontWeight: 500, fontSize: 26, charSpacing: 220, width: 700, top: 1150, fill: "#8A6A4A" }),
    ],
  },
  {
    id: "music-poster",
    name: "Midnight Frequencies",
    category: "Music",
    mood: "Dark · Electric",
    tags: ["music", "night", "neon"],
    width: 1080,
    height: 1350,
    background: { type: "linear", angle: 160, stops: [{ offset: 0, color: "#3B0F52" }, { offset: 1, color: "#0A0118" }] },
    objects: [
      T({ text: "MIDNIGHT", fontFamily: "Bebas Neue", fontSize: 250, width: 960, top: 240, fill: "#00E5FF", charSpacing: 20 }),
      T({ text: "FREQUENCIES", fontFamily: "Bebas Neue", fontSize: 150, width: 960, top: 500, fill: "#FFFFFF", charSpacing: 10 }),
      T({ text: "LIVE · 12.06 · WAREHOUSE 9", fontFamily: "JetBrains Mono", fontWeight: 400, fontSize: 30, charSpacing: 160, width: 960, top: 1080, fill: "#FFFFFF" }),
      T({ text: "ft. special guests — doors 21:00", fontSize: 32, fontWeight: 300, width: 800, top: 1160, fill: "#C9B8E0" }),
    ],
  },
  {
    id: "fashion-poster",
    name: "Atelier Maison",
    category: "Fashion",
    mood: "Elegant · Luxe",
    tags: ["fashion", "elegant", "editorial"],
    width: 1080,
    height: 1350,
    background: "#F3E3DE",
    objects: [
      T({ text: "ATELIER", fontFamily: "Syne", fontWeight: 800, fontSize: 210, width: 960, top: 110, fill: "#2A1A18", charSpacing: 20 }),
      T({ text: "MAISON", fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: 96, width: 960, top: 400, fill: "#B5483A", charSpacing: 60 }),
      T({ text: "AUTUMN / WINTER 2026", fontWeight: 500, fontSize: 26, charSpacing: 320, width: 900, top: 1150, fill: "#2A1A18" }),
      T({ text: "the new collection", fontFamily: "Cormorant Garamond", fontSize: 44, fontWeight: 400, width: 800, top: 1230, fill: "#6B4A44" }),
    ],
  },
  {
    id: "geometric-type",
    name: "Geometry",
    category: "Geometric",
    mood: "Modern · Graphic",
    tags: ["geometric", "graphic", "bold"],
    width: 1080,
    height: 1080,
    background: "#111111",
    objects: [
      T({ text: "GEOMETRY", fontFamily: "Archivo Black", fontSize: 170, width: 940, left: 60, top: 380, fill: "#FFFFFF", charSpacing: 10, textAlign: "center" }),
      T({ text: "SHAPE", fontFamily: "Anton", fontSize: 60, width: 400, left: 60, top: 120, fill: "#FFE066", angle: -12, charSpacing: 120 }),
      T({ text: "BALANCE", fontFamily: "Anton", fontSize: 60, width: 400, left: 620, top: 860, fill: "#00E5FF", angle: -12, charSpacing: 120 }),
      T({ text: "FORM FOLLOWS FUNCTION", fontFamily: "JetBrains Mono", fontSize: 24, charSpacing: 200, width: 940, left: 60, top: 640, fill: "#8B8B92", textAlign: "center" }),
    ],
  },
  {
    id: "retro-type",
    name: "Summer Festival",
    category: "Retro",
    mood: "Playful · Vintage",
    tags: ["retro", "vintage", "summer"],
    width: 1080,
    height: 1350,
    background: "#F4E6C8",
    objects: [
      T({ text: "SUMMER", fontFamily: "Oswald", fontWeight: 700, fontSize: 230, width: 960, top: 170, fill: "#E4572E", charSpacing: 20 }),
      T({ text: "FESTIVAL", fontFamily: "Bebas Neue", fontSize: 180, width: 960, top: 430, fill: "#2A9D8F", charSpacing: 30 }),
      T({ text: "JULY 18–21 · SEASIDE PARK", fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 28, charSpacing: 240, width: 960, top: 1140, fill: "#3A2417" }),
      T({ text: "EST. 1976", fontFamily: "Bebas Neue", fontSize: 70, charSpacing: 120, width: 400, top: 1000, fill: "#3A2417" }),
    ],
  },
  {
    id: "swiss-modern",
    name: "Swiss Modern",
    category: "Swiss / Modern",
    mood: "Precise · Grid",
    tags: ["swiss", "grid", "modern"],
    width: 1080,
    height: 1350,
    background: "#FFFFFF",
    objects: [
      T({ text: "HELVETICA\nNEUE", fontFamily: "Archivo", fontWeight: 800, fontSize: 168, lineHeight: 0.96, width: 940, top: 130, fill: "#111111" }),
      T({ text: "01", fontFamily: "Archivo", fontWeight: 800, fontSize: 300, width: 500, left: 620, top: 720, fill: "#E11D2E", textAlign: "right" }),
      T({ text: "INTERNATIONAL TYPOGRAPHIC STYLE", fontWeight: 500, fontSize: 24, charSpacing: 140, width: 940, top: 1180, fill: "#111111" }),
      T({ text: "1957 — 2026 · ZÜRICH", fontFamily: "JetBrains Mono", fontSize: 24, charSpacing: 120, width: 940, top: 1240, fill: "#6B6B6B" }),
    ],
  },
];

export function templateById(id: string): PosterTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function templateCategories(): string[] {
  return Array.from(new Set(TEMPLATES.map((t) => t.category)));
}
