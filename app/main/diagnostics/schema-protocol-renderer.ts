/**
 * Owns protocol, socket, renderer, graphics, and Enhancement diagnostic events.
 * It is the renderer-facing half of the closed diagnostic vocabulary.
 */
import type { DiagnosticScalar, RendererMilestoneFieldsByName } from "../../shared/diagnostics.js";
import type { EventSpec, FieldGuard } from "./schema-fields.js";
import { ALLOWED_PORTS } from "../core/allowlists.js";
import {
  RELOG_INPUT_OUTCOMES,
  ENHANCEMENT_OBSERVER_CONSUMERS,
  SKILL_GEOMETRY_WAIT_REASONS,
  RELOG_INPUT_STAGES,
  RELOG_SKIP_REASONS,
  RELOG_TERMINAL_OUTCOMES,
  WASM_ABORT_REASON_KINDS,
  WASM_GROWTH_OUTCOMES,
  WASM_MEMORY_PROBE_STATUSES,
  type RendererMilestone,
} from "../../shared/diagnostics.js";
import {
  isEnhancementCapabilityProfile,
} from "../../shared/enhancement-contracts.js";
import {
  boolean,
  captureAction,
  catalogueRefusal,
  closeReason,
  code,
  count,
  countUpTo,
  finiteNumber,
  gameReloadCause,
  incompleteCommandOutcome,
  invokeChannel,
  isRendererFingerprint,
  literal,
  none,
  nullable,
  ordinal,
  proxyEndReason,
  proxyMethod,
  proxyRoute,
  rendererFingerprintOrNull,
  snapshotPriority,
  socketFailureCode,
  socketSendStatus,
  safeInteger,
  uint32,
} from "./schema-fields.js";

/** Aggregate texture counters; no texture identity or pixels. */
const TEXTURE_MEMORY = {
  generatedTextures: count,
  deletedTextures: count,
  liveTextures: count,
  trackedTextures: countUpTo(4_096),
  knownTextureBytes: count,
  textureUploadBytes: count,
  unknownTextureAllocations: count,
  textureTrackingSaturated: boolean,
} as const;

/** A client program or build identifier: short text or a non-negative integer. */
const buildIdentifier: FieldGuard<string | number> = (value): value is string | number =>
  (typeof value === "string" && value.length <= 128) || count(value);

type MilestoneFieldGuards = {
  readonly [Name in keyof RendererMilestoneFieldsByName]: {
    readonly [Field in keyof RendererMilestoneFieldsByName[Name]]-?:
      FieldGuard<Extract<RendererMilestoneFieldsByName[Name][Field], DiagnosticScalar>>;
  };
};

/**
 * The fields each renderer milestone carries over IPC. The IPC boundary
 * accepts a milestone only when its fields match these guards exactly, and the
 * event that records the milestone spreads the same guards, so the boundary
 * and the export validator agree. `satisfies` proves the guards cover exactly
 * the fields the renderer declares.
 */
export const RENDERER_MILESTONE_FIELDS = {
  "build.info": { programId: buildIdentifier, buildId: buildIdentifier },
  "relog.preGameProbe": {
    state: literal(["unknown", "character-select", "reconnect", "loading"] as const),
    mask: uint32,
  },
  "relog.inputSettled": {
    stage: literal(RELOG_INPUT_STAGES),
    outcome: literal(RELOG_INPUT_OUTCOMES),
  },
  "relog.finished": { outcome: literal(RELOG_TERMINAL_OUTCOMES) },
  "relog.skipped": { reason: literal(RELOG_SKIP_REASONS) },
  "wasm.abort": {
    reasonKind: literal(WASM_ABORT_REASON_KINDS),
    fingerprint: isRendererFingerprint,
    heapBytes: count,
  },
  "wasm.exit": { code: safeInteger, heapBytes: count },
  "wasm.memoryProbe": { status: literal(WASM_MEMORY_PROBE_STATUSES) },
  "wasm.growthRequested": {
    requestedBytes: count,
    beforeBytes: count,
    afterBytes: count,
    outcome: literal(WASM_GROWTH_OUTCOMES),
    stackFingerprint: isRendererFingerprint,
    stackDepth: countUpTo(4),
    frame0Function: count,
    frame0Offset: count,
    frame1Function: count,
    frame1Offset: count,
    frame2Function: count,
    frame2Offset: count,
    frame3Function: count,
    frame3Offset: count,
    ...TEXTURE_MEMORY,
  },
  "graphics.visualProblem": {
    textureProbeInstalled: boolean,
    wasmHeapBytes: count,
    webglContextAvailable: boolean,
    contextLost: boolean,
    canvasWidth: count,
    canvasHeight: count,
    offscreenWidth: count,
    offscreenHeight: count,
    drawingBufferWidth: count,
    drawingBufferHeight: count,
    ...TEXTURE_MEMORY,
    programProbeInstalled: boolean,
    livePrograms: count,
    programPassThroughQueries: count,
  },
  "enhancement.installed": {
    companionAbi: count,
    installation: ordinal,
    capabilityProfile: isEnhancementCapabilityProfile,
  },
  "enhancement.consumerSignal": {
    consumer: literal(ENHANCEMENT_OBSERVER_CONSUMERS),
    signal: literal(["installed", "first-observation"] as const),
  },
  "enhancement.skillGeometryState": {
    state: literal(["waiting", "ready"] as const),
    reason: nullable(literal(SKILL_GEOMETRY_WAIT_REASONS)),
    candidates: nullable(countUpTo(16_384)),
  },
  "enhancement.uninstalled": { installation: ordinal },
} as const satisfies MilestoneFieldGuards;

