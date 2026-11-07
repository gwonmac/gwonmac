import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "targetReadout",
  settings: {
    /** Experimental live target distance/range readout. */
    targetReadout: setting.boolean(false, { tools: true }),
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
