import Link from "next/link";
import { ArrowRight, Sparkles, MoveHorizontal, Type, Layers } from "lucide-react";
import { PosterThumb } from "@/components/poster/PosterThumb";
import { TEMPLATES } from "@/lib/templates";

const shows = [TEMPLATES[0], TEMPLATES[1], TEMPLATES[3]];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-36">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-[0.5]"
        style={{
          background:
            "radial-gradient(600px 300px at 20% 0%, #e8ecff 0%, transparent 70%), radial-gradient(500px 260px at 85% 10%, #f1f1ec 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.05fr_minmax(0,520px)]">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft shadow-panel">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI-assisted typography studio
          </span>

          <h1 className="mt-6 text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[60px]">
            Design posters that speak in <span className="text-accent">type</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            A focused canvas for editorial-grade typography. Lay out editable text, pair fonts with
            confidence, borrow AI-written slogans, and export print-ready PNG or PDF — all without
            leaving your browser.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/editor"
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-medium text-white shadow-[0_12px_30px_-12px_rgba(29,78,216,0.7)] transition-all hover:bg-accent-ink"
            >
              Start creating
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#templates"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-panel px-5 text-[15px] font-medium text-ink transition-colors hover:bg-paper"
            >
              Explore templates
            </a>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
            <Stat icon={<Type className="h-4 w-4" />} value="16" label="Studio fonts" />
            <Stat icon={<Layers className="h-4 w-4" />} value="8" label="Starter layouts" />
            <Stat icon={<MoveHorizontal className="h-4 w-4" />} value="PNG / PDF" label="Print export" />
          </dl>
        </div>

        <div className="relative hidden h-[520px] lg:block" aria-hidden>
          <div className="absolute right-2 top-2 rotate-[3deg]">
            <PosterThumb template={shows[0]} width={230} className="shadow-poster ring-1 ring-line" />
          </div>
          <div className="absolute right-[210px] top-16 -rotate-[5deg]">
            <PosterThumb template={shows[1]} width={200} className="shadow-poster ring-1 ring-line" />
          </div>
          <div className="absolute right-[95px] top-[250px] rotate-[1deg]">
            <PosterThumb template={shows[2]} width={210} className="shadow-poster ring-1 ring-line" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-ink-mute">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.08em]">{label}</span>
      </dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight text-ink">{value}</dd>
    </div>
  );
}
