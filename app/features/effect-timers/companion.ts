/**
 * Effect Timers' game part: the player's effects from `game.effects`, written as
 * the time left on each native Effects icon through `ui.effectLabels`. Display only.
 */
import { featurePart } from "../../renderer/tools-companion-part.js";
import { effectTimerLabels } from "./renderer/effect-timer-labels.js";

export default featurePart("effectTimers", ({ game, ui }) => {
  const labels = ui.effectLabels.claim();
  const stop = game.effects.subscribe((effects) => labels.show(effectTimerLabels(effects)));
  return { stop() { stop(); labels.stop(); } };
});
