// The game window's sandboxed bridge, shared by the Core and Tools preloads.
//
// A sandboxed preload may `require` only `electron` (and `events`, `timers`,
// `url`), so it cannot load a repository module at run time. Rollup bundles
// each preload entry into one CommonJS file instead (scripts/build-renderer.mjs),
// which is what lets this file import the canonical channels and constants
// rather than carry a copy of them.
import { contextBridge, ipcRenderer } from "electron";
import {
  DIAGNOSTIC_PROFILES,
  RENDERER_INIT_ARGUMENT,
  WASM_BRIDGE_MARKERS,
  type CoreGwNativeApiBase,
  type DiagnosticProfile,
  type RendererCommand,
  type RendererInit,
} from "../shared/contracts.js";
import { GAME_CHANNELS } from "../shared/ipc/game.js";
import type { ToolsNativeApiExtension } from "../shared/ipc/tools.js";
import {
  ENHANCEMENTS,
  ENHANCEMENT_PROGRAMS,
  type EnhancementProgram,
  type EnhancementSelection,
} from "../shared/enhancement-contracts.js";
import { ipcBridge } from "./ipc-bridge.js";

const MAX_SOCKET_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** The game bridge before it is frozen; the Tools preload adds its namespaces. */
export type GameBridge = CoreGwNativeApiBase & Partial<ToolsNativeApiExtension>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Launch configuration, read from the one `additionalArguments` entry the main
 * process appends. Booleans only, defaulted off: a renderer that cannot read
 * its argument gets the production posture rather than a developer one.
 */
function rendererInit(): RendererInit {
  // `process` is injected into the sandboxed preload's own scope; it is not a
  // property of `globalThis`. Reading it off `globalThis` found nothing, so
  // every launch silently took the production defaults — no game cursor, no
  // developer program, no template trace — and only tests/electron could see
  // it, because a `vm` fixture's `process` global answers to either spelling.
  const argv: unknown = typeof process === "undefined" ? undefined : process.argv;
  const matching = Array.isArray(argv)
    ? argv.filter((value: string) => value.startsWith(RENDERER_INIT_ARGUMENT))
    : [];
  // Main emits exactly one argument. Ambiguity is a malformed boundary, not a
  // reason to let argv order choose a developer posture.
  const raw: string | undefined = matching.length === 1 ? matching[0] : undefined;
  let parsed: Record<string, unknown> = {};
  try {
    if (raw) {
      const value: unknown = JSON.parse(raw.slice(RENDERER_INIT_ARGUMENT.length));
      if (isRecord(value)) parsed = value;
    }
  } catch {
    parsed = {};
  }
  // The loop below writes every member of `ENHANCEMENTS`, which is exactly the
  // key set of `EnhancementSelection`; the checker cannot see that a `for…of` over
  // the canonical tuple is exhaustive, and listing the tools here to satisfy it
  // would be the second copy the tuple exists to prevent.
  const enhancementSelection = {} as EnhancementSelection;
  const selected: Record<string, unknown> = isRecord(parsed.enhancementSelection)
    ? parsed.enhancementSelection
    : {};
  for (const tool of ENHANCEMENTS) {
    enhancementSelection[tool] = selected[tool] === true;
  }
  Object.freeze(enhancementSelection);
  const requestedProgram = parsed.enhancementProgram;
  const enhancementProgram: EnhancementProgram = typeof requestedProgram === "string"
      && ENHANCEMENT_PROGRAMS.some((program) => program === requestedProgram)
    ? requestedProgram as EnhancementProgram
    : "none";
  const requestedDiagnosticProfile = parsed.diagnosticProfile;
  const diagnosticProfile: DiagnosticProfile = typeof requestedDiagnosticProfile === "string"
      && DIAGNOSTIC_PROFILES.some(
        (profile) => profile === requestedDiagnosticProfile,
      )
    ? requestedDiagnosticProfile as DiagnosticProfile
    : "standard";
  return {
    development: parsed.development === true,
    enhancementProgram,
    enhancementSelection,
    diagnosticProfile,
    templateFsTrace: parsed.templateFsTrace === true,
    texturePackGeneration:
      typeof parsed.texturePackGeneration === "string"
        && /^[0-9a-f]{32}$/.test(parsed.texturePackGeneration)
        ? parsed.texturePackGeneration
        : null,
    doubleClickMs:
      typeof parsed.doubleClickMs === "number"
        && Number.isFinite(parsed.doubleClickMs)
        && parsed.doubleClickMs > 0
        && parsed.doubleClickMs <= 10_000
        ? parsed.doubleClickMs
        : null,
  };
}

const invoke = ipcBridge.invoker(GAME_CHANNELS);
const listen = ipcBridge.listener(GAME_CHANNELS);

/**
 * Builds, freezes and exposes `window.gwNative` on the Core game channels;
 * `extend` adds the Tools namespaces before the bridge is frozen, and the Core
 * preload has none.
 */
