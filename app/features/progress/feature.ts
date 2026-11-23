import { defineFeature } from "../define.js";

/** Progress is a page of the Travel app: it has no switch of its own and runs while Travel does. */
export default defineFeature({
  id: "progress",
  name: "Progress",
  summary: "See what a title goal still needs for this character, one trip per missing place.",
  kind: "around",
  presence: "tool",
  icon: "list-checks",
  region: "pve",
  requires: ["travel"],
  /** Its page lives in Travel's Hub app, which gets the state through Travel's link. */
  links: { travel: ["showProgress"] },
  uses: ["progressObservation"],
  programs: ["toolbox-commands", "xunlai-storage"],
  shots: [],
  parts: ["game"],
});
