/**
 * Owns where the movable game overlays sit and whether the compass buttons are drawn.
 * Main and renderer share this one bounded value, so a position a player drags in one game
 * window is the position in every window and after a restart.
 */
import { isCornerPosition, type CornerPosition } from "./corner-position.js";

export type OverlayPlacement = Readonly<{
  /** Whether the two buttons beside the compass are drawn. Their settings stay in Settings › Maps. */
  compassButtons: boolean;
  /** How far the compass buttons sit from their place beside the compass, in pixels. */
  compassOffset: Readonly<{ x: number; y: number }>;
  /** Where Target Distance sits; null keeps it at the top centre. */
  targetDistance: CornerPosition | null;
}>;

export const DEFAULT_OVERLAY_PLACEMENT: OverlayPlacement = Object.freeze({
  compassButtons: true,
  compassOffset: Object.freeze({ x: 0, y: 0 }),
  targetDistance: null,
});

const LIMIT = 32_768;
const bounded = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMIT;

export function isOverlayPlacement(value: unknown): value is OverlayPlacement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  // `adjusting` is a retired key that an earlier build stored; it is read and dropped.
  const keys = Object.keys(value).filter(key => key !== "adjusting").sort().join(",");
  if (keys !== "compassButtons,compassOffset,targetDistance") return false;
  const p = value as Partial<OverlayPlacement>;
  const offset: unknown = p.compassOffset;
  if (!offset || typeof offset !== "object" || Object.keys(offset).sort().join(",") !== "x,y") return false;
  const { x, y } = offset as { x: unknown; y: unknown };
  if (!bounded(x) || !bounded(y)) return false;
  if (typeof p.compassButtons !== "boolean") return false;
  if (p.targetDistance === null) return true;
  return isCornerPosition(p.targetDistance)
    && Object.keys(p.targetDistance).sort().join(",") === "corner,x,y"
    && bounded(p.targetDistance.x) && bounded(p.targetDistance.y);
}

/** A copy that owns its nested values, for storing a validated placement. */
export function copyOverlayPlacement(value: OverlayPlacement): OverlayPlacement {
  return {
    compassButtons: value.compassButtons,
    compassOffset: { x: value.compassOffset.x, y: value.compassOffset.y },
    targetDistance: value.targetDistance === null ? null : { ...value.targetDistance },
  };
}
