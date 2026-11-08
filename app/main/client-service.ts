/**
 * The game client of this launch: which enhancements it was selected with,
 * the runtime that prepares and serves it, the per-document client sessions
 * renderers read, and the full-download pause across system sleep.
 */
import { app, powerMonitor, type BrowserWindow } from "electron";
import type {
  AppSettings,
  ClientSession,
  DiagnosticProfile,
  DownloadProgress,
  EnhancementRuntimeFeature,
} from "../shared/contracts.js";
import { diagnosticProfilePolicy } from "../shared/diagnostic-profile.js";
import {
  NO_ENHANCEMENT_CAPABILITIES,
  enhancementCapabilityProfile,
  type EnhancementCapabilities,
  type EnhancementProgram,
  type EnhancementSelection,
} from "../shared/enhancement-contracts.js";
import { ClientRuntime } from "../client/client-runtime.js";
import {
  DEVELOPER_ENHANCEMENT_PROGRAM,
  enhancementSelectionFor,
  requestedEnhancementCapabilities,
} from "../client/certification/enhancement-policy.js";
import { clientVerdictKey } from "./core/client-verdict-key.js";
import { loadDiagnosticProfile } from "./core/diagnostic-profile.js";
import type { NativeKeychain } from "./core/native-keychain.js";
import { logEvent } from "./diagnostics.js";
import type { GamePaths } from "./paths.js";
import { RendererClientSessions } from "./renderer-client-sessions.js";

export interface LaunchSelection {
  readonly diagnosticProfile: DiagnosticProfile;
  readonly enhancementSelection: EnhancementSelection;
  readonly enhancementProgram: EnhancementProgram;
  readonly enhancementCapabilities: EnhancementCapabilities;
}

/** Fix this launch's enhancement choice from Settings and the diagnostic profile. */
export async function selectLaunch(
  paths: GamePaths,
  settings: AppSettings,
): Promise<LaunchSelection> {
  const diagnosticProfile = await loadDiagnosticProfile(paths.diagnosticProfile);
  const diagnosticPolicy = diagnosticProfilePolicy(diagnosticProfile);
  const enhancementSelection: EnhancementSelection = diagnosticPolicy.officialClient
    ? Object.freeze({ nativeCursor: false, tools: false })
    : enhancementSelectionFor(settings);
  const enhancementProgram = DEVELOPER_ENHANCEMENT_PROGRAM;
  const enhancementCapabilities = diagnosticPolicy.officialClient
    ? NO_ENHANCEMENT_CAPABILITIES
    : requestedEnhancementCapabilities(settings, enhancementProgram);
  logEvent({
    k: "enhancement.launchSelected",
    buildKind: app.isPackaged ? "packaged" : "development",
    program: enhancementProgram,
    toolsAtLaunch: enhancementSelection.tools,
    diagnosticProfile,
    requestedProfile: enhancementCapabilityProfile(enhancementCapabilities),
  });
  return {
    diagnosticProfile,
    enhancementSelection,
    enhancementProgram,
    enhancementCapabilities,
  };
}

export interface ClientService {
  readonly runtime: ClientRuntime;
  readonly clientSession: (win: BrowserWindow) => ClientSession;
  readonly recordFeatureFailure: (
    win: BrowserWindow,
    features: readonly EnhancementRuntimeFeature[],
  ) => void;
  /** Stop a running full download for sleep and resume it after wake. */
  readonly pauseDownloadsDuringSleep: () => void;
}

export function createClientService(input: Readonly<{
  paths: GamePaths;
  hostVersion: string;
  settings: AppSettings;
  launch: LaunchSelection;
  keychain: NativeKeychain;
  onProgress: (next: DownloadProgress) => void;
}>): ClientService {
  const { launch } = input;
  const clientRuntime = new ClientRuntime({
    paths: input.paths,
    hostVersion: input.hostVersion,
    cachedOnly: process.env.GW_REQUIRE_CACHED_CLIENT === "1",
    enhancementCapabilities: launch.enhancementCapabilities,
    enhancementProgram: launch.enhancementProgram,
    // Maps native hooks belong to the selected Tools launch, even when hidden.
    cartographySpike: launch.enhancementSelection.tools,
    extendedMemoryEnabled: input.settings.extendedMemoryEnabled,
    diagnosticProfile: launch.diagnosticProfile,
    clientVerdictKey: clientVerdictKey(input.keychain),
    onProgress: input.onProgress,
  });
  const rendererClientSessions = new RendererClientSessions<BrowserWindow>();
  const documentOf = (win: BrowserWindow) => ({
    owner: win,
    documentId: win.webContents.mainFrame.routingId,
    generation: clientRuntime.active?.generation ?? 0,
  });
  return {
    runtime: clientRuntime,
    clientSession: (win) => rendererClientSessions.session(
      documentOf(win),
      clientRuntime.session(input.hostVersion),
    ),
    recordFeatureFailure: (win, features) => {
      rendererClientSessions.recordFailures(
        documentOf(win),
        clientRuntime.session(input.hostVersion),
        features,
      );
    },
    pauseDownloadsDuringSleep: () => {
      let resumeFullDownloadAfterWake = false;
      powerMonitor.on("suspend", () => {
        if (!clientRuntime.isDownloading) return;
        resumeFullDownloadAfterWake = true;
        logEvent({ k: "fullDownload.stoppedForSleep" });
        void clientRuntime.stopDownload();
      });
      powerMonitor.on("resume", () => {
        if (!resumeFullDownloadAfterWake) return;
        resumeFullDownloadAfterWake = false;
        void clientRuntime.stopDownload().then(() => clientRuntime.downloadAll());
      });
    },
  };
}
