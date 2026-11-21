/**
 * Owns how the walking route looks on every Maps surface: one dashed line with a
 * dark casing to the player's target, and a ring on the target. When the target
 * cannot be reached, the line ends on the nearest ground and a dotted line shows
 * the rest of the way. The Compass texture paints it through `paintRoute`; the
 * Mission Map and World Map compose the canvas of `createRouteLayer`.
 */
import type { CartographyGridProjection } from "./cartography-grid-projection.js";
import type { MapPainterImage } from "./native-map-graphics-layer.js";

// Okabe-Ito yellow: apart from the Compass range colours (the rest of that
// palette), the amber and orange exploration markers, and the cyan and magenta
// hover, and readable for colour-blind players. The casing is the Compass
// ranges' own, so the line holds against bright and dark map art.
export const ROUTE_LINE_COLOR = "#F0E442";
export const ROUTE_CASING_COLOR = "#050709";

/** What one surface draws, in continent map units, with the version that names it. */
export type RouteDrawing = Readonly<{
  version: string;
  /** x, y per corner from where the player is to where the line ends. */
  points: Float32Array;
  /** The point the player set. */
  target: Readonly<{ x: number; y: number }>;
  reached: boolean;
}>;

/** Map units to canvas pixels: x' = a·x + e, y' = d·y + f. */
export type RouteTransform = Readonly<{ a: number; d: number; e: number; f: number }>;

/** Paints `drawing` with lines `width` canvas pixels wide. */
export function paintRoute(context: CanvasRenderingContext2D, drawing: RouteDrawing, transform: RouteTransform, width: number): void {
  const at = (x: number, y: number): [number, number] => [transform.a * x + transform.e, transform.d * y + transform.f];
  const line = new Path2D();
  for (let corner = 0; corner < drawing.points.length / 2; corner += 1) {
    const [x, y] = at(drawing.points[corner * 2]!, drawing.points[corner * 2 + 1]!);
    if (corner === 0) line.moveTo(x, y); else line.lineTo(x, y);
  }
  const lastX = drawing.points[drawing.points.length - 2] ?? drawing.target.x;
  const lastY = drawing.points[drawing.points.length - 1] ?? drawing.target.y;
  const [endX, endY] = at(lastX, lastY);
  const [targetX, targetY] = at(drawing.target.x, drawing.target.y);
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  // The casing runs under everything, so the yellow never meets the map art directly.
  context.strokeStyle = ROUTE_CASING_COLOR;
  context.lineWidth = width * 2;
  context.stroke(line);
  if (!drawing.reached) {
    context.beginPath(); context.moveTo(endX, endY); context.lineTo(targetX, targetY);
    context.lineWidth = width * 1.5; context.stroke();
  }
  context.beginPath(); context.arc(targetX, targetY, width * 3, 0, Math.PI * 2);
  context.lineWidth = width * 2.5; context.stroke();
  context.strokeStyle = ROUTE_LINE_COLOR;
  context.lineWidth = width;
  context.setLineDash([width * 3, width * 2]);
  context.stroke(line);
  if (!drawing.reached) {
    // The part the route cannot walk: dotted, so it reads as "no way through here".
    context.setLineDash([width * 0.5, width * 2]);
    context.lineWidth = width * 0.75;
    context.beginPath(); context.moveTo(endX, endY); context.lineTo(targetX, targetY); context.stroke();
  }
  context.setLineDash([]);
  context.lineWidth = width;
  context.beginPath(); context.arc(targetX, targetY, width * 3, 0, Math.PI * 2); context.stroke();
  context.restore();
}

export type RouteLayer = Readonly<{
  update(input: Readonly<{ projection: CartographyGridProjection; drawing: RouteDrawing }>): void;
  image(): MapPainterImage | null;
  hide(): void;
  dispose(): void;
}>;

/** A detached canvas over one native map tile, repainted only for a new drawing or tile. */
export function createRouteLayer(document: Document): RouteLayer {
  const canvas = document.createElement("canvas");
  let version = "";
  return Object.freeze({
    update({ projection, drawing }) {
      const { box, transform } = projection;
      const ratio = Math.min(document.defaultView?.devicePixelRatio ?? 1, 2048 / Math.max(box.width, box.height));
      const next = [drawing.version, ratio, box.width, box.height, transform.a, transform.d, transform.e, transform.f].join(":");
      if (next === version) return;
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext("2d");
      if (context === null) { version = ""; return; }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      paintRoute(context, drawing, {
        a: transform.a * ratio, d: transform.d * ratio, e: transform.e * ratio, f: transform.f * ratio,
      }, 2.5 * ratio);
      version = next;
    },
    image: () => version === "" ? null : { canvas, version },
    hide() { version = ""; },
    dispose() { version = ""; canvas.width = 0; canvas.height = 0; },
  });
}
