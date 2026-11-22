import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "tools",
  name: "Features",
  summary: "Load your Features when the game starts. Turn this off to play the plain game.",
  kind: "mode",
  icon: "sparkles",
  settings: {
    /** The launch mode: on loads Features at the next start, off is the plain game (a Core launch). */
    gwonmacTools: setting.boolean(false, {
      tools: true,
      label: "Load Features",
      help: "Loads your Features at the next game start. Off plays the plain game, and your Feature choices stay saved.",
    }),
  },
  activation: { kind: "master", setting: "gwonmacTools" },
  region: "non-pvp",
  // This value gates native consumers. The Library host separately keeps
  // saved authoring selected without requiring live observation.
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  shots: [],
  parts: ["game"],
});
