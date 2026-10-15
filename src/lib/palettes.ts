export interface Palette {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  {
    id: "paper-black",
    name: "Paper & Ink",
    background: "#F4F1EA",
    text: "#111111",
    accent: "#1D4ED8",
    colors: ["#F4F1EA", "#E4DFD3", "#111111", "#1D4ED8", "#8A8579"],
  },
  {
    id: "electric-night",
    name: "Electric Night",
    background: "#0A0A0B",
    text: "#F5F5F5",
    accent: "#2A6BFF",
    colors: ["#0A0A0B", "#141418", "#2A6BFF", "#F5F5F5", "#6E6E78"],
  },
  {
    id: "sunset-pop",
    name: "Sunset Pop",
    background: "#FF5A3C",
    text: "#1A0F0A",
    accent: "#FFD23F",
    colors: ["#FF5A3C", "#FFD23F", "#1A0F0A", "#FFEFE6", "#C8341A"],
  },
  {
    id: "sage-calm",
    name: "Sage Calm",
    background: "#E7EDE4",
    text: "#1F2A22",
    accent: "#3E6A4C",
    colors: ["#E7EDE4", "#C5D3C0", "#1F2A22", "#3E6A4C", "#8AA08F"],
  },
  {
    id: "royal-editorial",
    name: "Royal Editorial",
    background: "#101B3B",
    text: "#F2F4FF",
    accent: "#F2C14E",
    colors: ["#101B3B", "#1B2A5B", "#F2C14E", "#F2F4FF", "#7C89C7"],
  },
  {
    id: "blush-fashion",
    name: "Blush Fashion",
    background: "#F3E3DE",
    text: "#2A1A18",
    accent: "#B5483A",
    colors: ["#F3E3DE", "#E7C8BE", "#2A1A18", "#B5483A", "#9E8B84"],
  },
  {
    id: "mono-swiss",
    name: "Mono Swiss",
    background: "#FFFFFF",
    text: "#111111",
    accent: "#E11D2E",
    colors: ["#FFFFFF", "#111111", "#E11D2E", "#EFEFEF", "#6B6B6B"],
  },
  {
    id: "retro-soda",
    name: "Retro Soda",
    background: "#F4E6C8",
    text: "#3A2417",
    accent: "#E4572E",
    colors: ["#F4E6C8", "#3A2417", "#E4572E", "#2A9D8F", "#F2C14E"],
  },
  {
    id: "neon-club",
    name: "Neon Club",
    background: "#12002B",
    text: "#FFFFFF",
    accent: "#00E5FF",
    colors: ["#12002B", "#00E5FF", "#FF2E88", "#FFFFFF", "#6C3BAA"],
  },
  {
    id: "forest-organic",
    name: "Forest Organic",
    background: "#1E2A24",
    text: "#EDE9DF",
    accent: "#C9A227",
    colors: ["#1E2A24", "#33463C", "#C9A227", "#EDE9DF", "#8FA394"],
  },
  {
    id: "slate-minimal",
    name: "Slate Minimal",
    background: "#EEF0F3",
    text: "#1B1F24",
    accent: "#2563EB",
    colors: ["#EEF0F3", "#1B1F24", "#2563EB", "#C7CCD3", "#6A7280"],
  },
  {
    id: "candy-brutal",
    name: "Candy Brutal",
    background: "#FFE066",
    text: "#111111",
    accent: "#FF4D6D",
    colors: ["#FFE066", "#FF4D6D", "#111111", "#33C4B0", "#FFFFFF"],
  },
];

export function paletteById(id: string): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}
