import type { AIResponse, AITask } from "./types";

function titleCase(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function demoResponse(task: AITask, topicRaw = "", mood = ""): AIResponse {
  const topic = topicRaw.trim() || "your idea";
  const label = titleCase(topic);
  const upper = label.toUpperCase();
  const moodLabel = mood.trim() || "confident";

  return {
    ok: true,
    configured: false,
    source: "demo",
    task,
    topic: label,
    message:
      "No AI key is configured. These are clearly-labelled LOCAL DEMO suggestions generated from templates — not live AI output.",
    slogans: [
      { text: `${upper} STARTS HERE.`, tone: moodLabel },
      { text: `Everything begins with ${label.toLowerCase()}.`, tone: "storytelling" },
      { text: `Make ${label.toLowerCase()} inevitable.`, tone: "bold" },
      { text: `Less noise. More ${label.toLowerCase()}.`, tone: "minimal" },
      { text: `${label} — designed to be remembered.`, tone: "premium" },
      { text: `Where ${label.toLowerCase()} meets obsession.`, tone: "editorial" },
    ],
    fontPairings: [
      {
        heading: "Anton",
        body: "Inter",
        rationale: "A towering condensed display against a neutral, highly legible grotesque.",
        useCase: "Bold editorial and statement posters",
      },
      {
        heading: "Playfair Display",
        body: "Montserrat",
        rationale: "High-contrast serif titles with a clean geometric sans for supporting copy.",
        useCase: "Quotes, fashion and luxury layouts",
      },
      {
        heading: "Archivo Black",
        body: "Space Grotesk",
        rationale: "Heavy industrial display paired with a slightly quirky modern grotesque.",
        useCase: "Music, sport and streetwear",
      },
      {
        heading: "Syne",
        body: "Barlow Condensed",
        rationale: "Distinctive contemporary display with efficient, tight supporting text.",
        useCase: "Culture and design events",
      },
    ],
    palettes: [
      {
        name: "Electric Night",
        background: "#0A0A0B",
        text: "#F5F5F5",
        accent: "#2A6BFF",
        colors: ["#0A0A0B", "#141418", "#2A6BFF", "#F5F5F5", "#6E6E78"],
      },
      {
        name: "Warm Paper",
        background: "#F4F1EA",
        text: "#111111",
        accent: "#E4572E",
        colors: ["#F4F1EA", "#E4DFD3", "#111111", "#E4572E", "#8A8579"],
      },
      {
        name: "Deep Sage",
        background: "#1E2A24",
        text: "#EDE9DF",
        accent: "#C9A227",
        colors: ["#1E2A24", "#33463C", "#C9A227", "#EDE9DF", "#8FA394"],
      },
    ],
    layouts: [
      {
        name: "Monolith",
        mood: "Loud",
        description: "One enormous word dominates; support copy is small and pinned to the base.",
        structure: ["Tiny label top-left", "Giant headline centre", "Supporting line bottom", "Accent rule or marker"],
      },
      {
        name: "Quiet Grid",
        mood: "Calm",
        description: "Generous margins, left-aligned stack, deliberate negative space.",
        structure: ["Eyebrow / index", "Multi-line headline", "Body paragraph", "Footer meta line"],
      },
      {
        name: "Editorial Split",
        mood: "Premium",
        description: "Stacked serif headline with a rotated accent phrase and refined attribution.",
        structure: ["Decorative quote mark", "Italic serif headline", "Rotated accent label", "Attribution"],
      },
    ],
    model: "local-demo",
  };
}
