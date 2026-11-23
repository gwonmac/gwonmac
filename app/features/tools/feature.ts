import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "tools",
  name: "Features",
  summary: "The optional extras GWonMac adds to Guild Wars, and how to play the plain game without them.",
  kind: "mode",
  icon: "sparkles",
  version: "1.0",
  settings: {
    /**
     * The launch mode: true loads Features at the next start, false is the plain game (a Core
     * launch). Players see the control inverted, as "Play the plain game", checked while false.
     */
    gwonmacTools: featureSwitch(false, {
      tools: true,
      label: "Play the plain game",
      help: "Turns off every Feature. Your Feature choices stay saved.",
    }),
  },
  region: "non-pvp",
  // This value gates native consumers. The Library host separately keeps
  // saved authoring selected without requiring live observation.
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  shots: [],
  parts: ["game"],
});
