import { NextResponse } from "next/server";
import { demoResponse } from "@/lib/ai/demo";
import type {
  AIRequest,
  AIResponse,
  AITask,
  FontPairing,
  LayoutSuggestion,
  PaletteSuggestion,
  SloganSuggestion,
} from "@/lib/ai/types";
import { FONT_FAMILIES } from "@/lib/fonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASKS: AITask[] = ["slogans", "fonts", "palette", "layout", "ideas"];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function aiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, baseUrl, model, configured: Boolean(apiKey) };
}

function clampCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(8, Math.max(2, Math.round(n)));
}

function buildPrompt(task: AITask, topic: string, mood: string, count: number): string {
  return [
    "You are a senior graphic-design art director who writes typography poster copy.",
    `Theme/topic: "${topic}". Desired mood: "${mood || "confident, modern"}".`,
    `Return ${count} strong options for each requested section.`,
    "Respond with ONLY a JSON object (no markdown, no commentary) using exactly this shape:",
    `{
  "slogans": [{ "text": string, "tone": string }],
  "fontPairings": [{ "heading": string, "body": string, "rationale": string, "useCase": string }],
  "palettes": [{ "name": string, "background": "#hex", "text": "#hex", "accent": "#hex", "colors": ["#hex", "#hex", "#hex", "#hex", "#hex"] }],
  "layouts": [{ "name": string, "mood": string, "description": string, "structure": [string, string, string] }]
}`,
    `For "fontPairings" heading/body values you MUST choose from this exact list: ${FONT_FAMILIES.join(", ")}.`,
    "All palette values must be valid 6-digit hex colors.",
    `Focus your strongest effort on the "${task}" section while still returning valid values for all sections.`,
  ].join("\n");
}

function coerceSlogans(value: unknown): SloganSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SloganSuggestion | null => {
      if (typeof item === "string") return { text: item };
      if (item && typeof item === "object" && typeof (item as SloganSuggestion).text === "string") {
        return {
          text: (item as SloganSuggestion).text,
          tone: typeof (item as SloganSuggestion).tone === "string" ? (item as SloganSuggestion).tone : undefined,
        };
      }
      return null;
    })
    .filter((x): x is SloganSuggestion => Boolean(x && x.text.trim()));
}

function coerceFonts(value: unknown): FontPairing[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(FONT_FAMILIES);
  return value
    .map((item): FontPairing | null => {
      const rec = item as Partial<FontPairing>;
      if (!rec || typeof rec.heading !== "string" || typeof rec.body !== "string") return null;
      const heading = allowed.has(rec.heading) ? rec.heading : "Anton";
      const body = allowed.has(rec.body) ? rec.body : "Inter";
      return {
        heading,
        body,
        rationale: typeof rec.rationale === "string" ? rec.rationale : "A balanced display and body pairing.",
        useCase: typeof rec.useCase === "string" ? rec.useCase : undefined,
      };
    })
    .filter((x): x is FontPairing => Boolean(x));
}

function coercePalettes(value: unknown): PaletteSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): PaletteSuggestion | null => {
      const rec = item as Partial<PaletteSuggestion>;
      if (!rec || !Array.isArray(rec.colors)) return null;
      const colors = rec.colors.filter((c): c is string => typeof c === "string" && HEX.test(c)).slice(0, 6);
      if (colors.length === 0) return null;
      return {
        name: typeof rec.name === "string" ? rec.name : "Suggested palette",
        background: typeof rec.background === "string" && HEX.test(rec.background) ? rec.background : colors[0],
        text: typeof rec.text === "string" && HEX.test(rec.text) ? rec.text : colors[1] ?? "#111111",
        accent: typeof rec.accent === "string" && HEX.test(rec.accent) ? rec.accent : colors[2] ?? colors[0],
        colors,
      };
    })
    .filter((x): x is PaletteSuggestion => Boolean(x));
}

function coerceLayouts(value: unknown): LayoutSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): LayoutSuggestion | null => {
      const rec = item as Partial<LayoutSuggestion>;
      if (!rec || typeof rec.name !== "string") return null;
      return {
        name: rec.name,
        mood: typeof rec.mood === "string" ? rec.mood : "Modern",
        description: typeof rec.description === "string" ? rec.description : "",
        structure: Array.isArray(rec.structure)
          ? rec.structure.filter((s): s is string => typeof s === "string")
          : [],
      };
    })
    .filter((x): x is LayoutSuggestion => Boolean(x));
}

function parseJson(content: string): Record<string, unknown> {
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as Record<string, unknown>;
}

export async function GET() {
  const { configured, model } = aiConfig();
  return NextResponse.json({ configured, model });
}

export async function POST(request: Request) {
  let body: AIRequest;
  try {
    body = (await request.json()) as AIRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON request body." }, { status: 400 });
  }

  const task = TASKS.includes(body?.task) ? body.task : null;
  if (!task) {
    return NextResponse.json({ ok: false, message: "Unknown AI task." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 240) : "";
  const mood = typeof body.mood === "string" ? body.mood.trim().slice(0, 80) : "";
  const count = clampCount(body.count);

  if (topic.length === 0 && task !== "ideas") {
    return NextResponse.json({ ok: false, message: "Describe your topic to get suggestions." }, { status: 400 });
  }

  const { apiKey, baseUrl, model, configured } = aiConfig();

  if (!configured) {
    return NextResponse.json(demoResponse(task, topic, mood));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.9,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You output strict, valid JSON only." },
            { role: "user", content: buildPrompt(task, topic || "a modern poster", mood, count) },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          message: `AI provider returned ${response.status}. ${detail.slice(0, 200)}`.trim(),
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, message: "The AI returned an empty response." }, { status: 502 });
    }

    const parsed = parseJson(content);
    const result: AIResponse = {
      ok: true,
      configured: true,
      source: "ai",
      task,
      topic: topic || undefined,
      slogans: coerceSlogans(parsed.slogans).slice(0, count),
      fontPairings: coerceFonts(parsed.fontPairings).slice(0, count),
      palettes: coercePalettes(parsed.palettes).slice(0, count),
      layouts: coerceLayouts(parsed.layouts).slice(0, count),
      model,
    };
    return NextResponse.json(result);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { ok: false, message: aborted ? "The AI request timed out. Please try again." : "Could not reach the AI provider." },
      { status: 502 },
    );
  }
}
