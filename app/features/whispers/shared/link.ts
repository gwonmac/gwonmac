/**
 * Owns the link Whispers offers other Features and the Hub (its manifest `offers`). Whispers owns
 * the conversation; a caller only names the person, or reads who Whispers knows.
 */
import type { WhisperSession } from "../../../shared/whisper-session.js";

/** Whispers' session, read-only: its conversations, the people seen in chat and its source switches. */
export type WhisperPeople = Pick<WhisperSession, "state" | "subscribe">;

export type WhispersLink = Readonly<{
  /** Opens a conversation with `name` and shows the panel; "unavailable" while Guild Wars chat is not ready. */
  open(name: string): "opened" | "unavailable";
  /** Who Whispers knows, for the Hub's people search; "unavailable" while Whispers' part is not running. */
  people(): WhisperPeople | "unavailable";
}>;
