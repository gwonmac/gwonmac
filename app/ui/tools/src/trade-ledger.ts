/**
 * Owns Trade's feed model, without the DOM. Per market: which messages are live, held
 * or found, how an arriving message or re-post changes them, and which row is selected.
 * Per row set: which loaded messages the intent filter and the typed words keep, in the
 * feed's newest-first order, and where those words appear for highlighting. Searching
 * the feed stays upstream; this only narrows what is already loaded.
 */
import {
  TRADE_LIMITS,
  type TradeConnectionState,
  type TradeMessage,
} from "../../../shared/trade-chat";
import { characterKey } from "../../../shared/player-text";

/** One market's feed in the Trade window. */
export type TradeSourceState = {
  status: TradeConnectionState;
  live: TradeMessage[];
  /** Arrivals held while the reader is away from the top of the live rows. */
  pending: TradeMessage[];
  /** The last submitted search's results. */
  search: TradeMessage[];
  /** The selected offer, by its timestamp. */
  selection: number | null;
  /** Set when the selection is a saved offer that the inspector shows in place of a row. */
  savedSelection: number | null;
};

export function emptyTradeSource(): TradeSourceState {
  return {
    status: "unavailable",
    live: [],
    pending: [],
    search: [],
    selection: null,
    savedSelection: null,
  };
}

/** A selection that followed a re-post, from the replaced row to the new one. */
export type TradeFollow = Readonly<{ from: number; to: number }>;

function sameSender(left: TradeMessage | undefined, right: TradeMessage): boolean {
  return left !== undefined && characterKey(left.sender) === characterKey(right.sender);
}

/**
 * A re-post replaces the seller's older message. The selection follows it only to the
 * same seller; other arrivals never move the selection (HUB-013).
 */
function followReplacement(
  state: TradeSourceState,
  message: TradeMessage,
  replaced: TradeMessage | undefined,
): TradeFollow | null {
  const from = message.replacementTimestamp;
  if (from === undefined || state.selection !== from || !sameSender(replaced, message)) return null;
  state.selection = message.timestamp;
  return { from, to: message.timestamp };
}

/**
 * Takes one arriving message into a market's feed. Search results and the open
 * player's listings are snapshots, so a re-post replaces its row there in place. A new
 * message joins the live rows, or waits in `pending` while `holdArrivals` is set, and
 * the row it replaces stays until the queue merges. The selection follows a re-post
 * once its row is live.
 */
export function applyTradeMessage(
  state: TradeSourceState,
  message: TradeMessage,
  options: Readonly<{ holdArrivals: boolean; player: TradeMessage[] }>,
): Readonly<{ player: TradeMessage[]; followed: TradeFollow | null }> {
  const replacedAt = message.replacementTimestamp;
  const replaced = replacedAt === undefined ? undefined
    : [...state.live, ...state.pending, ...state.search, ...options.player]
      .find((candidate) => candidate.timestamp === replacedAt);
  let player = options.player;
  if (replacedAt !== undefined) {
    const inPlace = (messages: readonly TradeMessage[]) =>
      messages.map((candidate) => candidate.timestamp === replacedAt ? message : candidate);
    state.search = inPlace(state.search);
    player = inPlace(player);
  }
  if ([...state.live, ...state.pending].some((candidate) => candidate.timestamp === message.timestamp)) {
    return { player, followed: followReplacement(state, message, replaced) };
  }
  if (options.holdArrivals) {
    state.pending = insertTradeMessage(state.pending, message);
    return { player, followed: null };
  }
  state.live = insertTradeMessage(state.live, message);
  state.pending = state.pending.filter((candidate) => candidate.timestamp !== replacedAt);
  return { player, followed: followReplacement(state, message, replaced) };
}

/** Merges the held arrivals into the live rows, oldest hold first. */
export function commitPendingTrade(state: TradeSourceState): TradeFollow[] {
  if (!state.pending.length) return [];
  const arrivals = state.pending;
  state.pending = [];
  const follows: TradeFollow[] = [];
  for (const message of arrivals) {
    const replaced = state.live.find((candidate) => candidate.timestamp === message.replacementTimestamp);
    state.live = insertTradeMessage(state.live, message);
    const followed = followReplacement(state, message, replaced);
    if (followed) follows.push(followed);
  }
  return follows;
}

/** Loading or returning to a list keeps a shown selection and otherwise starts on the first row. */
export function keepOrSelectFirst(state: TradeSourceState, messages: readonly TradeMessage[]): void {
  if (state.savedSelection !== null) return;
  if (!messages.some((message) => message.timestamp === state.selection)) {
    state.selection = messages[0]?.timestamp ?? null;
  }
}

/** A message's age in the ledger's short form: now, 5m, 3h, 2d. */
export function tradeAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export type TradeIntent = "all" | "selling" | "buying";

export function tradeMessageIntents(message: string): Exclude<TradeIntent, "all">[] {
  const selling = /(?:^|[^a-z0-9])wts(?:$|[^a-z0-9])/iu.test(message);
  const buying = /(?:^|[^a-z0-9])wtb(?:$|[^a-z0-9])/iu.test(message);
  return [selling ? "selling" : null, buying ? "buying" : null]
    .filter((value): value is Exclude<TradeIntent, "all"> => value !== null);
}

/** The words of a typed filter: case-insensitive, in any order. */
function filterWords(text: string): string[] {
  return text.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
}

/** The loaded messages whose sender or text contains every typed word, order kept. */
export function tradeTextMatches(
  messages: readonly TradeMessage[],
  text: string,
): readonly TradeMessage[] {
  const words = filterWords(text);
  if (!words.length) return messages;
  return messages.filter((message) => {
    const haystack = `${message.sender} ${message.message}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function tradeLedgerRows(
  messages: readonly TradeMessage[],
  intent: TradeIntent,
): TradeMessage[] {
  return messages.filter((message) => matchesIntent(message, intent));
}

/**
 * A message split where the words appear. The highlight is visual only: the text
 * itself is unchanged, so selecting and copying it gives the original wording.
 */
export function tradeMatchSegments(
  message: string,
  text: string,
): { text: string; match: boolean }[] {
  const words = filterWords(text);
  const lower = message.toLocaleLowerCase();
  // Lowercase offsets index the original only when lowercasing keeps the length.
  if (!words.length || lower.length !== message.length) return [{ text: message, match: false }];
  const marked = new Array<boolean>(message.length).fill(false);
  for (const word of words) {
    for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + 1)) {
      marked.fill(true, at, at + word.length);
    }
  }
  const segments: { text: string; match: boolean }[] = [];
  for (let index = 0; index < message.length; index += 1) {
    const last = segments.at(-1);
    if (last && last.match === marked[index]) last.text += message[index];
    else segments.push({ text: message[index]!, match: marked[index]! });
  }
  return segments;
}

export function insertTradeMessage(
  messages: readonly TradeMessage[],
  message: TradeMessage,
  limit = TRADE_LIMITS.liveMessages,
): TradeMessage[] {
  const withoutReplacement = message.replacementTimestamp === undefined
    ? messages
    : messages.filter((candidate) => candidate.timestamp !== message.replacementTimestamp);
  if (withoutReplacement.some((candidate) => candidate.timestamp === message.timestamp)) {
    return [...withoutReplacement];
  }
  return [message, ...withoutReplacement]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit);
}

function matchesIntent(message: TradeMessage, intent: TradeIntent): boolean {
  return intent === "all" || tradeMessageIntents(message.message).includes(intent);
}
