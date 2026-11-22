/**
 * Owns what Whispers does when another Feature or the Hub calls its link (../shared/link.ts):
 * open the conversation in this session and show the panel through Whispers' own command, or
 * lend the session read-only. While Guild Wars chat is not ready `open` opens nothing and nothing
 * waits for a later ⌘D (HUB-129).
 */
import type { WhisperSession } from "../../../shared/whisper-session.js";
import type { WhisperPeople, WhispersLink } from "../shared/link.js";

export function whispersLink(session: WhisperSession): WhispersLink {
  const people: WhisperPeople = Object.freeze({
    get state() { return session.state; },
    subscribe: session.subscribe,
  });
  return Object.freeze({
    open(name: string) {
      if (!session.state.available) return "unavailable";
      session.open(name, { visible: false });
      window.dispatchEvent(new CustomEvent("gw:whispers-toggle", { cancelable: true, detail: "show" }));
      return "opened";
    },
    people: () => people,
  });
}
