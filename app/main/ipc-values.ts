/**
 * Pure bounded-value validation and wire normalization for the IPC boundary,
 * and the one parser kit (`args`, `nothing`, `one`) every boundary builds its
 * argument parsers from. No Electron capability or domain policy belongs in
 * this module.
 */
import type { GraphicsDiagnostics, SocketEvent } from "../shared/contracts.js";
import {
  RENDERER_MILESTONES,
  type RendererMilestone,
  type RendererMilestoneArgs,
} from "../shared/diagnostics.js";
import { AppError, ValidationError } from "../shared/errors.js";
import { RENDERER_MILESTONE_FIELDS } from "./diagnostics/schema-protocol-renderer.js";
import { literal, matchesFields } from "./diagnostics/schema-fields.js";

/** Turns one invoke's argument list into the declared argument tuple, or throws. */
export type Parser<Args extends readonly unknown[]> = (args: readonly unknown[]) => Args;

/**
 * Builds a parser over exactly `count` arguments. Every rejection leaves as a
 * ValidationError, also from a shared value parser that throws a plain Error,
 * so `ipc.rejected` reports `validation` and never looks like a handler crash.
 */
export const args = <Args extends readonly unknown[]>(
  count: number,
  parse: (values: readonly unknown[]) => Args,
): Parser<Args> => (values) => {
  if (values.length !== count) {
    throw new ValidationError(`expected ${count} IPC argument(s)`);
  }
  try {
    return parse(values);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ValidationError(
      error instanceof Error ? error.message : "invalid IPC argument",
      { cause: error },
    );
  }
};

/** For the channels that carry nothing. Still a parser, still explicit. */
export const nothing: Parser<[]> = args(0, () => []);

/** Lifts a single-value validator into a parser over the argument list. */
export const one = <Value>(parse: (value: unknown) => Value): Parser<[Value]> =>
  args(1, ([value]) => [parse(value)]);

export function toWireSocketEvent(event: SocketEvent): SocketEvent {
  if (event.type !== "data") return event;
  return { type: "data", socketId: event.socketId, data: Uint8Array.from(event.data) };
}

export function isGraphicsDiagnostics(value: unknown): value is GraphicsDiagnostics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.userAgent === "string"
    && typeof record.jspi === "boolean"
    && typeof record.webglVersion === "string"
    && typeof record.renderer === "string"
    && typeof record.vendor === "string"
    && typeof record.hardwareAcceleration === "boolean"
    && [
      "canvasWidth", "canvasHeight", "offscreenWidth", "offscreenHeight",
      "drawingBufferWidth", "drawingBufferHeight", "devicePixelRatio",
      "renderScale", "samples",
    ].every((key) => typeof record[key] === "number" && Number.isFinite(record[key]))
    && typeof record.antialias === "boolean"
    && record.userAgent.length <= 2_048
    && record.webglVersion.length <= 1_024
    && record.renderer.length <= 1_024
    && record.vendor.length <= 1_024
    && (record.canvasWidth as number) >= 0
    && (record.canvasWidth as number) <= 32_768
    && (record.canvasHeight as number) >= 0
    && (record.canvasHeight as number) <= 32_768
    && (record.offscreenWidth as number) >= 0
    && (record.offscreenWidth as number) <= 32_768
    && (record.offscreenHeight as number) >= 0
    && (record.offscreenHeight as number) <= 32_768
    && (record.drawingBufferWidth as number) >= 0
    && (record.drawingBufferWidth as number) <= 32_768
    && (record.drawingBufferHeight as number) >= 0
    && (record.drawingBufferHeight as number) <= 32_768
    && Number.isInteger(record.samples)
    && (record.samples as number) >= 0
    && (record.samples as number) <= 64
    && (record.devicePixelRatio as number) > 0
    && (record.devicePixelRatio as number) <= 16
    && (record.renderScale === 1 || record.renderScale === 1.5 || record.renderScale === 2)
  );
}

const isRendererMilestone = literal(RENDERER_MILESTONES);
const isRendererTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)
  && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const hasMilestoneFields = (
  name: RendererMilestone,
): name is keyof typeof RENDERER_MILESTONE_FIELDS => Object.hasOwn(RENDERER_MILESTONE_FIELDS, name);

/**
 * The one rule across milestone fields: skill geometry names a reason only
 * while waiting, and a candidate count only for an ambiguous slot.
 */
function skillGeometryConsistent({ state, reason, candidates }: Readonly<Record<string, unknown>>): boolean {
  if (state === "ready") return reason === null && candidates === null;
  return reason === "slot-ambiguous"
    ? typeof candidates === "number" && candidates >= 2
    : reason !== null && candidates === null;
}

/**
 * Validates the complete renderer milestone tuple before diagnostics sees it,
 * with the schema's own field guards (RENDERER_MILESTONE_FIELDS).
 */
export const parseRendererMilestoneArgs: Parser<RendererMilestoneArgs> = args(3, ([name, rendererTimestampUs, fields]) => {
  if (!isRendererMilestone(name) || !isRendererTimestamp(rendererTimestampUs)) {
    throw new ValidationError("invalid renderer milestone");
  }
  const valid = hasMilestoneFields(name)
    ? matchesFields(RENDERER_MILESTONE_FIELDS[name], fields)
      && (name !== "enhancement.skillGeometryState" || skillGeometryConsistent(fields))
    : fields === undefined;
  if (!valid) throw new ValidationError("invalid renderer milestone");
  // The guards matched exactly the fields RendererMilestoneFieldsByName declares for this name.
  return [name, rendererTimestampUs, fields] as RendererMilestoneArgs;
});
