import Link from "next/link";
import { PosterThumb } from "@/components/poster/PosterThumb";
import { templateById } from "@/lib/templates";

const EXAMPLES: { id: string; caption: string; note: string }[] = [
  { id: "bold-editorial", caption: "Magazine cover", note: "Condensed display + mono eyebrow" },
  { id: "motivational-quote", caption: "Quote card", note: "High-contrast serif, italic lead" },
  { id: "swiss-modern", caption: "Swiss poster", note: "Grid, numbered index, red accent" },
  { id: "music-poster", caption: "Live event", note: "Neon on deep gradient" },
];

export function Examples() {
  return (
    <section id="examples" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="field-label">Example designs</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
            Built entirely from editable text and colour.
          </h2>
        </div>
        <Link
          href="/editor"
          className="text-sm font-medium text-accent transition-colors hover:text-accent-ink"
        >
          Try these layouts →
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLES.map((example) => {
          const template = templateById(example.id);
          if (!template) return null;
          return (
            <figure key={example.id} className="group">
              <Link
                href={`/editor?template=${example.id}`}
                className="block overflow-hidden rounded-lg border border-line bg-paper p-4 transition-all duration-200 ease-smooth group-hover:-translate-y-1 group-hover:shadow-pop"
              >
                <div className="flex justify-center">
                  <PosterThumb template={template} width={260} />
                </div>
              </Link>
              <figcaption className="mt-3">
                <p className="text-sm font-medium text-ink">{example.caption}</p>
                <p className="text-xs text-ink-mute">{example.note}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
