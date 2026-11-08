/**
 * The one runtime and compile-time schema for app-authored diagnostic events.
 *
 * Event names, subsystem/level ownership, field names, and field validators
 * live together. Producers receive the type derived from this value, and the
 * export detector executes these exact validators. There is no permissive
 * fallback: if an event is absent here, it cannot be recorded or exported.
 */
import {
  GAME_RELOAD_CAUSES,
  RENDERER_COMMAND_OUTCOMES,
  type AppUpdateErrorCode,
  type GameReloadCause,
  type RendererCommand,
  type RendererCommandOutcome,
  type SocketCloseReason,
  type SocketFailureCode,
} from "../../shared/contracts.js";
import { GAME_INVOKE_KEYS } from "../../shared/ipc/game.js";
import { TOOLS_INVOKE_KEYS } from "../../shared/ipc/tools.js";
import {
  isClientBuildId,
  isDigest,
  type ClientBuildId,
  type Digest,
} from "../../shared/digest.js";
import {
  type DiagnosticLevel,
  type DiagnosticScalar,
  type DiagnosticSubsystem,
} from "../../shared/diagnostics.js";
import { AppError, isErrorCode, type ErrorCode } from "../../shared/errors.js";
import {
  formatReleaseVersion,
  parseReleaseVersion,
} from "../../shared/release.js";
import {
  isProxyRoute,
  type ProxyRoute,
} from "../core/proxy-routes.js";
import type { CatalogueRefusal } from "../core/skill-catalogue.js";

export type FieldGuard<T extends DiagnosticScalar> = (
  value: unknown,
) => value is T;

export interface EventSpec {
  readonly subsystem: DiagnosticSubsystem;
  readonly level: DiagnosticLevel;
  readonly fields: Readonly<Record<string, FieldGuard<DiagnosticScalar>>>;
  /** Whether this event belongs to the process or exactly one game account. */
  readonly scope: "app" | "owner";
}

export const finiteNumber: FieldGuard<number> = (value): value is number =>
  typeof value === "number" && Number.isFinite(value);
export const uint32: FieldGuard<number> = (value): value is number =>
  typeof value === "number"
  && Number.isInteger(value)
  && value >= 0
  && value <= 0xffff_ffff;
export const boolean: FieldGuard<boolean> = (value): value is boolean =>
  typeof value === "boolean";
export const safeInteger: FieldGuard<number> = (value): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);
/** A non-negative safe integer: a byte size, count, or WASM index. */
export const count: FieldGuard<number> = (value): value is number =>
  safeInteger(value) && value >= 0;
/** A count with a fixed ceiling, for values bounded by the producer. */
export function countUpTo(max: number): FieldGuard<number> {
  return (value): value is number => count(value) && value <= max;
}
/** A 1-based installation or attempt number. */
export const ordinal: FieldGuard<number> = (value): value is number =>
  safeInteger(value) && value >= 1;

/**
 * Whether `value` is an object with exactly the guarded keys and every value
 * passes its guard. The export validator and the renderer-milestone boundary
 * read the same guards.
 */
export function matchesFields(
  guards: Readonly<Record<string, FieldGuard<DiagnosticScalar>>>,
  value: unknown,
): value is Record<string, DiagnosticScalar> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const fields = value as Readonly<Record<string, unknown>>;
  return Object.keys(fields).length === Object.keys(guards).length
    && Object.entries(guards).every(([key, guard]) => Object.hasOwn(fields, key) && guard(fields[key]));
}

export function literal<T extends DiagnosticScalar>(
  values: readonly T[],
): FieldGuard<T> {
  const allowed: ReadonlySet<DiagnosticScalar> = new Set(values);
  return (value): value is T =>
    (typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null) &&
    allowed.has(value);
}

export function nullable<T extends DiagnosticScalar>(
  guard: FieldGuard<T>,
): FieldGuard<T | null> {
  return (value): value is T | null => value === null || guard(value);
}

/** The renderer supplies only this fixed-width non-text fingerprint. */
export type RendererFingerprint = string & {
  readonly __rendererFingerprint: unique symbol;
};
export const RENDERER_FINGERPRINT = /^[a-f0-9]{8}$/;
export function asRendererFingerprint(value: string): RendererFingerprint {
  if (!RENDERER_FINGERPRINT.test(value)) {
    throw new AppError("validation", "expected an 8-character renderer fingerprint");
  }
  return value as RendererFingerprint;
}
export const isRendererFingerprint: FieldGuard<RendererFingerprint> = (
  value,
): value is RendererFingerprint =>
  typeof value === "string" && RENDERER_FINGERPRINT.test(value);

/** The shipped SemVer surface, constrained before it reaches a log. */
export type AppVersion = string & { readonly __appVersion: unique symbol };
export function isAppVersion(value: unknown): value is AppVersion {
  if (typeof value !== "string") return false;
  const parsed = parseReleaseVersion(value);
  return parsed !== null && formatReleaseVersion(parsed) === value;
}
export function asAppVersion(value: string): AppVersion {
  if (!isAppVersion(value)) {
    throw new AppError("validation", "expected a valid application version");
  }
  return value;
}
export const appVersion: FieldGuard<AppVersion> = isAppVersion;

