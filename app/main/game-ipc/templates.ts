/**
 * The game window's template channels: exporting the game's saved build
 * templates to a folder the player chooses, and the account's template library.
 */
import { logEvent } from "../diagnostics.js";
import { channel } from "../ipc-channel-registry.js";
import { nothing, one } from "../ipc-values.js";
import { exportTemplates, parseExportEntries } from "../template-export.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

export default ({ accounts, windows }: GameIpcInput) => ({
  channels: {
    templatesExport: channel(one(parseExportEntries), async (win, entries) => {
      const ownerId = windows.requireDiagnosticOwnerForWindow(win);
      const result = await exportTemplates(win, entries);
      if (result.status === "written") {
        logEvent({ k: "templates.exported", count: result.count }, ownerId);
      } else if (result.status === "failed") {
        logEvent({ k: "templates.exportFailed", code: result.errorCode }, ownerId);
      }
      return result;
    }),
    profileTemplatesLoad: channel(nothing, (win) => accounts.loadTemplates(win)),
    profileTemplatesSave: channel(one(parseExportEntries), (win, entries) =>
      accounts.saveTemplates(win, entries)),
  } satisfies GameHandlers,
});
