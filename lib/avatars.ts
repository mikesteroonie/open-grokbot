/** Bot avatar options: a color and a blob shape, Grok Bot style. */

export const AVATAR_COLORS = [
  { id: "brown", hex: "#A2714F" },
  { id: "red", hex: "#EF3E36" },
  { id: "orange", hex: "#F2662D" },
  { id: "amber", hex: "#FFA928" },
  { id: "green", hex: "#3DC55B" },
  { id: "teal", hex: "#17BE9F" },
  { id: "blue", hex: "#2E8EFF" },
  { id: "purple", hex: "#A163F7" },
  { id: "pink", hex: "#F5479B" },
  { id: "gray", hex: "#A8ABB0" },
] as const;

export const AVATAR_SHAPES = [
  "circle",
  "squircle",
  "square",
  "oval",
  "triangle",
  "hexagon",
  "pebble",
  "drop",
] as const;

export type AvatarColorId = (typeof AVATAR_COLORS)[number]["id"];
export type AvatarShapeId = (typeof AVATAR_SHAPES)[number];

export const DEFAULT_COLOR: AvatarColorId = "blue";
export const DEFAULT_SHAPE: AvatarShapeId = "circle";

export function colorHex(id: string): string {
  return AVATAR_COLORS.find((c) => c.id === id)?.hex ?? "#2E8EFF";
}

export function normalizeColor(id: unknown): AvatarColorId {
  return AVATAR_COLORS.some((c) => c.id === id)
    ? (id as AvatarColorId)
    : DEFAULT_COLOR;
}

export function normalizeShape(id: unknown): AvatarShapeId {
  return AVATAR_SHAPES.includes(id as AvatarShapeId)
    ? (id as AvatarShapeId)
    : DEFAULT_SHAPE;
}