/** Milestones that carry no fields; each records the clock state only. */
const PLAIN_MILESTONES = [
  "renderer.loaded",
  "relog.intentClaimed",
  "relog.savedCredentialsLoaded",
  "relog.loginSubmitted",
  "relog.tokenRequested",
  "relog.tokenAccepted",
  "relog.characterSubmitted",
  "wasm.instantiate.begin",
  "wasm.instantiate.end",
  "wasm.streamingFallback",
  "runtime.initialized",
  "frame.firstSubmit",
  "startup.complete",
  "build.info",
  "snapshot.fatalRead",
] as const satisfies readonly RendererMilestone[];

const PLAIN_MILESTONE_SPEC = {
  scope: "owner",
  subsystem: "renderer",
  level: "info",
  fields: { clockSynchronized: boolean },
} as const satisfies EventSpec;

/** One identical spec under each name; the mapped type keeps every name. */
function plainMilestoneSchema<const Names extends readonly string[]>(
  names: Names,
): { readonly [Name in Names[number]]: typeof PLAIN_MILESTONE_SPEC } {
  return Object.fromEntries(names.map((name) => [name, PLAIN_MILESTONE_SPEC])) as {
    readonly [Name in Names[number]]: typeof PLAIN_MILESTONE_SPEC;
  };
}

