/**
 * Who ends a performance capture. A developer automation build drives it over
 * the Node IPC channel; every other build offers the player an export when a
 * capture stops.
 */
import { dialog } from "electron";
import { AUTOMATION_COMMAND } from "../shared/automation.js";
import type { AppSettings } from "../shared/contracts.js";
import { errorCode } from "../shared/errors.js";
import { ENHANCEMENT_AUTOMATION_ENABLED } from "../client/certification/enhancement-policy.js";
import {
  exportDiagnosticsForWindow,
  logEvent,
  setDiagnosticCaptureStoppedHandler,
  startDiagnosticCapture,
  stopDiagnosticCapture,
} from "./diagnostics.js";
import { exportDiagnosticsReport } from "./diagnostics-export.js";
import { resetGameInput } from "./renderer-commands.js";
import { windowRegistry } from "./window-registry.js";

export function wireCaptureControl(readSettings: () => Promise<AppSettings>): void {
  if (ENHANCEMENT_AUTOMATION_ENABLED) {
    process.on("message", (message) => {
      if (message === AUTOMATION_COMMAND.startLevel1Capture) {
        const win = windowRegistry.focusedOrSoleGameWindow();
        if (!win) {
          return;
        }
        const diagnosticOwnerId =
          windowRegistry.requireDiagnosticOwnerForWindow(win);
        void startDiagnosticCapture(win, 1).catch((error) => {
          logEvent({
            k: "capture.automationStartFailed",
            code: errorCode(error),
          }, diagnosticOwnerId);
        });
      } else if (message === AUTOMATION_COMMAND.stopCapture) {
        void stopDiagnosticCapture();
      }
    });
  } else {
    setDiagnosticCaptureStoppedHandler(async (win) => {
      if (!win || win.isDestroyed()) return;
      await resetGameInput(win);
      const { response } = await dialog.showMessageBox(win, {
        type: "info",
        buttons: ["Export Now…", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: "Performance capture finished",
        detail: "Export it now while the capture context is fresh.",
      });
      if (response === 0) {
        await exportDiagnosticsReport(win, () =>
          exportDiagnosticsForWindow(win, readSettings)
        );
      }
    });
  }
}
