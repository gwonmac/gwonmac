/**
 * Owns what Whispers does when another Feature calls its link (../shared/link.ts): open the
 * conversation in this session and show the panel through Whispers' own command. While Guild
 * Wars chat is not ready it opens nothing and nothing waits for a later ⌘D (HUB-129).
 */
import type { WhisperSession } from "../../../shared/whisper-session.js";
import type { WhispersLink } from "../shared/link.js";

export function whispersLink(session: WhisperSession): WhispersLink {
  return Object.freeze({
    open(name: string) {
      if (!session.state.available) return "unavailable";
      session.open(name, { visible: false });
      window.dispatchEvent(new CustomEvent("gw:whispers-toggle", { cancelable: true, detail: "show" }));
      return "opened";
    },
  });
}
