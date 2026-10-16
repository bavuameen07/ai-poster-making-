import type { PosterTemplate, PosterTextObject } from "@/types/poster";
import { backgroundToCss } from "@/lib/background";
import { cn } from "@/lib/utils";

function objectStyle(obj: PosterTextObject, scale: number): React.CSSProperties {
  const fontSize = obj.fontSize * scale;
  const shadows: string[] = [];
  if (obj.shadow) {
    shadows.push(
      `${obj.shadow.offsetX * scale}px ${obj.shadow.offsetY * scale}px ${obj.shadow.blur * scale}px ${obj.shadow.color}`,
    );
  }
  return {
    position: "absolute",
    left: obj.left * scale,
    top: obj.top * scale,
    width: obj.width * scale,
    fontFamily: `"${obj.fontFamily}", sans-serif`,
    fontSize,
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle ?? "normal",
    color: obj.fill,
    textAlign: obj.textAlign,
    lineHeight: obj.lineHeight,
    letterSpacing: obj.charSpacing ? `${(obj.charSpacing / 1000) * fontSize}px` : undefined,
    transform: obj.angle ? `rotate(${obj.angle}deg)` : undefined,
    transformOrigin: "top left",
    opacity: obj.opacity,
    whiteSpace: "pre-wrap",
    textShadow: shadows.length ? shadows.join(", ") : undefined,
    WebkitTextStroke: obj.stroke && obj.strokeWidth ? `${obj.strokeWidth * scale}px ${obj.stroke}` : undefined,
    backgroundColor: obj.backgroundColor || undefined,
    pointerEvents: "none",
  };
}

export interface PosterThumbProps {
  template: PosterTemplate;
  width: number;
  height?: number;
  className?: string;
}

export function PosterThumb({ template, width, height, className }: PosterThumbProps) {
  const scale = Math.min(width / template.width, height ? height / template.height : Infinity);
  const posterWidth = Math.round(template.width * scale);
  const posterHeight = Math.round(template.height * scale);

  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden rounded-[3px]", className)}
      style={{
        width: height ? "100%" : posterWidth,
        height: height ?? posterHeight,
        background: backgroundToCss(template.background),
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width: posterWidth,
          height: posterHeight,
          transform: "translate(-50%, -50%)",
          background: backgroundToCss(template.background),
        }}
      >
        {template.objects.map((obj, i) => (
          <div key={i} style={objectStyle(obj, scale)}>
            {obj.text}
          </div>
        ))}
      </div>
    </div>
  );
}
