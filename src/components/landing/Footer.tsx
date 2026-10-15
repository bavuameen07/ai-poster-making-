import Link from "next/link";
import { Type } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-2">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
              <Type className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Typeset Studio</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
            An AI-assisted typography poster maker for designers who care about type. Your projects
            are stored locally in your browser.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link href="/editor" className="text-sm text-ink-soft transition-colors hover:text-ink">
            Open editor
          </Link>
          <a href="#templates" className="text-sm text-ink-soft transition-colors hover:text-ink">
            Templates
          </a>
          <a href="#features" className="text-sm text-ink-soft transition-colors hover:text-ink">
            Features
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-5 text-xs text-ink-mute">
          <span>© {new Date().getFullYear()} Typeset Studio</span>
          <span>Built with Next.js, Fabric.js & Tailwind CSS</span>
        </div>
      </div>
    </footer>
  );
}
