/**
 * Target Distance's game part: the selected target from `game.target`, drawn by
 * the readout at the place the player saved.
 */
import { featurePart } from "../../renderer/tools-companion-part.js";
import { createTargetReadout } from "./renderer/enhancement-readout.js";

export default featurePart("targetReadout", ({ game, settings }) => {
  // Every game window reads the place back from settings, so all of them follow a drag.
  const readout = createTargetReadout(document.body, {
    savePosition: targetReadoutPosition => { void window.gwNative.settings.set({ targetReadoutPosition }).catch(() => undefined); },
  });
  const stops = [
    settings.subscribe(({ targetReadoutPosition }) => readout.setPosition(targetReadoutPosition)),
    game.target.subscribe(readout.update),
  ];
  return { readout, stop() { for (const stop of stops) stop(); readout.dispose(); } };
}, { readout: (running) => running?.readout.state ?? null });
