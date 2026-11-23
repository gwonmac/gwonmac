import type { CornerPosition } from "../../shared/corner-position.js";
import { readCornerPlacement } from "../../shared/overlay-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "targetReadout",
  name: "Target Distance",
  summary: "Show distance to the selected target in PvE.",
  kind: "fight",
  presence: "screen",
  icon: "crosshair",
  settings: {
    /** Experimental live target distance/range readout. */
    targetReadout: featureSwitch(false, { tools: true }),
    /** Where the player dragged the readout, as a distance from the nearest corner; null is the top centre. */
    targetReadoutPosition: setting.position(
      null,
      (value): CornerPosition | null | undefined => value === null ? null : readCornerPlacement(value),
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Target Distance position is invalid",
        launcherError: "Target Distance position is invalid",
        label: "Target Distance position",
        help: "Drag the readout in a game window to move it. Put back returns it to the top centre.",
        keywords: "move drag reset position",
      },
    ),
  },
  region: "pve",
  uses: ["targetObservation"],
  programs: ["target-observer"],
  tool: {
    id: "target-readout",
    keywords: "distance range",
  },
  shots: [],
  parts: ["game"],
});
