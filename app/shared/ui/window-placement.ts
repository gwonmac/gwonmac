/**
 * Validates normalized placement shared by Hub and floating Tools windows.
 * One format retains geometry across viewport sizes without storing UI state.
 */
import { captureCornerPosition, restoreCornerPosition, isCornerPosition } from "../corner-position.js";

export type FloatingWindowViewport = Readonly<{
  width: number;
  height: number;
  margin: number;
}>;

export type FloatingWindowBox = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

/**
 * Where the player put a floating window, normalized to the usable viewport: `left` and `top`
 * are shares of the free room, `width` and `height` shares of the viewport (each 0 to 1).
 */
export type FloatingWindowPlacement = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

const ratio = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(Math.min(minimum, maximum), value));

function usable(viewport: FloatingWindowViewport) {
  return {
    width: Math.max(0, viewport.width - viewport.margin * 2),
    height: Math.max(0, viewport.height - viewport.margin * 2),
  };
}

function storedRecord(serialized: string | null): Record<string, unknown> | null {
  if (serialized === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Where a floating window keeps its placement: the store gives it at once when it knows it and
 * again after every change (null: never placed, or put back), and saves where the player moved it.
 */
export type FloatingWindowPlacementStore = Readonly<{
  subscribe(listener: (placement: FloatingWindowPlacement | null) => void): () => void;
  save(placement: FloatingWindowPlacement): void;
}>;

/** A placement read from a stored or sent value, or undefined when it is not one. */
export function readFloatingWindowPlacement(value: unknown): FloatingWindowPlacement | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { left, top, width, height } = value as Record<string, unknown>;
  return ratio(left) && ratio(top) && ratio(width) && ratio(height) && width > 0 && height > 0
    ? { left, top, width, height }
    : undefined;
}

/** A placement stored as text with its format version (browser storage), or null. */
export function parseFloatingWindowPlacement(serialized: string | null): FloatingWindowPlacement | null {
  const stored = storedRecord(serialized);
  return stored?.formatVersion === 1 ? readFloatingWindowPlacement(stored) ?? null : null;
}

export function restoreFloatingWindowPlacement(
  serialized: string | null,
  viewport: FloatingWindowViewport,
  minimum: Readonly<{ width: number; height: number }>,
): FloatingWindowBox | null {
  return placeFloatingWindow(parseFloatingWindowPlacement(serialized), viewport, minimum);
}

/** The box a placement takes in this viewport, at least `minimum` while the viewport allows; null for no placement. */
export function placeFloatingWindow(
  stored: FloatingWindowPlacement | null,
  viewport: FloatingWindowViewport,
  minimum: Readonly<{ width: number; height: number }>,
): FloatingWindowBox | null {
  if (!stored) return null;
  const available = usable(viewport);
  if (available.width === 0 || available.height === 0) return null;
  const width = clamp(
    Math.round(stored.width * available.width),
    minimum.width,
    available.width,
  );
  const height = clamp(
    Math.round(stored.height * available.height),
    minimum.height,
    available.height,
  );
  return {
    left: viewport.margin + Math.round(
      stored.left * Math.max(0, available.width - width),
    ),
    top: viewport.margin + Math.round(
      stored.top * Math.max(0, available.height - height),
    ),
    width,
    height,
  };
}

export function restoreFloatingPosition(
  serialized: string | null,
  viewport: FloatingWindowViewport,
  size: Readonly<{ width: number; height: number }>,
): Readonly<{ left: number; top: number }> | null {
  const stored = storedRecord(serialized);
  if (!stored || stored.formatVersion !== 1 || !isCornerPosition(stored)) return null;
  return restoreCornerPosition(stored, viewport, size);
}

export function serializeFloatingPosition(
  position: Readonly<{ left: number; top: number }>,
  viewport: FloatingWindowViewport,
  size: Readonly<{ width: number; height: number }>,
): string | null {
  const stored = captureCornerPosition(position, viewport, size);
  return stored === null ? null : JSON.stringify({ formatVersion: 1, ...stored });
}

export function serializeFloatingWindowPlacement(
  box: FloatingWindowBox,
  viewport: FloatingWindowViewport,
): string | null {
  const placement = captureFloatingWindowPlacement(box, viewport);
  return placement === null ? null : JSON.stringify({ formatVersion: 1, ...placement });
}

/** Where `box` sits in this viewport, normalized; null while the viewport or the box has no room. */
export function captureFloatingWindowPlacement(
  box: FloatingWindowBox,
  viewport: FloatingWindowViewport,
): FloatingWindowPlacement | null {
  const available = usable(viewport);
  if (
    available.width === 0
    || available.height === 0
    || box.width <= 0
    || box.height <= 0
  ) return null;
  const width = clamp(box.width, 1, available.width);
  const height = clamp(box.height, 1, available.height);
  const horizontalRange = Math.max(0, available.width - width);
  const verticalRange = Math.max(0, available.height - height);
  return {
    left: horizontalRange === 0
      ? 0
      : clamp((box.left - viewport.margin) / horizontalRange, 0, 1),
    top: verticalRange === 0
      ? 0
      : clamp((box.top - viewport.margin) / verticalRange, 0, 1),
    width: width / available.width,
    height: height / available.height,
  };
}
