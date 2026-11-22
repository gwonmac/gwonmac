import { defineFeature } from "../define.js";

/** Progress is a page of the Travel app, so it follows the Travel setting. */
export default defineFeature({
  id: "progress",
  name: "Progress",
  summary: "See what a title goal still needs for this character, one trip per missing place.",
  kind: "maps",
  purpose: "around",
  icon: "list-checks",
  activation: { kind: "setting", setting: "travelPalette", master: "gwonmacTools" },
  region: "pve",
  requires: ["travel"],
  uses: ["progressObservation"],
  programs: ["toolbox-commands", "xunlai-storage"],
  shots: [],
  parts: ["game"],
});
