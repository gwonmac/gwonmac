import type { CornerPosition } from "../../shared/corner-position.js";
import { readCornerPlacement } from "../../shared/overlay-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "targetReadout",
  settings: {
    /** Experimental live target distance/range readout. */
    targetReadout: setting.boolean(false, { tools: true }),
    /** Where the player dragged the readout, as a distance from the nearest corner; null is the top centre. */
    targetReadoutPosition: setting.value(
      null,
      (value): CornerPosition | null | undefined => value === null ? null : readCornerPlacement(value),
      { hub: true, rendererWritable: true, tools: true, error: "Target Distance position is invalid", launcherError: "Target Distance position is invalid" },
    ),
  },
  activation: { kind: "setting", setting: "targetReadout", master: "gwonmacTools" },
  region: "pve",
  programs: ["target-observer"],
  tool: {
    id: "target-readout",
    label: "Target Distance",
    description: "Show distance to the selected target in PvE.",
    keywords: "distance range",
  },
});
