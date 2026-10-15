import { Sparkles, Type, Palette, Layers, Download, MoveHorizontal } from "lucide-react";

const FEATURES = [
  {
    icon: Type,
    title: "Real typographic control",
    body: "Family, weight, size, tracking, leading, alignment and rotation — every value is editable and reflected on canvas instantly.",
  },
  {
    icon: Sparkles,
    title: "AI that writes the words",
    body: "Describe a topic and get slogans, font pairings, palettes and layout ideas. Apply any suggestion without losing your work.",
  },
  {
    icon: Palette,
    title: "Colour with context",
    body: "Curated palettes and gradients, plus full custom colour, outline and shadow control for every text object.",
  },
  {
    icon: Layers,
    title: "Layer-level control",
    body: "Reorder, rename, lock and hide objects. Undo and redo every meaningful edit, and your project is saved locally as you go.",
  },
  {
    icon: MoveHorizontal,
    title: "Composable layouts",
    body: "Portrait, square, story and landscape canvases with true document dimensions, so what you design is what you export.",
  },
  {
    icon: Download,
    title: "Print-ready export",
    body: "Download high-resolution PNG or vector-sized PDF at up to 3× scale with fonts, colours and effects preserved.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-line bg-panel/60">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-20">
        <p className="field-label">Why Typeset Studio</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
          Everything a poster needs, nothing that gets in the way.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="bg-panel p-6 transition-colors hover:bg-paper">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink">
                <feature.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
