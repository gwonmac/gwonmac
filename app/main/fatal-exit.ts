/**
 * The one fatal-exit path: a startup failure or an uncaught exception records
 * its event, shows one native error, runs quit cleanup, and exits with code 1.
 */
import { app, dialog } from "electron";
import { errorCode } from "../shared/errors.js";
import { logEvent } from "./diagnostics.js";
import { runQuitCleanup } from "./lifecycle.js";

export const INJECT_STARTUP_FAILURE =
  !app.isPackaged && process.env.GW_TEST_STARTUP_FAILURE === "1";

let fatalExitStarted = false;

export function startFatalExit(
  event: "app.startupFailed" | "app.uncaughtException",
  error: unknown,
  title: string,
  detail: string,
): void {
  if (fatalExitStarted) return;
  fatalExitStarted = true;
  const code = errorCode(error);
  if (event === "app.startupFailed") {
    logEvent({ k: "app.startupFailed", code });
  } else {
    logEvent({ k: "app.uncaughtException", code });
  }
  // The injected failure is an unpackaged-only test seam. Production startup
  // failures are always visible; the deterministic process-exit test must not
  // wait on a native modal with no window available to dismiss it.
  if (!INJECT_STARTUP_FAILURE) {
    try {
      dialog.showErrorBox(title, detail);
    } catch {
      // Cleanup and lock release are still mandatory if the OS dialog fails.
    }
  }
  void runQuitCleanup().then(
    () => app.exit(1),
    () => app.exit(1),
  );
}
