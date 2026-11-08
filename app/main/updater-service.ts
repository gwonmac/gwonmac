/**
 * Application updates: the AppUpdater wired to Electron's native updater, the
 * one restart-and-install action, and the automatic check schedule.
 */
import {
  app,
  autoUpdater,
  dialog,
  Notification,
  type BrowserWindow,
} from "electron";
import type { AppUpdateState } from "../shared/contracts.js";
import type { ClientRuntime } from "../client/client-runtime.js";
import {
  AppUpdater,
  PERIODIC_CHECK_TICK_MS,
  periodicCheckDue,
} from "./app-updater.js";
import type { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import type { SocketManager } from "./core/sockets.js";
import { logEvent } from "./diagnostics.js";
import { onAppQuit, runQuitCleanup } from "./lifecycle.js";
import { resetGameInput } from "./renderer-commands.js";
import { windowRegistry } from "./window-registry.js";

export interface UpdaterService {
  readonly state: () => AppUpdateState;
  /** The one application-update action; AppUpdater owns every outcome. */
  readonly check: () => Promise<void>;
  readonly restartAndInstall: (win: BrowserWindow) => Promise<void>;
  /**
   * Check now when due, then on every periodic tick until quit. The schedule
   * is handed to `attachSchedule` so a client that becomes ready can ask for
   * a due check too.
   */
  readonly startAutomaticChecks: (input: Readonly<{
    clientRuntime: ClientRuntime;
    sockets: SocketManager;
    attachSchedule: (schedule: (() => void) | null) => void;
  }>) => void;
}

export function createUpdaterService(input: Readonly<{
  hostVersion: string;
  capable: boolean;
  lastUpdateCheckAt: number | null;
  preferences: PreferencesCoordinator;
  publish: () => void;
}>): UpdaterService {
  const { preferences } = input;
  const controller = new AppUpdater({
    currentVersion: input.hostVersion,
    capable: input.capable,
    nativeUpdater: {
      setFeedURL: (options) => autoUpdater.setFeedURL(options),
      checkForUpdates: () => {
        autoUpdater.checkForUpdates();
      },
      quitAndInstall: () => autoUpdater.quitAndInstall(),
    },
    rememberCheckedAt: async (lastUpdateCheckAt) => {
      await preferences.write({ kind: "settings", patch: { lastUpdateCheckAt } });
    },
    recordFailure: (reason) => {
      logEvent({ k: "appUpdate.requestFailed", reason });
    },
    publish: (state) => {
      if (state.phase === "failed") {
        logEvent({ k: "appUpdate.failed", reason: state.reason });
      }
      if (
        app.isPackaged
        && state.phase === "ready"
        && Notification.isSupported()
      ) {
        new Notification({
          title: "Guild Wars Reforged update ready",
          body: `Version ${state.latestVersion} is ready to install.`,
          silent: true,
        }).show();
      }
      input.publish();
    },
  });
  controller.restoreLastCheckedAt(input.lastUpdateCheckAt);
  autoUpdater.on("update-downloaded", () => {
    controller.updateDownloaded();
  });
  autoUpdater.on("error", () => {
    controller.updateFailed();
  });
  autoUpdater.on("update-not-available", () => {
    controller.updateNotAvailable();
  });

  const check = async (): Promise<void> => {
    await controller.check();
  };

  let updateRestartInFlight: Promise<void> | null = null;
  const restartAndInstall = (win: BrowserWindow): Promise<void> => {
    if (updateRestartInFlight) return updateRestartInFlight;
    const updater = controller;
    const operation = (async () => {
      if (updater.getState().phase !== "ready") return;
      if (windowRegistry.contextForWebContents(win.webContents.id)?.role === "game") {
        await resetGameInput(win);
      }
      if (windowRegistry.gameWindows().length > 0) {
        const { response } = await dialog.showMessageBox(win, {
          type: "warning",
          buttons: ["Restart and Update", "Later"],
          defaultId: 1,
          cancelId: 1,
          message: "Restart and update Guild Wars Reforged?",
          detail: "Open game windows will close. The downloaded update remains ready if you choose Later.",
        });
        if (response !== 0) return;
      }
      await runQuitCleanup();
      if (!updater.quitAndInstall()) app.exit(1);
    })().finally(() => {
      if (updateRestartInFlight === operation) updateRestartInFlight = null;
    });
    updateRestartInFlight = operation;
    return operation;
  };

  const startAutomaticChecks: UpdaterService["startAutomaticChecks"] = ({
    clientRuntime,
    sockets,
    attachSchedule,
  }) => {
    let automaticUpdateCheckInFlight = false;
    const maybeCheckForAppUpdates = async (): Promise<void> => {
      if (automaticUpdateCheckInFlight) return;
      automaticUpdateCheckInFlight = true;
      try {
        const current = await preferences.getSettings();
        if (
          !clientRuntime.active
          || clientRuntime.isDownloading
          || !periodicCheckDue({
            capable: input.capable,
            autoCheckUpdates: current.autoCheckUpdates,
            activeSockets: sockets.size(),
            lastUpdateCheckAt: current.lastUpdateCheckAt,
            now: Date.now(),
          })
        ) return;
        await check();
      } finally {
        automaticUpdateCheckInFlight = false;
      }
    };
    const scheduleAutomaticAppUpdateCheck = () => {
      void maybeCheckForAppUpdates();
    };
    attachSchedule(scheduleAutomaticAppUpdateCheck);
    // The same persisted due-time governs launch and background checks. A player
    // who restarts repeatedly therefore does not spend another network request
    // until the previous settled attempt is six hours old.
    scheduleAutomaticAppUpdateCheck();
    // A 30-minute tick with a six-hour due-time instead of a six-hour timer:
    // a laptop waking past the boundary checks within half an hour, with no
    // resume handler and no new diagnostic event. check() already coalesces,
    // so a due tick during a download or a ready update is a no-op.
    const periodicCheckTick = setInterval(() => {
      void (async () => {
        await maybeCheckForAppUpdates();
      })().catch(() => {
        // A periodic check is silent by contract; an unreadable settings file
        // already surfaces on the next explicit settings read.
      });
    }, PERIODIC_CHECK_TICK_MS);
    onAppQuit(() => {
      attachSchedule(null);
      clearInterval(periodicCheckTick);
    });
  };

  return {
    state: () => controller.getState(),
    check,
    restartAndInstall,
    startAutomaticChecks,
  };
}
