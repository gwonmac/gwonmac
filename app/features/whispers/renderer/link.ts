/**
 * Owns what Whispers does when another Feature, the Hub or its shortcut calls its link
 * (../shared/link.ts): open the conversation in this session and show the panel, show or hide the
 * panel, or lend the session read-only. `toggle` reaches the panel while Whispers' game part runs
 * it and answers "unavailable" otherwise. While Guild Wars chat is not ready `open` opens nothing
 * and nothing waits for a later ⌘D (HUB-129).
 */
import type { WhisperSession } from "../../../shared/whisper-session.js";
import type { WhisperPeople, WhispersLink } from "../shared/link.js";

export function whispersLink(session: WhisperSession, toggle: WhispersLink["toggle"]): WhispersLink {
  const people: WhisperPeople = Object.freeze({
    get state() { return session.state; },
    subscribe: session.subscribe,
  });
  return Object.freeze({
    open(name: string) {
      if (!session.state.available) return "unavailable";
      session.open(name, { visible: false });
      toggle("show");
      return "opened";
    },
    people: () => people,
    toggle,
  });
}
