/**
 * Trade's feed model without a mounted window: how an arriving message, a re-post
 * and the held queue change one market's rows and its selection (HUB-013).
 */
import { describe, expect, it } from "vitest";
import type { TradeMessage } from "../../../shared/trade-chat";
import {
  applyTradeMessage,
  commitPendingTrade,
  emptyTradeSource,
  keepOrSelectFirst,
  tradeAge,
  type TradeSourceState,
} from "./trade-ledger";

const offer = (timestamp: number, sender: string, replacementTimestamp?: number): TradeMessage => ({
  source: "kamadan",
  timestamp,
  sender,
  message: `WTS offer ${timestamp}`,
  ...(replacementTimestamp === undefined ? {} : { replacementTimestamp }),
});

const feed = (patch: Partial<TradeSourceState>): TradeSourceState => ({ ...emptyTradeSource(), ...patch });

describe("applyTradeMessage", () => {
  it.each([
    {
      what: "a re-post by the selected seller moves the selection to it",
      state: { live: [offer(10, "Mira")], selection: 10 },
      message: offer(20, "Mira", 10),
      selection: 20, live: [20], followed: { from: 10, to: 20 },
    },
    {
      what: "a re-post matches the seller in any letter case",
      state: { live: [offer(10, "mira")], selection: 10 },
      message: offer(20, "Mira", 10),
      selection: 20, live: [20], followed: { from: 10, to: 20 },
    },
    {
      what: "a message that names another seller's row as replaced never takes the selection",
      state: { live: [offer(10, "Mira")], selection: 10 },
      message: offer(20, "Rin", 10),
      selection: 10, live: [20], followed: null,
    },
    {
      what: "a re-post of an unselected row leaves the selection",
      state: { live: [offer(10, "Mira"), offer(5, "Rin")], selection: 5 },
      message: offer(20, "Mira", 10),
      selection: 5, live: [20, 5], followed: null,
    },
    {
      what: "a new message never moves the selection",
      state: { live: [offer(10, "Mira")], selection: 10 },
      message: offer(20, "Rin"),
      selection: 10, live: [20, 10], followed: null,
    },
    {
      what: "a message already live is not added twice but still carries the selection",
      state: { live: [offer(20, "Mira"), offer(10, "Mira")], selection: 10 },
      message: offer(20, "Mira", 10),
      selection: 20, live: [20, 10], followed: { from: 10, to: 20 },
    },
  ])("$what", ({ state: patch, message, selection, live, followed }) => {
    const state = feed(patch);
    const result = applyTradeMessage(state, message, { holdArrivals: false, player: [] });
    expect(state.selection).toBe(selection);
    expect(state.live.map((row) => row.timestamp)).toEqual(live);
    expect(result.followed).toEqual(followed);
  });

  it("holds a re-post while the reader is away from the top, and follows it only when the queue merges", () => {
    const state = feed({ live: [offer(10, "Mira")], selection: 10 });
    const held = applyTradeMessage(state, offer(20, "Mira", 10), { holdArrivals: true, player: [] });
    expect(held.followed).toBeNull();
    expect(state.selection).toBe(10);
    expect(state.live.map((row) => row.timestamp)).toEqual([10]);
    expect(state.pending.map((row) => row.timestamp)).toEqual([20]);

    expect(commitPendingTrade(state)).toEqual([{ from: 10, to: 20 }]);
    expect(state.selection).toBe(20);
    expect(state.live.map((row) => row.timestamp)).toEqual([20]);
    expect(state.pending).toEqual([]);
  });

  it("drops a held message once its own re-post goes live", () => {
    const state = feed({ pending: [offer(10, "Mira")] });
    applyTradeMessage(state, offer(20, "Mira", 10), { holdArrivals: false, player: [] });
    expect(state.pending).toEqual([]);
    expect(state.live.map((row) => row.timestamp)).toEqual([20]);
  });

  it("replaces a re-posted row in place in search results and the open player's listings", () => {
    const state = feed({ search: [offer(10, "Mira"), offer(5, "Rin")], selection: 10 });
    const player = [offer(10, "Mira"), offer(3, "Mira")];
    const result = applyTradeMessage(state, offer(20, "Mira", 10), { holdArrivals: false, player });
    expect(state.search.map((row) => row.timestamp)).toEqual([20, 5]);
    expect(result.player.map((row) => row.timestamp)).toEqual([20, 3]);
    expect(result.followed).toEqual({ from: 10, to: 20 });
  });

  it("returns the same player listing when nothing is replaced", () => {
    const player = [offer(10, "Mira")];
    expect(applyTradeMessage(feed({}), offer(20, "Rin"), { holdArrivals: false, player }).player).toBe(player);
  });
});

describe("keepOrSelectFirst", () => {
  it.each([
    { what: "keeps a selection that is still shown", selection: 5, saved: null, expected: 5 },
    { what: "starts on the first row when the selection left", selection: 7, saved: null, expected: 10 },
    { what: "never replaces a saved offer the inspector shows", selection: 7, saved: 7, expected: 7 },
  ])("$what", ({ selection, saved, expected }) => {
    const state = feed({ selection, savedSelection: saved });
    keepOrSelectFirst(state, [offer(10, "Mira"), offer(5, "Rin")]);
    expect(state.selection).toBe(expected);
  });
});

describe("tradeAge", () => {
  it.each([
    [59_999, "now"],
    [60_000, "1m"],
    [3_599_999, "59m"],
    [3_600_000, "1h"],
    [86_399_999, "23h"],
    [86_400_000, "1d"],
    [-5_000, "now"],
  ])("%i ms old reads %s", (elapsed, expected) => {
    expect(tradeAge(1_000_000_000 - elapsed, 1_000_000_000)).toBe(expected);
  });
});
