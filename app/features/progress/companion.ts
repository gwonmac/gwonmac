/**
 * Progress in the game host: the character's progress from `game.progress`,
 * handed to Travel's link, because the Hub's Progress page lives in the Travel
 * app, which already owns the trip. Maps' quest route reads `game.progress` itself.
 *
 * This line also hosts the progress region's memory phases: the region keeps the
 * place in COMPANION_PARTS it had when Progress owned it (the heap layout), so the
 * line is written by hand and hands its session to the feature's `featurePart`.
 */
import type { GameProgressState } from "../../shared/game-progress.js";
import { featurePart, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

const WAITING: GameProgressState = Object.freeze({ status: "waiting", reason: "unavailable" });

export default {
  id: "progress",
  prepare(input) {
    const { progress } = input.substrates;
    let sequence = 0;
    const feature = featurePart("progress", ({ game, links }) => {
      const report = (state: GameProgressState) => links.travel?.showProgress(state);
      const unsubscribe = game.progress.subscribe((next) =>
        report(next === null ? WAITING : Object.freeze({ status: "ready", sequence: ++sequence, ...next })));
      // Stopping (character select, a map load, PvP) must not leave Travel's Progress page on
      // the last character's state.
      return { stop() { unsubscribe(); report(WAITING); } };
    }).prepare(input);
    return {
      ...progress.prepared,
      activate(context) {
        const memory = progress.session(context);
        const session = feature.activate(context);
        return { ...memory, ...session, syncFeeds() { session.syncFeeds?.(); memory.syncFeeds(); } };
      },
    };
  },
} satisfies ToolsCompanionPart;