export const APP_PHASES = ["startup", "quit"] as const;
export type AppPhase = (typeof APP_PHASES)[number];
export type ContractRendererCaptureAction = Extract<
  RendererCommand,
  { type: "diagnostics.capture" }
>["action"];
export const RENDERER_CAPTURE_ACTIONS = [
  "reset",
  "started",
  "stopped",
  "flush",
  "problem-marked",
  "visual-problem",
] as const satisfies readonly ContractRendererCaptureAction[];
export type RendererCaptureAction =
  (typeof RENDERER_CAPTURE_ACTIONS)[number];
export type ContractIncompleteRendererCommandOutcome = Exclude<
  RendererCommandOutcome,
  "completed"
>;
export const INCOMPLETE_RENDERER_COMMAND_OUTCOMES = [
  ...RENDERER_COMMAND_OUTCOMES.filter(
    (outcome): outcome is ContractIncompleteRendererCommandOutcome =>
      outcome !== "completed",
  ),
] as const;
export type IncompleteRendererCommandOutcome =
  (typeof INCOMPLETE_RENDERER_COMMAND_OUTCOMES)[number];

export const appPhase = literal(APP_PHASES);
export const captureAction = literal(RENDERER_CAPTURE_ACTIONS);
export const incompleteCommandOutcome = literal(
  INCOMPLETE_RENDERER_COMMAND_OUTCOMES,
);
export const gameReloadCause = literal<GameReloadCause>(GAME_RELOAD_CAUSES);
export const appUpdateErrorCode = literal([
  "rate-limited",
  "offline",
  "timeout",
  "server",
  "unreadable",
  "unsupported-build",
  "updater-unavailable",
  "feed-invalid",
  "download-failed",
] as const satisfies readonly AppUpdateErrorCode[]);
export const closeReason = literal([
  "requested",
  "peer",
  "owner",
  "timeout",
  "error",
] as const satisfies readonly SocketCloseReason[]);
export const socketFailureCode = literal([
  "timeout",
  "refused",
  "reset",
  "unreachable",
  "dns",
  "other",
] as const satisfies readonly SocketFailureCode[]);
/** A game window channel main answers, Core or Tools, named by its table key. */
export const invokeChannel = literal([...GAME_INVOKE_KEYS, ...TOOLS_INVOKE_KEYS]);
export const code: FieldGuard<ErrorCode> = isErrorCode;
export const digestOrNull = nullable<Digest>(isDigest);
export const clientBuildId: FieldGuard<ClientBuildId> = isClientBuildId;
export const rendererFingerprintOrNull =
  nullable<RendererFingerprint>(isRendererFingerprint);
export const proxyRoute: FieldGuard<ProxyRoute> = (
  value,
): value is ProxyRoute =>
  typeof value === "string" && isProxyRoute(value);
// Steam sign-in reports outcomes and nothing else. There is deliberately no
// field here that could carry a Steam identifier, a token, or an expiry — the
// closed schema is what makes that a build-time guarantee.
export const steamTokenOutcome = literal(["vended", "absent", "acquired"] as const);
export const steamBlocked = literal([
  "navigation",
  "popup",
  "download",
  "webview",
] as const);
export const steamSignInOutcome = literal([
  "success",
  "cancelled",
  "failed",
  "state-mismatch",
  "no-token",
] as const);
export const steamStorebackOutcome = literal([
  "refreshed",
  "ignored",
  "failed",
] as const);
export const windowMode = literal(["normal", "maximized", "fullscreen"] as const);
export const snapshotPriority = literal(["demand", "prefetch"] as const);
export const proxyMethod = literal(["GET", "POST", "PUT"] as const);
export const catalogueRefusal = literal<CatalogueRefusal>([
  "client-unreadable",
  "table-not-found",
  "archive-unreadable",
]);
export const proxyEndReason = nullable(
  literal(["bodyTooLarge", "redirectEscape"] as const),
);
export const updateStatus = literal([
  "rejectedCandidateSkipped",
  "candidate",
  "ready",
  "cachedFallback",
  "cancelled",
  "error",
] as const);
export const captureLevel = literal([1, 2] as const);
export const CAPTURE_STOP_REASONS = [
  "manual",
  "automatic",
  "buffer-full",
  "export",
  "shutdown",
  "owner-gone",
] as const;
export type CaptureStopReason = (typeof CAPTURE_STOP_REASONS)[number];
export const captureStopReason = literal(CAPTURE_STOP_REASONS);
export const socketSendStatus = literal(["sent", "failed"] as const);
export const thermalState = literal([
  "unknown",
  "nominal",
  "fair",
  "serious",
  "critical",
] as const);
export const none = {} as const;
