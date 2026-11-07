/**
 * The state main creates before `ready`, and the one place later services
 * attach to: the Settings coordinator, the window coordinator, launcher
 * reveal, and the fan-out of Settings and download progress to every live
 * projection.
 *
 * Services built during startup (launcher, Tools, updater) attach here when
 * they exist. A publication that arrives before one is attached reaches the
 * projections that do exist and skips the missing one.
 */
import { app, type BrowserWindow } from "electron";
import {
  IPC,
  type AppSettings,
  type DownloadProgress,
} from "../shared/contracts.js";
import {
  LAUNCHER_IPC,
  type LauncherDestination,
} from "../shared/launcher-contracts.js";
import { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import { logEvent } from "./diagnostics.js";
import type { LauncherOrchestrator } from "./launcher-orchestrator.js";
import { gamePaths } from "./paths.js";
import { updateLongRunningTaskFeedback } from "./window.js";
import { WindowCoordinator } from "./window-coordinator.js";
import { updateToolsMenuItems } from "./window-menu.js";
import { windowRegistry } from "./window-registry.js";
import { updateWindowShortcuts } from "./window-shortcuts.js";

export interface AppShell {
  readonly preferences: PreferencesCoordinator;
  readonly windowCoordinator: WindowCoordinator<BrowserWindow>;
  /** Reveal the launcher, optionally on one destination; false when none is open. */
  readonly revealLauncher: (destination?: LauncherDestination) => boolean;
  /** The second-instance answer: reveal now, or remember the request. */
  readonly revealMainWindow: () => void;
  readonly secondInstanceRequested: () => boolean;
  readonly setProgress: (next: DownloadProgress) => void;
  /** The last published Settings snapshot, once Settings were loaded. */
  readonly currentSettings: () => AppSettings | null;
  readonly settingsLoaded: (settings: AppSettings) => void;
  readonly launcher: () => LauncherOrchestrator | null;
  readonly attachLauncher: (launcher: LauncherOrchestrator) => void;
  readonly attachToolsSettings: (
    apply: ((settings: AppSettings) => Promise<void>) | null,
  ) => void;
  readonly attachAutomaticUpdateCheck: (schedule: (() => void) | null) => void;
}

export function createAppShell(): AppShell {
  let launcher: LauncherOrchestrator | null = null;
  let applyToolsSettings: ((settings: AppSettings) => Promise<void>) | null = null;
  let currentSettings: AppSettings | null = null;
  let scheduleAutomaticAppUpdateCheck: (() => void) | null = null;
  let secondInstanceRequested = false;

  const preferences = new PreferencesCoordinator(
    () => gamePaths(),
    () => logEvent({ k: "travelPreferences.corruptRecovered" }),
    publishSettings,
  );
  const windowCoordinator = new WindowCoordinator(
    {
      ...(app.dock ? { dock: app.dock } : {}),
      focus: (options) => app.focus(options),
    },
    windowRegistry,
  );

  function revealLauncher(destination?: LauncherDestination): boolean {
    if (!windowCoordinator.revealLauncher({ activateApp: true })) return false;
    if (destination) {
      windowRegistry.launcherWindow()?.webContents.send(
        LAUNCHER_IPC.navigationEvent,
        destination,
      );
    }
    return true;
  }

  function revealMainWindow(): void {
    if (!revealLauncher()) {
      secondInstanceRequested = true;
    }
    else secondInstanceRequested = false;
  }

  function setProgress(next: DownloadProgress): void {
    const windows = windowRegistry.windows();
    if (windows.length === 0) updateLongRunningTaskFeedback(next, null);
    else {
      for (const win of windows) updateLongRunningTaskFeedback(next, win);
    }
    launcher?.clientChanged();
    if (
      next.phase === "ready"
      && next.fullDownload?.status !== "running"
      && next.fullDownload?.status !== "stopping"
    ) {
      scheduleAutomaticAppUpdateCheck?.();
    }
  }

  function sendToRenderer(channel: string, value: unknown): void {
    for (const win of windowRegistry.windows()) {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
      try {
        win.webContents.send(channel, value);
      } catch {
        // Renderer teardown can race a native progress callback.
      }
    }
  }

  /** Publish the one durable Settings snapshot to every live game projection. */
  async function publishSettings(settings: AppSettings): Promise<void> {
    currentSettings = settings;
    await applyToolsSettings?.(settings);
    updateToolsMenuItems(settings);
    for (const win of windowRegistry.gameWindows()) {
      updateWindowShortcuts(win, settings);
    }
    sendToRenderer(IPC.settingsEvent, settings);
    launcher?.publish();
  }

  return {
    preferences,
    windowCoordinator,
    revealLauncher,
    revealMainWindow,
    secondInstanceRequested: () => secondInstanceRequested,
    setProgress,
    currentSettings: () => currentSettings,
    settingsLoaded: (settings) => {
      currentSettings = settings;
    },
    launcher: () => launcher,
    attachLauncher: (next) => {
      launcher = next;
    },
    attachToolsSettings: (apply) => {
      applyToolsSettings = apply;
    },
    attachAutomaticUpdateCheck: (schedule) => {
      scheduleAutomaticAppUpdateCheck = schedule;
    },
  };
}
