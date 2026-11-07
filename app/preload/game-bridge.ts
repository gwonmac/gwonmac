// The game window's sandboxed bridge, shared by the Core and Tools preloads.
//
// A sandboxed preload may `require` only `electron` (and `events`, `timers`,
// `url`), so it cannot load a repository module at run time. Rollup bundles
// each preload entry into one CommonJS file instead (scripts/build-renderer.mjs),
// which is what lets this file import the canonical channels and constants
// rather than carry a copy of them.
import { contextBridge, ipcRenderer } from "electron";
import {
  type CORE_IPC,
  DIAGNOSTIC_PROFILES,
  RENDERER_INIT_ARGUMENT,
  WASM_BRIDGE_MARKERS,
  type CoreGwNativeApiBase,
  type DiagnosticProfile,
  type RendererCommand,
  type RendererInit,
  type ToolsNativeApiExtension,
} from "../shared/contracts.js";
import {
  ENHANCEMENTS,
  ENHANCEMENT_PROGRAMS,
  type EnhancementProgram,
  type EnhancementSelection,
} from "../shared/enhancement-contracts.js";

const MAX_SOCKET_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** The game bridge before it is frozen; the Tools preload adds its namespaces. */
export type GameBridge = CoreGwNativeApiBase & Partial<ToolsNativeApiExtension>;

export type Listen = <T>(channel: string, callback: (value: T) => void) => () => void;

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

const listen: Listen = (eventChannel, callback) => {
  const handler = (_event: unknown, value: Parameters<typeof callback>[0]) =>
    callback(value);
  ipcRenderer.on(eventChannel, handler);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    ipcRenderer.removeListener(eventChannel, handler);
  };
};

/**
 * Builds, freezes and exposes `window.gwNative`. `IPC` is `CORE_IPC` for the
 * Core preload and the complete `IPC` for the Tools preload; `extend` adds the
 * Tools namespaces before the bridge is frozen, and the Core preload has none.
 */
