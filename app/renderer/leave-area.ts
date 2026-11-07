/**
 * Owns the one "Leave this area?" step (D-27). Every Hub action that leaves an
 * explorable instance asks it with the same words, the same safe default and the
 * same arming: Stay here leads and has the keyboard, and "Leave and …" accepts
 * nothing until it has armed, and never the later click of a multi-click
 * (HUB-242, HUB-027). Travel and Travel and invite ask on the step's own page;
 * Characters asks inside its page with these words and this arming time.
 */
import { CONFIRMATION_ARMING_MS } from "./surface-controller.js";
import type { HubViewMount } from "../shared/hub.js";
import type { HubLeaveAreaProps } from "../shared/ui/hub-pages.js";

/** Stay here leads and takes the keyboard. */
const STAY = Object.freeze({ key: "leave-area-stay", seq: 1 });

export type LeaveAreaCopy = Readonly<{ question: string; detail: string; leave: string }>;

/** The question, its consequence and the leave button, naming the place or character. */
export function leaveAreaCopy(action: "travel" | "switch", target: string): LeaveAreaCopy {
  return action === "travel"
    ? {
      question: `Leave this area and travel to ${target}?`,
      detail: "Travelling leaves this explorable area. You may lose progress in this instance.",
      leave: `Leave and travel to ${target}`,
    }
    : {
      question: `Leave this area and switch to ${target}?`,
      detail: "Switching characters will leave this explorable area. You may lose progress in this instance.",
      leave: `Leave and switch to ${target}`,
    };
}

type LeaveAreaHub = Readonly<{
  showView(title: string, mount: HubViewMount<HTMLElement>): void;
  close(): void;
}>;

/**
 * Asks on a Hub page of its own, drawn by the kit (`leaveArea`). Stay here, Esc and Back return
 * to the page that asked, with its query and selection. "Leave and …" runs `leave`, then closes
 * the Hub. The promise settles with the outcome: it resolves once `leave` ran and rejects with
 * an AbortError when the player stays, so an action that waits on it (Travel and invite) stops
 * and reports nothing.
 */
export function askLeaveArea(hub: LeaveAreaHub, copy: LeaveAreaCopy, leave: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const stayed = () => {
      if (settled) return;
      settled = true;
      reject(new DOMException("The player stayed in the area.", "AbortError"));
    };
    hub.showView("Leave this area?", (target, back, footer, pages) => {
      let armed = false;
      const props = (): HubLeaveAreaProps => ({ ...copy, armed, focus: STAY, stay: () => back(), depart });
      function depart() {
        if (settled || !armed) return;
        settled = true;
        armed = false;
        page.update(props());
        void leave().then(() => { hub.close(); resolve(); }, (error: unknown) => { back(); reject(error); });
      }
      const page = pages.mount("leaveArea", target, props());
      const arming = setTimeout(() => { armed = true; page.update(props()); }, CONFIRMATION_ARMING_MS);
      // The footer names the safe choice, so Enter outside the buttons stays.
      footer.primary({ label: "Stay here", run: () => back() });
      return () => { clearTimeout(arming); page.dispose(); stayed(); };
    });
  });
}
