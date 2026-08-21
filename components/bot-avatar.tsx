import { colorHex, normalizeShape } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Grok Bot-style blob avatar: a colored shape with two sleepy eyes.
 * Pure inline SVG — no emoji, no image assets.
 */

const BODIES: Record<string, React.ReactNode> = {
  circle: <circle cx="32" cy="32" r="29" />,
  squircle: <rect x="4" y="6" width="56" height="52" rx="20" />,
  square: <rect x="6" y="8" width="52" height="48" rx="12" />,
  oval: <ellipse cx="32" cy="34" rx="30" ry="23" />,
  triangle: (
    <path d="M28.5 8.5c1.8-3 5.2-3 7 0l21.5 40c1.8 3.2.3 6.5-3.5 6.5H10.5c-3.8 0-5.3-3.3-3.5-6.5Z" />
  ),
  hexagon: (
    <path d="M27 6.7c3-1.8 7-1.8 10 0l14.7 8.6c3 1.8 5 5.2 5 8.7v16c0 3.5-2 6.9-5 8.7L37 57.3c-3 1.8-7 1.8-10 0l-14.7-8.6c-3-1.8-5-5.2-5-8.7v-16c0-3.5 2-6.9 5-8.7Z" />
  ),
  pebble: (
    <path d="M32 8c8 0 13-2 19 2s8 10 8 16-1 13-5 19-9 9-17 9c-6 0-8 2-15 0S6 45 6 35c0-8 1-14 6-19S24 8 32 8Z" />
  ),
  drop: (
    <path d="M32 4c2 0 3 1.5 4.6 4.6C41 17 54 32 54 42c0 12-9.5 18-22 18S10 54 10 42C10 32 23 17 27.4 8.6 29 5.5 30 4 32 4Z" />
  ),
};

/** Eye vertical center per shape — lower for top-heavy shapes. */
const EYE_Y: Record<string, number> = {
  circle: 30,
  squircle: 30,
  square: 30,
  oval: 32,
  triangle: 42,
  hexagon: 31,
  pebble: 31,
  drop: 38,
};

export function BotAvatar({
  color,
  shape,
  className,
}: {
  color: string;
  shape: string;
  className?: string;
}) {
  const s = normalizeShape(shape);
  const y = EYE_Y[s] ?? 30;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      aria-hidden="true"
    >
      <g fill={colorHex(color)}>{BODIES[s]}</g>
      <g fill="rgba(10,10,12,0.78)">
        <ellipse cx="25" cy={y} rx="2.6" ry="4.6" transform={`rotate(-8 25 ${y})`} />
        <ellipse cx="39" cy={y} rx="2.6" ry="4.6" transform={`rotate(8 39 ${y})`} />
      </g>
    </svg>
  );
}
