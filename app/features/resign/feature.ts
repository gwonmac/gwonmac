import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "resign",
  name: "Resign",
  summary: "Ask before sending /resign in PvE. Enter confirms; Escape cancels.",
  kind: "helpers",
  purpose: "fight",
  icon: "flag",
  settings: {
    /** Allow the confirmed PvE resign shortcut when Tools are enabled. */
    resignEnabled: featureSwitch(false, { tools: true }),
  },
  region: "pve",
  uses: ["resignAction"],
  tool: {
    id: "resign",
    event: "gw:resign-show",
  },
  shortcuts: [{ action: "game.resign", binding: null, menuItem: "resign-game" }],
  shots: [],
  parts: ["game"],
});