export function exposeGameBridge(
  IPC: typeof CORE_IPC,
  extend?: (api: GameBridge, listen: Listen) => void,
) {
  let rendererCommandHandler: ((
    command: RendererCommand,
  ) => void | "unhandled" | Promise<void | "unhandled">) | null = null;
  ipcRenderer.on(IPC.rendererCommand, (_event, id: unknown, command: RendererCommand) => {
    const handler = rendererCommandHandler;
    if (!handler) {
      ipcRenderer.send(IPC.rendererCommandDone, id, "failed");
      return;
    }
    void Promise.resolve()
      .then(() => handler(command))
      .then(
        (result) => ipcRenderer.send(
          IPC.rendererCommandDone,
          id,
          result === "unhandled" ? "unhandled" : "completed",
        ),
        () => ipcRenderer.send(IPC.rendererCommandDone, id, "failed"),
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
      onEntry: (callback) => listen(IPC.inputTraceEvent, callback),
    },
    snapshot: {
      metadata: () => ipcRenderer.invoke(IPC.snapshotMetadata),
    },
    dns: {
      resolve: (name) => ipcRenderer.invoke(IPC.dnsResolve, name),
    },
    sockets: {
      connect: (destination) => ipcRenderer.invoke(IPC.socketConnect, destination),
      send: (socketId, data) => {
        if (
          !data
          || typeof data.byteLength !== "number"
          || data.byteLength < 0
          || data.byteLength > MAX_SOCKET_PAYLOAD_BYTES
        ) {
          return Promise.reject(new TypeError("invalid socket payload"));
        }
        return ipcRenderer.invoke(IPC.socketSend, socketId, data);
      },
      close: (socketId) => ipcRenderer.invoke(IPC.socketClose, socketId),
      onEvent: (callback) => listen(IPC.socketEvent, callback),
    },
    settings: {
      get: () => ipcRenderer.invoke(IPC.settingsGet),
      set: (value) => ipcRenderer.invoke(IPC.settingsSet, value),
      onChange: (callback) => listen(IPC.settingsEvent, callback),
    },
    credentials: {
      load: () => ipcRenderer.invoke(IPC.credentialsLoad),
      save: (value) => ipcRenderer.invoke(IPC.credentialsSave, value),
      clear: () => ipcRenderer.invoke(IPC.credentialsClear),
    },
    steam: {
      getToken: (silent) => ipcRenderer.invoke(IPC.steamToken, silent),
      store: (token, expiry) => ipcRenderer.invoke(IPC.steamStore, token, expiry),
      clear: () => ipcRenderer.invoke(IPC.steamClear),
    },
    diagnostics: {
      clockSync: (rendererNowUs) =>
        ipcRenderer.invoke(IPC.diagnosticsClockSync, rendererNowUs),
      recordClockOffset: (offsetUs, rttUs) =>
        ipcRenderer.invoke(IPC.diagnosticsClockResult, offsetUs, rttUs),
      recordGraphics: (value) => ipcRenderer.invoke(IPC.diagnosticsGraphics, value),
      recordRendererMetrics: (value) =>
        ipcRenderer.invoke(IPC.diagnosticsRendererMetrics, value),
      recordRendererFrames: (value) =>
        ipcRenderer.invoke(IPC.diagnosticsRendererFrames, value),
      recordRendererMilestone: (name, rendererTimestampUs, fields) =>
        ipcRenderer.invoke(
          IPC.diagnosticsRendererMilestone,
          name,
          rendererTimestampUs,
          fields,
        ),
      current: () => ipcRenderer.invoke(IPC.diagnosticsCurrent),
      submitVisualCapture: (value) =>
        ipcRenderer.invoke(IPC.diagnosticsVisualSubmit, value),
      setProfile: (value) => ipcRenderer.invoke(IPC.diagnosticsProfileSet, value),
    },
    accounts: {
      get: () => ipcRenderer.invoke(IPC.hubAccountsGet),
      open: (request) => ipcRenderer.invoke(IPC.hubAccountOpen, request),
    },
    hubSettings: {
      get: () => ipcRenderer.invoke(IPC.hubSettingsGet),
      update: change => ipcRenderer.invoke(IPC.hubSettingsUpdate, change),
      capture: action => ipcRenderer.invoke(IPC.hubShortcutCapture, action),
      cancelCapture: () => ipcRenderer.invoke(IPC.hubShortcutCaptureCancel),
    },
    app: {
      openExternal: (kind) => ipcRenderer.invoke(IPC.appOpenExternal, kind),
      reveal: (kind) => ipcRenderer.invoke(IPC.appRevealPath, kind),
      showLauncher: () => ipcRenderer.invoke(IPC.appShowLauncher),
      openSettings: (...target) => ipcRenderer.invoke(IPC.appOpenSettings, ...target),
      requestQuit: () => ipcRenderer.invoke(IPC.appRequestQuit),
      showQuitOrReload: () => ipcRenderer.invoke(IPC.appShowQuitOrReload),
      reloadGame: (cause) => ipcRenderer.invoke(IPC.appReloadGame, cause),
      claimRelogIntent: () => ipcRenderer.invoke(IPC.appClaimRelogIntent),
    },
    clipboard: {
      writeText: (text) => ipcRenderer.invoke(IPC.clipboardWriteText, text),
      readText: () => ipcRenderer.invoke(IPC.clipboardReadText),
      edit: (request) => ipcRenderer.invoke(IPC.clipboardEdit, request),
    },
    templates: {
      export: (entries) => ipcRenderer.invoke(IPC.templatesExport, entries),
    },
    client: {
      healthy: (token) => ipcRenderer.invoke(IPC.clientHealthy, token),
      session: () => ipcRenderer.invoke(IPC.clientSession),
      featureFailure: (features) =>
        ipcRenderer.invoke(IPC.clientFeatureFailure, features),
      readyToPresent: () => ipcRenderer.invoke(IPC.gameReadyToPresent),
    },
    profileTemplates: {
      loadTemplates: () => ipcRenderer.invoke(IPC.profileTemplatesLoad),
      saveTemplates: (entries) => ipcRenderer.invoke(IPC.profileTemplatesSave, entries),
    },
  };
  extend?.(api, listen);
  for (const namespace of Object.values(api)) Object.freeze(namespace);
  Object.freeze(api);

  contextBridge.exposeInMainWorld("gwNative", api);
}
