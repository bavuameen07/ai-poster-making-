import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F6F4",
        panel: "#FFFFFF",
        line: "#E6E6E2",
        ink: {
          DEFAULT: "#0B0B0C",
          soft: "#55555B",
          mute: "#8B8B92",
          faint: "#B8B8BE",
        },
        accent: {
          DEFAULT: "#1D4ED8",
          soft: "#3B82F6",
          wash: "#EEF2FF",
          ink: "#16368F",
        },
        danger: "#DC2626",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(11,11,12,0.04), 0 1px 0 rgba(11,11,12,0.02)",
        pop: "0 12px 32px -12px rgba(11,11,12,0.22), 0 2px 8px rgba(11,11,12,0.06)",
        poster: "0 24px 60px -24px rgba(11,11,12,0.30), 0 6px 20px -8px rgba(11,11,12,0.16)",
      },
      borderRadius: {
        panel: "14px",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.24s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
