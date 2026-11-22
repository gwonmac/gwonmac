/**
 * Alcohol Timer's game part: the alcohol estimate from `game.alcohol`, drawn by
 * the readout at the place the player saved in settings.
 *
 * The kernel forgets its estimate whenever nobody reads it, so the feature runs
 * through map loads (its region is `non-pvp`, which keeps an unknown area): a zone
 * change must not cost the countdown.
 */
import { featurePart } from "../../renderer/tools-companion-part.js";
import { createAlcoholTimerOverlay } from "./renderer/alcohol-timer-overlay.js";

export default featurePart("alcoholTimer", ({ game, settings }) => {
  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Enhancement alcohol overlay target is missing");
  const overlay = createAlcoholTimerOverlay(document.body, canvas,
    alcoholTimerPosition => window.gwNative.settings.set({ alcoholTimerPosition }));
  const stops = [
    settings.subscribe(({ alcoholTimerPosition }) => overlay.setPosition(alcoholTimerPosition)),
    game.alcohol.subscribe(overlay.setAlcohol),
  ];
  return { stop() { for (const stop of stops) stop(); overlay.dispose(); } };
});
