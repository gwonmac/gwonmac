/**
 * Progress in the game host: the character's progress from `game.progress`,
 * handed to Travel's link, because the Hub's Progress page lives in the Travel
 * app, which already owns the trip. Maps' quest route reads `game.progress` itself.
 * The part wraps its `featurePart` only so each installation counts its sequence from
 * zero; the progress region is the gameProgress substrate's (tools-companion-substrates.ts).
 */
import type { GameProgressState } from "../../shared/game-progress.js";
import { featurePart, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

const WAITING: GameProgressState = Object.freeze({ status: "waiting", reason: "unavailable" });

export default {
  id: "progress",
  prepare(input) {
    let sequence = 0;
    return featurePart("progress", ({ game, links }) => {
      const report = (state: GameProgressState) => links.travel?.showProgress(state);
      const unsubscribe = game.progress.subscribe((next) =>
        report(next === null ? WAITING : Object.freeze({ status: "ready", sequence: ++sequence, ...next })));
      // Stopping (character select, a map load, PvP) must not leave Travel's Progress page on
      // the last character's state.
      return { stop() { unsubscribe(); report(WAITING); } };
    }).prepare(input);
  },
} satisfies ToolsCompanionPart;
