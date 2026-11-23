/**
 * Owns the confirmed, fixed Resign command while Resign runs. The certified game mailbox
 * performs submission without touching chat input. Its shortcut and menu item reach it
 * through its link (`toggle`), the Hub through its own row.
 */
import { createResignDialog, type ResignHandoff } from "./resign-dialog.js";
import { provideLink } from "../../../renderer/feature-links.js";
import { matchHubRows, type HubSource } from "../../../shared/hub.js";
import type { ResignLink } from "../shared/link.js";

/** Checks the certified exports; `start` runs the command until its `stop`. */
export function resignCommand(exports: WebAssembly.Exports) {
  const configure = exports.enhancement_configure_resign;
  const enqueue = exports.enhancement_resign;
  if (typeof configure !== "function" || typeof enqueue !== "function") {
    throw new Error("The certified Resign command is unavailable.");
  }
  return Object.freeze({ start: () => startResign((enabled) => configure(enabled), () => Number(enqueue())) });
}

function startResign(configure: (enabled: number) => unknown, enqueue: () => number) {
  let running = true;
  let dialog: ReturnType<typeof createResignDialog> | null = null;
  /** Shows the confirmation; a Hub row passes the handoff that returns to it on Cancel. */
  const show = (handoff?: ResignHandoff) => {
    dialog ??= createResignDialog(document.body, unavailable, () => {
      if (!running || enqueue() !== 1) {
        throw new Error("Guild Wars command queue is busy. Close this dialog and try again.");
      }
    });
    dialog.show(handoff);
  };
  /**
   * Resign's Hub row, from the one owner of its refusals: the reason shows before Enter
   * (HUB-135, HUB-251). The row hands the Hub over to the confirmation, and Cancel hands the
   * task back, with its search and selection (HUB-250).
   */
  const source: HubSource = {
    search(query) {
      if (!query.trim()) return [];
      const reason = unavailable();
      return matchHubRows([{
        id: "resign", iconKind: "resign", title: "Resign…", detail: "Asks before sending /resign · PvE only", keywords: "surrender give up",
        group: "Commands", action: "Review resign", consequential: true, destructive: true, ...(reason ? { unavailable: reason } : {}),
        run() {
          const hub = window.gwHub;
          if (!hub) { show(); return; }
          hub.suspend();
          show({ confirmed: () => hub.close(), cancelled: () => hub.resume() });
        },
      }], query);
    },
    setVisible() {},
    subscribe: () => () => {},
  };
  const link: ResignLink = Object.freeze({ toggle: () => { show(); return "shown" as const; } });
  configure(1);
  const stopLink = provideLink("resign", link);
  const detachHub = window.gwHub?.attach(source);
  return Object.freeze({
    stop() {
      running = false;
      detachHub?.();
      stopLink();
      dialog?.close();
      dialog?.dispose();
      configure(0);
    },
  });
}

function unavailable(): string | null {
  const context = window.gwCharacterSwitch?.context;
  if (context !== "outpost" && context !== "pve-explorable") {
    return "Resign is available in a PvE area with Features on.";
  }
  const field = document.getElementById("osk-input-text");
  if (field instanceof HTMLInputElement && field.value !== "") {
    return "Finish or clear your chat draft before resigning.";
  }
  if (!document.hasFocus()) return "Return to Guild Wars before resigning.";
  return null;
}