export function exposeGameBridge(extend?: (api: GameBridge) => void) {
  let rendererCommandHandler: ((
    command: RendererCommand,
  ) => void | "unhandled" | Promise<void | "unhandled">) | null = null;
  ipcRenderer.on(GAME_CHANNELS.rendererCommand.channel, (_event, id: unknown, command: RendererCommand) => {
    const handler = rendererCommandHandler;
    if (!handler) {
      ipcRenderer.send(GAME_CHANNELS.rendererCommandDone.channel, id, "failed");
      return;
    }
    void Promise.resolve()
      .then(() => handler(command))
      .then(
        (result) => ipcRenderer.send(
          GAME_CHANNELS.rendererCommandDone.channel,
          id,
          result === "unhandled" ? "unhandled" : "completed",
        ),
        () => ipcRenderer.send(GAME_CHANNELS.rendererCommandDone.channel, id, "failed"),
      );
  });

  const api: GameBridge = {
    init: rendererInit(),
    // A constant, not a capability: the derived client's dirfd markers, which the
    // sandboxed renderer cannot import from app/shared and must not re-type.
    wasmBridgeMarkers: WASM_BRIDGE_MARKERS,
    commands: {
      // One handler, registered once. The transport listener above exists before
      // renderer scripts run, so an early command fails explicitly instead of
      // disappearing. The correlation id and completion stay in transport.
      handle: (handler) => {
        if (rendererCommandHandler) {
          throw new Error("renderer command handler is already registered");
        }
        rendererCommandHandler = handler;
      },
    },
    inputTrace: {
      onEntry: (callback) => listen("inputTraceEvent", callback),
    },
    snapshot: {
      metadata: () => invoke("snapshotMetadata"),
    },
    dns: {
      resolve: (name) => invoke("dnsResolve", name),
    },
    sockets: {
      connect: (destination) => invoke("socketConnect", destination),
      send: (socketId, data) => {
        if (
          !data
          || typeof data.byteLength !== "number"
          || data.byteLength < 0
          || data.byteLength > MAX_SOCKET_PAYLOAD_BYTES
        ) {
          return Promise.reject(new TypeError("invalid socket payload"));
        }
        return invoke("socketSend", socketId, data);
      },
      close: (socketId) => invoke("socketClose", socketId),
      onEvent: (callback) => listen("socketEvent", callback),
    },
    settings: {
      get: () => invoke("settingsGet"),
      set: (value) => invoke("settingsSet", value),
      onChange: (callback) => listen("settingsEvent", callback),
    },
    credentials: {
      load: () => invoke("credentialsLoad"),
      save: (value) => invoke("credentialsSave", value),
      clear: () => invoke("credentialsClear"),
    },
    steam: {
      getToken: (silent) => invoke("steamToken", silent),
      store: (token, expiry) => invoke("steamStore", token, expiry),
      clear: () => invoke("steamClear"),
    },
    diagnostics: {
      clockSync: (rendererNowUs) =>
        invoke("diagnosticsClockSync", rendererNowUs),
      recordClockOffset: (offsetUs, rttUs) =>
        invoke("diagnosticsClockResult", offsetUs, rttUs),
      recordGraphics: (value) => invoke("diagnosticsGraphics", value),
      recordRendererMetrics: (value) =>
        invoke("diagnosticsRendererMetrics", value),
      recordRendererFrames: (value) =>
        invoke("diagnosticsRendererFrames", value),
      recordRendererMilestone: (name, rendererTimestampUs, fields) =>
        invoke("diagnosticsRendererMilestone",
          name,
          rendererTimestampUs,
          fields,
        ),
      current: () => invoke("diagnosticsCurrent"),
      submitVisualCapture: (value) =>
        invoke("diagnosticsVisualSubmit", value),
      setProfile: (value) => invoke("diagnosticsProfileSet", value),
    },
    accounts: {
      get: () => invoke("hubAccountsGet"),
      open: (request) => invoke("hubAccountOpen", request),
    },
    hubSettings: {
      get: () => invoke("hubSettingsGet"),
      update: change => invoke("hubSettingsUpdate", change),
      capture: action => invoke("hubShortcutCapture", action),
      cancelCapture: () => invoke("hubShortcutCaptureCancel"),
    },
    app: {
      openExternal: (kind) => invoke("appOpenExternal", kind),
      reveal: (kind) => invoke("appRevealPath", kind),
      showLauncher: () => invoke("appShowLauncher"),
      openSettings: (...target) => invoke("appOpenSettings", ...target),
      requestQuit: () => invoke("appRequestQuit"),
      showQuitOrReload: () => invoke("appShowQuitOrReload"),
      reloadGame: (cause) => invoke("appReloadGame", cause),
      claimRelogIntent: () => invoke("appClaimRelogIntent"),
    },
    clipboard: {
      writeText: (text) => invoke("clipboardWriteText", text),
      readText: () => invoke("clipboardReadText"),
      edit: (request) => invoke("clipboardEdit", request),
    },
    templates: {
      export: (entries) => invoke("templatesExport", entries),
    },
    client: {
      healthy: (token) => invoke("clientHealthy", token),
      session: () => invoke("clientSession"),
      featureFailure: (features) =>
        invoke("clientFeatureFailure", features),
      readyToPresent: () => invoke("gameReadyToPresent"),
    },
    profileTemplates: {
      loadTemplates: () => invoke("profileTemplatesLoad"),
      saveTemplates: (entries) => invoke("profileTemplatesSave", entries),
    },
  };
  extend?.(api);
  for (const namespace of Object.values(api)) Object.freeze(namespace);
  Object.freeze(api);

  contextBridge.exposeInMainWorld("gwNative", api);
}
