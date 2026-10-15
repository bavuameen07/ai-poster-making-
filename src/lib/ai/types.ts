export type AITask = "slogans" | "fonts" | "palette" | "layout" | "ideas";

export interface SloganSuggestion {
  text: string;
  tone?: string;
}

export interface FontPairing {
  heading: string;
  body: string;
  rationale: string;
  useCase?: string;
}

export interface PaletteSuggestion {
  name: string;
  background: string;
  text: string;
  accent: string;
  colors: string[];
}

export interface LayoutSuggestion {
  name: string;
  mood: string;
  description: string;
  structure: string[];
}

export interface AIResponse {
  ok: boolean;
  configured: boolean;
  source: "ai" | "demo";
  task: AITask;
  topic?: string;
  slogans: SloganSuggestion[];
  fontPairings: FontPairing[];
  palettes: PaletteSuggestion[];
  layouts: LayoutSuggestion[];
  message?: string;
  model?: string;
}

export interface AIRequest {
  task: AITask;
  topic?: string;
  mood?: string;
  count?: number;
}

export const EMPTY_AI_RESPONSE: AIResponse = {
  ok: true,
  configured: false,
  source: "demo",
  task: "ideas",
  slogans: [],
  fontPairings: [],
  palettes: [],
  layouts: [],
};

export function emptyResponse(task: AITask, topic = ""): AIResponse {
  return { ...EMPTY_AI_RESPONSE, task, topic };
}
