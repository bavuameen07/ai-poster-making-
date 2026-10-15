import type { Metadata, Viewport } from "next";
import "./globals.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@200..900",
    "family=Montserrat:wght@300..900",
    "family=Poppins:wght@300;400;500;600;700;800;900",
    "family=Space+Grotesk:wght@300..700",
    "family=Archivo:wght@300..900",
    "family=Syne:wght@400..800",
    "family=Archivo+Black",
    "family=Anton",
    "family=Bebas+Neue",
    "family=Oswald:wght@200..700",
    "family=Barlow+Condensed:wght@300..800",
    "family=Playfair+Display:ital,wght@0,400..900;1,400..900",
    "family=DM+Serif+Display:ital@0;1",
    "family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
    "family=Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    "family=JetBrains+Mono:wght@300..700",
  ].join("&") +
  "&display=swap";

export const metadata: Metadata = {
  title: "Typeset Studio — AI Typography Poster Maker",
  description:
    "Design professional typography posters with editable text, curated font pairings, colour palettes, AI-assisted slogans and high-resolution PNG & PDF export.",
  applicationName: "Typeset Studio",
  keywords: ["typography", "poster maker", "AI", "design tool", "font pairing"],
};

export const viewport: Viewport = {
  themeColor: "#f6f6f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}