export const PROTOCOL_AND_RENDERER_EVENT_SCHEMA = {
  // Protocol requests and their four closed span families.
  "protocol.installed": {
    scope: "app",
    subsystem: "protocol",
    level: "info",
    fields: none,
  },
  "dns.resolve.begin": {
    scope: "owner",
    subsystem: "dns",
    level: "debug",
    fields: none,
  },
  "dns.resolve.end": {
    scope: "owner",
    subsystem: "dns",
    level: "debug",
    fields: { status: literal(["ok", "error"] as const), code: nullable(code) },
  },
  "snapshot.read.begin": {
    scope: "owner",
    subsystem: "snapshot",
    level: "debug",
    fields: {
      offsetBytes: finiteNumber,
      requestedBytes: finiteNumber,
      priority: snapshotPriority,
    },
  },
  "snapshot.read.end": {
    scope: "owner",
    subsystem: "snapshot",
    level: "debug",
    fields: {
      offsetBytes: finiteNumber,
      requestedBytes: finiteNumber,
      returnedBytes: finiteNumber,
      priority: snapshotPriority,
      status: literal([206, 503] as const),
      code: nullable(code),
    },
  },
  "snapshot.rangeFailed": {
    scope: "owner",
    subsystem: "snapshot",
    level: "error",
    fields: { offsetBytes: finiteNumber, bytes: finiteNumber, code },
  },
  "proxy.request.begin": {
    scope: "owner",
    subsystem: "proxy",
    level: "debug",
    fields: { route: proxyRoute, method: proxyMethod },
  },
  "proxy.request.end": {
    scope: "owner",
    subsystem: "proxy",
    level: "debug",
    fields: {
      route: proxyRoute,
      method: proxyMethod,
      status: finiteNumber,
      reason: proxyEndReason,
      code: nullable(code),
    },
  },
  "proxy.redirectBlocked": {
    scope: "owner",
    subsystem: "proxy",
    level: "warn",
    fields: { route: proxyRoute },
  },
  "proxy.requestFailed": {
    scope: "owner",
    subsystem: "proxy",
    level: "error",
    fields: { route: proxyRoute, code },
  },

  // The build editor asked for the skill catalogue and the client build could
  // not supply one. Warn rather than error: the editor stays usable and both
  // reasons are recoverable on a later request.
  "protocol.skillCatalogueRefused": {
    scope: "owner",
    subsystem: "protocol",
    level: "warn",
    fields: { reason: catalogueRefusal },
  },
  "protocol.gameFontRefused": {
    scope: "owner",
    subsystem: "protocol",
    level: "warn",
    fields: { reason: literal(["unsupported", "read-or-format"] as const) },
  },

  // Managed sockets and IPC rejection.
  "socket.open": {
    scope: "owner",
    subsystem: "socket",
    level: "info",
    // The port is the closed production allowlist, so a reset on the game
    // connection (6112) is distinguishable from patch/web traffic (80/443).
    fields: { socketId: finiteNumber, port: literal([...ALLOWED_PORTS]) },
  },
  "socket.close": {
    scope: "owner",
    subsystem: "socket",
    level: "info",
    fields: { socketId: finiteNumber, reason: closeReason },
  },
  "socket.error": {
    scope: "owner",
    subsystem: "socket",
    level: "warn",
    fields: { socketId: finiteNumber, code: socketFailureCode },
  },
  "socket.rendererSend": {
    scope: "owner",
    subsystem: "socket",
    level: "debug",
    fields: {
      syncUs: finiteNumber,
      settleUs: finiteNumber,
      payloadBytes: finiteNumber,
      sourceBackingBytes: finiteNumber,
      compactBytes: finiteNumber,
      status: socketSendStatus,
    },
  },
  "ipc.rejected": {
    scope: "owner",
    subsystem: "app",
    level: "warn",
    fields: { channel: invokeChannel, code },
  },

  // Renderer recovery and renderer-originated fixed events.
  "gameReload.requested": {
    scope: "owner",
    subsystem: "app",
    level: "info",
    fields: { cause: gameReloadCause },
  },
  "gameReload.syncIncomplete": {
    scope: "owner",
    subsystem: "app",
    level: "warn",
    fields: { outcome: incompleteCommandOutcome },
  },
  "gameReload.loaded": {
    scope: "owner",
    subsystem: "app",
    level: "info",
    fields: { cause: gameReloadCause },
  },
  "commandQ.shortcut": {
    scope: "owner",
    subsystem: "app",
    level: "info",
    fields: {
      phase: literal(["claimed", "repeat-contained", "rearmed"] as const),
      reason: literal([
        "none",
        "keyup",
        "dialog-settled",
        "appkit-release",
        "error",
      ] as const),
    },
  },
  "quitReloadDialog.lifecycle": {
    scope: "owner",
    subsystem: "app",
    level: "info",
    fields: {
      phase: literal(["requested", "opened", "settled"] as const),
      action: literal(["pending", "reload", "quit", "cancel", "failed"] as const),
      autoRelog: nullable(boolean),
    },
  },
  "relog.inputSettled": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["relog.inputSettled"] },
  },
  "relog.preGameProbe": {
    scope: "owner",
    subsystem: "renderer",
    level: "debug",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["relog.preGameProbe"] },
  },
  "relog.finished": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["relog.finished"] },
  },
  "relog.skipped": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: RENDERER_MILESTONE_FIELDS["relog.skipped"],
  },
  "enhancement.consumerSignal": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: RENDERER_MILESTONE_FIELDS["enhancement.consumerSignal"],
  },
  "enhancement.skillGeometryState": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: RENDERER_MILESTONE_FIELDS["enhancement.skillGeometryState"],
  },
  "renderer.processExitedDuringQuit": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { exitCode: finiteNumber },
  },
  "renderer.processGone": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { exitCode: finiteNumber },
  },
  "renderer.recoveryScheduled": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: none,
  },
  "renderer.recoveryPreparationFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { code },
  },
  "renderer.recovered": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: none,
  },
  "renderer.commandIncomplete": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: { action: captureAction, outcome: incompleteCommandOutcome },
  },
  "renderer.windowError": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "renderer.unhandledRejection": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "graphics.contextLost": {
    scope: "owner",
    subsystem: "graphics",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "graphics.contextRestored": {
    scope: "owner",
    subsystem: "graphics",
    level: "info",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "graphics.presentationFailed": {
    scope: "owner",
    subsystem: "graphics",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "client.glueLoadFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "filesystem.persistenceFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "audio.resumeFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "pointerLock.failed": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  // A demand read the client was awaiting rejected — the failure mode behind
  // black textures. The count and timestamps tie a visual artifact report to
  // the reads that failed under it.
  "snapshot.readFailed": {
    scope: "owner",
    subsystem: "snapshot",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  // A client prefetch rejected. The client never retries it, so the file's
  // icon or sound stays missing for the rest of the instance.
  "snapshot.cacheFailed": {
    scope: "owner",
    subsystem: "snapshot",
    level: "error",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  // The 1024-program ceiling was reached; later programs degrade to
  // pass-through polling. Its absence in a capture rules the cache out of a
  // rendering-artifact investigation.
  "graphics.programCacheSaturated": {
    scope: "owner",
    subsystem: "graphics",
    level: "warn",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "clipboard.copied": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "clipboard.writeFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: { fingerprint: rendererFingerprintOrNull },
  },
  "graphics.detected": {
    scope: "owner",
    subsystem: "graphics",
    level: "info",
    fields: {
      jspi: boolean,
      hardwareAcceleration: boolean,
      canvasWidth: finiteNumber,
      canvasHeight: finiteNumber,
      offscreenWidth: finiteNumber,
      offscreenHeight: finiteNumber,
      drawingBufferWidth: finiteNumber,
      drawingBufferHeight: finiteNumber,
      devicePixelRatio: finiteNumber,
      renderScale: finiteNumber,
      antialias: boolean,
      samples: finiteNumber,
    },
  },
  "renderer.metrics": {
    scope: "owner",
    subsystem: "renderer",
    level: "debug",
    fields: {
      visible: boolean,
      intervalMs: finiteNumber,
      rafCount: finiteNumber,
      rafMaxUs: finiteNumber,
      swapCount: finiteNumber,
      presentationFailures: finiteNumber,
      swapMaxUs: finiteNumber,
      submitIntervalMaxUs: finiteNumber,
      snapshotReads: finiteNumber,
      snapshotBytes: finiteNumber,
      snapshotMaxUs: finiteNumber,
      inputToSubmitCount: finiteNumber,
      inputToSubmitMaxUs: finiteNumber,
      memoryCacheBytes: finiteNumber,
      memoryCacheChunks: finiteNumber,
      pendingChunks: finiteNumber,
      activeDemand: finiteNumber,
      activePrefetch: finiteNumber,
      queuedDemand: finiteNumber,
      queuedPrefetch: finiteNumber,
      socketSendCalls: finiteNumber,
      socketPayloadBytes: finiteNumber,
      socketSourceBackingMaxBytes: finiteNumber,
      socketCompactBytes: finiteNumber,
      socketSyncMaxUs: finiteNumber,
      socketSettles: finiteNumber,
      socketSettleMaxUs: finiteNumber,
      droppedRecords: finiteNumber,
    },
  },
  "clock.synchronized": {
    scope: "owner",
    subsystem: "renderer",
    level: "debug",
    fields: { offsetUs: finiteNumber, rttUs: finiteNumber },
  },

  // Renderer milestones. Build identifiers stay in gauges/environment; the
  // event records only the fixed synchronization fact common to every entry.
  ...plainMilestoneSchema(PLAIN_MILESTONES),

  // The two milestones that are also failures. The abort argument collapses
  // in the renderer into a closed reason kind plus a non-text fingerprint, so
  // the export can name the failing native operation class without carrying
  // prose; a non-zero exit carries only the client's own numeric code.
  // `heapBytes` is the WASM linear memory at death: the glue caps it at
  // 2 GiB, so a crash recorded at the cap is memory exhaustion whatever
  // prose the abort carried.
  "wasm.abort": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["wasm.abort"] },
  },
  "wasm.exit": {
    scope: "owner",
    subsystem: "renderer",
    level: "error",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["wasm.exit"] },
  },
  // The heap staircase, sampled: the renderer reports heap size with each
  // metrics flush (~2 s) and every observed rise becomes one event, so
  // near-simultaneous growth steps can coalesce and a run's first event
  // rises from 0. Read with the socket.open map transitions around it, the
  // sequence answers whether a session leaked steadily or stepped up on
  // zone loads — the question every heap-cap abort asks.
  "wasm.heapGrew": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { fromBytes: finiteNumber, toBytes: finiteNumber },
  },
  "wasm.memoryProbe": {
    scope: "owner",
    subsystem: "wasm",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["wasm.memoryProbe"] },
  },
  // Exact heap-growth-boundary observation. Unlike `heapGrew`, this records
  // refused requests and preserves the numeric WASM call chain which caused
  // the request. Texture figures are bounded aggregates, never object names
  // or pixel data.
  "wasm.growthRequested": {
    scope: "owner",
    subsystem: "wasm",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["wasm.growthRequested"] },
  },
  "graphics.visualProblem": {
    scope: "owner",
    subsystem: "graphics",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["graphics.visualProblem"] },
  },
  // The renderer's Enhancement installation lifecycle. `clientPrepared` above
  // says a transformed module was served; only these say whether the hook was
  // actually live in the game's call path — the first fact a wasm.abort
  // triage needs.
  "enhancement.installed": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["enhancement.installed"] },
  },
  "enhancement.installFailed": {
    scope: "owner",
    subsystem: "renderer",
    level: "warn",
    fields: { clockSynchronized: boolean },
  },
  "enhancement.uninstalled": {
    scope: "owner",
    subsystem: "renderer",
    level: "info",
    fields: { clockSynchronized: boolean, ...RENDERER_MILESTONE_FIELDS["enhancement.uninstalled"] },
  },
} as const satisfies Readonly<Record<string, EventSpec>>;
