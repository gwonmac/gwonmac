/**
 * Connects the game renderer IPC surface to the services that answer it.
 *
 * `ipc.ts` owns every channel, its sender guard, and its parser; this module
 * only says which service handles each validated request.
 */
import type { AppSettings } from "../shared/contracts.js";
import { hubSettingsSnapshot } from "../shared/hub-settings.js";
import type { ClientService } from "./client-service.js";
import { saveDiagnosticProfile } from "./core/diagnostic-profile.js";
import type { LauncherOrchestrator } from "./launcher-orchestrator.js";
import { globalToolPatch } from "./core/launcher-tools.js";
import type { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import type { SocketManager } from "./core/sockets.js";
import { STEAM_OAUTH } from "./core/steam-oauth.js";
import { activateHubAccount, hubAccountSnapshot } from "./hub-account-actions.js";
import { registerIpcHandlers } from "./ipc.js";
import {
  cancelAppShortcutCapture,
  captureLauncherShortcut,
} from "./launcher-shortcut-capture.js";
import type { MultipleAccountsController } from "./multiple-accounts-controller.js";
import type { GamePaths } from "./paths.js";
import { acquireSteamToken } from "./steam-acquire.js";
import {
  closeProfileWindow,
  gameReadyToPresent,
  requestGameQuit,
  type WindowHost,
} from "./window.js";
import { showQuitOrReloadGame } from "./window-menu.js";
import { windowRegistry } from "./window-registry.js";

export function registerCoreIpc(input: Readonly<{
  paths: GamePaths;
  sockets: SocketManager;
  accounts: MultipleAccountsController;
  client: ClientService;
  preferences: PreferencesCoordinator;
  host: WindowHost;
  launcher: LauncherOrchestrator;
  currentSettings: () => AppSettings;
}>): ReturnType<typeof registerIpcHandlers> {
  const { paths, accounts, client, preferences, host, launcher } = input;
  const clientRuntime = client.runtime;
  return registerIpcHandlers({
    sockets: input.sockets,
    windows: windowRegistry,
    credentialsStoreFor: (win) => accounts.credentialsStoreFor(win),
    steamSessionStoreFor: (win) => accounts.steamSessionStoreFor(win),
    getSnapshotMetadata: () => clientRuntime.snapshotMetadata(),
    getSettings: () => preferences.getSettings(),
    updateSettings: (patch) => preferences.updateRendererSettings(patch),
    setDiagnosticProfile: async (profile) =>
      await saveDiagnosticProfile(paths.diagnosticProfile, profile),
    confirmClientHealthy: (token) =>
      clientRuntime.confirmCandidateHealthy(token),
    getClientSession: client.clientSession,
    recordClientFeatureFailure: client.recordFeatureFailure,
    gameReadyToPresent,
    acquireSteamToken: (parent, record) =>
      acquireSteamToken(STEAM_OAUTH, { parent, record }),
    loadAccountTemplates: (win) => accounts.loadTemplates(win),
    saveAccountTemplates: (win, entries) => accounts.saveTemplates(win, entries),
    requestQuit: requestGameQuit,
    // The Hub's "Quit or Reload Game…" opens the same sheet as Command-Q (HUB-001).
    showQuitOrReload: (win) => showQuitOrReloadGame(host, win),
    hubAccountsGet: win => {
      const context = windowRegistry.contextForWebContents(win.webContents.id);
      if (context?.role !== 'game') throw new Error('Game account required');
      return hubAccountSnapshot(host.accounts, context.profileId);
    },
    hubAccountOpen: (win, request) => {
      const context = windowRegistry.contextForWebContents(win.webContents.id);
      if (context?.role !== 'game') throw new Error('Game account required');
      return activateHubAccount(host.accounts, context.profileId, request, async () => {
        await closeProfileWindow(win);
        if (!win.isDestroyed()) throw new Error('The other account is open. This account stayed open because closing was cancelled.');
      });
    },
    showLauncher: () => host.revealLauncher(),
    openSettings: (_win, target) => host.revealLauncher(target ?? "settings"),
    hubSettings: {
      get: async () => hubSettingsSnapshot(launcher.snapshot()),
      update: async change => {
        if (change.kind === 'settings') await preferences.updateSettings(change.patch);
        else if (change.kind === 'tool') await preferences.updateSettings(globalToolPatch(change.tool, change.enabled));
        else if (change.kind === 'master') await preferences.updateSettings({ gwonmacTools: change.enabled });
        else await preferences.replaceShortcut(change.action, change.binding);
      },
      capture: (win, action) => captureLauncherShortcut(win, action, input.currentSettings),
      cancelCapture: win => cancelAppShortcutCapture(win),
    },
    reloadGame: (win, cause) => host.reloadGame(win, cause),
    claimRelogIntent: (win) => host.claimRelogIntent(win),
  });
}
