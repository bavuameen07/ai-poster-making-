"use client";

import { PosterThumb } from "@/components/poster/PosterThumb";
import { TEMPLATES } from "@/lib/templates";
import { getEngine } from "@/lib/editor/engineRef";

export function TemplatesPanel() {
  return (
    <div className="space-y-3">
      <p className="px-0.5 text-xs leading-relaxed text-ink-mute">
        Applying a template replaces the current canvas. You can undo this with ⌘/Ctrl + Z.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => getEngine()?.applyTemplate(template)}
            className="group min-w-0 text-left focus-visible:outline-none"
          >
            <div className="overflow-hidden rounded-lg border border-line bg-paper p-2 transition-all duration-200 ease-smooth group-hover:border-accent/40 group-hover:shadow-panel group-focus-visible:border-accent group-focus-visible:ring-2 group-focus-visible:ring-accent/30">
              <PosterThumb template={template} width={120} height={150} />
            </div>
            <p className="mt-1.5 truncate text-[11px] font-medium text-ink-soft group-hover:text-ink">
              {template.name}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
