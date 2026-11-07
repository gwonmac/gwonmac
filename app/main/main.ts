/**
 * The entry point: the work that must precede `ready`, the single-instance
 * lock, the profile location, and the fatal-error paths.
 *
 * Everything after `ready` is built by `bootstrap.ts` in launch order. Feature
 * rules belong to the module main hands work to; a feature decision that
 * starts growing here should move to that owner.
 */
import { app } from "electron";
import path from "node:path";
import { errorCode } from "../shared/errors.js";
import { readHostVersion } from "./app-identity.js";
import { createAppShell } from "./app-shell.js";
import { startApp } from "./bootstrap.js";
import { logEvent } from "./diagnostics.js";
import { startFatalExit } from "./fatal-exit.js";
import { enableSandboxBeforeReady, wireLifecycle } from "./lifecycle.js";
import { registerGwScheme } from "./protocol.js";

// The public app name changed after alpha profiles already existed. Keep that
// one profile as the canonical home so the rename cannot strand saved login,
// settings, diagnostics, or roughly 4 GB of verified game data. An explicit
// profile remains authoritative for tests and the deliberately scoped tools.
if (!app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath("userData", path.join(app.getPath("appData"), "Guild Wars"));
}

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) {
  app.quit();
} else {
  enableSandboxBeforeReady();
  registerGwScheme();
  wireLifecycle();
}

const HOST_VERSION = readHostVersion();
const shell = createAppShell();

if (primaryInstance) app.on("second-instance", shell.revealMainWindow);

if (primaryInstance) void app.whenReady().then(() => startApp(shell, HOST_VERSION)).catch((error) => {
  startFatalExit(
    "app.startupFailed",
    error,
    "Guild Wars could not start",
    "Startup failed before the game window could open. Reopen the app and, if it repeats, report the problem.",
  );
});

if (primaryInstance) process.on("uncaughtException", (err) => {
  startFatalExit(
    "app.uncaughtException",
    err,
    "Guild Wars stopped unexpectedly",
    "A fatal application error occurred. After reopening, choose Help → Report a Bug.",
  );
});

if (primaryInstance) process.on("unhandledRejection", (reason) => {
  logEvent({ k: "app.unhandledRejection", code: errorCode(reason) });
});
