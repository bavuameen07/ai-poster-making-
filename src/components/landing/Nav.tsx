"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Templates", href: "#templates" },
  { label: "Features", href: "#features" },
  { label: "Examples", href: "#examples" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200 ease-smooth",
        scrolled ? "border-b border-line bg-paper/85 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <Type className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Typeset Studio</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/editor"
            className="rounded-lg border border-line bg-panel px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper"
          >
            Open editor
          </Link>
          <Link
            href="/editor"
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
          >
            Start creating
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel md:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-6 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-black/[0.04] hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/editor"
              className="mt-2 rounded-lg bg-accent px-3.5 py-2.5 text-center text-sm font-medium text-white"
            >
              Start creating
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
