/**
 * Owns the stored shapes of a dragged game overlay's place: a distance from the
 * nearest game-window corner (Target Distance), or a pixel offset from the place
 * an overlay normally takes (the Compass dock, which follows the Compass).
 * Main and the game renderer share these bounded readers, so a place dragged in
 * one game window is the place in every window and after a restart.
 */
import { isCornerPosition, type CornerPosition } from "./corner-position.js";

/** Far beyond any display; a larger value is not a place on screen. */
const LIMIT = 32_768;
const bounded = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMIT;
const hasExactly = (value: object, keys: string) => Object.keys(value).sort().join(",") === keys;

/** A stored corner distance, copied; `undefined` when the value is not one. */
export function readCornerPlacement(value: unknown): CornerPosition | undefined {
  if (!isCornerPosition(value) || !hasExactly(value, "corner,x,y") || !bounded(value.x) || !bounded(value.y)) return undefined;
  return { corner: value.corner, x: value.x, y: value.y };
}

export type OverlayOffset = Readonly<{ x: number; y: number }>;
export const NO_OVERLAY_OFFSET: OverlayOffset = Object.freeze({ x: 0, y: 0 });

/** A stored pixel offset, copied; `undefined` when the value is not one. */
export function readOverlayOffset(value: unknown): OverlayOffset | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !hasExactly(value, "x,y")) return undefined;
  const { x, y } = value as Record<string, unknown>;
  return bounded(x) && bounded(y) ? { x, y } : undefined;
}
