import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "resign",
  name: "Resign",
  summary: "Ask before sending /resign in PvE. Enter confirms; Escape cancels.",
  kind: "party",
  presence: "action",
  icon: "flag",
  settings: {
    /** Allow the confirmed PvE resign shortcut when Tools are enabled. */
    resignEnabled: featureSwitch(false, { tools: true }),
  },
  region: "pve",
  uses: ["resignAction"],
  tool: {
    id: "resign",
  },
  shortcuts: [{ action: "game.resign", binding: null, menuItem: "resign-game" }],
  /** Its shortcut and menu item show the confirmation through `toggle` (shared/link.ts). */
  offers: ["toggle"],
  shots: [],
  parts: ["game"],
});
