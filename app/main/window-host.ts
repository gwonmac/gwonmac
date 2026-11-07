/**
 * The WindowHost every game window is built with: the launch-time client
 * choices, Settings, diagnostics actions, game reload, launcher reveal, and
 * account activation from a game window.
 */
import type { DiagnosticProfile } from "../shared/contracts.js";
import type {
  EnhancementProgram,
  EnhancementSelection,
} from "../shared/enhancement-contracts.js";
import type { ClientRuntime } from "../client/client-runtime.js";
import type { AppShell } from "./app-shell.js";
import type { SocketManager } from "./core/sockets.js";
import {
  exportDiagnosticsForWindow,
  logEvent,
  markPerformanceProblem,
  startDiagnosticCapture,
  stopDiagnosticCaptureForWindow,
} from "./diagnostics.js";
import { GameReloader } from "./game-reload.js";
import { sendRendererCommand } from "./renderer-commands.js";
import { reportVisualProblem } from "./visual-problem-report.js";
import {
  RENDERER_URL,
  requestGameQuit,
  type WindowHost,
} from "./window.js";
import { windowRegistry } from "./window-registry.js";

export function createWindowHost(input: Readonly<{
  shell: AppShell;
  clientRuntime: ClientRuntime;
  sockets: SocketManager;
  enhancementSelection: EnhancementSelection;
  enhancementProgram: EnhancementProgram;
  diagnosticProfile: DiagnosticProfile;
}>): WindowHost {
  const { shell, clientRuntime, sockets } = input;
  const { preferences } = shell;
  const gameReloader = new GameReloader({
    sockets,
    getSettings: () => preferences.getSettings(),
    diagnosticOwner: (win) =>
      windowRegistry.requireDiagnosticOwnerForWindow(win),
    record: logEvent,
    sync: (win) => sendRendererCommand(win, { type: "filesystem.sync" }),
    load: (win, url) => win.loadURL(url),
    rendererUrl: RENDERER_URL,
  });
  return {
    sockets,
    enhancementSelection: input.enhancementSelection,
    enhancementProgram: input.enhancementProgram,
    diagnosticProfile: input.diagnosticProfile,
    getProgress: () => clientRuntime.progress,
    getSettings: () => preferences.getSettings(),
    updateSettings: (patch) => preferences.updateSettings(patch),
    exportDiagnostics: (win) =>
      clientRuntime.diagnosticState().then((runtimeState) =>
        exportDiagnosticsForWindow(win, () => preferences.getSettings(), {
          runtimeState,
        })),
    reportVisualProblem: (win) =>
      reportVisualProblem(
        win,
        () => preferences.getSettings(),
        () => clientRuntime.diagnosticState(),
      ),
    markPerformanceProblem,
    startCapture: startDiagnosticCapture,
    stopCapture: stopDiagnosticCaptureForWindow,
    reloadGame: (win, cause) => gameReloader.reload(win, cause),
    claimRelogIntent: (win) => gameReloader.claimRelogIntent(win),
    requestQuit: requestGameQuit,
    prepareRendererRecovery: async () => {
      await clientRuntime.recoverRendererCrash();
    },
    revealLauncher: (destination) => {
      shell.revealLauncher(destination);
    },
    accounts: {
      profiles: () => shell.launcher()?.snapshot().profiles ?? [],
      activate: async (id) => {
        const orchestrator = shell.launcher();
        const profile = orchestrator?.snapshot().profiles.find(candidate => candidate.id === id && !candidate.archived);
        if (!orchestrator || !profile) return;
        if (profile.state === "running") await orchestrator.show(id);
        else if (profile.state === "ready" || profile.state === "failed") {
          await orchestrator.play([id]);
          if (windowRegistry.focusedWindow() && orchestrator.snapshot().profiles.some(candidate => candidate.id === id && candidate.state === "running")) {
            await orchestrator.show(id);
          }
        }
      },
    },
    gameWindowClosed: () => {
      shell.windowCoordinator.afterGameClosed();
    },
  };
}
