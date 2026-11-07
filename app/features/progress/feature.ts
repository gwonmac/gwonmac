import { defineFeature } from "../define.js";

/** Progress is a page of the Travel app, so it follows the Travel setting. */
export default defineFeature({
  id: "progress",
  activation: { kind: "setting", setting: "travelPalette", master: "gwonmacTools" },
  region: "pve",
  programs: ["toolbox-commands", "xunlai-storage"],
  capabilities: ["progressObservation"],
});
