import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PosterThumb } from "@/components/poster/PosterThumb";
import { TEMPLATES, templateCategories } from "@/lib/templates";

export function FeaturedGallery() {
  const categories = templateCategories();

  return (
    <section id="templates" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-20">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="field-label">Featured templates</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
            Start from a designed layout, not a blank canvas.
          </h2>
        </div>
        <Link
          href="/editor"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-ink"
        >
          Open the editor <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            {category}
          </span>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {TEMPLATES.map((template) => (
          <Link
            key={template.id}
            href={`/editor?template=${template.id}`}
            className="group block"
          >
            <div className="overflow-hidden rounded-lg border border-line bg-paper p-3 transition-all duration-200 ease-smooth group-hover:-translate-y-1 group-hover:border-ink/20 group-hover:shadow-pop">
              <div className="flex justify-center">
                <PosterThumb template={template} width={210} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{template.name}</p>
                <p className="text-xs text-ink-mute">{template.mood}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-accent" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
