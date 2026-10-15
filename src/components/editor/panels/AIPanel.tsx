"use client";

import { useCallback, useState } from "react";
import {
  Sparkles,
  Wand2,
  Type,
  Palette as PaletteIcon,
  LayoutTemplate,
  Quote,
  RefreshCw,
  AlertTriangle,
  Check,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { SkeletonLine } from "@/components/ui/Spinner";
import { useEditorStore } from "@/store/editorStore";
import { getEngine } from "@/lib/editor/engineRef";
import { idealTextColor } from "@/lib/background";
import type { AIResponse, AITask, FontPairing, LayoutSuggestion, PaletteSuggestion } from "@/lib/ai/types";

const MOODS = [
  "Confident",
  "Minimal",
  "Bold",
  "Elegant",
  "Playful",
  "Editorial",
  "Warm",
  "Cinematic",
  "Futuristic",
];

export function AIPanel() {
  const [topic, setTopic] = useState("");
  const [mood, setMood] = useState("Confident");
  const [loading, setLoading] = useState<AITask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [lastTask, setLastTask] = useState<AITask>("ideas");

  const background = useEditorStore((s) => s.doc.background);

  const generate = useCallback(
    async (task: AITask) => {
      if (!topic.trim() && task !== "ideas") {
        setError("Describe your poster topic first.");
        return;
      }
      setLoading(task);
      setError(null);
      setLastTask(task);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, topic, mood, count: 6 }),
        });
        const data = (await res.json()) as AIResponse & { message?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.message || "The AI request failed. Please try again.");
        }
        setResponse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please retry.");
      } finally {
        setLoading(null);
      }
    },
    [topic, mood],
  );

  const flash = (key: string) => {
    setApplied(key);
    setTimeout(() => setApplied((current) => (current === key ? null : current)), 1400);
  };

  const engine = () => getEngine();
  const selection = () => useEditorStore.getState().selected;

  const applySlogan = (text: string) => {
    const e = engine();
    if (!e) return;
    if (selection()) {
      e.updateSelected({ text }, "now");
    } else {
      void e.addTextObject(
        {
          text,
          fontFamily: "Inter",
          fontSize: 84,
          fontWeight: 700,
          fill: idealTextColor(background),
          textAlign: "center",
          lineHeight: 1.1,
          name: "Slogan",
        },
        { edit: false },
      );
    }
    flash(`slogan-${text}`);
  };

  const applyFontPairing = (pairing: FontPairing) => {
    const e = engine();
    if (!e) return;
    if (selection()) {
      e.updateSelected({ fontFamily: pairing.heading, fontWeight: 800 }, "now");
    } else {
      const color = idealTextColor(background);
      void e.addTextObject(
        {
          text: "Heading",
          fontFamily: pairing.heading,
          fontSize: 140,
          fontWeight: pairing.heading === "Anton" || pairing.heading === "Bebas Neue" ? 400 : 800,
          fill: color,
          textAlign: "center",
          name: `${pairing.heading} heading`,
        },
        { edit: false },
      );
      void e.addTextObject(
        {
          text: "Supporting text in the paired body face.",
          fontFamily: pairing.body,
          fontSize: 34,
          fontWeight: 400,
          fill: color,
          textAlign: "center",
          name: `${pairing.body} body`,
        },
        { edit: false },
      );
    }
    flash(`font-${pairing.heading}-${pairing.body}`);
  };

  const applyPalette = (palette: PaletteSuggestion) => {
    const e = engine();
    if (!e) return;
    e.setBackground(palette.background);
    if (selection()) {
      e.updateSelected({ fill: palette.text }, "now");
    }
    flash(`palette-${palette.name}`);
  };

  const applyLayout = (layout: LayoutSuggestion) => {
    const e = engine();
    if (!e) return;
    const doc = e.getDocument();
    const color = idealTextColor(background);
    const width = Math.round(doc.width * 0.78);
    const left = Math.round((doc.width - width) / 2);
    const blocks: { text: string; family: string; size: number; top: number; spacing: number }[] = [
      { text: (layout.structure[0] ?? "EYEBROW").toUpperCase(), family: "JetBrains Mono", size: 24, top: Math.round(doc.height * 0.22), spacing: 220 },
      { text: layout.name.toUpperCase(), family: "Anton", size: 150, top: Math.round(doc.height * 0.36), spacing: 0 },
      { text: layout.description || "Supporting copy goes here.", family: "Inter", size: 32, top: Math.round(doc.height * 0.62), spacing: 0 },
    ];
    blocks.forEach((block) => {
      void e.addTextObject(
        {
          text: block.text,
          fontFamily: block.family,
          fontSize: block.size,
          fontWeight: block.family === "Anton" ? 400 : 500,
          fill: color,
          textAlign: "center",
          charSpacing: block.spacing,
          left,
          top: block.top,
          width,
          lineHeight: 1.2,
          name: `Layout · ${layout.name}`,
        },
        { edit: false },
      );
    });
    flash(`layout-${layout.name}`);
  };

  const configured = response?.configured ?? false;
  const isDemo = response?.source === "demo";

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-lg border border-line bg-gradient-to-b from-accent-wash/60 to-transparent p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">AI creative assistant</p>
            <p className="text-[11px] text-ink-mute">Slogans, fonts, palettes and layouts</p>
          </div>
        </div>
        <TextInput
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. a jazz night, a startup launch, a marathon"
          aria-label="Poster topic"
        />
        <select
          aria-label="Mood"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          className="h-8 w-full rounded-lg border border-line bg-panel px-2.5 text-sm text-ink outline-none focus:border-accent"
        >
          {MOODS.map((m) => (
            <option key={m} value={m}>
              Mood: {m}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          className="w-full"
          loading={loading === "ideas"}
          onClick={() => generate("ideas")}
        >
          {loading !== "ideas" && <Sparkles className="h-3.5 w-3.5" />}
          Generate ideas
        </Button>
        <div className="grid grid-cols-4 gap-1">
          <TaskButton active={lastTask === "slogans"} loading={loading === "slogans"} onClick={() => generate("slogans")} icon={<Quote className="h-3.5 w-3.5" />} label="Slogans" />
          <TaskButton active={lastTask === "fonts"} loading={loading === "fonts"} onClick={() => generate("fonts")} icon={<Type className="h-3.5 w-3.5" />} label="Fonts" />
          <TaskButton active={lastTask === "palette"} loading={loading === "palette"} onClick={() => generate("palette")} icon={<PaletteIcon className="h-3.5 w-3.5" />} label="Colour" />
          <TaskButton active={lastTask === "layout"} loading={loading === "layout"} onClick={() => generate("layout")} icon={<LayoutTemplate className="h-3.5 w-3.5" />} label="Layout" />
        </div>
      </div>

      {error && (
        <div className="space-y-2 rounded-lg border border-danger/30 bg-red-50 p-3">
          <div className="flex items-start gap-2 text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => generate(lastTask)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {response && isDemo && (
        <div className="flex items-start gap-2 rounded-lg border border-line bg-paper p-3 text-ink-soft">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-[11px] leading-relaxed">
            <span className="font-medium text-ink">Local demo suggestions.</span> No AI key is
            configured. Add <code className="rounded bg-panel px-1">OPENAI_API_KEY</code> to your
            environment to enable live generation.
          </p>
        </div>
      )}
      {response && configured && (
        <p className="px-0.5 text-[11px] text-ink-faint">
          Generated with {response.model ?? "your AI provider"} · {response.source === "ai" ? "live" : "demo"}
        </p>
      )}

      {loading && <LoadingState />}

      {!loading && !response && !error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
          <Wand2 className="h-5 w-5 text-ink-faint" />
          <p className="text-xs text-ink-mute">
            Enter a topic and generate on-brand slogans, pairings, palettes and layouts.
          </p>
        </div>
      )}

      {!loading && response && (
        <div className="space-y-5">
          {response.slogans.length > 0 && (
            <Section title="Slogans & quotes" count={response.slogans.length}>
              {response.slogans.map((slogan) => (
                <div
                  key={slogan.text}
                  className="flex items-start justify-between gap-2 rounded-lg border border-line bg-panel p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug text-ink">{slogan.text}</p>
                    {slogan.tone && <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-faint">{slogan.tone}</p>}
                  </div>
                  <ApplyButton
                    applied={applied === `slogan-${slogan.text}`}
                    onClick={() => applySlogan(slogan.text)}
                  />
                </div>
              ))}
            </Section>
          )}

          {response.fontPairings.length > 0 && (
            <Section title="Font pairings" count={response.fontPairings.length}>
              {response.fontPairings.map((pairing) => (
                <div
                  key={`${pairing.heading}-${pairing.body}`}
                  className="space-y-2 rounded-lg border border-line bg-panel p-2.5"
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className="truncate text-lg leading-tight"
                      style={{ fontFamily: `"${pairing.heading}", sans-serif`, fontWeight: 700 }}
                    >
                      {pairing.heading}
                    </span>
                    <span className="text-sm text-ink-soft" style={{ fontFamily: `"${pairing.body}", sans-serif` }}>
                      + {pairing.body}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-mute">{pairing.rationale}</p>
                  <div className="flex items-center justify-between">
                    {pairing.useCase && <span className="text-[10px] text-ink-faint">{pairing.useCase}</span>}
                    <ApplyButton
                      applied={applied === `font-${pairing.heading}-${pairing.body}`}
                      onClick={() => applyFontPairing(pairing)}
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}

          {response.palettes.length > 0 && (
            <Section title="Colour palettes" count={response.palettes.length}>
              {response.palettes.map((palette) => (
                <div key={palette.name} className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2.5">
                  <span className="flex overflow-hidden rounded-md border border-line">
                    {palette.colors.map((color, i) => (
                      <span key={`${color}-${i}`} className="h-7 w-5" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-soft">{palette.name}</span>
                  <ApplyButton applied={applied === `palette-${palette.name}`} onClick={() => applyPalette(palette)} />
                </div>
              ))}
            </Section>
          )}

          {response.layouts.length > 0 && (
            <Section title="Layout ideas" count={response.layouts.length}>
              {response.layouts.map((layout) => (
                <div key={layout.name} className="space-y-2 rounded-lg border border-line bg-panel p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">{layout.name}</span>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-soft">{layout.mood}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-mute">{layout.description}</p>
                  <ul className="space-y-0.5">
                    {layout.structure.map((step, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[10px] text-ink-faint">
                        <span className="h-1 w-1 rounded-full bg-ink-faint" />
                        {step}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <ApplyButton applied={applied === `layout-${layout.name}`} onClick={() => applyLayout(layout)} />
                  </div>
                </div>
              ))}
            </Section>
          )}

          {response.slogans.length === 0 &&
            response.fontPairings.length === 0 &&
            response.palettes.length === 0 &&
            response.layouts.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-ink-mute">
                No suggestions returned. Try a different topic or mood.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function TaskButton({
  active,
  loading,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors " +
        (active ? "border-accent/40 bg-panel text-accent" : "border-line bg-panel text-ink-soft hover:bg-paper")
      }
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {label}
    </button>
  );
}

function ApplyButton({ applied, onClick }: { applied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors " +
        (applied ? "border-emerald-500/40 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-ink hover:border-accent/40 hover:text-accent")
      }
    >
      {applied ? <Check className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
      {applied ? "Applied" : "Apply"}
    </button>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h4>
        <span className="text-[10px] text-ink-faint">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <SkeletonLine className="w-1/3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border border-line bg-panel p-2.5">
          <SkeletonLine className="w-4/5" />
          <SkeletonLine className="w-2/5" />
        </div>
      ))}
    </div>
  );
}
