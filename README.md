# Typeset Studio — AI Typography Poster Maker

A production-quality web app for designing typography posters: a Fabric.js editor with
editable text layers, curated font pairings, colour palettes, templates, AI-assisted copy,
and high-resolution PNG/PDF export.

## Features

- **Landing page** with featured examples and template gallery.
- **Poster editor** (Fabric.js) — add/move/edit text layers, typography controls
  (family, weight, style, size, spacing, line height, alignment, colour, shadow),
  gradients and solid backgrounds, layer ordering, locking and visibility.
- **Templates** — eight editable, responsive poster templates.
- **AI assistant** — slogans, font pairings, palettes and layout ideas, with a
  clearly-labelled local demo fallback when no API key is configured.
- **Export** — PNG at 1×/2×/3× and print-ready PDF.
- **Local persistence** — your project auto-saves to `localStorage`.
- **Undo / redo**, zoom controls and keyboard shortcuts.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand · Fabric.js 6 · jsPDF

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page and
[http://localhost:3000/editor](http://localhost:3000/editor) for the editor.

## Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm run dev`       | Start the development server   |
| `npm run build`     | Create an optimized build      |
| `npm run start`     | Run the production build       |
| `npm run lint`      | Run ESLint                     |
| `npm run typecheck` | Type-check with TypeScript     |

## AI configuration

The AI assistant works without any configuration using bundled demo suggestions.
To enable live generation, copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1   # optional, OpenAI-compatible endpoint
OPENAI_MODEL=gpt-4o-mini                    # optional
```

## Project structure

```
src/
  app/            # routes: landing, editor, /api/ai
  components/     # landing, editor, panels and UI primitives
  lib/            # editor engine, fonts, palettes, templates, export, AI
  store/          # Zustand editor state
  types/          # shared types
```
